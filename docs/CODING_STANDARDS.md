# Madhav Finance Manager

# Coding Standards & Engineering Guidelines

**Document Version:** 1.0  
**Project:** Personal & Family Finance Manager  
**Platform:** Vanilla JavaScript ES6 (Offline PWA)  
**Primary Target:** iPhone (Safari / WebKit)  
**Currency Standard:** Indian Rupee (INR ₹) via Integer Paise  

---

# 1. ENGINEERING OBJECTIVES

The engineering standards for Madhav Finance Manager prioritize:

1. **Financial Accuracy & Data Integrity:** Zero tolerance for calculation drifts, floating-point rounding errors, or silent data loss.
2. **Offline-First Resilience:** Predictable behavior with zero dependency on network connectivity or external servers.
3. **Simplicity & Zero Unnecessary Dependencies:** Pure Vanilla JavaScript ES6 modules, native Web APIs, and self-hosted Chart.js.
4. **Defensive Security & Privacy:** Strict validation, safe DOM manipulation, formula-injection-safe CSV export, and zero telemetry.
5. **Portability to Native iOS:** Business logic, models, and calculation rules structured to map cleanly to Swift and SwiftData.

---

# 2. ES6 MODULE & CODE ORGANIZATION

## 2.1 Modular Architecture

The application is structured into discrete ES6 modules. Monolithic scripts or combining unrelated responsibilities into one file is strictly forbidden.

- Use standard ES6 `import` and `export` statements.
- **Explicit File Extensions:** Always include the `.js` extension in import paths (e.g., `import { calculateSurplus } from './finance.js';`).
- **Named Exports Preferred:** Use explicit named exports rather than default exports. Named exports facilitate tree-shaking, predictable refactoring, and clear interface definitions.
- **No Circular Dependencies:** Structure data flow hierarchically (Constants -> Utilities -> Storage -> Domain Logic -> UI Controllers).
- **No Global Scope Pollution:** Do not attach application variables, functions, or state to `window` except during explicit local debugging in non-production environments.

## 2.2 Directory & Module Mapping

Each JavaScript file must strictly observe its designated responsibility:

- `constants.js`: Immutable enumeration values, category metadata, payment modes, storage keys, and UI thresholds.
- `utils.js`: Pure helper functions for formatting, parsing, calendar dates, unique ID generation, and DOM sanitization.
- `storage.js`: LocalStorage access, atomic persistence cycles, quota handling, and schema validation.
- `finance.js`: Pure calculation engine for monthly income, expenses, investments, surplus, and savings rates. Zero DOM access.
- `transactions.js`: Domain operations for transaction validation, CRUD, filtering, search, and sorting.
- `budgets.js`: Domain operations for recurring default budgets, month-specific overrides, and utilization tracking.
- `goals.js`: Domain operations for savings goals, progress tracking, and manual balance updates.
- `charts.js`: Chart.js configuration, canvas rendering, theme switching, and memory cleanup.
- `backup.js`: Versioned JSON export/import validation, conflict detection, and CSV statement generation.
- `app.js`: Application bootstrap, event listeners, view routing, modal handling, and coordinating UI re-renders.

---

# 3. NAMING CONVENTIONS

Follow standard JavaScript conventions consistently:

| Identifier Type | Convention | Example | Notes |
| :--- | :--- | :--- | :--- |
| **Variables & Properties** | `camelCase` | `amountPaise`, `targetDate`, `paymentMode` | Descriptive, avoid single letters except in loops. |
| **Monetary Values** | Suffix with `Paise` | `limitPaise`, `savedPaise`, `surplusPaise` | Mandatory to prevent accidental rupee-paise confusion. |
| **Booleans** | Prefix with verb | `isDefault`, `hasError`, `isCompleted` | Always phrase as positive assertions. |
| **Functions & Methods** | `camelCase` verb phrase | `calculateMonthlySurplus()`, `validateTransaction()` | Describe the explicit action performed. |
| **Constants & Enums** | `UPPER_SNAKE_CASE` | `STORAGE_KEY`, `SCHEMA_VERSION`, `BUDGET_THRESHOLDS` | Defined in `constants.js`. |
| **Module Files** | `kebab-case` or lowercase | `finance.js`, `service-worker.js` | Consistent lowercase filenames. |
| **DOM Elements** | Suffix with element type | `transactionForm`, `incomeKpiEl`, `budgetModal` | Makes DOM references immediately identifiable. |

---

# 4. FINANCIAL PRECISION & ARITHMETIC RULES

## 4.1 Integer Paise Rule

All monetary amounts must be stored, transmitted, and computed as **integer paise** (1 Rupee = 100 Paise).

- ₹1.00 is stored as `100`.
- ₹1,250.50 is stored as `125050`.
- ₹50,000.00 is stored as `5000000`.

## 4.2 Safe Integer Validation

Every financial input and calculation result must be validated using `Number.isSafeInteger()`:

```javascript
export function isValidPaise(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
```

- **Rejection of Floating-Point Values:** Never persist numbers with decimal fractions (e.g., `1250.50`).
- **No `BigInt` in JSON Storage:** Do not use `BigInt` primitives in application data structures. `JSON.stringify()` natively throws a `TypeError` when encountering `BigInt`. Standard JavaScript `Number.isSafeInteger()` safely supports values up to $9,007,199,254,740,991$ paise (over ₹90 Lakh Crore / ₹90 Trillion), which is far beyond the requirements of household finance.
- **Presentation Layer Conversion:** Convert paise to rupees only when formatting for display:
  ```javascript
  export function formatINR(paise) {
    if (!Number.isSafeInteger(paise)) return '₹0.00';
    return (paise / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  ```

