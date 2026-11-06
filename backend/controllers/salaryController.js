const User = require('../models/User');
const LeaveRequest = require('../models/LeaveRequest');
const DeductionLedger = require('../models/DeductionLedger');
const Task = require('../models/Task');
const mongoose = require('mongoose');

const DEFAULT_MONTHLY_BASE = 60000;
const DAYS_PER_MONTH = 30;

const toId = (value) => {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch (err) {
    return null;
  }
};

const parseMonth = (monthParam) => {
  const now = new Date();
  const [year, month] = String(monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    .split('-')
    .map(Number);
  const monthStart = new Date(year, (month || 1) - 1, 1);
  const monthEnd = new Date(year, month || 1, 0, 23, 59, 59, 999);
  return { monthStart, monthEnd, label: `${year}-${String(month).padStart(2, '0')}` };
};

const getLeaveDaysInMonth = async (userId, monthStart, monthEnd) => {
  const approvedLeaves = await LeaveRequest.find({
    userId,
    status: 'approved',
    startDate: { $lte: monthEnd },
    endDate: { $gte: monthStart }
  }).select('dayCalculation totalDays startDate endDate');

  let totalDays = 0;
  approvedLeaves.forEach((leave) => {
    totalDays += Number(leave.dayCalculation?.chargeableDays) || Number(leave.totalDays) || 0;
  });
  return { days: totalDays, leaves: approvedLeaves };
};

const getCoverageBonus = async (userId, monthStart, monthEnd) => {
  const coverageTasks = await Task.find({
    assignedTo: userId,
    isCoverageTask: true,
    status: { $ne: 'cancelled' },
    coverageAcceptedAt: { $lte: monthEnd },
    $or: [
      { coverageAcceptedAt: { $gte: monthStart } },
      { coverageAcceptedAt: null }
    ]
  }).select('coverageBonus');

  const totalBonus = coverageTasks.reduce((sum, task) => sum + (Number(task.coverageBonus) || 0), 0);
  // Also include any distributed leave-deduction compensation.
  // If DEDUCTION_REQUIRE_LEDGER_APPROVAL=true, only include approved ledger entries.
  let distributionSum = 0;
  try {
    if (process.env.DEDUCTION_REQUIRE_LEDGER_APPROVAL === 'true') {
      const ledgerEntries = await DeductionLedger.find({
        toUser: userId,
        status: 'approved',
        createdAt: { $lte: monthEnd, $gte: monthStart }
      }).select('amount');
      ledgerEntries.forEach((le) => { distributionSum += Number(le.amount) || 0; });
    } else {
      const leaves = await LeaveRequest.find({
        'deductionDistribution.userId': userId,
        startDate: { $lte: monthEnd },
        endDate: { $gte: monthStart }
      }).select('deductionDistribution');

      leaves.forEach((leave) => {
        (leave.deductionDistribution || []).forEach((entry) => {
          if (String(entry.userId) === String(userId)) {
            distributionSum += Number(entry.amount) || 0;
          }
        });
      });
    }
  } catch (err) {
    console.error('Error while summing deduction distributions:', err);
  }

  return { totalBonus: totalBonus + distributionSum, tasks: coverageTasks.length };
};

const buildSalaryReport = async (user, monthParam) => {
  const { monthStart, monthEnd, label } = parseMonth(monthParam);
  const monthlyBase = Number(user.salary?.monthlyBase) || DEFAULT_MONTHLY_BASE;
  const currency = user.salary?.currency || 'INR';
  const perDayRate = monthlyBase / DAYS_PER_MONTH;

  const [{ days: leaveDays, leaves }, { totalBonus: extraPay, tasks: coverageTaskCount }] = await Promise.all([
    getLeaveDaysInMonth(user._id, monthStart, monthEnd),
    getCoverageBonus(user._id, monthStart, monthEnd)
  ]);

  const leaveDeduction = Math.round(leaveDays * perDayRate);

  return {
    userId: user._id,
    month: label,
    monthlyBase,
    currency,
    perDayRate: Math.round(perDayRate),
    leaveDays,
    leaveDeduction,
    extraPay,
    coverageTaskCount,
    netPay: monthlyBase - leaveDeduction + extraPay
  };
};

// @desc    Get own salary report for a month
// @route   GET /api/salary/me
// @query   month=YYYY-MM (defaults to current month)
// @access  Private
const getMySalary = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const report = await buildSalaryReport(user, req.query.month);
    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Server error while fetching salary report' });
  }
};

// @desc    Get salary report for a specific employee (Admin)
// @route   GET /api/salary/:userId
// @access  Private/Admin
const getSalaryByUser = async (req, res) => {
  try {
    const userId = toId(req.params.userId);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Invalid user id' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const report = await buildSalaryReport(user, req.query.month);
    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Server error while fetching salary report' });
  }
};

// @desc    Get salary reports for all employees (Admin)
// @route   GET /api/salary/all
// @access  Private/Admin
const getAllSalaries = async (req, res) => {
  try {
    const users = await User.find({ role: 'employee' }).select('name email employeeId department designation salary status').populate('department', 'name code');
    const reports = await Promise.all(users.map((user) => buildSalaryReport(user, req.query.month)));

    const totalBase = reports.reduce((sum, report) => sum + report.monthlyBase, 0);
    const totalDeduction = reports.reduce((sum, report) => sum + report.leaveDeduction, 0);
    const totalExtraPay = reports.reduce((sum, report) => sum + report.extraPay, 0);

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
      summary: {
        totalBase,
        totalDeduction,
        totalExtraPay,
        totalNetPay: totalBase - totalDeduction + totalExtraPay
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server error while fetching salary reports' });
  }
};

// @desc    Set an employee's monthly base salary (Admin)
// @route   PUT /api/salary/:userId
// @access  Private/Admin
const updateSalary = async (req, res) => {
  try {
    const userId = toId(req.params.userId);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Invalid user id' });
    }

    const { monthlyBase, perDayDeductionRate, currency } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (monthlyBase !== undefined && (Number(monthlyBase) < 0 || Number.isNaN(Number(monthlyBase)))) {
      return res.status(400).json({ success: false, error: 'Monthly base salary must be a non-negative number' });
    }

    user.salary = {
      monthlyBase: monthlyBase !== undefined ? Number(monthlyBase) : (user.salary?.monthlyBase || DEFAULT_MONTHLY_BASE),
      perDayDeductionRate: perDayDeductionRate !== undefined ? Number(perDayDeductionRate) : (user.salary?.perDayDeductionRate ?? null),
      currency: currency || user.salary?.currency || 'INR',
      updatedBy: req.user._id,
      updatedAt: new Date()
    };
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Salary updated successfully',
      data: user.salary
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Server error while updating salary' });
  }
};

module.exports = { getMySalary, getSalaryByUser, getAllSalaries, updateSalary };