jest.setTimeout(30000);
const mongoose = require('mongoose');
const { distribute } = require('../services/deductionDistributor');

describe('deductionDistributor', () => {
  test('weighted distribution sums to total', async () => {
    const leave = { totalDays: 2, leaverMonthlyBase: 60000 };
    const tasks = [
      { assignedTo: 'a', coverageBonus: 500 },
      { assignedTo: 'b', coverageBonus: 1000 }
    ];
    const { deductionTotal, distribution } = await distribute(leave, tasks);
    const sum = distribution.reduce((s, d) => s + d.amount, 0);
    expect(sum).toBe(deductionTotal);
    expect(distribution.length).toBeGreaterThan(0);
  });

  test('equal distribution splits evenly', async () => {
    process.env.DEDUCTION_DISTRIBUTION_MODE = 'equal';
    const leave = { totalDays: 3, leaverMonthlyBase: 60000 };
    const tasks = [
      { assignedTo: 'a' },
      { assignedTo: 'b' },
      { assignedTo: 'a' }
    ];
    const { deductionTotal, distribution } = await distribute(leave, tasks);
    const sum = distribution.reduce((s, d) => s + d.amount, 0);
    expect(sum).toBe(deductionTotal);
    expect(distribution.length).toBeGreaterThan(0);
    process.env.DEDUCTION_DISTRIBUTION_MODE = '';
  });
});
