/**
 * Madhav Finance Manager - Storage Abstraction Layer
 *
 * Implements atomic persistence, schema versioning, validation, quota error handling,
 * and state change subscriptions.
 *
 * Guarantees that in-memory state is NEVER updated before persistence succeeds.
 */

import { STORAGE_KEYS } from './constants.js';
import { isValidPaise } from './utils.js';

/**
 * Custom error thrown when a persistence write fails.
 */
export class PersistenceError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'PersistenceError';
    this.originalError = originalError;
  }
}

/**
 * Custom error thrown when stored data is corrupted or has an unsupported schema version.
 * Carries the raw unparsed string to facilitate manual or offline recovery without data loss.
 */
export class CorruptedStorageError extends PersistenceError {
  constructor(message, rawData = null, originalError = null) {
    super(message, originalError);
    this.name = 'CorruptedStorageError';
    this.rawData = rawData;
  }
}

/**
 * In-memory fallback storage adapter for non-browser or test environments.
 */
class MemoryStorage {
  constructor() {
    this._store = new Map();
  }

  getItem(key) {
    return this._store.has(key) ? this._store.get(key) : null;
  }

  setItem(key, value) {
    this._store.set(key, String(value));
  }

  removeItem(key) {
    this._store.delete(key);
  }

  clear() {
    this._store.clear();
  }
}

// Active storage backend (defaults to window.localStorage in browser, MemoryStorage in Node)
let _storageBackend = (typeof window !== 'undefined' && window.localStorage)
  ? window.localStorage
  : new MemoryStorage();

// In-memory application state
let _state = null;

// State change subscriber callbacks
const _subscribers = new Set();

/**
 * Creates a clean, empty initial state object conforming to schemaVersion 1.
 *
 * @returns {Object} Fresh default application state.
 */
export function createDefaultState() {
  return {
    schemaVersion: STORAGE_KEYS.SCHEMA_VERSION,
    transactions: [],
    budgets: [],
    goals: [],
    preferences: {
      theme: 'system',
      currency: 'INR'
    },
    updatedAt: new Date().toISOString()
  };
}

/**
 * Deep clones any JSON-serializable object.
 *
 * @param {T} obj - Object to clone.
 * @returns {T} Deep clone of the object.
 */
