/**
 * Madhav Finance Manager - Financial Calculation Engine
 *
 * Implements pure financial calculations for monthly income, expenses, investments,
 * net monthly surplus, savings & investment rate, category breakdowns, and historical trends.
 *
 * CRITICAL QUALITY RULES:
 * 1. Zero DOM or UI manipulation.
 * 2. All monetary calculations operate strictly on integer paise.
 * 3. Never use converted floating-point rupees in financial calculations.
 */

import { TRANSACTION_TYPES, ALL_CATEGORIES } from './constants.js';
import { getPreviousMonths, getMonthFromDate } from './utils.js';

/**
 * Calculates total income in integer paise for a specified calendar month.
 *
 * @param {Array<Object>} transactions - List of transaction records.
 * @param {string} targetMonth - Calendar month in YYYY-MM format.
 * @returns {number} Total income in integer paise.
 */
export function calculateMonthlyIncome(transactions, targetMonth) {
  if (!Array.isArray(transactions) || !targetMonth) return 0;

  return transactions.reduce((sum, trn) => {
    if (trn.type === TRANSACTION_TYPES.INCOME && getMonthFromDate(trn.date) === targetMonth) {
      const nextSum = sum + trn.amountPaise;
      if (!Number.isSafeInteger(nextSum)) {
        throw new RangeError('Financial arithmetic overflow: monthly income sum exceeds safe integer limit.');
      }
      return nextSum;
    }
    return sum;
  }, 0);
}

/**
 * Calculates total consumption expenses in integer paise for a specified calendar month.
 * Investments are strictly excluded from ordinary expenditure.
 *
 * @param {Array<Object>} transactions - List of transaction records.
 * @param {string} targetMonth - Calendar month in YYYY-MM format.
 * @returns {number} Total expenses in integer paise.
 */
export function calculateMonthlyExpenses(transactions, targetMonth) {
  if (!Array.isArray(transactions) || !targetMonth) return 0;

  return transactions.reduce((sum, trn) => {
    if (trn.type === TRANSACTION_TYPES.EXPENSE && getMonthFromDate(trn.date) === targetMonth) {
      const nextSum = sum + trn.amountPaise;
      if (!Number.isSafeInteger(nextSum)) {
        throw new RangeError('Financial arithmetic overflow: monthly expense sum exceeds safe integer limit.');
      }
      return nextSum;
    }
    return sum;
  }, 0);
}

/**
 * Calculates total investments in integer paise for a specified calendar month.
 *
 * @param {Array<Object>} transactions - List of transaction records.
 * @param {string} targetMonth - Calendar month in YYYY-MM format.
 * @returns {number} Total investments in integer paise.
 */
export function calculateMonthlyInvestments(transactions, targetMonth) {
  if (!Array.isArray(transactions) || !targetMonth) return 0;

  return transactions.reduce((sum, trn) => {
    if (trn.type === TRANSACTION_TYPES.INVESTMENT && getMonthFromDate(trn.date) === targetMonth) {
      const nextSum = sum + trn.amountPaise;
      if (!Number.isSafeInteger(nextSum)) {
        throw new RangeError('Financial arithmetic overflow: monthly investment sum exceeds safe integer limit.');
      }
      return nextSum;
    }
    return sum;
  }, 0);
}

/**
 * Calculates the net monthly surplus after deducting expenses and investments from income.
 *
 * Formula: Income - Expenses - Investments
 *
 * @param {number} incomePaise - Monthly income in integer paise.
 * @param {number} expensePaise - Monthly expenses in integer paise.
 * @param {number} investmentPaise - Monthly investments in integer paise.
 * @returns {number} Net surplus in integer paise (may be negative during a deficit).
 */
export function calculateNetSurplus(incomePaise, expensePaise, investmentPaise) {
  if (Array.isArray(incomePaise) && typeof expensePaise === 'string') {
    const inc = calculateMonthlyIncome(incomePaise, expensePaise);
    const exp = calculateMonthlyExpenses(incomePaise, expensePaise);
    const inv = calculateMonthlyInvestments(incomePaise, expensePaise);
    return calculateNetSurplus(inc, exp, inv);
  }

  const inc = Number.isSafeInteger(incomePaise) ? incomePaise : 0;
  const exp = Number.isSafeInteger(expensePaise) ? expensePaise : 0;
  const inv = Number.isSafeInteger(investmentPaise) ? investmentPaise : 0;

  const surplus = inc - exp - inv;
  if (!Number.isSafeInteger(surplus)) {
    throw new RangeError('Financial arithmetic overflow: net surplus calculation exceeds safe integer limit.');
  }

  return surplus;
}

