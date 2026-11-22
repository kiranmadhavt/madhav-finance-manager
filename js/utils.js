/**
 * Madhav Finance Manager - Core Utility Functions
 *
 * Implements currency formatting (en-IN), monetary conversion (rupees to paise),
 * safe integer validation, local calendar date handling, unique ID generation,
 * and safe DOM manipulation helpers.
 */

import { CURRENCY } from './constants.js';

/**
 * Validates that a value is a non-negative safe integer representing monetary paise.
 *
 * @param {unknown} value - Value to validate.
 * @returns {boolean} True if the value is a safe non-negative integer.
 */
export function isValidPaise(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Validates that a value is a strictly positive safe integer representing monetary paise.
 *
 * @param {unknown} value - Value to validate.
 * @returns {boolean} True if the value is a safe integer greater than zero.
 */
export function isPositivePaise(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/**
 * Converts integer paise into a floating-point rupee number for display calculation.
 * Never persist the return value of this function.
 *
 * @param {number} paise - Amount in integer paise.
 * @returns {number} Amount in rupees.
 */
export function paiseToRupees(paise) {
  if (!Number.isSafeInteger(paise)) return 0;
  return paise / 100;
}

/**
 * Parses user-entered rupee input (string or number) into exact integer paise.
 * Avoids IEEE-754 floating-point rounding errors by splitting decimal components.
 *
 * Examples:
 *   "1250"     -> 125000
 *   "1250.5"   -> 125050
 *   "1250.50"  -> 125050
 *   "1,250.00" -> 125000
 *   "-500"     -> null (negative values rejected)
 *   "abc"      -> null (invalid)
 *
 * @param {string|number} input - Rupee input to parse.
 * @returns {number|null} Exact integer paise, or null if input is invalid.
 */
export function parseRupeesToPaise(input) {
  if (input === null || input === undefined) return null;

  let str = String(input).trim();
  if (str === '') return null;

  // Remove commas (e.g., from formatted inputs "1,25,000")
  str = str.replace(/,/g, '');

  // Must match optional digits followed by optional single dot and at most 2 decimal digits
  // Rejects negatives, multiple dots, letters, scientific notation
  const regex = /^\d+(\.\d{1,2})?$/;
  if (!regex.test(str)) {
    return null;
  }

  const parts = str.split('.');
  const wholePartStr = parts[0] || '0';
  const fracPartStr = (parts[1] || '').padEnd(2, '0');

  const wholeRupees = parseInt(wholePartStr, 10);
  const fracPaise = parseInt(fracPartStr, 10);

  if (!Number.isSafeInteger(wholeRupees) || !Number.isSafeInteger(fracPaise)) {
    return null;
  }

  const totalPaise = wholeRupees * 100 + fracPaise;

  if (!Number.isSafeInteger(totalPaise) || totalPaise < 0) {
    return null;
  }

  return totalPaise;
}

/**
 * Formats an amount in integer paise as an Indian Rupee (INR) currency string.
 *
 * @param {number} paise - Amount in integer paise (can be negative for deficit/surplus).
 * @param {Object} [options={}] - Formatting options.
 * @param {boolean} [options.showSymbol=true] - Whether to prepend the ₹ symbol.
 * @param {boolean} [options.showSign=false] - Whether to explicitly prefix positive numbers with '+'.
 * @returns {string} Formatted INR string (e.g., "₹1,25,000.00" or "-₹4,500.00").
 */
export function formatINR(paise, options = {}) {
  const { showSymbol = true, showSign = false } = options;

  if (typeof paise !== 'number' || !Number.isSafeInteger(paise)) {
    return showSymbol ? '₹0.00' : '0.00';
  }

  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);

  // Exact integer decomposition prevents floating-point rounding errors near Number.MAX_SAFE_INTEGER
  const wholeRupees = Math.floor(absPaise / 100);
  const fracPaise = absPaise % 100;
  const formattedWhole = wholeRupees.toLocaleString(CURRENCY.LOCALE);
  const formattedFrac = String(fracPaise).padStart(2, '0');
  const formatted = `${formattedWhole}.${formattedFrac}`;

  const sign = isNegative ? '-' : (showSign && paise > 0 ? '+' : '');
  const symbol = showSymbol ? CURRENCY.SYMBOL : '';

  return `${sign}${symbol}${formatted}`;
}

/**
 * Formats a percentage number for display with standard rounding.
 *
 * @param {number} percent - Percentage value.
 * @param {number} [decimals=1] - Decimal precision.
 * @returns {string} Formatted percentage string (e.g., "56.2%", "0.0%", "-12.5%").
 */
export function formatPercent(percent, decimals = 1) {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) {
    return '0.0%';
  }
  return `${percent.toFixed(decimals)}%`;
}

/**
 * Returns the current local calendar date formatted as YYYY-MM-DD.
 * Uses local calendar components to prevent UTC date shifting.
 *
 * @param {Date} [date=new Date()] - Date object to convert.
 * @returns {string} Date string in YYYY-MM-DD format.
 */
export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validates that a string is a valid real calendar date in YYYY-MM-DD format.
 * Checks for invalid dates such as 2026-02-30 or 2025-02-29.
 *
 * @param {string} dateStr - Date string to validate.
 * @returns {boolean} True if the string is a valid calendar date.
 */
