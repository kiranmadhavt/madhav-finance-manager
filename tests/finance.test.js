import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMonthlyIncome,
  calculateMonthlyExpenses,
  calculateMonthlyInvestments,
  calculateNetSurplus,
  calculateSavingsRate,
  calculateMonthlySummary,
  calculateCategoryBreakdown,
  calculateTrendHistory
} from '../js/finance.js';
import { TRANSACTION_TYPES } from '../js/constants.js';
import { formatINR } from '../js/utils.js';

test('Finance Engine: calculates monthly income correctly', () => {
  const transactions = [
    { type: TRANSACTION_TYPES.INCOME, amountPaise: 8000000, date: '2026-11-01' },
    { type: TRANSACTION_TYPES.INCOME, amountPaise: 1500000, date: '2026-11-15' },
    { type: TRANSACTION_TYPES.INCOME, amountPaise: 5000000, date: '2026-10-31' }, // Different month
    { type: TRANSACTION_TYPES.EXPENSE, amountPaise: 2000000, date: '2026-11-10' }
  ];

  const income = calculateMonthlyIncome(transactions, '2026-11');
  assert.strictEqual(income, 9500000); // ₹95,000 in paise
});

test('Finance Engine: calculates monthly expenses excluding investments', () => {
  const transactions = [
    { type: TRANSACTION_TYPES.EXPENSE, amountPaise: 2500000, date: '2026-11-02' },
    { type: TRANSACTION_TYPES.EXPENSE, amountPaise: 1000000, date: '2026-11-12' },
    { type: TRANSACTION_TYPES.INVESTMENT, amountPaise: 1500000, date: '2026-11-05' }, // Investment excluded
    { type: TRANSACTION_TYPES.EXPENSE, amountPaise: 500000, date: '2026-12-01' } // Different month
  ];

  const expenses = calculateMonthlyExpenses(transactions, '2026-11');
  assert.strictEqual(expenses, 3500000); // ₹35,000 in paise
});

test('Finance Engine: calculates monthly investments separately', () => {
  const transactions = [
    { type: TRANSACTION_TYPES.INVESTMENT, amountPaise: 1000000, date: '2026-11-05' },
    { type: TRANSACTION_TYPES.INVESTMENT, amountPaise: 500000, date: '2026-11-20' },
    { type: TRANSACTION_TYPES.EXPENSE, amountPaise: 500000, date: '2026-11-10' }
  ];

  const investments = calculateMonthlyInvestments(transactions, '2026-11');
  assert.strictEqual(investments, 1500000); // ₹15,000 in paise
});

test('Finance Engine: calculates net monthly surplus (Income - Expenses - Investments)', () => {
  // Example from specification: Income ₹80,000, Expenses ₹35,000, Investments ₹15,000 -> Surplus ₹30,000
  const incomePaise = 8000000;
  const expensePaise = 3500000;
  const investmentPaise = 1500000;

  const surplus = calculateNetSurplus(incomePaise, expensePaise, investmentPaise);
  assert.strictEqual(surplus, 3000000); // ₹30,000 in paise
});

test('Finance Engine: calculates net monthly deficit correctly when expenses exceed income', () => {
  const incomePaise = 5000000;      // ₹50,000
  const expensePaise = 7000000;     // ₹70,000
  const investmentPaise = 500000;   // ₹5,000

  const deficit = calculateNetSurplus(incomePaise, expensePaise, investmentPaise);
  assert.strictEqual(deficit, -2500000); // -₹25,000
});

test('Finance Engine: calculates savings & investment rate ((Income - Expenses) / Income) * 100', () => {
  // Example from specification: Income ₹80,000, Expenses ₹35,000 -> 56.25%
  const incomePaise = 8000000;
  const expensePaise = 3500000;

  const rate = calculateSavingsRate(incomePaise, expensePaise);
  assert.strictEqual(rate, 56.25);
});

test('Finance Engine: handles zero income safely in savings rate (returns 0.0, never NaN or Infinity)', () => {
  assert.strictEqual(calculateSavingsRate(0, 1000000), 0.0);
  assert.strictEqual(calculateSavingsRate(-500, 1000000), 0.0);
});

test('Finance Engine: returns negative savings rate during deficit', () => {
  // Income ₹50,000, Expenses ₹70,000 -> ((50000 - 70000) / 50000) * 100 = -40.0%
  const rate = calculateSavingsRate(5000000, 7000000);
  assert.strictEqual(rate, -40.0);
});

test('Finance Engine: generates comprehensive monthly summary', () => {
  const transactions = [
    { type: TRANSACTION_TYPES.INCOME, amountPaise: 10000000, date: '2026-11-01' },
    { type: TRANSACTION_TYPES.EXPENSE, amountPaise: 4000000, date: '2026-11-05' },
    { type: TRANSACTION_TYPES.INVESTMENT, amountPaise: 2000000, date: '2026-11-10' }
  ];

  const summary = calculateMonthlySummary(transactions, '2026-11');
  assert.strictEqual(summary.incomePaise, 10000000);
  assert.strictEqual(summary.expensePaise, 4000000);
  assert.strictEqual(summary.investmentPaise, 2000000);
  assert.strictEqual(summary.surplusPaise, 4000000);
  assert.strictEqual(summary.savingsRate, 60.0);
  assert.strictEqual(summary.isDeficit, false);
  assert.strictEqual(summary.hasIncome, true);
});