/**
 * Calculates the savings and investment rate representing the proportion of income
 * retained as surplus and investments after consumption expenses.
 *
 * Formula: ((Income - Expenses) / Income) * 100
 *
 * - When income is <= 0: Returns 0.0 (prevents NaN or Infinity).
 * - When expenses > income: Returns a negative percentage reflecting capital erosion.
 *
 * @param {number|Array<Object>} incomePaise - Monthly income in integer paise or transactions list.
 * @param {number|string} expensePaise - Monthly expenses in integer paise or month string.
 * @returns {number} Savings rate percentage (unrounded float).
 */
export function calculateSavingsRate(incomePaise, expensePaise) {
  if (Array.isArray(incomePaise) && typeof expensePaise === 'string') {
    const inc = calculateMonthlyIncome(incomePaise, expensePaise);
    const exp = calculateMonthlyExpenses(incomePaise, expensePaise);
    return calculateSavingsRate(inc, exp);
  }

  const inc = Number.isSafeInteger(incomePaise) ? incomePaise : 0;
  const exp = Number.isSafeInteger(expensePaise) ? expensePaise : 0;

  if (inc <= 0) {
    return 0.0;
  }

  return ((inc - exp) / inc) * 100;
}

/**
 * Computes a complete financial KPI summary for a given calendar month.
 *
 * @param {Array<Object>} transactions - List of transaction records.
 * @param {string} targetMonth - Calendar month in YYYY-MM format.
 * @returns {Object} Comprehensive monthly KPI summary.
 */
export function calculateMonthlySummary(transactions, targetMonth) {
  const incomePaise = calculateMonthlyIncome(transactions, targetMonth);
  const expensePaise = calculateMonthlyExpenses(transactions, targetMonth);
  const investmentPaise = calculateMonthlyInvestments(transactions, targetMonth);
  const surplusPaise = calculateNetSurplus(incomePaise, expensePaise, investmentPaise);
  const savingsRate = calculateSavingsRate(incomePaise, expensePaise);

  return {
    targetMonth,
    incomePaise,
    expensePaise,
    investmentPaise,
    surplusPaise,
    savingsRate,
    isDeficit: surplusPaise < 0,
    hasIncome: incomePaise > 0
  };
}

/**
 * Aggregates transactions by category for a specific month and type.
 * Computes the total paise and percentage distribution for each active category.
 *
 * @param {Array<Object>} transactions - List of transaction records.
 * @param {string} targetMonth - Calendar month in YYYY-MM format.
 * @param {string} [type=TRANSACTION_TYPES.EXPENSE] - Transaction type to aggregate.
 * @returns {Array<Object>} Category breakdowns sorted descending by total amount.
 */
export function calculateCategoryBreakdown(transactions, targetMonth, type = TRANSACTION_TYPES.EXPENSE) {
  if (!Array.isArray(transactions) || !targetMonth) return [];

  const categoryTotals = new Map();
  let grandTotalPaise = 0;

  transactions.forEach((trn) => {
    if (trn.type === type && getMonthFromDate(trn.date) === targetMonth) {
      const prev = categoryTotals.get(trn.category) || 0;
      categoryTotals.set(trn.category, prev + trn.amountPaise);
      grandTotalPaise += trn.amountPaise;
    }
  });

  const breakdown = [];

  categoryTotals.forEach((totalPaise, categoryId) => {
    const meta = ALL_CATEGORIES[categoryId];
    const categoryName = meta ? meta.name : categoryId;
    const percentage = grandTotalPaise > 0 ? (totalPaise / grandTotalPaise) * 100 : 0;

    breakdown.push({
      categoryId,
      categoryName,
      type,
      totalPaise,
      percentage
    });
  });

  // Sort descending by totalPaise
  breakdown.sort((a, b) => b.totalPaise - a.totalPaise);

  return breakdown;
}

/**
 * Computes chronological monthly financial trend summaries for historical charts.
 * Guarantees that months with zero transactions are included with 0 paise amounts.
 *
 * @param {Array<Object>} transactions - List of transaction records.
 * @param {string} targetMonth - Latest month in the series in YYYY-MM format.
 * @param {number} [count=6] - Number of consecutive calendar months.
 * @returns {Array<Object>} Chronological list of monthly summaries (oldest to newest).
 */
export function calculateTrendHistory(transactions, targetMonth, count = 6) {
  const months = getPreviousMonths(targetMonth, count);

  return months.map((month) => {
    return calculateMonthlySummary(transactions, month);
  });
}
