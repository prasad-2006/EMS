const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const LeaveRequest = require('../models/LeaveRequest');
const Notification = require('../models/Notification');
const Task = require('../models/Task');
const { sendReturnTomorrowReminder, sendCoveringDigest, sendLowBalanceWarning } = require('./emailService');
const { escalateOverdueGovernanceItems, pruneExpiredAuditEvents } = require('./governanceService');

const safeBackupFallback = { name: 'your backup colleague' };

/**
 * Initialize all scheduled jobs
 */
const initializeScheduledJobs = () => {
  console.log('🔔 Initializing scheduled jobs...');

  // Job 1: Daily - Check for employees returning today
  dailyReturnNotifications();

  // Job 2: Daily - Send digest to covering persons
  dailyCoveringPersonDigest();

  // Job 3: Daily - Check for overdue tasks while owner on leave
  dailyOverdueTaskCheck();

  // Job 4: Yearly - Carry forward leave balance on Jan 1
  yearlyCarryForward();

  // Job 5: Daily - Check for low leave balance
  dailyLowBalanceCheck();
  dailyGovernanceEscalation();
  dailyAuditRetention();

  console.log('✅ All scheduled jobs initialized');
};

const dailyGovernanceEscalation = () => {
  cron.schedule('0 11 * * *', async () => {
    try {
      const result = await escalateOverdueGovernanceItems();
      console.log(`Governance escalation: ${result.escalatedRisks} risks, ${result.escalatedIssues} issues`);
    } catch (error) {
      console.error('Governance escalation failed:', error.message);
    }
  });
};

const dailyAuditRetention = () => {
  cron.schedule('30 2 * * *', async () => {
    try {
      const result = await pruneExpiredAuditEvents();
      console.log(`Audit retention: removed ${result.deleted} events older than ${result.retentionDays} days`);
    } catch (error) {
      console.error('Audit retention failed:', error.message);
    }
  });
};

/**
 * Job 1: Daily at 8:00 AM - Notify returning employees and their backups
 */
const dailyReturnNotifications = () => {
  // Runs every day at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('🔔 [CRON] Running daily return notifications job...');
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = new Date(tomorrow.setHours(0, 0, 0, 0));
      const tomorrowEnd = new Date(tomorrow.setHours(23, 59, 59, 999));

      // Find leaves ending tomorrow
      const returningLeaves = await LeaveRequest.find({
        endDate: { $gte: tomorrowStart, $lte: tomorrowEnd },
        status: 'approved'
      }).populate('userId');

      for (const leave of returningLeaves) {
        const employee = leave.userId;

        // Find this employee's handed-over tasks that are still active
        const coveringTasks = await Task.find({
          assignedTo: employee._id,
          handedOverTo: { $exists: true, $ne: null },
          status: { $ne: 'done' }
        }).populate('handedOverTo', 'name email');

        // Pick a backup contact from active handed-over tasks if present
        const backup = coveringTasks[0]?.handedOverTo || safeBackupFallback;

        // Send notification to employee
        await Notification.create({
          userId: employee._id,
          type: 'reminder',
          category: 'info',
          title: 'Return to Work Tomorrow',
          message: `You're returning from leave tomorrow. You have ${coveringTasks.length} task(s) to review.`,
          priority: 'high',
          relatedEntity: { entityType: 'LeaveRequest', entityId: leave._id },
          sentBySystem: true
        });

        // Send email to employee
        if (employee.email) {
          await sendReturnTomorrowReminder(employee, backup);
        }

        console.log(`✅ Return notification sent to ${employee.name}`);
      }
    } catch (error) {
      console.error('❌ Error in daily return notifications:', error.message);
    }
  });
};

/**
 * Job 2: Daily at 9:00 AM - Send digest to backup persons covering tasks
 */
const dailyCoveringPersonDigest = () => {
  // Runs every weekday at 9:00 AM
  cron.schedule('0 9 * * 1-5', async () => {
    console.log('🔔 [CRON] Running covering person digest job...');
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Find all active leaves
      const activeLeaves = await LeaveRequest.find({
        startDate: { $lte: today },
        endDate: { $gte: today },
        status: 'approved'
      }).populate('userId');

      for (const leave of activeLeaves) {
        const employee = leave.userId;

        // Find all tasks handed over to anyone for this employee
        const handedOverTasks = await Task.find({
          assignedTo: employee._id,
          handedOverTo: { $exists: true, $ne: null },
          status: { $ne: 'done' }
        }).populate('handedOverTo');

        // Group by covering person
        const groupedByBackup = {};
        for (const task of handedOverTasks) {
          const backupId = task.handedOverTo._id.toString();
          if (!groupedByBackup[backupId]) {
            groupedByBackup[backupId] = {
              backup: task.handedOverTo,
              tasks: []
            };
          }
          groupedByBackup[backupId].tasks.push(task);
        }

        // Send digest to each backup
        for (const backupId in groupedByBackup) {
          const { backup, tasks } = groupedByBackup[backupId];

          // Create in-app notification
          await Notification.create({
            userId: backup._id,
            type: 'reminder',
            category: 'info',
            title: `You're covering ${tasks.length} task(s) for ${employee.name}`,
            message: `Daily digest: ${tasks.length} active task(s) you're covering`,
            priority: 'normal',
            relatedEntity: { entityType: 'User', entityId: employee._id },
            sentBySystem: true
          });

          // Send email digest
          if (backup.email) {
            await sendCoveringDigest(backup, tasks);
          }

          console.log(`✅ Covering digest sent to ${backup.name} (${tasks.length} tasks)`);
        }
      }
    } catch (error) {
      console.error('❌ Error in covering person digest:', error.message);
    }
  });
};

