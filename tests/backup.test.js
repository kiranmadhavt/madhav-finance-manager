import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportJSONBackup,
  validateBackupPayload,
  importJSONBackup,
  exportTransactionsToCSV,
  savePreRestoreSnapshot
} from '../js/backup.js';
import {
  resetStorage,
  getState,
  setStorageBackend,
  getStorageBackend,
  PersistenceError
} from '../js/storage.js';
import { addTransaction } from '../js/transactions.js';
import { addBudget } from '../js/budgets.js';
import { addGoal } from '../js/goals.js';
import { formatINR, parseRupeesToPaise } from '../js/utils.js';
import { STORAGE_KEYS, TRANSACTION_TYPES } from '../js/constants.js';

test.beforeEach(() => {
  resetStorage();
});

test('Backup Engine: exports valid versioned JSON backup', () => {
  addTransaction({
    id: 'trn_export_1',
    type: TRANSACTION_TYPES.INCOME,
    amountPaise: 8000000,
    date: '2026-11-01',
    category: 'monthly_salary',
    paymentMode: 'net_banking',
    description: 'Monthly Salary'
  });

  addBudget({
    id: 'bgt_export_1',
    category: 'groceries',
    limitPaise: 1500000,
    month: null
  });

  addGoal({
    id: 'gol_export_1',
    name: 'Emergency Fund',
    targetPaise: 50000000,
    savedPaise: 10000000
  });

  const jsonString = exportJSONBackup();
  const parsed = JSON.parse(jsonString);

  assert.strictEqual(parsed.appName, STORAGE_KEYS.APP_NAME);
  assert.strictEqual(parsed.backupFormatVersion, 1);
  assert.strictEqual(parsed.schemaVersion, 1);
  assert.strictEqual(typeof parsed.exportedAt, 'string');
  assert.strictEqual(parsed.data.transactions.length, 1);
  assert.strictEqual(parsed.data.budgets.length, 1);
  assert.strictEqual(parsed.data.goals.length, 1);

  const validation = validateBackupPayload(parsed);
  assert.strictEqual(validation.valid, true);
  assert.strictEqual(validation.summary.transactionCount, 1);
  assert.strictEqual(validation.summary.totalIncomePaise, 8000000);
});

test('Backup Engine: validates and rejects invalid backup structures', () => {
  // Missing appName
  assert.strictEqual(validateBackupPayload({ backupFormatVersion: 1 }).valid, false);

  // Wrong appName
  assert.strictEqual(
    validateBackupPayload({
      appName: 'Other App',
      backupFormatVersion: 1,
      schemaVersion: 1,
      data: { transactions: [], budgets: [], goals: [], preferences: {} }
    }).valid,
    false
  );

  // Invalid transaction in backup
  const corruptedTransactions = {
    appName: STORAGE_KEYS.APP_NAME,
    backupFormatVersion: 1,
    schemaVersion: 1,
    data: {
      transactions: [{ id: '1', type: 'invalid_type', amountPaise: -500 }],
      budgets: [],
      goals: [],
      preferences: {}
    }
  };
  assert.strictEqual(validateBackupPayload(corruptedTransactions).valid, false);

  // Duplicate IDs within backup
  const duplicateIds = {
    appName: STORAGE_KEYS.APP_NAME,
    backupFormatVersion: 1,
    schemaVersion: 1,
    data: {
      transactions: [
        { id: 'dup_1', type: TRANSACTION_TYPES.INCOME, amountPaise: 10000, date: '2026-11-01', category: 'monthly_salary', paymentMode: 'upi', description: 'A' },
        { id: 'dup_1', type: TRANSACTION_TYPES.INCOME, amountPaise: 20000, date: '2026-11-02', category: 'monthly_salary', paymentMode: 'upi', description: 'B' }
      ],
      budgets: [],
      goals: [],
      preferences: {}
    }
  };
  const dupResult = validateBackupPayload(duplicateIds);
  assert.strictEqual(dupResult.valid, false);
  assert.strictEqual(dupResult.errors.some(e => e.includes('Duplicate transaction ID')), true);
});

