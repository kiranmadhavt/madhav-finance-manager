import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGoal,
  addGoal,
  updateGoal,
  updateGoalSavedAmount,
  deleteGoal,
  calculateGoalProgress,
  getAllGoals
} from '../js/goals.js';
import { resetStorage } from '../js/storage.js';

test.beforeEach(() => {
  resetStorage();
});

test('Savings Goals: validates valid savings goal candidate', () => {
  const goal = {
    name: 'Emergency Fund',
    targetPaise: 50000000, // ₹5,00,000
    savedPaise: 15000000,  // ₹1,50,000
    targetDate: '2027-12-31'
  };

  const validation = validateGoal(goal);
  assert.strictEqual(validation.valid, true);
  assert.strictEqual(validation.errors.length, 0);
});

test('Savings Goals: rejects non-positive target or negative saved amount', () => {
  // Empty name
  assert.strictEqual(validateGoal({ name: '', targetPaise: 100000, savedPaise: 0 }).valid, false);

  // Zero target amount
  assert.strictEqual(validateGoal({ name: 'Car', targetPaise: 0, savedPaise: 0 }).valid, false);

  // Negative target amount
  assert.strictEqual(validateGoal({ name: 'Car', targetPaise: -50000, savedPaise: 0 }).valid, false);

  // Negative saved amount
  assert.strictEqual(validateGoal({ name: 'Car', targetPaise: 100000, savedPaise: -500 }).valid, false);

  // Invalid date
  assert.strictEqual(
    validateGoal({ name: 'Car', targetPaise: 100000, savedPaise: 0, targetDate: 'invalid-date' }).valid,
    false
  );
});

test('Savings Goals: allows saved amount to exceed target amount without error', () => {
  // Candidate with saved amount greater than target amount
  const exceededGoal = {
    name: 'Vacation Trip',
    targetPaise: 10000000, // Target: ₹1,00,000
    savedPaise: 12000000   // Saved: ₹1,20,000 (120%)
  };

  const validation = validateGoal(exceededGoal);
  assert.strictEqual(validation.valid, true);
});

test('Savings Goals: adds, updates, and deletes goals correctly', () => {
  const created = addGoal({
    name: 'New Laptop',
    targetPaise: 15000000, // ₹1,50,000
    savedPaise: 5000000,   // ₹50,000
    targetDate: '2027-06-30'
  });

  assert.strictEqual(typeof created.id, 'string');
  assert.strictEqual(created.id.startsWith('gol_'), true);
  assert.strictEqual(getAllGoals().length, 1);

  // Update manual balance
  const updated = updateGoalSavedAmount(created.id, 7500000);
  assert.strictEqual(updated.savedPaise, 7500000);

  // Delete goal
  const deleted = deleteGoal(created.id);
  assert.strictEqual(deleted.id, created.id);
  assert.strictEqual(getAllGoals().length, 0);
});

test('Savings Goals: calculates completion percentage and handles exceeded targets cleanly', () => {
  // Case 1: In progress (50%)
  const inProgressGoal = {
    id: 'g1',
    name: 'Emergency Fund',
    targetPaise: 10000000, // ₹1,00,000
    savedPaise: 5000000    // ₹50,000
  };
  const prog1 = calculateGoalProgress(inProgressGoal);
  assert.strictEqual(prog1.percentComplete, 50.0);
  assert.strictEqual(prog1.remainingPaise, 5000000);
  assert.strictEqual(prog1.surplusPaise, 0);
  assert.strictEqual(prog1.isCompleted, false);
  assert.strictEqual(prog1.isExceeded, false);

  // Case 2: Exactly reached (100%)
  const completedGoal = {
    ...inProgressGoal,
    savedPaise: 10000000
  };
  const prog2 = calculateGoalProgress(completedGoal);
  assert.strictEqual(prog2.percentComplete, 100.0);
  assert.strictEqual(prog2.remainingPaise, 0);
  assert.strictEqual(prog2.surplusPaise, 0);
  assert.strictEqual(prog2.isCompleted, true);
  assert.strictEqual(prog2.isExceeded, false);

  // Case 3: Exceeded target (125%)
  const exceededGoal = {
    ...inProgressGoal,
    savedPaise: 12500000 // ₹1,25,000
  };
  const prog3 = calculateGoalProgress(exceededGoal);
  assert.strictEqual(prog3.percentComplete, 125.0);
  assert.strictEqual(prog3.remainingPaise, 0); // Remaining clamped to 0
  assert.strictEqual(prog3.surplusPaise, 2500000); // Excess ₹25,000
  assert.strictEqual(prog3.isCompleted, true);
  assert.strictEqual(prog3.isExceeded, true);
});
