import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initStorage,
  getState,
  setState,
  updateState,
  resetStorage,
  setStorageBackend,
  getStorageBackend,
  getRawStorageString,
  PersistenceError,
  CorruptedStorageError,
  createDefaultState
} from '../js/storage.js';
import { STORAGE_KEYS } from '../js/constants.js';

class MockStorage {
  constructor(initialData = {}) {
    this._data = new Map(Object.entries(initialData));
  }

  getItem(key) {
    return this._data.has(key) ? this._data.get(key) : null;
  }

  setItem(key, value) {
    this._data.set(key, String(value));
  }

  removeItem(key) {
    this._data.delete(key);
  }

  clear() {
    this._data.clear();
  }
}

test.beforeEach(() => {
  setStorageBackend(new MockStorage());
  resetStorage();
});

test('Storage: initializes clean default state when storage is empty', () => {
  const backend = new MockStorage();
  setStorageBackend(backend);

  // Storage starts empty
  assert.strictEqual(backend.getItem(STORAGE_KEYS.APP_DATA), null);

  const state = initStorage();

  assert.strictEqual(state.schemaVersion, 1);
  assert.deepStrictEqual(state.transactions, []);
  assert.deepStrictEqual(state.budgets, []);
  assert.deepStrictEqual(state.goals, []);
  assert.strictEqual(state.preferences.currency, 'INR');
  assert.strictEqual(state.preferences.theme, 'system');
  assert.strictEqual(typeof state.updatedAt, 'string');

  // Verify default state was persisted to backend
  const persistedRaw = backend.getItem(STORAGE_KEYS.APP_DATA);
  assert.strictEqual(typeof persistedRaw, 'string');
  assert.strictEqual(JSON.parse(persistedRaw).schemaVersion, 1);
});

test('Storage: saves state and reloads correctly across sessions', () => {
  const backend = new MockStorage();
  setStorageBackend(backend);
  initStorage();

  // Mutate state
  updateState((state) => {
    state.transactions.push({
      id: 'trn_test_1',
      type: 'income',
      amountPaise: 5000000,
      date: '2026-11-20',
      category: 'monthly_salary',
      paymentMode: 'net_banking',
      description: 'Test Salary',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z'
    });
    return state;
  });

  // Simulate application restart by creating a new session pointing to the same backend
  setStorageBackend(backend);
  const reloaded = initStorage();

  assert.strictEqual(reloaded.transactions.length, 1);
  assert.strictEqual(reloaded.transactions[0].id, 'trn_test_1');
  assert.strictEqual(reloaded.transactions[0].amountPaise, 5000000);
});