---

# 5. INPUT VALIDATION & DEFENSIVE PROGRAMMING

## 5.1 Validation at System Boundaries

Apply defensive validation at all system entry points: user input forms, LocalStorage loading, and JSON backup imports.

- **Amount Validation:** Must be positive integer paise (`Number.isSafeInteger(paise) && paise > 0`). Zero or negative amounts are rejected for transactions and budget limits.
- **Date Validation:** Transaction dates must match the standard ISO local calendar format `YYYY-MM-DD` and represent a valid calendar date.
- **Category Validation:** Categories must be validated against the immutable list of allowed categories for the specified transaction type (`income`, `expense`, or `investment`).
- **Payment Mode Validation:** Must belong to the recognized payment modes (`upi`, `credit_card`, `debit_card`, `net_banking`, `auto_debit`, `cash`).
- **Text Length & Truncation:** Descriptions and notes must be sanitized and bounded (e.g., maximum 200 characters).

## 5.2 Prevention of Duplicate Submissions

Form submit handlers must disable the submit button immediately upon invocation and re-enable it only after persistence completes or validation fails, preventing duplicate transaction records caused by rapid mobile tapping.

---

# 6. SAFE DOM MANIPULATION & XSS PREVENTION

## 6.1 Prohibition of Unsanitized `innerHTML`

Never assign unsanitized, user-supplied content directly to `innerHTML`. This is mandatory to prevent Cross-Site Scripting (XSS).

- **Use Safe Text Binding:** Assign user-provided strings (descriptions, notes, goal names) using `textContent` or `innerText`.
- **Structured Element Creation:** Build dynamic DOM trees using `document.createElement()`, `classList.add()`, and `setAttribute()`.
- **HTML Escaping Helper:** When HTML template strings are necessary for complex cards, all interpolated dynamic strings must pass through a sanitization escape function:
  ```javascript
  export function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  ```

## 6.2 Formula Injection Protection in CSV Export

When exporting user text to CSV for spreadsheet programs (Excel, Apple Numbers, Google Sheets), any cell starting with `=`, `+`, `-`, or `@` can trigger remote code or macro execution.

- **Sanitization Rule:** Prefix any cell value starting with `=`, `+`, `-`, or `@` with a single quote (`'`).
- **RFC-4180 Escaping:** Wrap text containing commas, quotes, or newlines in double quotes, and escape internal quotes by doubling them (`""`).

---

# 7. ERROR HANDLING & PERSISTENCE SAFETY

## 7.1 Strict Persistence Guarantees

LocalStorage is subject to browser quotas, storage restrictions (e.g., Safari Private Browsing mode), and user purges.

- **Atomic Write Sequence:**
  1. Retrieve and clone current state.
  2. Validate changes.
  3. Attempt `localStorage.setItem()`.
  4. Only if `setItem()` succeeds without error, update the in-memory state.
  5. If `setItem()` throws (e.g., `QuotaExceededError`), abort the mutation, leave in-memory data untouched, and throw an explicit user-facing error.
- **No Illusion of Success:** A failed persistence operation must **never** appear successful in the UI. Financial totals on screen must reflect only persisted data.
- **Structured Try-Catch Blocks:** Every asynchronous or storage-interacting function must handle errors predictably and return either a structured result object `{ success: true, data }` / `{ success: false, error }` or throw descriptive custom errors.

---

# 8. COMMENTS & DOCUMENTATION

- **JSDoc on Public Interfaces:** Every exported function, class, and utility must include a JSDoc block detailing its intent, parameters, types, and return values:
  ```javascript
  /**
   * Calculates the net monthly surplus after expenses and investments.
   *
   * @param {number} incomePaise - Total monthly income in integer paise.
   * @param {number} expensePaise - Total monthly expenses in integer paise.
   * @param {number} investmentPaise - Total monthly investments in integer paise.
   * @returns {number} Net surplus in integer paise (may be negative).
   */
  export function calculateMonthlySurplus(incomePaise, expensePaise, investmentPaise) { ... }
  ```
- **Explain "Why", Not "What":** Write comments explaining non-obvious business logic, tax/regulatory assumptions, calendar boundary considerations, or workarounds for iOS Safari idiosyncrasies.
- **No Dead Code:** Commented-out blocks of code are strictly forbidden. Git history serves as the archive for historical code.

---

# 9. MAINTAINABILITY & FUTURE SWIFT MIGRATION

To ensure seamless future migration to native iOS (SwiftUI & SwiftData):

1. **Keep Business Logic Free of Browser Primitives:** Functions in `finance.js`, `transactions.js`, `budgets.js`, and `goals.js` must operate on plain JavaScript objects and arrays. Never reference `window`, `document`, `localStorage`, or DOM nodes inside domain logic modules.
2. **Deterministic Date Math:** Use local calendar dates (`YYYY-MM-DD` and `YYYY-MM`) directly without passing through UTC conversions that shift calendar days across time zones.
3. **Consistent Model Keys:** Internal identifiers (`id`, `amountPaise`, `category`, `paymentMode`) must strictly match the naming documented in `DATA_MODEL.md` and `IOS_MIGRATION_PLAN.md`.
