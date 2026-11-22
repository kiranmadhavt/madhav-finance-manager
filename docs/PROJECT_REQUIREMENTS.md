# Personal Finance Manager

## Master Project Requirements & Development Specification

**Project Name:** Madhav Finance Manager  
**Project Type:** Personal & Family Finance Management  
**Initial Platform:** Progressive Web Application (PWA)  
**Future Platform:** Native iOS Application (SwiftUI)  
**Primary Device:** iPhone  
**Secondary Development Environment:** Windows PC  
**Currency:** Indian Rupee (INR ₹)  
**Number Format:** Indian English (en-IN)  
**Storage:** LocalStorage (device-local only)  
**Version:** 1.0

---

# 1. PROJECT OBJECTIVE

Develop a modern, secure, reliable and easy-to-use personal finance management application for tracking individual and household finances in India.

The application must allow users to:

- Track monthly income.
- Record daily household expenses.
- Track investments and mutual fund SIPs.
- Monitor monthly budgets.
- Set and track savings goals.
- Analyze spending patterns.
- Maintain searchable transaction history.
- Export financial records and restore backups.

The application must initially operate as an offline-first PWA and later be converted into a genuine native iOS application.

The architecture must support future migration to SwiftUI without unnecessarily rewriting financial calculations or redesigning the data model.

# 2. STRICT PROJECT RULES

The following requirements are mandatory.

1. This is exclusively a personal and family finance application.
2. No business, clinic, corporate or commercial accounting features.
3. No Firebase, cloud databases or cloud synchronization.
4. No authentication, registration or user accounts.
5. Financial data must remain on the user's device.
6. No multi-device synchronization.
7. Offline functionality is mandatory.
8. Use Indian Rupee formatting throughout.
9. Use modular JavaScript ES6 architecture.
10. Never silently overwrite or delete financial records.
11. Implement reliable JSON backup and restore.
12. Do not introduce unnecessary libraries or dependencies.
13. Never use fabricated financial data in production.
14. Do not change core architecture without documenting the reason.
15. Do not generate the entire application in one HTML file.

# 3. TECHNOLOGY STACK

## Frontend

- HTML5
- CSS3
- Vanilla JavaScript ES6 modules

## Storage

- Browser LocalStorage
- Dedicated storage abstraction layer
- Versioned JSON backup format

## Charts

- Chart.js

## PWA

- Web App Manifest
- Service Worker
- Offline asset caching
- HTTPS hosting

## Automation

- Git
- GitHub
- GitHub Actions
- GitHub Pages

## Future Native iOS

- Swift
- SwiftUI
- SwiftData
- Swift Charts

Do not implement the native iOS application during the initial PWA development phase.

# 4. APPLICATION MODULES

## 4.1 Dashboard

Create an attractive financial overview dashboard.

Display four primary KPI cards:

1. Total Monthly Income
2. Total Monthly Expenditure
3. Net Monthly Surplus After Investments
4. Savings & Investment Rate

All values must update immediately whenever a transaction is added, edited or deleted.

Provide a month selector.

Include quick access to adding a transaction.

## 4.2 Transaction Management

Implement complete CRUD functionality.

Transaction fields:

- Unique transaction ID
- Transaction type
- Amount
- Date
- Category
- Payment mode
- Description / Notes
- Created timestamp
- Updated timestamp

Transaction types:

### Income

- Monthly Salary
- Side Income / Freelance
- Dividends & Interest
- Cashback / Refunds
- Family / Gift
- Other

### Expense

- Housing / Rent / Maintenance
- Groceries & Quick-Commerce
- Electricity / Water / Wi-Fi / Mobile Bills
- Fuel / EV Charging / Cab & Metro
- Kids & Education
- Healthcare & Pharmacy
- Dining Out & Entertainment
- Shopping & Personal Care
- Home Loan / Car EMI
- Insurance Premiums
- Miscellaneous

### Investment / SIP

- Mutual Fund SIP
- Direct Stocks
- PPF / NPS / FD
- Gold

Payment modes:

- UPI
- Credit Card
- Debit Card
- Net Banking
- Auto-Debit / Mandate
- Cash

Requirements:

- Default transaction date to today.
- Validate amount before saving.
- Amount must be greater than zero.
- Allow transaction editing.
- Allow transaction deletion with confirmation.
- Allow descriptions and notes.
- Prevent invalid category/type combinations.
- Prevent duplicate submission caused by repeated taps.

## 4.3 Financial Calculation Engine

Keep all financial calculations independent of the UI.

Use a single source of truth for transaction calculations.

Definitions:

**Monthly Income**

Sum of all income transactions for the selected month.

**Monthly Expenditure**

