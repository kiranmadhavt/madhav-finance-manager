/**
 * Madhav Finance Manager - Savings Goal Domain Logic
 *
 * Implements savings goals CRUD, manual balance updates, target exceeded tracking,
 * and completion progress calculation.
 *
 * CRITICAL RULE:
 * Saved amounts may exceed target amounts (`savedPaise >= targetPaise`), and
 * progress may exceed 100%. Goal balances must be updated explicitly by the user.
 */

import {
  isPositivePaise,
  isValidPaise,
  isValidDateString,
  generateId
} from './utils.js';
import { getState, updateState } from './storage.js';

/**
 * Validates a savings goal candidate against domain constraints.
 *
 * @param {Object} candidate - Goal candidate to validate.
 * @returns {{ valid: boolean, errors: string[] }} Validation result.
 */
export function validateGoal(candidate) {
  const errors = [];

  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, errors: ['Savings goal must be an object.'] };
  }

  // Name validation
  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
    errors.push('Goal name is required.');
  } else if (candidate.name.trim().length > 100) {
    errors.push('Goal name must not exceed 100 characters.');
  }

  // Target amount validation (strictly positive safe integer paise)
  if (!isPositivePaise(candidate.targetPaise)) {
    errors.push('Target amount must be a positive safe integer representing paise.');
  }

  // Saved amount validation (non-negative safe integer paise; may exceed target)
  if (!isValidPaise(candidate.savedPaise)) {
    errors.push('Saved amount must be a non-negative safe integer representing paise.');
  }

  // Target date validation (optional YYYY-MM-DD)
  if (candidate.targetDate !== null && candidate.targetDate !== undefined && candidate.targetDate !== '') {
    if (!isValidDateString(candidate.targetDate)) {
      errors.push(`Invalid target date: "${candidate.targetDate}". Expected a valid calendar date in YYYY-MM-DD format.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Creates and persists a new savings goal.
 *
 * @param {Object} params - Goal parameters.
 * @param {string} params.name - Goal name.
 * @param {number} params.targetPaise - Target amount in integer paise.
 * @param {number} [params.savedPaise=0] - Current saved amount in integer paise.
 * @param {string|null} [params.targetDate=null] - Optional target completion date (YYYY-MM-DD).
 * @param {string} [params.id] - Optional ID (auto-generated if omitted).
 * @returns {Object} Created and persisted goal record.
 * @throws {Error} If validation fails or ID already exists.
 */
export function addGoal(params) {
  const goalId = params.id || generateId('gol');
  const now = new Date().toISOString();

  const record = {
    id: goalId,
    name: (params.name || '').trim(),
    targetPaise: params.targetPaise,
    savedPaise: params.savedPaise !== undefined ? params.savedPaise : 0,
    targetDate: params.targetDate || null,
    createdAt: params.createdAt || now,
    updatedAt: now
  };

  const validation = validateGoal(record);
  if (!validation.valid) {
    throw new Error(`Savings goal validation failed: ${validation.errors.join(' ')}`);
  }

  updateState((state) => {
    if (state.goals.some((g) => g.id === record.id)) {
      throw new Error(`Savings goal with ID "${record.id}" already exists.`);
    }

    state.goals.push(record);
    return state;
  });

  return record;
}

/**
 * Updates an existing savings goal by ID.
 *
 * @param {string} id - Goal ID to update.
 * @param {Object} updates - Properties to update (name, targetPaise, savedPaise, targetDate).
 * @returns {Object} Updated goal record.
 */
export function updateGoal(id, updates) {
  if (!id || typeof id !== 'string') {
    throw new Error('Goal ID is required.');
  }

  let updatedRecord = null;

  updateState((state) => {
    const index = state.goals.findIndex((g) => g.id === id);
    if (index === -1) {
      throw new Error(`Savings goal not found with ID "${id}".`);
    }

    const current = state.goals[index];
    const candidate = {
      ...current,
      ...updates,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString()
    };

    if (typeof candidate.name === 'string') {
      candidate.name = candidate.name.trim();
    }

    if (candidate.targetDate === '') {
      candidate.targetDate = null;
    }

    const validation = validateGoal(candidate);
    if (!validation.valid) {
      throw new Error(`Savings goal validation failed: ${validation.errors.join(' ')}`);
    }

    state.goals[index] = candidate;
    updatedRecord = candidate;
    return state;
  });

  return updatedRecord;
}

/**
 * Updates the saved balance of a savings goal.
 *
 * @param {string} id - Goal ID.
 * @param {number} newSavedPaise - New saved balance in integer paise (non-negative).
 * @returns {Object} Updated goal record.
 */
export function updateGoalSavedAmount(id, newSavedPaise) {
  if (!isValidPaise(newSavedPaise)) {
    throw new Error('Saved amount must be a non-negative safe integer representing paise.');
  }

  return updateGoal(id, { savedPaise: newSavedPaise });
}

/**
 * Deletes a savings goal by ID.
 *
 * @param {string} id - Goal ID to delete.
 * @returns {Object} Deleted goal record.
 */
export function deleteGoal(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('Goal ID is required.');
  }

  let deletedRecord = null;

  updateState((state) => {
    const index = state.goals.findIndex((g) => g.id === id);
    if (index === -1) {
      throw new Error(`Savings goal not found with ID "${id}".`);
    }

    deletedRecord = state.goals[index];
    state.goals.splice(index, 1);
    return state;
  });

  return deletedRecord;
}

/**
 * Retrieves all savings goals from state.
 *
 * @returns {Array<Object>} List of all savings goals.
 */
export function getAllGoals() {
  return getState().goals;
}

/**
 * Calculates progress metrics, completion status, and surplus for a savings goal.
 *
 * Supports goals that have reached 100% or exceeded their target (> 100%).
 *
 * @param {Object} goal - Savings goal record.
 * @returns {Object} Calculated progress report.
 */
export function calculateGoalProgress(goal) {
  if (!goal) return null;

  const targetPaise = goal.targetPaise || 0;
  const savedPaise = goal.savedPaise || 0;

  const remainingPaise = Math.max(0, targetPaise - savedPaise);
  const surplusPaise = Math.max(0, savedPaise - targetPaise);

  const percentComplete = targetPaise > 0 ? (savedPaise / targetPaise) * 100 : 0;
  const isCompleted = savedPaise >= targetPaise;
  const isExceeded = savedPaise > targetPaise;

  return {
    goalId: goal.id,
    id: goal.id,
    name: goal.name,
    targetPaise,
    savedPaise,
    remainingPaise,
    surplusPaise,
    percentComplete,
    progressPercent: percentComplete,
    isCompleted,
    isComplete: isCompleted,
    isExceeded,
    targetDate: goal.targetDate || null
  };
}

// Convenience export aliases
export const createGoal = addGoal;
export const getGoals = getAllGoals;