test('Backup Engine: performs full restore with safety pre-restore snapshot', () => {
  // Existing state has 1 transaction
  addTransaction({
    id: 'trn_old_1',
    type: TRANSACTION_TYPES.EXPENSE,
    amountPaise: 50000,
    date: '2026-11-01',
    category: 'groceries',
    paymentMode: 'cash',
    description: 'Old data'
  });

  const backupToRestore = {
    appName: STORAGE_KEYS.APP_NAME,
    backupFormatVersion: 1,
    schemaVersion: 1,
    exportedAt: '2026-11-20T12:00:00.000Z',
    data: {
      transactions: [
        {
          id: 'trn_restored_1',
          type: TRANSACTION_TYPES.INCOME,
          amountPaise: 10000000,
          date: '2026-11-10',
          category: 'monthly_salary',
          paymentMode: 'net_banking',
          description: 'Restored salary'
        }
      ],
      budgets: [],
      goals: [],
      preferences: { theme: 'dark', currency: 'INR' }
    }
  };

  const result = importJSONBackup(JSON.stringify(backupToRestore), 'restore');
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.mode, 'restore');

  // Verify that live state now contains restored transaction only
  const state = getState();
  assert.strictEqual(state.transactions.length, 1);
  assert.strictEqual(state.transactions[0].id, 'trn_restored_1');
  assert.strictEqual(state.preferences.theme, 'dark');

  // Verify that safety snapshot of old data exists in storage
  const backend = getStorageBackend();
  const rawPreRestore = backend.getItem(STORAGE_KEYS.PRE_RESTORE_BACKUP);
  assert.strictEqual(typeof rawPreRestore, 'string');
  const parsedPreRestore = JSON.parse(rawPreRestore);
  assert.strictEqual(parsedPreRestore.transactions[0].id, 'trn_old_1');
});

test('Backup Engine: aborts full restore if pre-restore snapshot fails to save', () => {
  // Existing state has 1 transaction
  addTransaction({
    id: 'trn_original',
    type: TRANSACTION_TYPES.EXPENSE,
    amountPaise: 50000,
    date: '2026-11-01',
    category: 'groceries',
    paymentMode: 'cash',
    description: 'Must be preserved'
  });

  const originalBackend = getStorageBackend();

  // Mock backend where writing PRE_RESTORE_BACKUP fails
  const failingSnapshotBackend = {
    getItem: (key) => originalBackend.getItem(key),
    setItem: (key, val) => {
      if (key === STORAGE_KEYS.PRE_RESTORE_BACKUP) {
        throw new Error('Disk error during snapshot');
      }
      return originalBackend.setItem(key, val);
    },
    removeItem: (key) => originalBackend.removeItem(key)
  };
  setStorageBackend(failingSnapshotBackend);

  const backupToRestore = {
    appName: STORAGE_KEYS.APP_NAME,
    backupFormatVersion: 1,
    schemaVersion: 1,
    exportedAt: '2026-11-20T12:00:00.000Z',
    data: {
      transactions: [
        {
          id: 'trn_new',
          type: TRANSACTION_TYPES.INCOME,
          amountPaise: 10000000,
          date: '2026-11-10',
          category: 'monthly_salary',
          paymentMode: 'net_banking',
          description: 'Should not be restored'
        }
      ],
      budgets: [],
      goals: [],
      preferences: { theme: 'light', currency: 'INR' }
    }
  };

  // Restore must throw and abort
  assert.throws(() => {
    importJSONBackup(JSON.stringify(backupToRestore), 'restore');
  }, (err) => {
    return err.message.includes('Full restore aborted') && err.message.includes('pre-restore safety snapshot');
  });

  // CRITICAL: Verify existing data was NOT overwritten
  assert.strictEqual(getState().transactions.length, 1);
  assert.strictEqual(getState().transactions[0].id, 'trn_original');

  // Restore original backend
  setStorageBackend(originalBackend);
});