export function isValidDateString(dateStr) {
  if (typeof dateStr !== 'string') return false;

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Use Date constructor with local values to verify day existence in month
  const testDate = new Date(year, month - 1, day);
  return (
    testDate.getFullYear() === year &&
    testDate.getMonth() === month - 1 &&
    testDate.getDate() === day
  );
}

/**
 * Formats a YYYY-MM-DD date string into a user-friendly display date.
 *
 * @param {string} dateStr - Date string in YYYY-MM-DD format.
 * @param {Object} [options={}] - Intl.DateTimeFormat options.
 * @returns {string} Formatted display date (e.g., "20 Nov 2026").
 */
export function formatDisplayDate(dateStr, options = {}) {
  if (!isValidDateString(dateStr)) return dateStr || '';

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const defaultOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };

  return date.toLocaleDateString(CURRENCY.LOCALE, { ...defaultOptions, ...options });
}

/**
 * Returns the current local calendar month formatted as YYYY-MM.
 *
 * @param {Date} [date=new Date()] - Date object to convert.
 * @returns {string} Month identifier string in YYYY-MM format.
 */
export function getCurrentMonthString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Validates that a string is a valid month identifier in YYYY-MM format.
 *
 * @param {string} monthStr - Month string to validate.
 * @returns {boolean} True if valid.
 */
export function isValidMonthString(monthStr) {
  if (typeof monthStr !== 'string') return false;
  const match = monthStr.match(/^(\d{4})-(\d{2})$/);
  if (!match) return false;

  const month = parseInt(match[2], 10);
  return month >= 1 && month <= 12;
}

/**
 * Formats a YYYY-MM month string into a readable label.
 *
 * @param {string} monthStr - Month identifier in YYYY-MM format.
 * @param {boolean} [short=false] - Whether to use abbreviated month name.
 * @returns {string} Formatted display month (e.g., "November 2026" or "Nov 2026").
 */
export function formatDisplayMonth(monthStr, short = false) {
  if (!isValidMonthString(monthStr)) return monthStr || '';

  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString(CURRENCY.LOCALE, {
    month: short ? 'short' : 'long',
    year: 'numeric'
  });
}

/**
 * Extracts the YYYY-MM month string from a YYYY-MM-DD date string.
 *
 * @param {string} dateStr - Date string in YYYY-MM-DD format.
 * @returns {string} Extracted YYYY-MM string, or empty string if invalid.
 */
export function getMonthFromDate(dateStr) {
  if (typeof dateStr !== 'string' || dateStr.length < 7) return '';
  return dateStr.slice(0, 7);
}

/**
 * Returns the next consecutive calendar month string in YYYY-MM format.
 *
 * @param {string} monthStr - Month string in YYYY-MM format.
 * @returns {string} Next month in YYYY-MM format.
 */
export function getNextMonth(monthStr) {
  if (!isValidMonthString(monthStr)) return getCurrentMonthString();
  const [year, month] = monthStr.split('-').map(Number);
  if (month === 12) {
    return `${year + 1}-01`;
  }
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * Returns the previous consecutive calendar month string in YYYY-MM format.
 *
 * @param {string} monthStr - Month string in YYYY-MM format.
 * @returns {string} Previous month in YYYY-MM format.
 */
export function getPreviousMonth(monthStr) {
  if (!isValidMonthString(monthStr)) return getCurrentMonthString();
  const [year, month] = monthStr.split('-').map(Number);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

/**
 * Generates an array of consecutive month strings ending at targetMonth in chronological order.
 *
 * @param {string} targetMonth - Ending month in YYYY-MM format.
 * @param {number} [count=6] - Number of months to generate.
 * @returns {string[]} Array of month strings in chronological order (oldest to newest).
 */
export function getPreviousMonths(targetMonth, count = 6) {
  if (!isValidMonthString(targetMonth) || count <= 0) {
    return [];
  }

  const result = [];
  let current = targetMonth;

  for (let i = 0; i < count; i++) {
    result.unshift(current);
    current = getPreviousMonth(current);
  }

  return result;
}

/**
 * Generates a collision-resistant unique identifier with a module prefix.
 *
 * @param {string} [prefix='id'] - Prefix indicating record type (e.g., 'trn', 'bgt', 'gol').
 * @returns {string} Unique identifier string (e.g., 'trn_a1b2c3d4e5f67890').
 */
export function generateId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    const rawUuid = crypto.randomUUID().replace(/-/g, '');
    return `${prefix}_${rawUuid.slice(0, 16)}`;
  }
  // Fallback for environments lacking crypto.randomUUID
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${randomPart}`;
}

/**
 * Escapes special HTML characters in a string to prevent Cross-Site Scripting (XSS).
 *
 * @param {unknown} value - Value to escape.
 * @returns {string} Sanitized string safe for DOM interpolation.
 */
export function escapeHTML(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes a string for CSV export to prevent spreadsheet formula injection.
 * Neutralizes cells beginning with '=', '+', '-', or '@', and handles RFC-4180 quotes.
 *
 * @param {unknown} value - Cell value to format.
 * @returns {string} Sanitized, escaped CSV cell string.
 */
export function sanitizeForCSV(value) {
  if (value === null || value === undefined) return '""';

  let str = String(value);

  // Neutralize formula injection triggers
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  // RFC-4180: Escape double quotes by doubling them, wrap in quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}
