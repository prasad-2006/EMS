const DEFAULT_MONTHLY_BASE = 60000;

/**
 * Distribution modes:
 * - 'weighted' : proportional to task.coverageBonus (default, existing behavior)
 * - 'equal'    : equal share across coverers
 * - 'per_task' : allocate per-task (each task's share goes to its assignee)
 */
const mode = process.env.DEDUCTION_DISTRIBUTION_MODE || 'weighted';

const distribute = async (leave, coverageTasks = []) => {
  const leaverMonthly = Number(leave.leaverMonthlyBase) || DEFAULT_MONTHLY_BASE;
  // backward compatibility: try to fetch from leave.user -> caller can pass monthlyBase; if not, leave.leaverMonthlyBase fallback handled by caller
  const monthlyBase = leaverMonthly;
  const perDay = monthlyBase / 30;
  const deductionTotal = Math.round((Number(leave.totalDays) || 0) * perDay);

  const map = new Map();

  if (coverageTasks.length === 0) {
    return { deductionTotal: deductionTotal, distribution: [] };
  }

  if (mode === 'equal') {
    const coverers = [...new Set(coverageTasks.map((t) => String(t.assignedTo)))];
    const baseShare = Math.floor(deductionTotal / coverers.length) || 0;
    const distribution = coverers.map((uid, idx) => ({ userId: uid, amount: baseShare, taskIds: coverageTasks.filter(t=>String(t.assignedTo)===uid).map(t=>t._id) }));
    const allocated = distribution.reduce((s, d) => s + d.amount, 0);
    const diff = deductionTotal - allocated;
    if (diff !== 0 && distribution.length > 0) distribution[0].amount += diff;
    return { deductionTotal, distribution };
  }

  if (mode === 'per_task') {
    // assign each task an equal per-task share
    const perTask = Math.floor(deductionTotal / coverageTasks.length) || 0;
    const distributionMap = new Map();
    for (const t of coverageTasks) {
      const uid = String(t.assignedTo);
      if (!distributionMap.has(uid)) distributionMap.set(uid, { amount: 0, taskIds: [] });
      distributionMap.get(uid).amount += perTask;
      distributionMap.get(uid).taskIds.push(t._id);
    }
    const distribution = Array.from(distributionMap.entries()).map(([userId, info]) => ({ userId, amount: info.amount, taskIds: info.taskIds }));
    const allocated = distribution.reduce((s, d) => s + d.amount, 0);
    const diff = deductionTotal - allocated;
    if (diff !== 0 && distribution.length > 0) distribution[0].amount += diff;
    return { deductionTotal, distribution };
  }

  // default: weighted by coverageBonus
  let totalWeight = 0;
  for (const t of coverageTasks) {
    const uid = String(t.assignedTo);
    const w = Number(t.coverageBonus) || 1;
    if (!map.has(uid)) map.set(uid, { weight: 0, taskIds: [] });
    map.get(uid).weight += w;
    map.get(uid).taskIds.push(t._id);
    totalWeight += w;
  }

  const distribution = [];
  if (totalWeight > 0) {
    let allocated = 0;
    for (const [uid, info] of map.entries()) {
      const share = Math.round(deductionTotal * (info.weight / totalWeight));
      distribution.push({ userId: uid, amount: share, taskIds: info.taskIds });
      allocated += share;
    }
    const diff = deductionTotal - allocated;
    if (diff !== 0 && distribution.length > 0) distribution[0].amount += diff;
  }

  return { deductionTotal, distribution };
};

module.exports = { distribute };
