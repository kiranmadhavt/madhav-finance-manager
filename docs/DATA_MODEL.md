# Madhav Finance Manager

# Data Model & Database Specification

**Version:** 1.1  
**Storage:** Browser LocalStorage  
**Data Ownership:** Single user, single device  
**Currency:** Indian Rupee (INR ₹)  
**Internal Monetary Unit:** Integer Paise  
**Future Migration:** SwiftData

---

# 1. OBJECTIVE

Define consistent, validated and migration-friendly data structures for the Personal Finance Manager.

All application modules must use these agreed data structures.

The data model supports:

- Income transactions.
- Expense transactions.
- Investment transactions.
- Monthly budgets (recurring defaults with month-specific overrides).
- Savings goals (supporting completed and exceeded targets).
- Application preferences.
- JSON backup and restoration.
- Future native iOS migration.

# 2. GENERAL DATA RULES

1. Every record must have a unique ID (`id`).
2. All monetary values must be stored as positive or non-negative integer paise validated with `Number.isSafeInteger()`.
3. Never use `BigInt` directly in persisted JSON data structures without an explicit serialization strategy.
4. Never store formatted currency strings as monetary values.
5. Transaction dates must use local calendar date format `YYYY-MM-DD`.
6. Month identifiers must use `YYYY-MM`.
7. Timestamps must use ISO 8601 UTC format.
8. Transaction type and category must be validated together.
9. Budgets establish recurring monthly limits by default, with optional month-specific overrides.
10. Savings goals allow saved amounts to exceed target amounts (`savedPaise >= targetPaise`).
11. Unknown fields must not silently corrupt existing records.
12. All imported data must be validated against schema constraints before persistence.
13. Downloadable JSON backups are the primary recovery mechanism; browser storage is volatile.

# 3. APPLICATION DATA STRUCTURE

Use one application-level data object stored in LocalStorage.

LocalStorage key:

`madhavFinanceApp`

Structure:

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

# 4. TRANSACTION MODEL

Each transaction record represents an individual financial movement:

```json
{
  "id": "trn_a1b2c3d4",
  "type": "expense",
  "amountPaise": 125000,
  "date": "2026-11-20",
  "category": "groceries",
  "paymentMode": "upi",
  "description": "Monthly groceries and vegetables",
  "createdAt": "2026-11-20T10:00:00.000Z",
  "updatedAt": "2026-11-20T10:00:00.000Z"
}
```

## Transaction types

Allowed values:

- `income`
- `expense`
- `investment`

## Income category identifiers

| Identifier | Display name |
| :--- | :--- |
| `monthly_salary` | Monthly Salary |
| `side_income` | Side Income / Freelance |
| `dividends_interest` | Dividends & Interest |
| `cashback_refunds` | Cashback / Refunds |
| `family_gift` | Family / Gift |
| `other` | Other |

## Expense category identifiers

| Identifier | Display name |
| :--- | :--- |
| `housing` | Housing / Rent / Maintenance |
| `groceries` | Groceries & Quick-Commerce |
| `utilities` | Electricity / Water / Wi-Fi / Mobile Bills |
| `transport` | Fuel / EV Charging / Cab & Metro |
| `education` | Kids & Education |
| `healthcare` | Healthcare & Pharmacy |
| `entertainment` | Dining Out & Entertainment |
| `shopping` | Shopping & Personal Care |
| `emi` | Home Loan / Car EMI |
| `insurance` | Insurance Premiums |
| `miscellaneous` | Miscellaneous |

## Investment category identifiers

| Identifier | Display name |
| :--- | :--- |
| `mutual_fund_sip` | Mutual Fund SIP |
| `direct_stocks` | Direct Stocks |
| `ppf_nps_fd` | PPF / NPS / FD |
| `gold` | Gold |

## Payment modes

Allowed identifiers:

- `upi`
- `credit_card`
- `debit_card`
- `net_banking`
- `auto_debit`
- `cash`

# 5. TRANSACTION VALIDATION

Every transaction must pass these checks:

- `id`: Non-empty string, unique across transactions.
- `type`: Must be one of `income`, `expense`, `investment`.
- `amountPaise`: Positive safe integer (`Number.isSafeInteger(amountPaise) && amountPaise > 0`).
- `date`: Valid calendar date string matching `YYYY-MM-DD`.
- `category`: Must be a valid identifier belonging to the chosen `type`.
- `paymentMode`: Must be one of the permitted payment modes.
- `description`: String (trimmed, max 200 characters).
- `createdAt` and `updatedAt`: Valid ISO 8601 timestamps. `updatedAt` must not precede `createdAt`.

# 6. BUDGET MODEL

Budgets support **recurring default monthly category budgets** with optional **month-specific overrides**, so users never need to recreate budgets each month.

```json
{
  "id": "bgt_x9y8z7w6",
  "category": "groceries",
  "limitPaise": 1500000,
  "month": null,
  "createdAt": "2026-11-01T00:00:00.000Z",
  "updatedAt": "2026-11-20T10:00:00.000Z"
}
```

### Recurring vs. Month-Specific Overrides

- **Default / Recurring Budget (`month: null` or omitted):**
  Applies automatically to every calendar month for that category.
- **Month-Specific Override (`month: "YYYY-MM"`, e.g. `"2026-11"`):**
  Applies exclusively to the specified calendar month (e.g., allocating a higher budget for a festival or travel month).

