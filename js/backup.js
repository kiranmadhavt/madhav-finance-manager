/**
 * Madhav Finance Manager - Backup, Restore & CSV Export Engine
 *
 * Implements:
 * 1. Versioned JSON export.
 * 2. Strict multi-layer JSON validation prior to restoration.
 * 3. Pre-restore safety snapshots.
 * 4. Full restore and merge import strategies.
 * 5. RFC-4180 compliant CSV statement export with spreadsheet formula injection protection.
 */

import { STORAGE_KEYS, ALL_CATEGORIES, PAYMENT_MODES, TRANSACTION_TYPES } from './constants.js';
import { sanitizeForCSV, paiseToRupees } from './utils.js';
import { getState, setState, updateState, getStorageBackend } from './storage.js';
import { validateTransaction } from './transactions.js';
import { validateBudget } from './budgets.js';
import { validateGoal } from './goals.js';

/**
 * Exports current application state as a validated, versioned JSON backup string.
 *
 * @param {Object} [stateToExport] - Optional state object to export; defaults to live state.
 * @returns {string} Formatted JSON backup string.
 */
export function exportJSONBackup(stateToExport = null) {
  const sourceState = stateToExport || getState();

  const backupObject = {
    appName: STORAGE_KEYS.APP_NAME,
    backupFormatVersion: STORAGE_KEYS.BACKUP_FORMAT_VERSION,
    schemaVersion: STORAGE_KEYS.SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      transactions: sourceState.transactions || [],
      budgets: sourceState.budgets || [],
      goals: sourceState.goals || [],
      preferences: sourceState.preferences || {
        theme: 'system',
        currency: 'INR'
      }
    }
  };

  return JSON.stringify(backupObject, null, 2);
}

/**
 * Validates the entire payload of an imported JSON backup.
 *
 * Performs comprehensive checks:
 * - App identification and schema version compatibility.
 * - Structural integrity of transactions, budgets, goals, and preferences.
 * - Validation of individual records using domain validators.
 * - ID collision detection within the backup file itself.
 * - Calculation of financial aggregate summaries for pre-import verification.
 *
 * @param {unknown} payload - Parsed JSON backup object.
 * @returns {Object} Validation report with valid status, error list, and record summary.
 */
