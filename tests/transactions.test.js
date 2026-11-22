import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTransaction,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getTransaction,
  getAllTransactions,
  filterTransactions,
  sortTransactions
} from '../js/transactions.js';
import { resetStorage } from '../js/storage.js';
import { TRANSACTION_TYPES } from '../js/constants.js';

test.beforeEach(() => {
  resetStorage();
});

test('Transactions: validates valid transaction candidate', () => {
  const candidate = {
    id: 'trn_123',
    type: TRANSACTION_TYPES.EXPENSE,
    amountPaise: 125000,
    date: '2026-11-20',
    category: 'groceries',
    paymentMode: 'upi',
    description: 'Groceries and fruits'
  };

  const result = validateTransaction(candidate);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});

test('Transactions: rejects zero or negative amount', () => {
  const candidateZero = {
    type: TRANSACTION_TYPES.EXPENSE,
    amountPaise: 0,
    date: '2026-11-20',
    category: 'groceries',
    paymentMode: 'upi',
    description: 'Test'
  };
  assert.strictEqual(validateTransaction(candidateZero).valid, false);

  const candidateNegative = {
    ...candidateZero,
    amountPaise: -5000
  };
  assert.strictEqual(validateTransaction(candidateNegative).valid, false);

  const candidateFloat = {
    ...candidateZero,
    amountPaise: 1250.50
  };
  assert.strictEqual(validateTransaction(candidateFloat).valid, false);
});

test('Transactions: rejects invalid dates', () => {
  const invalidDate1 = {
    type: TRANSACTION_TYPES.EXPENSE,
    amountPaise: 10000,
    date: '2026-02-31', // Feb 31 does not exist
    category: 'groceries',
    paymentMode: 'upi',
    description: 'Test'
  };
  assert.strictEqual(validateTransaction(invalidDate1).valid, false);

  const invalidDate2 = {
    ...invalidDate1,
    date: '2025-02-29' // 2025 is not a leap year
  };
  assert.strictEqual(validateTransaction(invalidDate2).valid, false);

  const validLeapYearDate = {
    ...invalidDate1,
    date: '2024-02-29' // 2024 is a leap year
  };
  assert.strictEqual(validateTransaction(validLeapYearDate).valid, true);
});

test('Transactions: rejects mismatched type and category pairing', () => {
  const mismatched = {
    type: TRANSACTION_TYPES.EXPENSE,
    amountPaise: 5000000,
    date: '2026-11-20',
    category: 'monthly_salary', // Income category assigned to Expense type!
    paymentMode: 'net_banking',
    description: 'Salary'
  };

  const result = validateTransaction(mismatched);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.errors[0].includes('not valid for transaction type'), true);
});

test('Transactions: rejects invalid payment mode', () => {
  const invalidPayment = {
    type: TRANSACTION_TYPES.EXPENSE,
    amountPaise: 100000,
    date: '2026-11-20',
    category: 'groceries',
    paymentMode: 'crypto', // Not supported
    description: 'Groceries'
  };

  assert.strictEqual(validateTransaction(invalidPayment).valid, false);
});

test('Transactions: adds, updates, and deletes transaction successfully', () => {
  // 1. Add transaction
  const created = addTransaction({
    type: TRANSACTION_TYPES.INCOME,
    amountPaise: 8000000,
    date: '2026-11-01',
    category: 'monthly_salary',
    paymentMode: 'net_banking',
    description: 'November Salary'
  });

  assert.strictEqual(typeof created.id, 'string');
  assert.strictEqual(created.id.startsWith('trn_'), true);
  assert.strictEqual(getAllTransactions().length, 1);

  // 2. Retrieve transaction
  const fetched = getTransaction(created.id);
  assert.strictEqual(fetched.amountPaise, 8000000);
  assert.strictEqual(fetched.description, 'November Salary');

  // 3. Update transaction
  const updated = updateTransaction(created.id, {
    amountPaise: 8500000,
    description: 'November Salary + Bonus'
  });

  assert.strictEqual(updated.amountPaise, 8500000);
  assert.strictEqual(updated.description, 'November Salary + Bonus');
  assert.strictEqual(getTransaction(created.id).amountPaise, 8500000);

  // 4. Delete transaction
  const deleted = deleteTransaction(created.id);
  assert.strictEqual(deleted.id, created.id);
  assert.strictEqual(getAllTransactions().length, 0);
  assert.strictEqual(getTransaction(created.id), null);
});

test('Transactions: filters transactions by month, type, category, and text search', () => {
  addTransaction({
    id: 'trn_1',
    type: TRANSACTION_TYPES.EXPENSE,
    amountPaise: 150000,
    date: '2026-11-05',
    category: 'groceries',
    paymentMode: 'upi',
    description: 'Weekly organic vegetables'
  });

  addTransaction({
    id: 'trn_2',
    type: TRANSACTION_TYPES.EXPENSE,
    amountPaise: 250000,
    date: '2026-11-12',
    category: 'utilities',
    paymentMode: 'net_banking',
    description: 'Electricity bill payment'
  });

  addTransaction({
    id: 'trn_3',
    type: TRANSACTION_TYPES.INCOME,
    amountPaise: 500000,
    date: '2026-10-25',
    category: 'side_income',
    paymentMode: 'upi',
    description: 'Consulting freelance'
  });

  const all = getAllTransactions();

  // Filter by month
  const novTransactions = filterTransactions(all, { month: '2026-11' });
  assert.strictEqual(novTransactions.length, 2);

  // Filter by type
  const expenseTransactions = filterTransactions(all, { type: TRANSACTION_TYPES.EXPENSE });
  assert.strictEqual(expenseTransactions.length, 2);

  // Filter by category
  const utilityTransactions = filterTransactions(all, { category: 'utilities' });
  assert.strictEqual(utilityTransactions.length, 1);
  assert.strictEqual(utilityTransactions[0].id, 'trn_2');

  // Search by description text
  const searchResults = filterTransactions(all, { search: 'organic' });
  assert.strictEqual(searchResults.length, 1);
  assert.strictEqual(searchResults[0].id, 'trn_1');

  // Search by category display name ("Groceries & Quick-Commerce")
  const catSearchResults = filterTransactions(all, { search: 'Quick-Commerce' });
  assert.strictEqual(catSearchResults.length, 1);
  assert.strictEqual(catSearchResults[0].id, 'trn_1');
});

test('Transactions: sorts transactions chronologically (newest first)', () => {
  const trns = [
    { id: '1', date: '2026-11-05', createdAt: '2026-11-05T10:00:00.000Z' },
    { id: '2', date: '2026-11-20', createdAt: '2026-11-20T12:00:00.000Z' },
    { id: '3', date: '2026-11-10', createdAt: '2026-11-10T08:00:00.000Z' },
    { id: '4', date: '2026-11-20', createdAt: '2026-11-20T15:00:00.000Z' } // Same day, later time
  ];

  const sortedDesc = sortTransactions(trns, 'desc');
  assert.deepStrictEqual(sortedDesc.map((t) => t.id), ['4', '2', '3', '1']);

  const sortedAsc = sortTransactions(trns, 'asc');
  assert.deepStrictEqual(sortedAsc.map((t) => t.id), ['1', '3', '2', '4']);
});