/**
 * Job 3: Daily at 10:00 AM - Check for overdue tasks of employees on leave
 */
const dailyOverdueTaskCheck = () => {
  // Runs every day at 10:00 AM
  cron.schedule('0 10 * * *', async () => {
    console.log('🔔 [CRON] Running overdue task check job...');
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find employees currently on leave
      const onLeaveEmployees = await LeaveRequest.find({
        startDate: { $lte: today },
        endDate: { $gte: today },
        status: 'approved'
      }).populate('userId');

      for (const leave of onLeaveEmployees) {
        const employee = leave.userId;

        // Find overdue tasks assigned to this employee
        const overdueTasks = await Task.find({
          assignedTo: employee._id,
          deadline: { $lt: today },
          status: { $in: ['todo', 'in-progress'] }
        }).populate('createdBy');

        if (overdueTasks.length > 0) {
          // Get employee's manager
          const manager = await User.findById(employee.managerId);

          if (manager) {
            // Create notification for manager
            await Notification.create({
              userId: manager._id,
              type: 'alert',
              category: 'warning',
              title: `⚠️ ${overdueTasks.length} overdue task(s) for ${employee.name}`,
              message: `${employee.name} is on leave with ${overdueTasks.length} overdue task(s)`,
              priority: 'high',
              relatedEntity: { entityType: 'User', entityId: employee._id },
              sentBySystem: true
            });

            console.log(`⚠️ Escalated ${overdueTasks.length} overdue task(s) for ${employee.name} to ${manager.name}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in overdue task check:', error.message);
    }
  });
};

/**
 * Job 4: Yearly on Jan 1 at 00:01 AM - Carry forward unused leave balance
 */
const yearlyCarryForward = () => {
  // Runs on Jan 1 at 00:01 AM
  cron.schedule('1 0 1 1 *', async () => {
    console.log('🔔 [CRON] Running yearly carry forward job...');
    try {
      const users = await User.find({});

      for (const user of users) {
        // Get default policy
        const Policy = require('../models/LeavePolicy');
        const policy = await Policy.findOne({});

        if (policy && policy.carryForwardRules) {
          const carryForwardConfig = policy.carryForwardRules;

          // Process each leave type
          const leaveTypes = ['annual', 'sick', 'casual', 'earned'];
          for (const leaveType of leaveTypes) {
            const configKey = `${leaveType}CarryForward`;
            if (carryForwardConfig[configKey] && user.leaveBalance[leaveType] > 0) {
              const maxCarryForward = carryForwardConfig[`${leaveType}MaxCarryForward`] || 5;
              const carryForwardDays = Math.min(user.leaveBalance[leaveType], maxCarryForward);

              // Add to next year's balance
              user.leaveBalance[leaveType] = carryForwardDays;
              
              // Create notification
              await Notification.create({
                userId: user._id,
                type: 'policy',
                category: 'info',
                title: `${carryForwardDays} days of ${leaveType} leave carried forward`,
                message: `Your unused ${leaveType} leave has been carried forward to the new year.`,
                priority: 'normal',
                sentBySystem: true
              });
            } else {
              // Reset to yearly allocation
              const allocationKey = `${leaveType}PerYear`;
              user.leaveBalance[leaveType] = carryForwardConfig[allocationKey] || 10;
            }
          }

          await user.save();
          console.log(`✅ Carry forward processed for ${user.name}`);
        }
      }
    } catch (error) {
      console.error('❌ Error in yearly carry forward:', error.message);
    }
  });
};

/**
 * Job 5: Daily at 5:00 PM - Check for low leave balance (<2 days)
 */
const dailyLowBalanceCheck = () => {
  // Runs every day at 5:00 PM
  cron.schedule('0 17 * * *', async () => {
    console.log('🔔 [CRON] Running low balance check job...');
    try {
      const users = await User.find({});

      for (const user of users) {
        const totalBalance = (user.leaveBalance.annual || 0) + 
                           (user.leaveBalance.sick || 0) + 
                           (user.leaveBalance.casual || 0);

        if (totalBalance > 0 && totalBalance < 2) {
          // Create notification
          await Notification.create({
            userId: user._id,
            type: 'alert',
            category: 'warning',
            title: `⚠️ Low Leave Balance: ${totalBalance} day(s) remaining`,
            message: `You have only ${totalBalance} day(s) of leave remaining. Plan accordingly.`,
            priority: 'high',
            sentBySystem: true
          });

          // Send email
          if (user.email) {
            await sendLowBalanceWarning(user, {
              remaining: totalBalance,
              annual: user.leaveBalance.annual || 0,
              sick: user.leaveBalance.sick || 0,
              casual: user.leaveBalance.casual || 0
            });
          }

          console.log(`⚠️ Low balance warning sent to ${user.name}`);
        }
      }
    } catch (error) {
      console.error('❌ Error in low balance check:', error.message);
    }
  });
};

module.exports = { initializeScheduledJobs };
