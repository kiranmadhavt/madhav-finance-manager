# Madhav Finance Manager

# Application Architecture & Technical Design

**Document Version:** 1.0  
**Project:** Personal Finance Manager  
**Initial Platform:** PWA  
**Future Platform:** Native iOS (SwiftUI)  
**Storage:** LocalStorage  
**Architecture Style:** Modular, Offline-First, Layered Architecture

---

# 1. ARCHITECTURE OBJECTIVE

Build a modular personal finance application where financial calculations, data storage, application state and user interface remain independent.

The architecture must prioritize:

- Data integrity.
- Accurate financial calculations.
- Offline operation.
- Maintainability.
- Mobile performance.
- Future native iOS migration.

Avoid unnecessary frameworks and complex architectural patterns.

# 2. APPLICATION ARCHITECTURE

Use a layered architecture with five primary layers.

## Layer 1: User Interface

Responsibilities:

- Render dashboard.
- Render transaction history.
- Display budget progress.
- Display savings goals.
- Display charts.
- Handle user interactions.
- Display validation and error messages.

UI must never directly manipulate financial storage.

## Layer 2: Application Services

Responsibilities:

- Coordinate transaction operations.
- Coordinate budget operations.
- Coordinate savings goal operations.
- Refresh application state.
- Coordinate backup and restore.
- Notify the UI when data changes.

## Layer 3: Business Logic

Responsibilities:

- Calculate income.
- Calculate expenses.
- Calculate investments.
- Calculate monthly surplus.
- Calculate savings and investment rate.
- Calculate category budget utilization.
- Calculate savings goal progress.
- Prepare chart datasets.

Financial rules must remain independent of the UI and storage implementation.

## Layer 4: Storage

Responsibilities:

- Persist application data.
- Retrieve application data.
- Update application data.
- Delete application data.
- Validate stored records.
- Handle schema migrations.
- Handle storage failures.

Use LocalStorage for the initial PWA.

## Layer 5: Backup and Export

Responsibilities:

- Export complete JSON backups.
- Import and validate JSON backups.
- Export filtered CSV statements.
- Preserve data during restoration.
- Support future native iOS migration.

# 3. PROJECT DIRECTORY STRUCTURE

Maintain this project structure:

```text
Madhav Finance-Manager/
│
├── AGENTS.md
├── index.html
├── manifest.json
├── service-worker.js
│
├── css/
│   └── style.css
│
├── js/
│   ├── app.js
│   ├── backup.js
│   ├── budgets.js
│   ├── charts.js
│   ├── constants.js
│   ├── finance.js
│   ├── goals.js
│   ├── storage.js
│   ├── transactions.js
│   └── utils.js
│
├── assets/
│   ├── icons/
│   └── vendor/
│       └── chart.umd.min.js
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CODING_STANDARDS.md
│   ├── DATA_MODEL.md
│   ├── IOS_MIGRATION_PLAN.md
│   ├── PROJECT_REQUIREMENTS.md
│   ├── PWA_GUIDE.md
│   ├── TESTING_GUIDE.md
│   └── UI_DESIGN_GUIDE.md
│
├── tests/
│   ├── backup.test.js
│   ├── budgets.test.js
│   ├── finance.test.js
│   ├── goals.test.js
│   ├── runner.js
│   └── transactions.test.js
│
└── .github/
    └── workflows/
        └── ci-cd.yml
```

Additional modules may be introduced when justified.

Do not combine unrelated responsibilities into one large JavaScript file.

# 4. MODULE RESPONSIBILITIES

## constants.js

Single source of truth for fixed application metadata.

Responsibilities:

- Define transaction types (`income`, `expense`, `investment`).
- Define category definitions, identifiers, and display names.
- Define allowed payment modes.
- Define storage keys and current schema version.
- Define budget utilization threshold constants (<75%, 75–95%, >95%).
- Define theme options (`light`, `dark`, `system`).

## app.js

Application entry point and UI controller.

Responsibilities:

- Initialize the application.
- Load persisted data and verify state.
- Initialize application state.
- Register DOM event listeners and bottom navigation routing.
- Initialize UI modules.
- Coordinate modals, sheets, and transaction entry forms.
- Refresh dashboard, ledger, budgets, goals, and charts.

## storage.js

Single source of truth for persistent application data.

Responsibilities:

- Read LocalStorage with defensive error handling.
- Write LocalStorage atomically.
- Validate stored data structures with `Number.isSafeInteger`.
- Handle schema versions and migrations.
- Abort state updates if persistence throws an error.
- Ensure failed persistence never appears as a success to the user.

## finance.js

Central financial calculation engine.

Responsibilities:

- Calculate monthly income.
- Calculate monthly expenses.
- Calculate monthly investments.
- Calculate net monthly surplus (`Income - Expenses - Investments`).
- Calculate savings and investment rate (`((Income - Expenses) / Income) * 100`).
  - Return 0% when income is zero or negative.
  - Return negative percentage when expenses exceed income (deficit).
- Calculate category expense breakdowns.
- Calculate 6-month historical trends.

No DOM manipulation is permitted in this module.

## transactions.js

Transaction domain logic.

Responsibilities:

- Create, update, and delete transactions.
- Validate transaction inputs (positive safe integer paise, valid calendar date, allowed type-category pair).
- Filter transactions by month, type, category, and payment mode.
- Search transaction history by description and category.
- Sort transactions chronologically (newest first).

## budgets.js

Budget domain logic.

Responsibilities:

- Create, update, and delete budgets.
- Manage **recurring default monthly budgets** (`month: null`).
- Manage **month-specific overrides** (`month: "YYYY-MM"`).
- Resolve effective budget for any category in any month (override > default).
- Calculate category spending for the active month.
- Calculate remaining budget and utilization percentage.
- Determine threshold status (green, amber, red).

## goals.js

Savings goal domain logic.

Responsibilities:

- Create, edit, and delete savings goals.
- Validate target amount (positive safe integer) and saved amount (non-negative safe integer).
- Allow saved amount to exceed target amount (`savedPaise >= targetPaise`).
- Calculate completion percentage (can exceed 100%).
- Calculate remaining amount (clamped to ₹0 when reached/exceeded).
- Update saved amounts manually (investments are not auto-added).

## charts.js

Chart rendering controller.

Responsibilities:

- Initialize Chart.js using local vendor bundle.
- Render expense category doughnut chart.
- Render six-month financial trend chart.
- Update chart datasets dynamically on state change.
- Clean up and destroy existing Chart instances before re-rendering to prevent canvas leaks.
- Adapt chart text and grid lines to light and dark themes.

## backup.js

Data backup and restoration coordinator.

Responsibilities:

- Export complete versioned JSON backups.
- Validate imported JSON backup structure, schema version, and record constraints.
- Display import summary preview.
- Support both full restore and merge import strategies.
- Export filtered transactions to CSV with RFC-4180 escaping and spreadsheet formula injection protection.

## utils.js

Shared utility functions:

- Format integer paise to INR currency strings (`Intl.NumberFormat('en-IN', ...)`).
- Parse user rupee input into integer paise (`parseRupeesToPaise`).
- Safe date formatting and local calendar helpers.
- Unique ID generation (`crypto.randomUUID()` with fallback).
- Input validation helpers (`Number.isSafeInteger`).
- Safe DOM text escaping (`escapeHTML`).

# 5. DATA STORAGE DESIGN

Use a versioned application data structure stored in browser LocalStorage.

Storage key: `madhavFinanceApp`

State schema:

```json
{
  "schemaVersion": 1,
  "transactions": [],
  "budgets": [],
  "goals": [],
  "preferences": {
    "theme": "system",
    "currency": "INR"
  },
  "updatedAt": "2026-11-20T12:00:00.000Z"
}
```

### Atomic Persistence Workflow

All write operations must execute this deterministic pipeline:

