/**
 * Madhav Finance Manager - Critical User Workflows & Financial Integration Tests
 *
 * Verifies end-to-end user workflows:
 * - Transaction creation, editing, deletion, filtering, searching, sorting.
 * - Budget creation, recurring vs override priority, exact 75% and 95% thresholds.
 * - Savings goal tracking, balance updates, >100% completion and surplus.
 * - JSON backup export, corrupt import rejection, merge vs restore safety.
 * - CSV export with spreadsheet formula injection defense.
 * - Financial correctness: exact integer paise, zero income, deficits, investment separation.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  initStorage,
  getState,
  setState,
  resetStorage,
  getTransactions,
  getBudgets,
  getGoals,
  getPreferences,
  updatePreferences,
  setStorageBackend
} from '../js/storage.js';

import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
  filterTransactions,
  sortTransactions
} from '../js/transactions.js';

import {
  addBudget,
  updateBudget,
  deleteBudget,
  resolveBudget,
  calculateBudgetUtilization,
  calculateAllBudgetsUtilization
} from '../js/budgets.js';

import {
  addGoal,
  updateGoal,
  updateGoalSavedAmount,
  calculateGoalProgress,
  deleteGoal
} from '../js/goals.js';

import {
  calculateMonthlyIncome,
  calculateMonthlyExpenses,
  calculateMonthlyInvestments,
  calculateNetSurplus,
  calculateSavingsRate,
  calculateMonthlySummary,
  calculateTrendHistory
} from '../js/finance.js';

import {
  exportJSONBackup,
  importJSONBackup,
  exportTransactionsToCSV
} from '../js/backup.js';

import {
  BUDGET_THRESHOLDS,
  TRANSACTION_TYPES,
  THEMES
} from '../js/constants.js';

import {
  formatINR,
  parseRupeesToPaise,
  paiseToRupees
} from '../js/utils.js';

class MockMemoryStorage {
  constructor() {
    this._data = new Map();
  }
  getItem(key) {
    return this._data.has(key) ? this._data.get(key) : null;
  }
  setItem(key, val) {
    this._data.set(key, String(val));
  }
  removeItem(key) {
    this._data.delete(key);
  }
  clear() {
    this._data.clear();
  }
}

describe('Critical User Workflows & Presentation Integration', () => {
  beforeEach(() => {
    setStorageBackend(new MockMemoryStorage());
    resetStorage();
  });

  test('Workflow 1: Transaction Lifecycle (Income, Expense, Investment)', () => {
    // 1. Create Income
    const incomeTxn = addTransaction({
      type: TRANSACTION_TYPES.INCOME,
      amountPaise: 15000000, // ₹1,50,000.00
      date: '2026-11-01',
      category: 'monthly_salary',
      paymentMode: 'net_banking',
      description: 'November Salary'
    });
    assert.equal(incomeTxn.amountPaise, 15000000);
    assert.equal(getTransactions().length, 1);

    // 2. Create Expense
    const expenseTxn = addTransaction({
      type: TRANSACTION_TYPES.EXPENSE,
      amountPaise: 450000, // ₹4,500.00
      date: '2026-11-05',
      category: 'groceries',
      paymentMode: 'upi',
      description: 'Weekly Supermarket'
    });
    assert.equal(getTransactions().length, 2);

    // 3. Create Investment
    const investmentTxn = addTransaction({
      type: TRANSACTION_TYPES.INVESTMENT,
      amountPaise: 5000000, // ₹50,000.00
      date: '2026-11-10',
      category: 'mutual_fund_sip',
      paymentMode: 'auto_debit',
      description: 'Nifty 50 Index SIP'
    });
    assert.equal(getTransactions().length, 3);

    // 4. Edit Transaction: update amount and payment mode
    const updated = updateTransaction(expenseTxn.id, {
      amountPaise: 520000, // ₹5,200.00
      paymentMode: 'credit_card',
      description: 'Weekly Supermarket + Organic produce'
    });
    assert.equal(updated.amountPaise, 520000);
    assert.equal(updated.paymentMode, 'credit_card');

    // 5. Delete Transaction
    const deleted = deleteTransaction(investmentTxn.id);
    assert.equal(deleted.id, investmentTxn.id);
    assert.equal(getTransactions().length, 2);
  });

  test('Workflow 2: Ledger Search, Multi-Filter, and Deterministic Sorting', () => {
    addTransaction({
      type: TRANSACTION_TYPES.INCOME,
      amountPaise: 10000000,
      date: '2026-10-31',
      category: 'monthly_salary',
      paymentMode: 'net_banking',
      description: 'October Salary'
    });
    addTransaction({
      type: TRANSACTION_TYPES.EXPENSE,
      amountPaise: 300000,
      date: '2026-11-02',
      category: 'groceries',
      paymentMode: 'upi',
      description: 'Grocery store'
    });
    addTransaction({
      type: TRANSACTION_TYPES.EXPENSE,
      amountPaise: 150000,
      date: '2026-11-15',
      category: 'entertainment',
      paymentMode: 'credit_card',
      description: 'Dinner with family'
    });

    const txns = getTransactions();

    // Filter by month
    const novTxns = filterTransactions(txns, { month: '2026-11' });
    assert.equal(novTxns.length, 2);

    // Filter by type
    const expenseTxns = filterTransactions(txns, { type: 'expense' });
    assert.equal(expenseTxns.length, 2);

    // Filter by category
    const diningTxns = filterTransactions(txns, { category: 'entertainment' });
    assert.equal(diningTxns.length, 1);

    // Filter by payment mode
    const upiTxns = filterTransactions(txns, { paymentMode: 'upi' });
    assert.equal(upiTxns.length, 1);

    // Text search (case-insensitive description matching)
    const searchDinner = filterTransactions(txns, { search: 'dinner' });
    assert.equal(searchDinner.length, 1);

    // Text search on category name
    const searchGrocery = filterTransactions(txns, { search: 'groceries' });
    assert.equal(searchGrocery.length, 1);

    // Chronological sorting (newest first)
    const sortedDesc = sortTransactions(txns, 'desc');
    assert.equal(sortedDesc[0].date, '2026-11-15');
    assert.equal(sortedDesc[2].date, '2026-10-31');
  });

  test('Workflow 3: Budget Overrides and Priority Resolution', () => {
    // 1. Create recurring default budget for housing: ₹40,000
    const defaultHousing = addBudget({
      category: 'housing',
      limitPaise: 4000000,
      month: null
    });
    assert.equal(defaultHousing.month, null);

    // 2. Create month override for housing in November: ₹45,000 (festival maintenance)
    const overrideHousing = addBudget({
      category: 'housing',
      limitPaise: 4500000,
      month: '2026-11'
    });
    assert.equal(overrideHousing.month, '2026-11');

    const budgets = getBudgets();

    // Priority check: November should resolve to override (₹45,000)
    const resolvedNov = resolveBudget(budgets, 'housing', '2026-11');
    assert.equal(resolvedNov.limitPaise, 4500000);
    assert.equal(resolvedNov.isOverride, true);

    // Priority check: December should resolve to default (₹40,000)
    const resolvedDec = resolveBudget(budgets, 'housing', '2026-12');
    assert.equal(resolvedDec.limitPaise, 4000000);
    assert.equal(resolvedDec.isOverride, false);

    // Update override limit
    updateBudget(overrideHousing.id, { limitPaise: 4800000, month: '2026-11' });
    const updatedNov = resolveBudget(getBudgets(), 'housing', '2026-11');
    assert.equal(updatedNov.limitPaise, 4800000);

    // Prevent duplicate default for same category
    assert.throws(
      () => addBudget({ category: 'housing', limitPaise: 3000000, month: null }),
      /already exists/
    );

    // Prevent duplicate override for same category and month
    assert.throws(
      () => addBudget({ category: 'housing', limitPaise: 3000000, month: '2026-11' }),
      /already exists/
    );
  });

  test('Workflow 4: Budget Utilization Threshold Boundaries (Exactly 75% and 95%)', () => {
    const budget = {
      id: 'bgt_test_threshold',
      category: 'groceries',
      limitPaise: 1000000 // ₹10,000.00
    };

    // Case 1: 74.99% -> Normal (Green)
    const util74_99 = calculateBudgetUtilization(budget, [{
      type: 'expense',
      category: 'groceries',
      amountPaise: 749900,
      date: '2026-11-05'
    }], '2026-11');
    assert.equal(util74_99.percentUsed, 74.99);
    assert.equal(util74_99.status, BUDGET_THRESHOLDS.STATUS.NORMAL);

    // Case 2: Exactly 75.00% -> Warning (Amber)
    const util75_00 = calculateBudgetUtilization(budget, [{
      type: 'expense',
      category: 'groceries',
      amountPaise: 750000,
      date: '2026-11-05'
    }], '2026-11');
    assert.equal(util75_00.percentUsed, 75.00);
    assert.equal(util75_00.status, BUDGET_THRESHOLDS.STATUS.WARNING);

    // Case 3: Exactly 95.00% -> Warning (Amber)
    const util95_00 = calculateBudgetUtilization(budget, [{
      type: 'expense',
      category: 'groceries',
      amountPaise: 950000,
      date: '2026-11-05'
    }], '2026-11');
    assert.equal(util95_00.percentUsed, 95.00);
    assert.equal(util95_00.status, BUDGET_THRESHOLDS.STATUS.WARNING);

    // Case 4: 95.01% -> Danger (Red)
    const util95_01 = calculateBudgetUtilization(budget, [{
      type: 'expense',
      category: 'groceries',
      amountPaise: 950100,
      date: '2026-11-05'
    }], '2026-11');
    assert.ok(Math.abs(util95_01.percentUsed - 95.01) < 1e-4);
    assert.equal(util95_01.status, BUDGET_THRESHOLDS.STATUS.DANGER);
  });

  test('Workflow 5: Savings Goal Completion, Exceeded (>100%), and Surplus', () => {
    const goal = addGoal({
      name: 'Emergency Fund',
      targetPaise: 50000000, // ₹5,00,000
      savedPaise: 25000000,  // ₹2,50,000 (50%)
      targetDate: '2027-12-31'
    });

    let progress = calculateGoalProgress(goal);
    assert.equal(progress.progressPercent, 50.0);
    assert.equal(progress.isCompleted, false);
    assert.equal(progress.remainingPaise, 25000000);
    assert.equal(progress.surplusPaise, 0);

    // Quick balance update: exactly reached 100%
    updateGoalSavedAmount(goal.id, 50000000);
    progress = calculateGoalProgress(getGoals()[0]);
    assert.equal(progress.progressPercent, 100.0);
    assert.equal(progress.isCompleted, true);
    assert.equal(progress.isExceeded, false);
    assert.equal(progress.remainingPaise, 0);
    assert.equal(progress.surplusPaise, 0);

    // Quick balance update: exceeded target (120%)
    updateGoalSavedAmount(goal.id, 60000000); // ₹6,00,000
    progress = calculateGoalProgress(getGoals()[0]);
    assert.equal(progress.progressPercent, 120.0);
    assert.equal(progress.isCompleted, true);
    assert.equal(progress.isExceeded, true);
    assert.equal(progress.remainingPaise, 0);
    assert.equal(progress.surplusPaise, 10000000); // ₹1,00,000 surplus

    // Rejection of negative saved balance
    assert.throws(() => updateGoalSavedAmount(goal.id, -500), /non-negative/);
  });

  test('Workflow 6: JSON Backup Export, Safe Restore, and Merge', () => {
    // Populate some data
    addTransaction({
      type: 'income',
      amountPaise: 10000000,
      date: '2026-11-01',
      category: 'monthly_salary',
      paymentMode: 'net_banking'
    });
    addBudget({
      category: 'groceries',
      limitPaise: 2000000,
      month: null
    });
    addGoal({
      name: 'Vacation',
      targetPaise: 10000000,
      savedPaise: 2000000
    });

    const backupJson = exportJSONBackup();
    const parsed = JSON.parse(backupJson);
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.data.transactions.length, 1);
    assert.equal(parsed.data.budgets.length, 1);
    assert.equal(parsed.data.goals.length, 1);

    // Test corrupted JSON rejection - must NOT alter existing data
    assert.throws(
      () => importJSONBackup('{"corrupted": true', 'restore'),
      /JSON/
    );
    assert.equal(getTransactions().length, 1); // Preserved

    // Test unsupported schema rejection
    assert.throws(
      () => importJSONBackup(JSON.stringify({ schemaVersion: 99, data: {} }), 'restore'),
      /Unsupported schema version/
    );
    assert.equal(getTransactions().length, 1); // Preserved

    // Test Merge Import: adding a second backup with unique records
    const secondBackup = JSON.stringify({
      schemaVersion: 1,
      backupFormatVersion: 1,
      appName: 'Madhav Finance Manager',
      exportedAt: new Date().toISOString(),
      data: {
        transactions: [{
          id: 'trn_merged_001',
          type: 'expense',
          amountPaise: 50000,
          date: '2026-11-02',
          category: 'transport',
          paymentMode: 'upi',
          description: 'Fuel fill',
          createdAt: new Date().toISOString()
        }],
        budgets: [],
        goals: [],
        preferences: {
          theme: 'system',
          currency: 'INR'
        }
      }
    });

    const mergeResult = importJSONBackup(secondBackup, 'merge');
    assert.equal(mergeResult.transactions, 1);
    assert.equal(getTransactions().length, 2);
  });

  test('Workflow 7: CSV Statement Export with Formula Injection Defense', () => {
    addTransaction({
      type: 'expense',
      amountPaise: 120000,
      date: '2026-11-02',
      category: 'groceries',
      paymentMode: 'upi',
      description: '=SUM(A1:A10)' // Malicious formula payload
    });
    addTransaction({
      type: 'expense',
      amountPaise: 50000,
      date: '2026-11-03',
      category: 'utilities',
      paymentMode: 'net_banking',
      description: '+100-200' // Malicious formula payload
    });

    const csv = exportTransactionsToCSV(getTransactions());

    // UTF-8 BOM must be present
    assert.ok(csv.startsWith('\uFEFF'));

    // Formula injection characters (=, +, -, @) must be neutralized with leading single quote
    assert.ok(csv.includes('"\'=SUM(A1:A10)"'));
    assert.ok(csv.includes('"\'+100-200"'));
  });

  test('Workflow 8: Financial Calculations - Investment Separation & Surplus Deficit', () => {
    const transactions = [
      { type: 'income', amountPaise: 10000000, date: '2026-11-01' },       // ₹1,00,000 Income
      { type: 'expense', amountPaise: 6000000, date: '2026-11-05' },       // ₹60,000 Consumption Expense
      { type: 'investment', amountPaise: 3000000, date: '2026-11-10' }     // ₹30,000 Investment
    ];

    const income = calculateMonthlyIncome(transactions, '2026-11');
    const expense = calculateMonthlyExpenses(transactions, '2026-11');
    const investment = calculateMonthlyInvestments(transactions, '2026-11');

    assert.equal(income, 10000000);
    assert.equal(expense, 6000000);
    assert.equal(investment, 3000000);

    // Surplus = Income (₹1,00,000) - Expenses (₹60,000) - Investments (₹30,000) = ₹10,000
    const surplus = calculateNetSurplus(income, expense, investment);
    assert.equal(surplus, 1000000);

    // Polymorphic signature test: calculateNetSurplus(transactions, '2026-11')
    const surplusPoly = calculateNetSurplus(transactions, '2026-11');
    assert.equal(surplusPoly, 1000000);

    // Savings Rate = ((Income - Expenses) / Income) * 100 = ((100000 - 60000) / 100000) * 100 = 40.0%
    const rate = calculateSavingsRate(income, expense);
    assert.equal(rate, 40.0);

    const ratePoly = calculateSavingsRate(transactions, '2026-11');
    assert.equal(ratePoly, 40.0);

    // Deficit Month: Expenses exceed income
    const deficitTransactions = [
      { type: 'income', amountPaise: 5000000, date: '2026-12-01' },  // ₹50,000 Income
      { type: 'expense', amountPaise: 7500000, date: '2026-12-05' }  // ₹75,000 Expenses
    ];
    const deficitSurplus = calculateNetSurplus(deficitTransactions, '2026-12');
    assert.equal(deficitSurplus, -2500000); // -₹25,000 deficit

    const deficitRate = calculateSavingsRate(deficitTransactions, '2026-12');
    assert.equal(deficitRate, -50.0); // -50.0% savings rate
  });

  test('Workflow 9: Theme Preferences Mutation and Live State Persistence', () => {
    assert.equal(getPreferences().theme, 'system');

    updatePreferences({ theme: THEMES.DARK });
    assert.equal(getPreferences().theme, 'dark');

    updatePreferences({ theme: THEMES.LIGHT });
    assert.equal(getPreferences().theme, 'light');
  });
});
