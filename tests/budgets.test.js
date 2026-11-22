import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBudget,
  addBudget,
  updateBudget,
  deleteBudget,
  resolveBudget,
  calculateBudgetUtilization,
  calculateAllBudgetsUtilization,
  getAllBudgets
} from '../js/budgets.js';
import { resetStorage } from '../js/storage.js';
import { BUDGET_THRESHOLDS, TRANSACTION_TYPES } from '../js/constants.js';

test.beforeEach(() => {
  resetStorage();
});

test('Budgets: validates valid default and override budget candidates', () => {
  // Default recurring budget
  const defaultBudget = {
    category: 'groceries',
    limitPaise: 1500000,
    month: null
  };
  assert.strictEqual(validateBudget(defaultBudget).valid, true);

  // Month-specific override budget
  const overrideBudget = {
    category: 'groceries',
    limitPaise: 2000000,
    month: '2026-11'
  };
  assert.strictEqual(validateBudget(overrideBudget).valid, true);
});

test('Budgets: rejects invalid category or non-positive limit', () => {
  // Non-expense category
  const invalidCategory = {
    category: 'monthly_salary', // Income category
    limitPaise: 1000000,
    month: null
  };
  assert.strictEqual(validateBudget(invalidCategory).valid, false);

  // Zero limit
  const zeroLimit = {
    category: 'groceries',
    limitPaise: 0,
    month: null
  };
  assert.strictEqual(validateBudget(zeroLimit).valid, false);

  // Negative limit
  const negativeLimit = {
    category: 'groceries',
    limitPaise: -50000,
    month: null
  };
  assert.strictEqual(validateBudget(negativeLimit).valid, false);

  // Invalid month format
  const invalidMonth = {
    category: 'groceries',
    limitPaise: 100000,
    month: '2026-13' // Invalid month 13
  };
  assert.strictEqual(validateBudget(invalidMonth).valid, false);
});

test('Budgets: creates recurring default budget and month-specific override', () => {
  // 1. Add recurring default budget
  const defaultBudget = addBudget({
    category: 'groceries',
    limitPaise: 1500000,
    month: null
  });

  assert.strictEqual(defaultBudget.category, 'groceries');
  assert.strictEqual(defaultBudget.month, null);

  // 2. Add override for a specific month (e.g., festival/holiday month November)
  const overrideBudget = addBudget({
    category: 'groceries',
    limitPaise: 2500000,
    month: '2026-11'
  });

  assert.strictEqual(overrideBudget.category, 'groceries');
  assert.strictEqual(overrideBudget.month, '2026-11');

  assert.strictEqual(getAllBudgets().length, 2);
});

test('Budgets: enforces priority resolution (override > default > null)', () => {
  const budgets = [
    { id: 'b1', category: 'groceries', limitPaise: 1500000, month: null }, // Default: ₹15,000
    { id: 'b2', category: 'groceries', limitPaise: 2500000, month: '2026-11' }, // Override for Nov: ₹25,000
    { id: 'b3', category: 'utilities', limitPaise: 600000, month: null } // Default: ₹6,000
  ];

  // In November: groceries should resolve to the override limit (₹25,000)
  const novGroceries = resolveBudget(budgets, 'groceries', '2026-11');
  assert.strictEqual(novGroceries.limitPaise, 2500000);
  assert.strictEqual(novGroceries.isOverride, true);

  // In December: groceries should automatically fall back to recurring default (₹15,000)
  const decGroceries = resolveBudget(budgets, 'groceries', '2026-12');
  assert.strictEqual(decGroceries.limitPaise, 1500000);
  assert.strictEqual(decGroceries.isOverride, false);

  // In November: utilities has no override, should resolve to default (₹6,000)
  const novUtilities = resolveBudget(budgets, 'utilities', '2026-11');
  assert.strictEqual(novUtilities.limitPaise, 600000);
  assert.strictEqual(novUtilities.isOverride, false);

  // Category with no budget should resolve to null
  const noBudget = resolveBudget(budgets, 'entertainment', '2026-11');
  assert.strictEqual(noBudget, null);
});

test('Budgets: prevents duplicate default budgets and duplicate month overrides', () => {
  addBudget({
    category: 'transport',
    limitPaise: 800000,
    month: null
  });

  // Attempting second default for 'transport' must throw
  assert.throws(() => {
    addBudget({
      category: 'transport',
      limitPaise: 900000,
      month: null
    });
  }, /already exists/);

  // Adding an override for Nov 2026 is allowed
  addBudget({
    category: 'transport',
    limitPaise: 1200000,
    month: '2026-11'
  });

  // Attempting second override for Nov 2026 must throw
  assert.throws(() => {
    addBudget({
      category: 'transport',
      limitPaise: 1300000,
      month: '2026-11'
    });
  }, /already exists/);
});

test('Budgets: calculates spending and threshold levels correctly (Green, Amber, Red)', () => {
  const budget = {
    id: 'b1',
    category: 'groceries',
    limitPaise: 1000000, // ₹10,000 limit
    month: '2026-11'
  };

  // Case 1: 50% spent -> Normal (Green)
  const txns50 = [
    { type: TRANSACTION_TYPES.EXPENSE, category: 'groceries', amountPaise: 500000, date: '2026-11-05' }
  ];
  const util50 = calculateBudgetUtilization(budget, txns50, '2026-11');
  assert.strictEqual(util50.spentPaise, 500000);
  assert.strictEqual(util50.remainingPaise, 500000);
  assert.strictEqual(util50.percentUsed, 50.0);
  assert.strictEqual(util50.status, BUDGET_THRESHOLDS.STATUS.NORMAL); // Green

  // Case 2: 75% spent -> Warning (Amber)
  const txns75 = [
    { type: TRANSACTION_TYPES.EXPENSE, category: 'groceries', amountPaise: 750000, date: '2026-11-05' }
  ];
  const util75 = calculateBudgetUtilization(budget, txns75, '2026-11');
  assert.strictEqual(util75.percentUsed, 75.0);
  assert.strictEqual(util75.status, BUDGET_THRESHOLDS.STATUS.WARNING); // Amber

  // Case 3: 96% spent -> Danger (Red)
  const txns96 = [
    { type: TRANSACTION_TYPES.EXPENSE, category: 'groceries', amountPaise: 960000, date: '2026-11-05' }
  ];
  const util96 = calculateBudgetUtilization(budget, txns96, '2026-11');
  assert.strictEqual(util96.percentUsed, 96.0);
  assert.strictEqual(util96.status, BUDGET_THRESHOLDS.STATUS.DANGER); // Red

  // Case 4: 120% spent -> Overspent, Danger (Red), negative remaining
  const txns120 = [
    { type: TRANSACTION_TYPES.EXPENSE, category: 'groceries', amountPaise: 1200000, date: '2026-11-05' }
  ];
  const util120 = calculateBudgetUtilization(budget, txns120, '2026-11');
  assert.strictEqual(util120.spentPaise, 1200000);
  assert.strictEqual(util120.remainingPaise, -200000);
  assert.strictEqual(util120.isOverspent, true);
  assert.strictEqual(util120.status, BUDGET_THRESHOLDS.STATUS.DANGER);
});