1. **Read Current State:** Retrieve the validated in-memory state.
2. **Validate Proposed Mutation:** Verify record properties using `Number.isSafeInteger()`.
3. **Generate Next State:** Clone state and update `updatedAt`.
4. **Serialize:** Convert to JSON string.
5. **Persist:** Attempt `localStorage.setItem('madhavFinanceApp', serialized)`.
6. **Error Gate:** If `setItem()` throws (e.g. `QuotaExceededError` or private browsing restriction):
   - Immediately abort the operation.
   - Do **NOT** update the in-memory state.
   - Do **NOT** update UI totals.
   - Report a clear persistence failure notification to the user.
7. **Commit & Notify:** Update in-memory state only upon successful persistence, then notify UI controllers to re-render.

### LocalStorage Limitations & Disaster Recovery

- LocalStorage is unencrypted and subject to browser eviction policies (e.g., Safari 7-day cap on uninstalled web apps).
- **Primary Recovery Mechanism:** Downloadable versioned JSON backup files. The UI must provide regular backup download guidance.

# 6. TRANSACTION DATA MODEL

```json
{
  "id": "trn_unique_id",
  "type": "expense",
  "amountPaise": 125000,
  "date": "2026-11-20",
  "category": "groceries",
  "paymentMode": "upi",
  "description": "Monthly groceries",
  "createdAt": "2026-11-20T10:00:00.000Z",
  "updatedAt": "2026-11-20T10:00:00.000Z"
}
```

Rules:

- Unique ID string.
- Monetary amount stored as integer paise (`Number.isSafeInteger(amountPaise) && amountPaise > 0`).
- No `BigInt` in JSON data structures.
- Local calendar date string (`YYYY-MM-DD`). Never convert through UTC for reporting month determination.
- Timestamps in ISO 8601 UTC.
- Enforce strict type-category pairings.

# 7. BUDGET DATA MODEL

Budgets support **recurring default monthly category budgets** with optional **month-specific overrides**:

```json
{
  "id": "bgt_unique_id",
  "category": "groceries",
  "limitPaise": 1500000,
  "month": null,
  "createdAt": "2026-11-01T00:00:00.000Z",
  "updatedAt": "2026-11-20T10:00:00.000Z"
}
```

Rules:

- `month: null` denotes a recurring monthly baseline that applies to all months.
- `month: "YYYY-MM"` (e.g., `"2026-11"`) denotes an override for a specific month.
- Effective budget resolution: Override limit takes precedence over default limit.
- `limitPaise`: Positive safe integer (`Number.isSafeInteger(limitPaise) && limitPaise > 0`).
- At most one default budget per expense category.
- At most one month-specific override budget per category per month.

# 8. SAVINGS GOAL DATA MODEL

```json
{
  "id": "gol_unique_id",
  "name": "Emergency Fund",
  "targetPaise": 50000000,
  "savedPaise": 55000000,
  "targetDate": "2027-12-31",
  "createdAt": "2026-11-20T10:00:00.000Z",
  "updatedAt": "2026-11-20T10:00:00.000Z"
}
```

Rules:

- `name`: Required non-empty string.
- `targetPaise`: Positive safe integer (`Number.isSafeInteger(targetPaise) && targetPaise > 0`).
- `savedPaise`: Non-negative safe integer (`Number.isSafeInteger(savedPaise) && savedPaise >= 0`).
- `savedPaise` **may exceed** `targetPaise` (progress > 100% permitted).
- `targetDate`: Optional `YYYY-MM-DD` string.
- Balances are updated manually by the user.

# 9. CI/CD & DEPLOYMENT ARCHITECTURE

Automate validation and deployment using a single GitHub Actions workflow (`.github/workflows/ci-cd.yml`):

1. **Job 1 (test):**
   - Runs on Ubuntu latest.
   - Sets up Node.js LTS.
   - Runs `node --test tests/*.test.js` covering financial math, validation, storage integrity, and backup schemas.
2. **Job 2 (deploy):**
   - Strictly depends on `test` (`needs: test`).
   - Runs only on pushes to branch `main`.
   - Packages and deploys static assets to GitHub Pages using official actions (`actions/deploy-pages@v4`).
   - If any test fails, deployment is automatically prevented.

```