test('Finance Engine: computes category breakdown sorted descending by amount', () => {
  const transactions = [
    { type: TRANSACTION_TYPES.EXPENSE, category: 'groceries', amountPaise: 1500000, date: '2026-11-02' },
    { type: TRANSACTION_TYPES.EXPENSE, category: 'utilities', amountPaise: 500000, date: '2026-11-03' },
    { type: TRANSACTION_TYPES.EXPENSE, category: 'groceries', amountPaise: 500000, date: '2026-11-15' },
    { type: TRANSACTION_TYPES.EXPENSE, category: 'transport', amountPaise: 1000000, date: '2026-11-10' }
  ];

  const breakdown = calculateCategoryBreakdown(transactions, '2026-11', TRANSACTION_TYPES.EXPENSE);

  assert.strictEqual(breakdown.length, 3);
  assert.strictEqual(breakdown[0].categoryId, 'groceries');
  assert.strictEqual(breakdown[0].totalPaise, 2000000);
  assert.strictEqual(breakdown[0].percentage, 57.14285714285714);
  assert.strictEqual(breakdown[1].categoryId, 'transport');
  assert.strictEqual(breakdown[1].totalPaise, 1000000);
  assert.strictEqual(breakdown[2].categoryId, 'utilities');
  assert.strictEqual(breakdown[2].totalPaise, 500000);
});

test('Finance Engine: computes 6-month historical trend with zero-filled missing months', () => {
  const transactions = [
    { type: TRANSACTION_TYPES.INCOME, amountPaise: 8000000, date: '2026-11-01' },
    { type: TRANSACTION_TYPES.EXPENSE, amountPaise: 3000000, date: '2026-11-05' },
    // October missing
    { type: TRANSACTION_TYPES.INCOME, amountPaise: 7500000, date: '2026-09-01' }
  ];

  const history = calculateTrendHistory(transactions, '2026-11', 4);

  assert.strictEqual(history.length, 4);
  assert.strictEqual(history[0].targetMonth, '2026-08');
  assert.strictEqual(history[0].incomePaise, 0); // Missing month filled as zero

  assert.strictEqual(history[1].targetMonth, '2026-09');
  assert.strictEqual(history[1].incomePaise, 7500000);

  assert.strictEqual(history[2].targetMonth, '2026-10');
  assert.strictEqual(history[2].incomePaise, 0); // Missing month filled as zero

  assert.strictEqual(history[3].targetMonth, '2026-11');
  assert.strictEqual(history[3].incomePaise, 8000000);
  assert.strictEqual(history[3].expensePaise, 3000000);
});

test('Finance Engine: handles large safe-integer addition without precision loss', () => {
  // 4,000,000,000,000,000 paise + 5,000,000,000,000,000 paise = 9,000,000,000,000,000 paise
  // (Both within Number.MAX_SAFE_INTEGER = 9,007,199,254,740,991)
  const transactions = [
    { type: TRANSACTION_TYPES.INCOME, amountPaise: 4000000000000000, date: '2026-11-01' },
    { type: TRANSACTION_TYPES.INCOME, amountPaise: 5000000000000000, date: '2026-11-02' }
  ];

  const totalIncome = calculateMonthlyIncome(transactions, '2026-11');
  assert.strictEqual(totalIncome, 9000000000000000);
  assert.strictEqual(Number.isSafeInteger(totalIncome), true);
});

test('Finance Engine: detects arithmetic overflow and throws RangeError before precision loss', () => {
  // Adding amounts that exceed Number.MAX_SAFE_INTEGER must throw RangeError
  const transactions = [
    { type: TRANSACTION_TYPES.INCOME, amountPaise: Number.MAX_SAFE_INTEGER - 100, date: '2026-11-01' },
    { type: TRANSACTION_TYPES.INCOME, amountPaise: 200, date: '2026-11-02' }
  ];

  assert.throws(() => {
    calculateMonthlyIncome(transactions, '2026-11');
  }, (err) => {
    return err instanceof RangeError && err.message.includes('overflow');
  });

  // Net surplus overflow detection
  assert.throws(() => {
    calculateNetSurplus(Number.MAX_SAFE_INTEGER, -1000, 0);
  }, RangeError);
});

test('Finance Engine: exact INR formatting for Number.MAX_SAFE_INTEGER without rounding glitch', () => {
  // Number.MAX_SAFE_INTEGER is 9,007,199,254,740,991 paise (₹90,071,992,547,409.91)
  // Floating point division / 100 would round the .91 to .90, but integer decomposition preserves .91 exactly
  const formatted = formatINR(Number.MAX_SAFE_INTEGER);
  assert.strictEqual(formatted, '₹9,00,71,99,25,47,409.91');
});