export function validateBackupPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['Backup payload must be a non-null JSON object.'], summary: null };
  }

  // Application identity check
  if (payload.appName !== STORAGE_KEYS.APP_NAME) {
    errors.push(`Invalid application identity: "${payload.appName}". Expected "${STORAGE_KEYS.APP_NAME}".`);
  }

  // Backup format version check
  if (payload.backupFormatVersion !== STORAGE_KEYS.BACKUP_FORMAT_VERSION) {
    errors.push(
      `Unsupported backup format version: ${payload.backupFormatVersion}. Expected version ${STORAGE_KEYS.BACKUP_FORMAT_VERSION}.`
    );
  }

  // Schema version check
  if (payload.schemaVersion !== STORAGE_KEYS.SCHEMA_VERSION) {
    errors.push(
      `Unsupported schema version: ${payload.schemaVersion}. Expected version ${STORAGE_KEYS.SCHEMA_VERSION}.`
    );
  }

  // Data container check
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    errors.push('Backup payload missing required "data" container object.');
    return { valid: false, errors, summary: null };
  }

  const { transactions, budgets, goals, preferences } = payload.data;

  // Transactions validation
  if (!Array.isArray(transactions)) {
    errors.push('Backup data "transactions" must be an array.');
  } else {
    const transactionIds = new Set();
    transactions.forEach((trn, index) => {
      const v = validateTransaction(trn);
      if (!v.valid) {
        errors.push(`Transaction at index ${index} invalid: ${v.errors.join(' ')}`);
      }
      if (trn.id) {
        if (transactionIds.has(trn.id)) {
          errors.push(`Duplicate transaction ID "${trn.id}" found in backup file.`);
        }
        transactionIds.add(trn.id);
      }
    });
  }

  // Budgets validation
  if (!Array.isArray(budgets)) {
    errors.push('Backup data "budgets" must be an array.');
  } else {
    const budgetIds = new Set();
    budgets.forEach((bgt, index) => {
      const v = validateBudget(bgt);
      if (!v.valid) {
        errors.push(`Budget at index ${index} invalid: ${v.errors.join(' ')}`);
      }
      if (bgt.id) {
        if (budgetIds.has(bgt.id)) {
          errors.push(`Duplicate budget ID "${bgt.id}" found in backup file.`);
        }
        budgetIds.add(bgt.id);
      }
    });
  }

  // Goals validation
  if (!Array.isArray(goals)) {
    errors.push('Backup data "goals" must be an array.');
  } else {
    const goalIds = new Set();
    goals.forEach((gol, index) => {
      const v = validateGoal(gol);
      if (!v.valid) {
        errors.push(`Savings goal at index ${index} invalid: ${v.errors.join(' ')}`);
      }
      if (gol.id) {
        if (goalIds.has(gol.id)) {
          errors.push(`Duplicate savings goal ID "${gol.id}" found in backup file.`);
        }
        goalIds.add(gol.id);
      }
    });
  }

  // Preferences validation
  if (!preferences || typeof preferences !== 'object') {
    errors.push('Backup data "preferences" must be an object.');
  }

  if (errors.length > 0) {
    return { valid: false, errors, summary: null };
  }

  // Compute verification summary for import preview
  let totalIncomePaise = 0;
  let totalExpensePaise = 0;
  let totalInvestmentPaise = 0;

  transactions.forEach((t) => {
    if (t.type === TRANSACTION_TYPES.INCOME) totalIncomePaise += t.amountPaise;
    else if (t.type === TRANSACTION_TYPES.EXPENSE) totalExpensePaise += t.amountPaise;
    else if (t.type === TRANSACTION_TYPES.INVESTMENT) totalInvestmentPaise += t.amountPaise;
  });

  return {
    valid: true,
    errors: [],
    summary: {
      transactionCount: transactions.length,
      budgetCount: budgets.length,
      goalCount: goals.length,
      totalIncomePaise,
      totalExpensePaise,
      totalInvestmentPaise
    }
  };
}

/**
 * Saves a safety snapshot of the active application state before destructive restore.
 *
 * @returns {boolean} True if rescue snapshot was successfully written.
 */
export function savePreRestoreSnapshot() {
  try {
    const currentState = getState();
    const serialized = JSON.stringify(currentState);
    const backend = getStorageBackend();
    backend.setItem(STORAGE_KEYS.PRE_RESTORE_BACKUP, serialized);
    return true;
  } catch (err) {
    console.warn('Warning: Failed to create pre-restore snapshot in storage.', err);
    return false;
  }
}

/**
 * Imports a JSON backup file.
 *
 * @param {string} jsonString - Raw JSON backup string.
 * @param {string} [mode='restore'] - 'restore' (full replace) | 'merge' (append non-duplicates).
 * @returns {Object} Import outcome with summary and conflict details.
 * @throws {Error} If JSON parsing fails or validation checks fail.
 */