### Budget Resolution Hierarchy

To compute the effective budget for a category in month `M`:
1. Check if a budget exists with matching `category` and `month === M`. If found, use this override limit.
2. If no override exists, check for a default budget with matching `category` and `month === null` (or undefined). If found, use this recurring limit.
3. If neither exists, no budget is established for that category in month `M`.

### Constraints:
- `limitPaise`: Positive safe integer (`Number.isSafeInteger(limitPaise) && limitPaise > 0`).
- `category`: Must be a valid expense category.
- At most **one default budget** (`month: null`) per expense category.
- At most **one month-specific override budget** (`month: "YYYY-MM"`) per category per month.
- Budget spending tracking applies to `expense` transactions only (investments are excluded).

# 7. SAVINGS GOAL MODEL

Savings goals track progress toward personal financial milestones:

```json
{
  "id": "gol_m1n2o3p4",
  "name": "Emergency Fund",
  "targetPaise": 50000000,
  "savedPaise": 55000000,
  "targetDate": "2027-12-31",
  "createdAt": "2026-11-20T10:00:00.000Z",
  "updatedAt": "2026-11-20T10:00:00.000Z"
}
```

### Rules & Exceeded Goals:
- `name`: Non-empty string (trimmed, max 100 characters).
- `targetPaise`: Positive safe integer (`Number.isSafeInteger(targetPaise) && targetPaise > 0`).
- `savedPaise`: Non-negative safe integer (`Number.isSafeInteger(savedPaise) && savedPaise >= 0`).
- **Exceeded Goals Allowed:** `savedPaise` **may exceed** `targetPaise` (e.g., saving ₹5,50,000 against a ₹5,00,000 target). Progress can exceed 100% (e.g., 110%).
- `targetDate`: Optional string in `YYYY-MM-DD` format.
- **Completion Status:**
  - In progress: `savedPaise < targetPaise`
  - Completed: `savedPaise === targetPaise` (100%)
  - Exceeded: `savedPaise > targetPaise` (>100%)
- **Manual Balance Management:** Savings goal balances are updated explicitly by the user; investments are not automatically added to savings goals.

# 8. APPLICATION PREFERENCES

```json
{
  "theme": "system",
  "currency": "INR"
}
```

- `theme`: `light`, `dark`, or `system`.
- `currency`: Fixed to `"INR"`.

# 9. MONETARY DATA HANDLING & ARITHMETIC PRECISION

- Store all monetary values as integer paise.
- **Safe Integer Bounds:** Validate with `Number.isSafeInteger()`. The JavaScript safe integer limit is $2^{53} - 1 = 9,007,199,254,740,991$ paise ($\approx$ ₹90 Lakh Crore / ₹90 Trillion), fully sufficient for personal finance.
- **No `BigInt` in JSON:** Standard `JSON.stringify()` throws a `TypeError` when serializing `BigInt`. Do not use `BigInt` in JSON-persisted state without an explicit custom serialization strategy.
- **Formatting Rule:** Never perform mathematical calculations on formatted strings. Convert paise to rupees only when presenting in UI or exporting formatted reports:
  `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })`

# 10. DATE HANDLING

- Transaction dates represent local calendar dates (`YYYY-MM-DD`).
- Avoid passing local calendar dates through UTC conversions that could shift the reporting date or month due to timezone offsets.
- Reporting months are identified as `YYYY-MM`.

# 11. JSON BACKUP FORMAT & PRIMARY RECOVERY

Downloadable versioned JSON backups are the **primary disaster recovery mechanism**. Browser LocalStorage is non-permanent and subject to OS cleanup or user clearing.

Backup schema:

```json
{
  "appName": "Madhav Finance Manager",
  "backupFormatVersion": 1,
  "schemaVersion": 1,
  "exportedAt": "2026-11-20T12:00:00.000Z",
  "data": {
    "transactions": [],
    "budgets": [],
    "goals": [],
    "preferences": {
      "theme": "system",
      "currency": "INR"
    }
  }
}
```

### Import & Verification Rules:
1. Parse JSON safely.
2. Validate `appName`, `backupFormatVersion`, and `schemaVersion`.
3. Validate all transaction, budget, and goal records against schema rules.
4. Detect duplicate IDs.
5. Display an import preview (record counts, total income/expense/investment sums).
6. Require explicit user confirmation before applying.
7. Support both **Full Restore** (complete replacement) and **Merge Import** (append non-duplicate records).

# 12. STORAGE INTEGRITY & FAILURE HANDLING

- LocalStorage writes must be atomic.
- If persistence fails (e.g., quota exceeded or disabled storage), the operation must abort, leave in-memory state unmodified, and report an error to the user.
- A failed write must never appear as a successful transaction to the user.

# 13. FUTURE NATIVE iOS DATA MODEL (SWIFTDATA)

The SwiftData schema maps directly to these structures:
- `Transaction`: `id: UUID`, `type: String`, `amountPaise: Int64`, `date: String`, `category: String`, `paymentMode: String`, `desc: String`
- `Budget`: `id: UUID`, `category: String`, `limitPaise: Int64`, `month: String?` (optional `String?` represents default recurring vs override)
- `SavingsGoal`: `id: UUID`, `name: String`, `targetPaise: Int64`, `savedPaise: Int64`, `targetDate: String?`
- `AppPreferences`: `theme: String`, `currency: String`

All category and payment mode keys remain identical between PWA and iOS.