test('Storage: updateState and setState validate and persist mutations', () => {
  initStorage();

  // Update preferences
  updateState((state) => {
    state.preferences.theme = 'dark';
    return state;
  });

  assert.strictEqual(getState().preferences.theme, 'dark');

  // Direct setState
  const currentState = getState();
  currentState.goals.push({
    id: 'gol_1',
    name: 'Retirement',
    targetPaise: 100000000,
    savedPaise: 25000000,
    targetDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  setState(currentState);
  assert.strictEqual(getState().goals.length, 1);
});

test('Storage: corrupted JSON throws CorruptedStorageError and never resets data', () => {
  const corruptedRaw = '{"schemaVersion": 1, "transactions": [ CORRUPTED JSON ...';
  const backend = new MockStorage({
    [STORAGE_KEYS.APP_DATA]: corruptedRaw
  });
  setStorageBackend(backend);

  // Initializing storage with corrupted JSON must throw CorruptedStorageError
  let caughtError = null;
  try {
    initStorage();
  } catch (err) {
    caughtError = err;
  }

  assert.strictEqual(caughtError instanceof CorruptedStorageError, true);
  assert.strictEqual(caughtError.name, 'CorruptedStorageError');
  assert.strictEqual(caughtError.message.includes('JSON parsing failed'), true);

  // CRITICAL: Verify that the corrupted raw string in backend was NOT overwritten or wiped
  assert.strictEqual(backend.getItem(STORAGE_KEYS.APP_DATA), corruptedRaw);

  // Verify getRawStorageString allows recovering the unparsed string
  assert.strictEqual(getRawStorageString(), corruptedRaw);
});

test('Storage: unsupported schema version throws CorruptedStorageError and protects records', () => {
  const futureSchemaData = {
    schemaVersion: 99, // Incompatible future schema version
    transactions: [],
    budgets: [],
    goals: [],
    preferences: {}
  };
  const rawPayload = JSON.stringify(futureSchemaData);
  const backend = new MockStorage({
    [STORAGE_KEYS.APP_DATA]: rawPayload
  });
  setStorageBackend(backend);

  let caughtError = null;
  try {
    initStorage();
  } catch (err) {
    caughtError = err;
  }

  assert.strictEqual(caughtError instanceof CorruptedStorageError, true);
  assert.strictEqual(caughtError.message.includes('schemaVersion: 99'), true);

  // Stored data must NOT be reset
  assert.strictEqual(backend.getItem(STORAGE_KEYS.APP_DATA), rawPayload);
});

test('Storage: handles unavailable storage backend safely', () => {
  const unavailableBackend = {
    getItem: () => {
      const err = new Error('SecurityError: The operation is insecure.');
      err.name = 'SecurityError';
      throw err;
    },
    setItem: () => {},
    removeItem: () => {}
  };

  setStorageBackend(unavailableBackend);

  assert.throws(() => {
    initStorage();
  }, (err) => {
    return err instanceof PersistenceError && err.message.includes('Storage access failed');
  });
});

test('Storage: QuotaExceededError is intercepted and throws clean PersistenceError', () => {
  const workingBackend = new MockStorage();
  setStorageBackend(workingBackend);
  initStorage();

  // Switch backend to one that fails writes due to quota
  const quotaBackend = {
    getItem: (key) => workingBackend.getItem(key),
    setItem: () => {
      const quotaErr = new Error('Quota exceeded');
      quotaErr.name = 'QuotaExceededError';
      quotaErr.code = 22;
      throw quotaErr;
    },
    removeItem: (key) => workingBackend.removeItem(key)
  };

  setStorageBackend(quotaBackend);

  assert.throws(() => {
    updateState((state) => {
      state.transactions.push({ id: 'trn_fail', type: 'income', amountPaise: 100 });
      return state;
    });
  }, (err) => {
    return err instanceof PersistenceError && err.message.includes('quota exceeded');
  });
});

test('Storage: ensures in-memory state never changes after failed persistence', () => {
  const backend = new MockStorage();
  setStorageBackend(backend);
  initStorage();

  // Add an initial transaction
  updateState((state) => {
    state.transactions.push({
      id: 'trn_initial',
      type: 'expense',
      amountPaise: 100000,
      date: '2026-11-20',
      category: 'groceries',
      paymentMode: 'cash',
      description: 'Initial',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z'
    });
    return state;
  });

  const stateBeforeFailure = getState();
  const initialTransactionCount = stateBeforeFailure.transactions.length;
  const initialUpdatedAt = stateBeforeFailure.updatedAt;

  // Configure write failure
  const failingBackend = {
    getItem: (key) => backend.getItem(key),
    setItem: () => {
      throw new Error('Disk write I/O failure');
    },
    removeItem: (key) => backend.removeItem(key)
  };
  setStorageBackend(failingBackend);

  // Attempt mutation that will fail during storage write
  assert.throws(() => {
    updateState((state) => {
      state.transactions.push({
        id: 'trn_should_never_exist',
        type: 'expense',
        amountPaise: 999999,
        date: '2026-11-20',
        category: 'shopping',
        paymentMode: 'upi',
        description: 'Failed transaction'
      });
      return state;
    });
  }, PersistenceError);

  // VERIFY IN-MEMORY STATE:
  // Must NOT contain the failed transaction, and must remain completely identical
  const stateAfterFailure = getState();
  assert.strictEqual(stateAfterFailure.transactions.length, initialTransactionCount);
  assert.strictEqual(stateAfterFailure.transactions[0].id, 'trn_initial');
  assert.strictEqual(stateAfterFailure.updatedAt, initialUpdatedAt);
  assert.strictEqual(
    stateAfterFailure.transactions.some((t) => t.id === 'trn_should_never_exist'),
    false
  );
});
