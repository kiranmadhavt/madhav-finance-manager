# Madhav Finance Manager

# Future Native iOS Migration Plan

**Document Version:** 1.0  
**Current Platform:** Progressive Web Application  
**Target Platform:** Native iOS Application  
**Native Framework:** SwiftUI  
**Database:** SwiftData  
**Charts:** Swift Charts  
**Build Environment:** Xcode on macOS  
**Automation:** GitHub Actions  
**Cloud Synchronization:** Not required

---

# 1. MIGRATION OBJECTIVE

Convert the successfully tested Personal Finance Manager PWA into a genuine native iOS application.

The native application must preserve all essential functionality and existing financial records.

The migration must not begin until the PWA has passed its functional, financial accuracy, offline and data integrity tests.

This is a native rebuild, not simply wrapping the existing website inside a WebView.

# 2. MIGRATION ENTRY CRITERIA

Native development can begin only when:

- All PWA modules are working.
- Financial calculations are verified.
- Transaction management is reliable.
- Budget calculations are verified.
- Savings goals work correctly.
- Charts display correct information.
- JSON backup and restore are tested.
- CSV export works.
- Offline functionality is verified.
- iPhone usability is satisfactory.
- No critical data integrity issues remain.

# 3. NATIVE TECHNOLOGY STACK

Use:

| Component        | Native technology |
| ---------------- | ----------------- |
| Interface        | SwiftUI           |
| Database         | SwiftData         |
| Charts           | Swift Charts      |
| Currency         | INR / en-IN       |
| Monetary storage | Int64 paise       |
| Date handling    | Foundation        |
| File export      | FileExporter      |
| File import      | FileImporter      |
| Navigation       | SwiftUI TabView   |
| Testing          | XCTest            |
| Build automation | GitHub Actions    |

No Firebase, cloud database, authentication or synchronization is required.

# 4. NATIVE PROJECT STRUCTURE

Recommended Xcode project:

```text
MadhavFinanceManager/
│
├── App/
│   └── MadhavFinanceManagerApp.swift
│
├── Models/
│   ├── Transaction.swift
│   ├── Budget.swift
│   ├── SavingsGoal.swift
│   └── AppPreferences.swift
│
├── Views/
│   ├── Dashboard/
│   │   └── DashboardView.swift
│   │
│   ├── Transactions/
│   │   ├── TransactionsView.swift
│   │   └── AddTransactionView.swift
│   │
│   ├── Budgets/
│   │   └── BudgetsView.swift
│   │
│   ├── Goals/
│   │   └── SavingsGoalsView.swift
│   │
│   └── Settings/
│       └── SettingsView.swift
│
├── Services/
│   ├── FinanceCalculator.swift
│   ├── StorageManager.swift
│   ├── BackupManager.swift
│   └── MigrationManager.swift
│
├── Resources/
│   ├── Assets.xcassets
│   └── Preview Content/
│
└── Tests/
    ├── FinanceCalculatorTests.swift
    ├── TransactionTests.swift
    ├── BudgetTests.swift
    └── MigrationTests.swift
```

# 5. NATIVE DATA MODELS

Create SwiftData models for:

## Transaction

Fields:

- id
- type
- amountPaise
- date
- category
- paymentMode
- description
- createdAt
- updatedAt

Use Int64 for monetary amounts.

## Budget

Fields:

- id (UUID)
- category (String)
- limitPaise (Int64)
- month (String?, nil represents recurring default budget; "YYYY-MM" represents month-specific override)
- createdAt (Date)
- updatedAt (Date)

## SavingsGoal

Fields:

- id (UUID)
- name (String)
- targetPaise (Int64)
- savedPaise (Int64, may exceed targetPaise for goals > 100% completed)
- targetDate (Date?, optional)
- createdAt (Date)
- updatedAt (Date)

## AppPreferences

Fields:

- theme
- currency

Preserve the same logical data structure and stable category identifiers as the PWA.

# 6. NATIVE USER INTERFACE

Rebuild the interface using SwiftUI.

Required screens:

1. Dashboard.
2. Transactions.
3. Add/Edit Transaction.
4. Budgets.
5. Savings Goals.
6. Analytics.
7. Settings.

Requirements:

- Native navigation.
- Native input controls.
- Native date selection.
- Native presentation sheets.
- Native charts.
- Light and dark themes.
- iPhone accessibility.
- Responsive iPad layouts.

The design should preserve the visual identity of the tested PWA while following native iOS interaction conventions.

# 7. FINANCIAL CALCULATION COMPATIBILITY

Preserve the PWA financial calculation definitions.

Monthly Income:

Sum of income transactions.

Monthly Expenses:

Sum of expense transactions.

Monthly Investments:

Sum of investment transactions.

Net Monthly Surplus:

Income - Expenses - Investments.

Savings and Investment Rate:

((Income - Expenses) / Income) × 100.

- Handle zero income safely: return 0.0% (never NaN or Infinity).
- Allow and correctly format negative percentages when expenses exceed income (e.g., -25.0%).