function cloneState(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Validates the core structure of an application state object.
 *
 * @param {unknown} data - Data to validate.
 * @returns {{ valid: boolean, errors: string[] }} Validation result.
 */
export function validateStateSchema(data) {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['State must be a non-null object.'] };
  }

  if (typeof data.schemaVersion !== 'number' || data.schemaVersion !== STORAGE_KEYS.SCHEMA_VERSION) {
    errors.push(`Invalid or unsupported schemaVersion: ${data.schemaVersion}. Expected ${STORAGE_KEYS.SCHEMA_VERSION}.`);
  }

  if (!Array.isArray(data.transactions)) {
    errors.push('State property "transactions" must be an array.');
  }

  if (!Array.isArray(data.budgets)) {
    errors.push('State property "budgets" must be an array.');
  }

  if (!Array.isArray(data.goals)) {
    errors.push('State property "goals" must be an array.');
  }

  if (!data.preferences || typeof data.preferences !== 'object') {
    errors.push('State property "preferences" must be an object.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sets the active storage backend. Used for dependency injection during automated testing.
 *
 * @param {Storage|Object} backend - Storage implementation supporting getItem, setItem, removeItem.
 */
export function setStorageBackend(backend) {
  if (!backend || typeof backend.getItem !== 'function' || typeof backend.setItem !== 'function') {
    throw new Error('Storage backend must implement getItem and setItem methods.');
  }
  _storageBackend = backend;
}

/**
 * Returns the active storage backend.
 *
 * @returns {Storage|Object} Active storage backend.
 */
export function getStorageBackend() {
  return _storageBackend;
}

/**
 * Initializes application storage. Reads persisted state from storage backend,
 * validates its schema, or initializes a default state if no data exists.
 *
 * If stored data is corrupted, an error is thrown to prevent silent data destruction.
 *
 * @returns {Object} Loaded and validated application state.
 */
export function initStorage() {
  let raw;
  try {
    raw = _storageBackend.getItem(STORAGE_KEYS.APP_DATA);
  } catch (err) {
    throw new PersistenceError('Storage access failed: Unable to read from storage backend.', err);
  }

  // Clean initial run: storage key does not exist
  if (raw === null || raw === undefined) {
    const defaultState = createDefaultState();
    persistState(defaultState);
    _state = defaultState;
    return cloneState(_state);
  }

  // Reject empty string as corrupted rather than clean
  if (typeof raw === 'string' && raw.trim() === '') {
    throw new CorruptedStorageError(
      'Corrupted financial data: Empty record found in storage. Stored data was NOT reset to protect historical records.',
      raw
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new CorruptedStorageError(
      'Corrupted financial data: JSON parsing failed on stored records. Stored data was NOT reset to protect historical records.',
      raw,
      err
    );
  }

  const validation = validateStateSchema(parsed);
  if (!validation.valid) {
    throw new CorruptedStorageError(
      `Corrupted financial data: Schema validation failed. ${validation.errors.join(' ')}. Stored data was NOT reset to protect historical records.`,
      raw
    );
  }

  _state = parsed;
  return cloneState(_state);
}

/**
 * Retrieves the raw, unparsed string directly from the storage backend.
 * Provides a recovery mechanism when stored data is corrupted.
 *
 * @returns {string|null} Raw storage payload.
 */
export function getRawStorageString() {
  try {
    return _storageBackend.getItem(STORAGE_KEYS.APP_DATA);
  } catch (err) {
    return null;
  }
}

/**
 * Returns a deep copy of the current in-memory application state.
 *
 * @returns {Object} Deep clone of application state.
 */
export function getState() {
  if (!_state) {
    initStorage();
  }
  return cloneState(_state);
}

/**
 * Returns a deep copy of all transaction records.
 *
 * @returns {Array<Object>} List of transactions.
 */
export function getTransactions() {
  return getState().transactions;
}

/**
 * Returns a deep copy of all budget records.
 *
 * @returns {Array<Object>} List of budgets.
 */
export function getBudgets() {
  return getState().budgets;
}

/**
 * Returns a deep copy of all savings goal records.
 *
 * @returns {Array<Object>} List of savings goals.
 */
export function getGoals() {
  return getState().goals;
}

/**
 * Returns a deep copy of current user preferences.
 *
 * @returns {Object} Preferences object.
 */
export function getPreferences() {
  return getState().preferences;
}

/**
 * Updates application preferences atomically.
 *
 * @param {Object} updates - Preferences to merge.
 * @returns {Object} Updated application state clone.
 */
export function updatePreferences(updates) {
  if (!updates || typeof updates !== 'object') {
    throw new Error('updates must be an object.');
  }
  return updateState((state) => {
    state.preferences = { ...state.preferences, ...updates };
    return state;
  });
}

/**
 * Low-level atomic write operation to the storage backend.
 * Never modifies in-memory state.
 *
 * @param {Object} stateObj - Complete state object to persist.
 * @throws {PersistenceError} If storage is unavailable or quota is exceeded.
 */
function persistState(stateObj) {
  let serialized;
  try {
    serialized = JSON.stringify(stateObj);
  } catch (err) {
    throw new PersistenceError('Failed to serialize application state to JSON.', err);
  }

  try {
    _storageBackend.setItem(STORAGE_KEYS.APP_DATA, serialized);
  } catch (err) {
    const isQuota = err && (
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22 ||
      err.code === 1014
    );

    const message = isQuota
      ? 'Device storage quota exceeded. Please export a JSON backup and clear obsolete data.'
      : 'Failed to write financial records to device storage.';

    throw new PersistenceError(message, err);
  }
}

/**
 * Atomically replaces the current state with a validated new state.
 *
 * Execution guarantee: In-memory state is ONLY updated if persistence succeeds.
 *
 * @param {Object} newState - Candidate state object.
 * @returns {Object} Updated application state clone.
 * @throws {PersistenceError} If validation fails or storage write fails.
 */
export function setState(newState) {
  const validation = validateStateSchema(newState);
  if (!validation.valid) {
    throw new PersistenceError(`Invalid state schema: ${validation.errors.join(' ')}`);
  }

  const candidate = cloneState(newState);
  candidate.updatedAt = new Date().toISOString();

  // Attempt atomic persistence FIRST
  persistState(candidate);

  // Persistence succeeded: commit in-memory update
  _state = candidate;

  // Notify subscribers
  notifySubscribers();

  return cloneState(_state);
}

/**
 * Atomically mutates state using an updater function.
 *
 * The updater function receives the current state and returns the desired next state.
 * If the updater throws or persistence fails, current state remains completely unmodified.
 *
 * @param {function(Object): Object} updaterFn - Pure updater function.
 * @returns {Object} Updated application state clone.
 * @throws {PersistenceError} If updater fails or persistence fails.
 */
export function updateState(updaterFn) {
  if (typeof updaterFn !== 'function') {
    throw new Error('updaterFn must be a function.');
  }

  const current = getState();
  const nextCandidate = updaterFn(cloneState(current));

  return setState(nextCandidate);
}

/**
 * Resets storage to a clean default state. Used for testing or after confirmed full restore.
 *
 * @returns {Object} Clean default state.
 */
export function resetStorage() {
  const defaultState = createDefaultState();
  persistState(defaultState);
  _state = defaultState;
  notifySubscribers();
  return cloneState(_state);
}

/**
 * Subscribes a listener callback to state change notifications.
 *
 * @param {function(Object): void} listener - Callback invoked on state changes.
 * @returns {function(): void} Unsubscribe function.
 */
export function subscribe(listener) {
  if (typeof listener !== 'function') {
    throw new Error('Subscriber must be a function.');
  }
  _subscribers.add(listener);
  return () => {
    _subscribers.delete(listener);
  };
}

/**
 * Notifies all active subscribers of a state change.
 */
function notifySubscribers() {
  const current = cloneState(_state);
  _subscribers.forEach((listener) => {
    try {
      listener(current);
    } catch (err) {
      console.error('Error in state subscriber callback:', err);
    }
  });
}