test('Backup Engine: performs merge import without duplicating records', () => {
  // Existing state: trn_1
  addTransaction({
    id: 'trn_1',
    type: TRANSACTION_TYPES.EXPENSE,
    amountPaise: 50000,
    date: '2026-11-01',
    category: 'groceries',
    paymentMode: 'cash',
    description: 'Existing grocery'
  });

  // Backup payload contains trn_1 (duplicate) and trn_2 (new)
  const backupToMerge = {
    appName: STORAGE_KEYS.APP_NAME,
    backupFormatVersion: 1,
    schemaVersion: 1,
    exportedAt: '2026-11-20T12:00:00.000Z',
    data: {
      transactions: [
        {
          id: 'trn_1',
          type: TRANSACTION_TYPES.EXPENSE,
          amountPaise: 50000,
          date: '2026-11-01',
          category: 'groceries',
          paymentMode: 'cash',
          description: 'Existing grocery'
        },
        {
          id: 'trn_2',
          type: TRANSACTION_TYPES.EXPENSE,
          amountPaise: 75000,
          date: '2026-11-02',
          category: 'utilities',
          paymentMode: 'upi',
          description: 'New utility'
        }
      ],
      budgets: [],
      goals: [],
      preferences: { theme: 'system', currency: 'INR' }
    }
  };

  const result = importJSONBackup(JSON.stringify(backupToMerge), 'merge');
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.added.transactions, 1); // Only trn_2 added
  assert.strictEqual(result.conflicts.length, 1);   // trn_1 identified as conflict
  assert.strictEqual(result.conflicts[0].id, 'trn_1');

  const state = getState();
  assert.strictEqual(state.transactions.length, 2);
});

test('Backup Engine: exports CSV with formula injection defense and UTF-8 BOM', () => {
  const transactions = [
    {
      date: '2026-11-15',
      type: TRANSACTION_TYPES.EXPENSE,
      category: 'groceries',
      description: '=HYPERLINK("http://malicious.site")', // Formula injection attempt
      paymentMode: 'upi',
      amountPaise: 125050
    },
    {
      date: '2026-11-16',
      type: TRANSACTION_TYPES.EXPENSE,
      category: 'shopping',
      description: 'Items with, comma and "quotes"',
      paymentMode: 'credit_card',
      amountPaise: 350000
    }
  ];

  const csv = exportTransactionsToCSV(transactions);

  // 1. Must start with UTF-8 BOM (\uFEFF)
  assert.strictEqual(csv.startsWith('\uFEFF'), true);

  // 2. Check header
  assert.strictEqual(csv.includes('"Date","Type","Category","Description","Payment Mode","Amount (INR)"'), true);

  // 3. Formula injection: '=' must be neutralized with a leading single quote "'"
  assert.strictEqual(csv.includes('"\'=HYPERLINK'), true);

  // 4. Check decimal rupees formatting (125050 paise -> 1250.50)
  assert.strictEqual(csv.includes('"1250.50"'), true);

  // 5. Check quotes escaping (quotes escaped as "")
  assert.strictEqual(csv.includes('""quotes""'), true);
});

test('Storage Safety: throws PersistenceError and aborts state change on QuotaExceededError', () => {
  const originalBackend = getStorageBackend();

  // Create a mock storage backend that throws quota exceeded error on write
  const failingBackend = {
    getItem: (key) => originalBackend.getItem(key),
    setItem: () => {
      const quotaErr = new Error('The quota has been exceeded.');
      quotaErr.name = 'QuotaExceededError';
      quotaErr.code = 22;
      throw quotaErr;
    },
    removeItem: (key) => originalBackend.removeItem(key)
  };

  setStorageBackend(failingBackend);

  const initialCount = getState().transactions.length;

  // Adding transaction should throw PersistenceError
  assert.throws(() => {
    addTransaction({
      type: TRANSACTION_TYPES.EXPENSE,
      amountPaise: 50000,
      date: '2026-11-20',
      category: 'groceries',
      paymentMode: 'upi',
      description: 'Will fail write'
    });
  }, (err) => {
    return err instanceof PersistenceError && err.message.includes('quota exceeded');
  });

  // Verify in-memory state was NOT updated (remained unchanged)
  assert.strictEqual(getState().transactions.length, initialCount);

  // Restore working backend
  setStorageBackend(originalBackend);
});

test('Financial Precision: formats large safe-integer paise values accurately', () => {
  // Test large financial values (₹90,000 Crore standard)
  const largePaise = 9000000000000; // ₹90,000,00,000.00
  const formatted = formatINR(largePaise);
  assert.strictEqual(formatted.includes('₹'), true);
  assert.strictEqual(formatted.includes('.00'), true);

  // Test maximum safe integer
  assert.strictEqual(Number.isSafeInteger(Number.MAX_SAFE_INTEGER), true);
  const maxFormatted = formatINR(Number.MAX_SAFE_INTEGER);
  assert.strictEqual(typeof maxFormatted, 'string');
  assert.strictEqual(maxFormatted.startsWith('₹'), true);
});