Sum of expense transactions for the selected month.

Investment transactions must not be counted as ordinary expenditure.

**Monthly Investments**

Sum of investment transactions for the selected month.

**Net Monthly Surplus**

Income - Expenses - Investments.

**Savings & Investment Rate**

((Income - Expenses) / Income) × 100.

- When income is zero (or negative), return and display 0% rather than Infinity or NaN.
- When expenses exceed income (deficit), return and correctly display the negative percentage (e.g., -25.0%), indicating capital deficit with coral/warning styling.

The savings and investment rate represents the proportion of income remaining after consumption expenses, including amounts invested and amounts retained as surplus.

All calculations must use integer paise validated with `Number.isSafeInteger` internally. Do not introduce `BigInt` into JSON data without an explicit serialization strategy. Apply currency formatting only when displaying values.

# 5. MONTHLY BUDGET MANAGEMENT

Allow users to establish monthly spending limits for individual expense categories.

Budgets support **recurring default monthly category budgets** with optional **month-specific overrides**, ensuring users never need to recreate their budgets each month:

- **Default / Recurring Category Budget:** Applies automatically to every calendar month.
- **Month-Specific Override:** Applies to a specific month (e.g., higher budget for a festival or travel month), taking precedence over the default budget.

Requirements:

- Create and manage recurring default category budgets.
- Create optional month-specific budget overrides.
- Edit budget amounts.
- Delete budgets with confirmation.
- Display spending against budget.
- Display remaining budget.
- Display percentage consumed.
- Automatically update when expenses change.

Progress indicators:

- Green: Below 75%.
- Amber: 75% to 95%, inclusive.
- Red: Above 95%.

Budget calculations must include expense transactions only.

Investments must not be included in ordinary expense budgets.

Display an appropriate empty state when no budgets exist.

# 6. SAVINGS GOAL TRACKER

Allow users to create multiple personal savings goals.

Example goals:

- Emergency Fund
- Family Vacation
- New Gadget
- Car Purchase
- Home Renovation

Each goal should contain:

- Unique ID
- Goal name
- Target amount (positive integer paise)
- Current saved amount (non-negative integer paise; may exceed target amount)
- Target date (optional)
- Creation date

Display:

- Target amount
- Saved amount
- Remaining amount (₹0 when target is reached or exceeded)
- Completion percentage (may exceed 100% when savings surpass the target)
- Visual progress bar with completed (100%) and exceeded (>100%) status indicators

Allow users to add, edit and delete goals. Saved amount must remain non-negative, but can exceed target amount.

Do not automatically count every investment transaction as money saved toward a goal.

Goal balances must be updated explicitly by the user.

# 7. ANALYTICS AND CHARTS

Implement charts using Chart.js.

## Doughnut Chart

Title: Where My Money Goes.

Show expense distribution by category for the selected month.

Requirements:

- Category labels.
- Category spending amounts.
- Percentage distribution.
- Tooltips.
- Empty state when no expenses exist.

## Six-Month Financial Trend

Display a combined chart showing:

- Income
- Expenses
- Investments

Use the previous six calendar months, including the selected current month.

Ensure missing months appear as zero rather than disappearing.

Charts must update whenever transactions change.

# 8. SMART TRANSACTION LEDGER

Create a searchable and filterable transaction history.

Display:

- Date
- Description
- Category
- Transaction type
- Payment mode
- Amount
- Edit action
- Delete action

Filtering options:

- Month
- Transaction type
- Category
- Payment mode

Search should match descriptions and category names.

Sort transactions by date, newest first, with a consistent secondary ordering.

Provide an appropriate empty state.

# 9. EXPORT AND BACKUP

## CSV Export

Allow exporting filtered transaction records.

Include:

- Date
- Type
- Category
- Description
- Payment mode
- Amount

Use UTF-8 encoding and appropriate CSV escaping.

Protect against spreadsheet formula injection when exporting user-entered text.

## JSON Export

Export a complete application backup containing:

- Transactions
- Budgets
- Savings goals
- User preferences
- Backup schema version
- Export timestamp

## JSON Import

Requirements:

- Validate imported JSON structure.
- Validate schema version.
- Validate transaction records.
- Validate budget records.
- Validate savings goal records.
- Show an import confirmation.
- Never silently replace existing financial data.
- Create a backup of current data before destructive replacement.
- Handle corrupted or unsupported backups safely.

Support both full restore and a clearly defined merge strategy.

# 10. USER INTERFACE AND DESIGN

Create a premium, modern personal fintech interface.

Design direction:

