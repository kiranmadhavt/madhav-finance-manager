/**
 * Madhav Finance Manager - Transaction Domain Logic
 *
 * Implements transaction validation, CRUD operations, searching, multi-criteria filtering,
 * and deterministic sorting.
 */

import {
  TRANSACTION_TYPES,
  CATEGORIES_BY_TYPE,
  ALL_CATEGORIES,
  PAYMENT_MODES
} from './constants.js';
import {
  isPositivePaise,
  isValidDateString,
  generateId,
  getMonthFromDate
} from './utils.js';
import { getState, updateState } from './storage.js';

/**
 * Validates a transaction candidate against all domain and data integrity rules.
 *
 * @param {Object} candidate - Transaction object to validate.
 * @returns {{ valid: boolean, errors: string[] }} Validation result.
 */
export function validateTransaction(candidate) {
  const errors = [];

  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, errors: ['Transaction must be an object.'] };
  }

  // Type validation
  const validTypes = Object.values(TRANSACTION_TYPES);
  if (!validTypes.includes(candidate.type)) {
    errors.push(`Invalid transaction type: "${candidate.type}". Allowed: ${validTypes.join(', ')}.`);
  }

  // Amount validation (strictly positive integer paise)
  if (!isPositivePaise(candidate.amountPaise)) {
    errors.push('Transaction amount must be a positive safe integer representing paise.');
  }

  // Date validation (local calendar YYYY-MM-DD)
  if (!isValidDateString(candidate.date)) {
    errors.push(`Invalid transaction date: "${candidate.date}". Expected a valid calendar date in YYYY-MM-DD format.`);
  }

  // Category and Type pairing validation
  if (candidate.type && validTypes.includes(candidate.type)) {
    const allowedCategories = CATEGORIES_BY_TYPE[candidate.type] || [];
    const isCategoryValid = allowedCategories.some((cat) => cat.id === candidate.category);

    if (!isCategoryValid) {
      errors.push(`Category "${candidate.category}" is not valid for transaction type "${candidate.type}".`);
    }
  }

  // Payment mode validation
  const validPaymentModes = Object.keys(PAYMENT_MODES);
  if (!validPaymentModes.includes(candidate.paymentMode)) {
    errors.push(`Invalid payment mode: "${candidate.paymentMode}". Allowed: ${validPaymentModes.join(', ')}.`);
  }

  // Description validation
  if (typeof candidate.description !== 'string') {
    errors.push('Description must be a string.');
  } else if (candidate.description.trim().length > 200) {
    errors.push('Description must not exceed 200 characters.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Creates and persists a new transaction.
 *
 * @param {Object} params - Transaction parameters.
 * @param {string} params.type - 'income' | 'expense' | 'investment'.
 * @param {number} params.amountPaise - Positive integer paise.
 * @param {string} params.date - Calendar date string YYYY-MM-DD.
 * @param {string} params.category - Category identifier.
 * @param {string} params.paymentMode - Payment mode identifier.
 * @param {string} [params.description=''] - Optional description or note.
 * @param {string} [params.id] - Optional ID (generated automatically if omitted).
 * @returns {Object} Created and persisted transaction.
 * @throws {Error} If validation fails or persistence fails.
 */
export function addTransaction(params) {
  const transactionId = params.id || generateId('trn');
  const now = new Date().toISOString();

  const record = {
    id: transactionId,
    type: params.type,
    amountPaise: params.amountPaise,
    date: params.date,
    category: params.category,
    paymentMode: params.paymentMode,
    description: (params.description || '').trim(),
    createdAt: params.createdAt || now,
    updatedAt: now
  };

  const validation = validateTransaction(record);
  if (!validation.valid) {
    throw new Error(`Transaction validation failed: ${validation.errors.join(' ')}`);
  }

  updateState((state) => {
    const isDuplicate = state.transactions.some((t) => t.id === record.id);
    if (isDuplicate) {
      throw new Error(`Transaction with ID "${record.id}" already exists.`);
    }

    state.transactions.push(record);
    return state;
  });

  return record;
}

/**
 * Updates an existing transaction by ID.
 *
 * @param {string} id - ID of the transaction to update.
 * @param {Object} updates - Properties to update.
 * @returns {Object} Updated transaction record.
 * @throws {Error} If transaction is not found, validation fails, or persistence fails.
 */
export function updateTransaction(id, updates) {
  if (!id || typeof id !== 'string') {
    throw new Error('Transaction ID is required.');
  }

  let updatedRecord = null;

  updateState((state) => {
    const index = state.transactions.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Transaction not found with ID "${id}".`);
    }

    const current = state.transactions[index];
    const candidate = {
      ...current,
      ...updates,
      id: current.id, // Immutable ID
      createdAt: current.createdAt, // Immutable creation timestamp
      updatedAt: new Date().toISOString()
    };

    if (typeof candidate.description === 'string') {
      candidate.description = candidate.description.trim();
    }

    const validation = validateTransaction(candidate);
    if (!validation.valid) {
      throw new Error(`Transaction validation failed: ${validation.errors.join(' ')}`);
    }

    state.transactions[index] = candidate;
    updatedRecord = candidate;
    return state;
  });

  return updatedRecord;
}

/**
 * Deletes a transaction by ID.
 *
 * @param {string} id - ID of the transaction to delete.
 * @returns {Object} The deleted transaction record.
 * @throws {Error} If transaction is not found or persistence fails.
 */
export function deleteTransaction(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('Transaction ID is required.');
  }

  let deletedRecord = null;

  updateState((state) => {
    const index = state.transactions.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Transaction not found with ID "${id}".`);
    }

    deletedRecord = state.transactions[index];
    state.transactions.splice(index, 1);
    return state;
  });

  return deletedRecord;
}

