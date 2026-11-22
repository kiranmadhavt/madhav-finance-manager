/**
 * Madhav Finance Manager - Budget Domain Logic
 *
 * Implements recurring default category budgets, month-specific budget overrides,
 * resolution hierarchy, spending tracking, and status threshold classification.
 *
 * RESOLUTION PRIORITY:
 * Month-specific override (`month === "YYYY-MM"`) > Recurring default (`month === null`) > No budget.
 */

import {
  EXPENSE_CATEGORIES,
  BUDGET_THRESHOLDS,
  TRANSACTION_TYPES
} from './constants.js';
import {
  isPositivePaise,
  isValidMonthString,
  generateId,
  getMonthFromDate
} from './utils.js';
import { getState, updateState } from './storage.js';

/**
 * Validates a budget candidate against domain constraints.
 *
 * @param {Object} candidate - Budget candidate to validate.
 * @returns {{ valid: boolean, errors: string[] }} Validation result.
 */
export function validateBudget(candidate) {
  const errors = [];

  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, errors: ['Budget must be an object.'] };
  }

  // Category validation (must be a valid expense category)
  const validExpenseCategories = Object.keys(EXPENSE_CATEGORIES);
  if (!validExpenseCategories.includes(candidate.category)) {
    errors.push(
      `Invalid budget category: "${candidate.category}". Budgets can only be assigned to expense categories.`
    );
  }

  // Limit validation (positive safe integer paise)
  if (!isPositivePaise(candidate.limitPaise)) {
    errors.push('Budget limit must be a positive safe integer representing paise.');
  }

  // Month validation: either null (recurring default) or valid YYYY-MM (override)
  if (candidate.month !== null && candidate.month !== undefined) {
    if (!isValidMonthString(candidate.month)) {
      errors.push(`Invalid budget month: "${candidate.month}". Expected null for recurring default or YYYY-MM for override.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Creates and persists a new budget (either a recurring default or a month-specific override).
 *
 * @param {Object} params - Budget parameters.
 * @param {string} params.category - Expense category identifier.
 * @param {number} params.limitPaise - Budget limit in integer paise.
 * @param {string|null} [params.month=null] - Month in YYYY-MM format, or null for recurring default.
 * @param {string} [params.id] - Optional ID (auto-generated if omitted).
 * @returns {Object} Created and persisted budget record.
 * @throws {Error} If validation fails or duplicate constraint is violated.
 */
export function addBudget(params) {
  const budgetId = params.id || generateId('bgt');
  const month = params.month || null;
  const now = new Date().toISOString();

  const record = {
    id: budgetId,
    category: params.category,
    limitPaise: params.limitPaise,
    month,
    createdAt: params.createdAt || now,
    updatedAt: now
  };

  const validation = validateBudget(record);
  if (!validation.valid) {
    throw new Error(`Budget validation failed: ${validation.errors.join(' ')}`);
  }

  updateState((state) => {
    // Check for ID collision
    if (state.budgets.some((b) => b.id === record.id)) {
      throw new Error(`Budget with ID "${record.id}" already exists.`);
    }

    // Constraint: only one default budget per expense category
    if (record.month === null) {
      const existingDefault = state.budgets.some(
        (b) => b.category === record.category && (b.month === null || b.month === undefined)
      );
      if (existingDefault) {
        throw new Error(`A default recurring budget already exists for category "${record.category}".`);
      }
    } else {
      // Constraint: only one override per category per month
      const existingOverride = state.budgets.some(
        (b) => b.category === record.category && b.month === record.month
      );
      if (existingOverride) {
        throw new Error(
          `A budget override already exists for category "${record.category}" in month "${record.month}".`
        );
      }
    }

    state.budgets.push(record);
    return state;
  });

  return record;
}

/**
 * Updates an existing budget's limit or month.
 *
 * @param {string} id - Budget ID to update.
 * @param {Object} updates - Properties to update (e.g. limitPaise).
 * @returns {Object} Updated budget record.
 */
export function updateBudget(id, updates) {
  if (!id || typeof id !== 'string') {
    throw new Error('Budget ID is required.');
  }

  let updatedRecord = null;

  updateState((state) => {
    const index = state.budgets.findIndex((b) => b.id === id);
    if (index === -1) {
      throw new Error(`Budget not found with ID "${id}".`);
    }

    const current = state.budgets[index];
    const candidate = {
      ...current,
      ...updates,
      id: current.id,
      category: current.category, // Category remains fixed
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString()
    };

    if (candidate.month === undefined) {
      candidate.month = null;
    }

    const validation = validateBudget(candidate);
    if (!validation.valid) {
      throw new Error(`Budget validation failed: ${validation.errors.join(' ')}`);
    }

    // Constraint: ensure no duplicate collision when month/scope changes
    if (candidate.month === null) {
      const collision = state.budgets.some(
        (b) => b.id !== id && b.category === candidate.category && (b.month === null || b.month === undefined)
      );
      if (collision) {
        throw new Error(`A default recurring budget already exists for category "${candidate.category}".`);
      }
    } else {
      const collision = state.budgets.some(
        (b) => b.id !== id && b.category === candidate.category && b.month === candidate.month
      );
      if (collision) {
        throw new Error(`A budget override already exists for category "${candidate.category}" in month "${candidate.month}".`);
      }
    }

    state.budgets[index] = candidate;
    updatedRecord = candidate;
    return state;
  });

  return updatedRecord;
}

/**
 * Deletes a budget by ID.
 *
 * @param {string} id - Budget ID to delete.
 * @returns {Object} Deleted budget record.
 */
export function deleteBudget(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('Budget ID is required.');
  }

  let deletedRecord = null;

  updateState((state) => {
    const index = state.budgets.findIndex((b) => b.id === id);
    if (index === -1) {
      throw new Error(`Budget not found with ID "${id}".`);
    }

    deletedRecord = state.budgets[index];
    state.budgets.splice(index, 1);
    return state;
  });

  return deletedRecord;
}

/**
 * Retrieves all budgets from state.
 *
 * @returns {Array<Object>} List of all budget records.
 */
export function getAllBudgets() {
  return getState().budgets;
}

/**
 * Resolves the effective budget for a category in a specific calendar month.
 *
 * Priority:
 * 1. Month-specific override (`month === targetMonth`)
 * 2. Recurring default budget (`month === null` or undefined)
 * 3. None (`null`)
 *
 * @param {Array<Object>} budgets - List of all budget records.
 * @param {string} categoryId - Category identifier.
 * @param {string} targetMonth - Target month in YYYY-MM format.
 * @returns {Object|null} Resolved effective budget, or null if no budget exists.
 */
export function resolveBudget(budgets, categoryId, targetMonth) {
  if (!Array.isArray(budgets) || !categoryId) return null;

  // 1. Check for month-specific override
  if (targetMonth) {
    const override = budgets.find((b) => b.category === categoryId && b.month === targetMonth);
    if (override) {
      return { ...override, isOverride: true };
    }
  }

  // 2. Fall back to recurring default budget
  const defaultBudget = budgets.find(
    (b) => b.category === categoryId && (b.month === null || b.month === undefined)
  );

  if (defaultBudget) {
    return { ...defaultBudget, isOverride: false };
  }

  return null;
}

/**
 * Calculates budget utilization and health status for a specific budget in a given month.
 *
 * @param {Object} budget - Effective budget record.
 * @param {Array<Object>} transactions - List of transactions.
 * @param {string} targetMonth - Calendar month in YYYY-MM format.
 * @returns {Object} Utilization report.
 */
export function calculateBudgetUtilization(budget, transactions, targetMonth) {
  if (!budget || !targetMonth) return null;

  const month = targetMonth;
  let spentPaise = 0;

  if (Array.isArray(transactions)) {
    spentPaise = transactions.reduce((sum, trn) => {
      if (
        trn.type === TRANSACTION_TYPES.EXPENSE &&
        trn.category === budget.category &&
        getMonthFromDate(trn.date) === month
      ) {
        return sum + trn.amountPaise;
      }
      return sum;
    }, 0);
  }

  const limitPaise = budget.limitPaise;
  const remainingPaise = limitPaise - spentPaise;
  const percentUsed = limitPaise > 0 ? (spentPaise / limitPaise) * 100 : 0;

  // Status classification based on agreed thresholds
  let status = BUDGET_THRESHOLDS.STATUS.NORMAL;
  if (percentUsed > BUDGET_THRESHOLDS.DANGER_PERCENT) {
    status = BUDGET_THRESHOLDS.STATUS.DANGER;
  } else if (percentUsed >= BUDGET_THRESHOLDS.WARNING_PERCENT) {
    status = BUDGET_THRESHOLDS.STATUS.WARNING;
  }

  return {
    budgetId: budget.id,
    id: budget.id,
    category: budget.category,
    isOverride: Boolean(budget.isOverride || (budget.month && budget.month === targetMonth)),
    month: targetMonth,
    limitPaise,
    spentPaise,
    remainingPaise,
    percentUsed,
    spentPercent: percentUsed,
    thresholdStatus: status,
    isOverspent: spentPaise > limitPaise,
    status
  };
}

/**
 * Resolves and calculates utilization for all active budgets in a given month.
 *
 * @param {Array<Object>} budgets - List of all budget records.
 * @param {Array<Object>} transactions - List of all transaction records.
 * @param {string} targetMonth - Target month in YYYY-MM format.
 * @returns {Array<Object>} Array of utilization reports for all budgeted categories.
 */
export function calculateAllBudgetsUtilization(budgets, transactions, targetMonth) {
  if (!Array.isArray(budgets) || !targetMonth) return [];

  // Find all distinct categories that have either an override or a default budget
  const categoryIds = new Set();
  budgets.forEach((b) => {
    if (b.month === targetMonth || b.month === null || b.month === undefined) {
      categoryIds.add(b.category);
    }
  });

  const reports = [];

  categoryIds.forEach((catId) => {
    const resolved = resolveBudget(budgets, catId, targetMonth);
    if (resolved) {
      const util = calculateBudgetUtilization(resolved, transactions, targetMonth);
      if (util) {
        reports.push(util);
      }
    }
  });

  // Sort by highest percentUsed descending
  reports.sort((a, b) => b.percentUsed - a.percentUsed);

  return reports;
}

// Convenience export aliases
export const createBudget = addBudget;
export const getBudgets = getAllBudgets;
export const getMonthlyBudgetStatus = calculateAllBudgetsUtilization;