- Clean and minimalist.
- Soft slate backgrounds.
- Emerald green for income and savings.
- Coral and amber for expenses and warnings.
- Rounded cards.
- Subtle shadows.
- Consistent spacing.
- Clear typography.
- Easy-to-read financial figures.

Implement dark mode and light mode.

Use CSS variables for colors and design tokens.

## Mobile-First Design

Primary target: iPhone.

Requirements:

- Responsive layouts.
- Large touch targets.
- Comfortable form inputs.
- Easy transaction entry.
- No horizontal overflow.
- iOS safe-area support.
- Appropriate keyboard handling.
- Accessible contrast.
- Clear visual feedback.

Use a mobile bottom navigation bar.

Suggested navigation:

1. Dashboard
2. Transactions
3. Budgets
4. Goals
5. Settings

On larger screens, adapt navigation appropriately.

# 11. PWA AND OFFLINE REQUIREMENTS

Implement:

- manifest.json
- service-worker.js
- Application icons
- Standalone display mode
- Offline caching
- Application update handling

The application must work after initial installation and successful asset caching without an internet connection.

Cache the application shell and required chart library assets.

Do not make core functionality dependent on external APIs.

Handle unavailable cached resources gracefully.

Use HTTPS in production.

Do not claim that LocalStorage is permanent or equivalent to a native database. LocalStorage is browser-managed, unencrypted, and subject to browser eviction policies (including Safari's 7-day storage cap on unbookmarked web apps).

Downloadable JSON backups are the **primary disaster recovery mechanism**. Provide regular JSON backup reminders or guidance because browser storage can be cleared by the operating system or user.

# 12. STORAGE ARCHITECTURE

Use a dedicated storage.js module.

Responsibilities:

- Save transactions.
- Retrieve transactions.
- Update transactions.
- Delete transactions.
- Save budgets.
- Retrieve budgets.
- Save savings goals.
- Retrieve savings goals.
- Manage preferences.
- Export and restore application data.

Use consistent storage keys and a schema version.

Validate data before saving using `Number.isSafeInteger` for monetary fields.

Handle LocalStorage quota errors and unavailable storage explicitly.

Never leave the application displaying outdated financial totals after a storage failure. A failed persistence write must abort state changes, throw an error, and alert the user immediately—it must **never** appear to the user as a successful transaction.

Use safe write operations and report persistence failures clearly.

The storage abstraction should be independent of the UI.

# 13. DATA INTEGRITY AND SECURITY

Financial information is sensitive.

Requirements:

- No external transmission of financial records.
- No unnecessary third-party analytics.
- No passwords or credentials stored.
- Validate all user inputs.
- Safely render user-entered descriptions.
- Avoid unsafe innerHTML usage with untrusted data.
- Handle invalid or missing stored data.
- Protect against accidental deletion.
- Provide reliable backup and recovery.

Do not describe LocalStorage as encrypted storage.

# 14. TESTING REQUIREMENTS

Test the following before deployment:

### Transactions

- Add income.
- Add expense.
- Add investment.
- Edit transaction.
- Delete transaction.
- Invalid amount handling.
- Invalid category handling.

### Financial calculations

- Monthly income.
- Monthly expenses.
- Monthly investments.
- Net surplus.
- Savings and investment rate.
- Zero income handling.
- Month boundaries.

### Budgets

- Category budget creation.
- Budget progress calculations.
- Threshold colors.
- Budget updates after editing expenses.

### Savings goals

- Create goals.
- Update saved amounts.
- Calculate progress.
- Delete goals.

### Backup

- CSV export.
- JSON export.
- JSON import.
- Invalid JSON handling.
- Duplicate handling.
- Recovery after import failure.

### PWA

- Initial installation.
- Offline reopening.
- Cached asset loading.
- Service worker updates.
- iPhone Home Screen operation.

# 15. DEVELOPMENT AND DEPLOYMENT

Use GitHub for source control.

Implement a single consolidated GitHub Actions CI/CD workflow (`.github/workflows/ci-cd.yml`):

- **Job 1: Test:** Validates JavaScript syntax, checks schema constraints, and executes all unit tests using Node.js native test runner (`node --test tests/*.test.js`).
- **Job 2: Deploy:** Strictly depends on the test job (`needs: test`). Deploys to GitHub Pages from the `main` branch **only after** all tests pass.

Deployment is blocked if any test fails.

Never commit financial user data, private backups, credentials or secrets to GitHub.

Keep the repository private during development unless there is a deliberate reason to publish it.

# 16. FUTURE NATIVE iOS MIGRATION

The PWA is the first development milestone.

Native iOS development must begin only after successful PWA testing.

Future native implementation:

- SwiftUI user interface.
- SwiftData local persistence.
- Swift Charts.
- Native file export.
- Native file