export function importJSONBackup(jsonString, mode = 'restore') {
  if (typeof jsonString !== 'string' || jsonString.trim() === '') {
    throw new Error('Backup input must be a non-empty JSON string.');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(`JSON parsing failed: ${err.message}`);
  }

  const validation = validateBackupPayload(parsed);
  if (!validation.valid) {
    throw new Error(`Invalid backup structure: ${validation.errors.join(' ')}`);
  }

  const backupData = parsed.data;

  if (mode === 'restore') {
    // 1. Mandatory safety snapshot of existing data before any destructive operation
    const snapshotPersisted = savePreRestoreSnapshot();
    if (!snapshotPersisted) {
      throw new Error(
        'Full restore aborted: Failed to persist pre-restore safety snapshot to storage. Existing financial data was NOT modified.'
      );
    }

    // 2. Full replacement
    const newState = {
      schemaVersion: STORAGE_KEYS.SCHEMA_VERSION,
      transactions: backupData.transactions,
      budgets: backupData.budgets,
      goals: backupData.goals,
      preferences: backupData.preferences || { theme: 'system', currency: 'INR' },
      updatedAt: new Date().toISOString()
    };

    setState(newState);

    return {
      success: true,
      mode: 'restore',
      transactions: validation.summary.transactions,
      budgets: validation.summary.budgets,
      goals: validation.summary.goals,
      summary: validation.summary,
      conflicts: []
    };
  }

  if (mode === 'merge') {
    let addedTransactionsCount = 0;
    let addedBudgetsCount = 0;
    let addedGoalsCount = 0;
    const conflicts = [];

    updateState((state) => {
      // 1. Merge transactions (skip duplicate IDs)
      const existingTxnIds = new Set(state.transactions.map((t) => t.id));
      backupData.transactions.forEach((txn) => {
        if (existingTxnIds.has(txn.id)) {
          conflicts.push({ type: 'transaction', id: txn.id, description: txn.description });
        } else {
          state.transactions.push(txn);
          existingTxnIds.add(txn.id);
          addedTransactionsCount++;
        }
      });

      // 2. Merge budgets (skip duplicate IDs and rule duplicates)
      const existingBgtIds = new Set(state.budgets.map((b) => b.id));
      backupData.budgets.forEach((bgt) => {
        if (existingBgtIds.has(bgt.id)) {
          conflicts.push({ type: 'budget', id: bgt.id, category: bgt.category });
          return;
        }

        // Check if an equivalent default/override already exists
        const hasConflict = state.budgets.some(
          (b) => b.category === bgt.category && b.month === bgt.month
        );

        if (hasConflict) {
          conflicts.push({
            type: 'budget_rule_conflict',
            id: bgt.id,
            category: bgt.category,
            month: bgt.month
          });
        } else {
          state.budgets.push(bgt);
          existingBgtIds.add(bgt.id);
          addedBudgetsCount++;
        }
      });

      // 3. Merge savings goals (skip duplicate IDs)
      const existingGoalIds = new Set(state.goals.map((g) => g.id));
      backupData.goals.forEach((gol) => {
        if (existingGoalIds.has(gol.id)) {
          conflicts.push({ type: 'goal', id: gol.id, name: gol.name });
        } else {
          state.goals.push(gol);
          existingGoalIds.add(gol.id);
          addedGoalsCount++;
        }
      });

      return state;
    });

    return {
      success: true,
      mode: 'merge',
      transactions: addedTransactionsCount,
      budgets: addedBudgetsCount,
      goals: addedGoalsCount,
      added: {
        transactions: addedTransactionsCount,
        budgets: addedBudgetsCount,
        goals: addedGoalsCount
      },
      conflicts
    };
  }

  throw new Error(`Unsupported import mode: "${mode}". Use "restore" or "merge".`);
}

/**
 * Exports transaction records to an RFC-4180 compliant CSV string.
 *
 * Protects against spreadsheet formula injection by sanitizing fields starting with =, +, -, or @.
 * Prepends a UTF-8 Byte Order Mark (\uFEFF) so Excel and spreadsheet apps display special characters correctly.
 *
 * @param {Array<Object>} transactions - List of transactions to export.
 * @returns {string} RFC-4180 compliant CSV text with UTF-8 BOM.
 */
export function exportTransactionsToCSV(transactions) {
  if (!Array.isArray(transactions)) return '';

  const headers = [
    'Date',
    'Type',
    'Category',
    'Description',
    'Payment Mode',
    'Amount (INR)'
  ];

  const headerLine = headers.map(sanitizeForCSV).join(',');
  const lines = [headerLine];

  transactions.forEach((trn) => {
    const catMeta = ALL_CATEGORIES[trn.category];
    const categoryName = catMeta ? catMeta.name : trn.category;

    const pmMeta = PAYMENT_MODES[trn.paymentMode];
    const paymentModeName = pmMeta ? pmMeta.name : trn.paymentMode;

    const rupees = paiseToRupees(trn.amountPaise).toFixed(2);

    const row = [
      trn.date,
      trn.type,
      categoryName,
      trn.description || '',
      paymentModeName,
      rupees
    ];

    lines.push(row.map(sanitizeForCSV).join(','));
  });

  // Prepend UTF-8 BOM for Microsoft Excel / Numbers compatibility
  return '\uFEFF' + lines.join('\r\n');
}