Use integer paise (`Int64`) for monetary calculations. Validate with safe bounds.

Avoid floating-point arithmetic for persisted financial amounts.

Create automated tests to compare the native calculation results against verified PWA test cases.

# 8. PWA TO NATIVE DATA MIGRATION

JSON backup will be the primary migration bridge.

Migration workflow:

1. Open the existing PWA.
2. Export a complete JSON backup.
3. Save the backup in a user-controlled location.
4. Open the native iOS application.
5. Navigate to Settings.
6. Select Import Existing PWA Data.
7. Select the JSON backup.
8. Validate the backup format.
9. Validate the schema version.
10. Validate all transactions.
11. Validate budgets.
12. Validate savings goals.
13. Display an import preview.
14. Ask for explicit confirmation.
15. Import into SwiftData.
16. Verify record counts and monetary totals.
17. Display the import result.

Never delete existing native records automatically during import.

# 9. DATA MIGRATION VALIDATION

Verify the following after import:

- Transaction count.
- Income totals.
- Expense totals.
- Investment totals.
- Monthly surplus.
- Budget count.
- Savings goal count.
- Saved amounts.
- Transaction dates.
- Category identifiers.
- Payment modes.

Use deterministic test fixtures to compare the PWA and native versions.

The migrated financial data must match the source backup exactly.

# 10. BACKUP AND RESTORE IN NATIVE iOS

Provide native backup features:

- Export JSON.
- Import JSON.
- Export CSV.
- Restore existing backups.

Use Apple's native file import and export interfaces.

Before replacing existing records:

- Validate the backup.
- Create a recovery backup.
- Request explicit confirmation.
- Verify restored records.

Maintain compatibility with the established JSON backup format.

# 11. NATIVE DATABASE MANAGEMENT

Use SwiftData for on-device persistence.

Requirements:

- Persistent local storage.
- Safe database updates.
- Data validation.
- Error handling.
- Schema migration support.
- Backup and recovery.
- No cloud synchronization.

Do not assume that a successful import is complete until the resulting database records have been verified.

# 12. NATIVE iOS TESTING

Test on an actual iPhone.

Required tests:

- Add transaction.
- Edit transaction.
- Delete transaction.
- Monthly calculations.
- Budget tracking.
- Savings goal updates.
- Expense charts.
- Six-month trends.
- JSON export.
- JSON import.
- CSV export.
- Database persistence.
- Application restart.
- Backup restoration.
- PWA data migration.

Test both light and dark modes.

# 13. GITHUB ACTIONS FOR NATIVE iOS

Use GitHub Actions with macOS runners.

Possible workflow:

1. Checkout source code.
2. Select an appropriate Xcode version.
3. Resolve dependencies.
4. Build the iOS application.
5. Run XCTest.
6. Generate build artifacts.
7. Optionally prepare signed distribution builds.

Important requirements:

- Use macOS runners.
- Store signing credentials as protected GitHub secrets.
- Never commit certificates or private keys.
- Keep signing configuration separate from application source code.

TestFlight distribution and App Store release require appropriate Apple Developer account access and signing configuration.

# 14. RELEASE STRATEGY

Release sequence:

## Stage 1: Internal Development

Build and test the native application.

## Stage 2: Device Testing

Install on the actual iPhone and verify all features.

## Stage 3: TestFlight

Distribute a testing build through Apple's TestFlight service.

## Stage 4: Final Validation

Verify:

- Financial accuracy.
- Data persistence.
- Backup and restore.
- Migration compatibility.
- Application performance.
- Accessibility.

## Stage 5: App Store

Prepare an App Store release if desired.

# 15. MIGRATION RISKS

Potential issues:

- Different date handling between JavaScript and Swift.
- Monetary precision differences.
- Missing category mappings.
- Duplicate records.
- Invalid JSON backups.
- Database migration failures.
- Data loss during restoration.

Mitigation:

- Use integer paise.
- Use stable category identifiers.
- Maintain versioned JSON backups.
- Validate before importing.
- Compare financial totals.
- Preserve recovery backups.
- Test migration with sample datasets before actual personal data.

# 16. FUTURE COMPATIBILITY RULES

During PWA development:

- Keep category identifiers stable.
- Keep payment mode identifiers stable.
- Use integer paise.
- Maintain versioned JSON backups.
- Keep financial calculations independent of the UI.
- Avoid browser-specific dependencies in business logic.
- Document schema changes.

These decisions will simplify the native iOS conversion.

# 17. FINAL MIGRATION PRINCIPLE

The native iOS application must preserve the reliability, privacy and financial accuracy established during PWA testing.

The native application must be a genuine SwiftUI application with local SwiftData persistence.

No cloud synchronization, multi-device support or business accounting functionality is required.

The user must be able to migrate existing PWA financial records without manually re-entering transactions.

Native development must begin only after the PWA has been thoroughly tested and approved.