/**
 * Retrieves a single transaction by ID.
 *
 * @param {string} id - Transaction ID.
 * @returns {Object|null} Transaction record, or null if not found.
 */
export function getTransaction(id) {
  const { transactions } = getState();
  return transactions.find((t) => t.id === id) || null;
}

/**
 * Retrieves all transactions from application state.
 *
 * @returns {Array<Object>} List of all transaction records.
 */
export function getAllTransactions() {
  return getState().transactions;
}

/**
 * Filters a list of transactions by multiple criteria.
 *
 * @param {Array<Object>} transactions - Source list of transactions.
 * @param {Object} [filters={}] - Filter criteria.
 * @param {string} [filters.month] - Target month in YYYY-MM format.
 * @param {string} [filters.type] - 'income' | 'expense' | 'investment'.
 * @param {string} [filters.category] - Category identifier.
 * @param {string} [filters.paymentMode] - Payment mode identifier.
 * @param {string} [filters.search] - Free-text search term matching description or category name.
 * @returns {Array<Object>} Filtered list of transactions.
 */
export function filterTransactions(transactions, filters = {}) {
  if (!Array.isArray(transactions)) return [];

  const { month, type, category, paymentMode, search } = filters;
  const normalizedSearch = (search || '').trim().toLowerCase();

  return transactions.filter((trn) => {
    // Month filter
    if (month && getMonthFromDate(trn.date) !== month) {
      return false;
    }

    // Type filter
    if (type && trn.type !== type) {
      return false;
    }

    // Category filter
    if (category && trn.category !== category) {
      return false;
    }

    // Payment mode filter
    if (paymentMode && trn.paymentMode !== paymentMode) {
      return false;
    }

    // Text search filter
    if (normalizedSearch) {
      const descMatch = (trn.description || '').toLowerCase().includes(normalizedSearch);
      const catMeta = ALL_CATEGORIES[trn.category];
      const catMatch = catMeta && catMeta.name.toLowerCase().includes(normalizedSearch);

      if (!descMatch && !catMatch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sorts transactions chronologically with consistent secondary tie-breaking.
 *
 * @param {Array<Object>} transactions - List of transactions to sort.
 * @param {string} [order='desc'] - 'desc' (newest first) or 'asc' (oldest first).
 * @returns {Array<Object>} New array sorted by date and createdAt.
 */
export function sortTransactions(transactions, order = 'desc') {
  if (!Array.isArray(transactions)) return [];

  const multiplier = order === 'asc' ? 1 : -1;

  return [...transactions].sort((a, b) => {
    // Primary: Calendar date (YYYY-MM-DD string comparison is naturally chronological)
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date) * multiplier;
    }

    // Secondary: Creation timestamp
    const aCreated = a.createdAt || '';
    const bCreated = b.createdAt || '';
    return aCreated.localeCompare(bCreated) * multiplier;
  });
}

// Convenience export aliases
export const createTransaction = addTransaction;
export const getTransactions = getAllTransactions;
export const sortTransactionsByDateDesc = (txns) => sortTransactions(txns, 'desc');
