/**
 * Madhav Finance Manager - Application Constants
 *
 * Single source of truth for transaction types, categories, payment modes,
 * storage keys, budget thresholds, and theme options.
 *
 * All objects are recursively frozen to guarantee runtime immutability.
 */

function deepFreeze(obj) {
  Object.keys(obj).forEach((prop) => {
    if (typeof obj[prop] === 'object' && obj[prop] !== null && !Object.isFrozen(obj[prop])) {
      deepFreeze(obj[prop]);
    }
  });
  return Object.freeze(obj);
}

/**
 * Transaction type identifiers.
 */
export const TRANSACTION_TYPES = deepFreeze({
  INCOME: 'income',
  EXPENSE: 'expense',
  INVESTMENT: 'investment'
});

/**
 * Income category identifiers and metadata.
 */
export const INCOME_CATEGORIES = deepFreeze({
  monthly_salary: {
    id: 'monthly_salary',
    name: 'Monthly Salary',
    type: 'income',
    icon: 'briefcase'
  },
  side_income: {
    id: 'side_income',
    name: 'Side Income / Freelance',
    type: 'income',
    icon: 'laptop'
  },
  dividends_interest: {
    id: 'dividends_interest',
    name: 'Dividends & Interest',
    type: 'income',
    icon: 'trending-up'
  },
  cashback_refunds: {
    id: 'cashback_refunds',
    name: 'Cashback / Refunds',
    type: 'income',
    icon: 'gift'
  },
  family_gift: {
    id: 'family_gift',
    name: 'Family / Gift',
    type: 'income',
    icon: 'heart'
  },
  other: {
    id: 'other',
    name: 'Other',
    type: 'income',
    icon: 'more-horizontal'
  }
});

/**
 * Expense category identifiers and metadata.
 */
export const EXPENSE_CATEGORIES = deepFreeze({
  housing: {
    id: 'housing',
    name: 'Housing / Rent / Maintenance',
    type: 'expense',
    icon: 'home'
  },
  groceries: {
    id: 'groceries',
    name: 'Groceries & Quick-Commerce',
    type: 'expense',
    icon: 'shopping-cart'
  },
  utilities: {
    id: 'utilities',
    name: 'Electricity / Water / Wi-Fi / Mobile Bills',
    type: 'expense',
    icon: 'zap'
  },
  transport: {
    id: 'transport',
    name: 'Fuel / EV Charging / Cab & Metro',
    type: 'expense',
    icon: 'navigation'
  },
  education: {
    id: 'education',
    name: 'Kids & Education',
    type: 'expense',
    icon: 'book-open'
  },
  healthcare: {
    id: 'healthcare',
    name: 'Healthcare & Pharmacy',
    type: 'expense',
    icon: 'activity'
  },
  entertainment: {
    id: 'entertainment',
    name: 'Dining Out & Entertainment',
    type: 'expense',
    icon: 'film'
  },
  shopping: {
    id: 'shopping',
    name: 'Shopping & Personal Care',
    type: 'expense',
    icon: 'shopping-bag'
  },
  emi: {
    id: 'emi',
    name: 'Home Loan / Car EMI',
    type: 'expense',
    icon: 'credit-card'
  },
  insurance: {
    id: 'insurance',
    name: 'Insurance Premiums',
    type: 'expense',
    icon: 'shield'
  },
  miscellaneous: {
    id: 'miscellaneous',
    name: 'Miscellaneous',
    type: 'expense',
    icon: 'grid'
  }
});

/**
 * Investment category identifiers and metadata.
 */
export const INVESTMENT_CATEGORIES = deepFreeze({
  mutual_fund_sip: {
    id: 'mutual_fund_sip',
    name: 'Mutual Fund SIP',
    type: 'investment',
    icon: 'pie-chart'
  },
  direct_stocks: {
    id: 'direct_stocks',
    name: 'Direct Stocks',
    type: 'investment',
    icon: 'bar-chart-2'
  },
  ppf_nps_fd: {
    id: 'ppf_nps_fd',
    name: 'PPF / NPS / FD',
    type: 'investment',
    icon: 'lock'
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    type: 'investment',
    icon: 'award'
  }
});

/**
 * Consolidated category map indexable by ID.
 */
export const ALL_CATEGORIES = deepFreeze({
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
  ...INVESTMENT_CATEGORIES
});

/**
 * Categories grouped by transaction type.
 */
export const CATEGORIES_BY_TYPE = deepFreeze({
  [TRANSACTION_TYPES.INCOME]: Object.values(INCOME_CATEGORIES),
  [TRANSACTION_TYPES.EXPENSE]: Object.values(EXPENSE_CATEGORIES),
  [TRANSACTION_TYPES.INVESTMENT]: Object.values(INVESTMENT_CATEGORIES)
});

/**
 * Payment mode identifiers and metadata.
 */
export const PAYMENT_MODES = deepFreeze({
  upi: {
    id: 'upi',
    name: 'UPI',
    icon: 'smartphone'
  },
  credit_card: {
    id: 'credit_card',
    name: 'Credit Card',
    icon: 'credit-card'
  },
  debit_card: {
    id: 'debit_card',
    name: 'Debit Card',
    icon: 'credit-card'
  },
  net_banking: {
    id: 'net_banking',
    name: 'Net Banking',
    icon: 'globe'
  },
  auto_debit: {
    id: 'auto_debit',
    name: 'Auto-Debit / Mandate',
    icon: 'repeat'
  },
  cash: {
    id: 'cash',
    name: 'Cash',
    icon: 'dollar-sign'
  }
});

/**
 * Application storage keys and versioning.
 */
export const STORAGE_KEYS = deepFreeze({
  APP_DATA: 'madhavFinanceApp',
  PRE_RESTORE_BACKUP: 'madhavFinanceApp_pre_restore_backup',
  SCHEMA_VERSION: 1,
  BACKUP_FORMAT_VERSION: 1,
  APP_NAME: 'Madhav Finance Manager'
});

/**
 * Budget utilization thresholds and status levels.
 */
export const BUDGET_THRESHOLDS = deepFreeze({
  WARNING_PERCENT: 75,
  DANGER_PERCENT: 95,
  STATUS: {
    NORMAL: 'normal',   // < 75% (Green)
    WARNING: 'warning', // 75% to 95% (Amber)
    DANGER: 'danger'    // > 95% (Red)
  }
});

/**
 * Theme preference values.
 */
export const THEMES = deepFreeze({
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
});

/**
 * Currency standards.
 */
export const CURRENCY = deepFreeze({
  CODE: 'INR',
  SYMBOL: '₹',
  LOCALE: 'en-IN'
});
