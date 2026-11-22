# Madhav Finance Manager

# Testing Strategy & Quality Assurance Guide

**Version:** 1.0  
**Application:** Personal Finance Manager PWA  
**Testing Priority:** Financial Accuracy and Data Integrity  
**Primary Device:** iPhone

---

# 1. TESTING OBJECTIVE

Ensure the application is reliable, accurate, secure and usable on iPhone browsers.

Testing must cover:

- Financial calculations.
- Transaction management.
- Budget calculations.
- Savings goals.
- Data persistence.
- JSON backup and restoration.
- CSV export.
- Offline functionality.
- Responsive UI.
- Future native iOS migration compatibility.

Never deploy untested financial calculation changes.

# 2. TESTING PRINCIPLES

1. Test business logic independently of the UI.
2. Use deterministic test data.
3. Never use actual personal financial records in automated tests.
4. Test normal and invalid inputs.
5. Test edge cases.
6. Test data persistence after application reload.
7. Test failed storage operations.
8. Verify calculations independently.
9. Do not modify real user data during testing.
10. Fix critical failures before deployment.

# 3. FINANCIAL CALCULATION TESTS

## Monthly Income

Test:

- One income transaction.
- Multiple income transactions.
- No income transactions.
- Transactions across different months.

Expected result: Only income transactions within the selected month are included.

## Monthly Expenses

Test:

- One expense.
- Multiple expenses.
- No expenses.
- Expenses from different months.

Expected result: Only expense transactions within the selected month are included.

## Monthly Investments

Test:

- Mutual Fund SIP.
- Direct Stocks.
- PPF / NPS / FD.
- Gold.

Expected result: Investment transactions are calculated separately from ordinary expenditure.

## Net Monthly Surplus

Formula:

Income - Expenses - Investments.

Example:

- Income: ₹80,000
- Expenses: ₹35,000
- Investments: ₹15,000

Expected surplus: ₹30,000.

## Savings & Investment Rate

Formula:

((Income - Expenses) / Income) × 100.

Example 1 (Surplus):

- Income: ₹80,000
- Expenses: ₹35,000
- Expected rate: 56.25%.

Example 2 (Zero Income):

- Income: ₹0
- Expenses: ₹10,000
- Expected rate: 0%, never NaN or Infinity.

Example 3 (Deficit / Negative Rate):

- Income: ₹50,000
- Expenses: ₹70,000
- Expected rate: -40.0% (accurately reflects capital erosion).

Validation:

- Test with integer paise amounts validated using `Number.isSafeInteger`.
- Ensure no floating-point arithmetic errors occur during internal calculations.

# 4. TRANSACTION TESTS

Test:

- Add income.
- Add expense.
- Add investment.
- Edit transaction amount.
- Edit transaction category.
- Edit transaction date.
- Change payment mode.
- Delete transaction.
- Cancel deletion.
- Search transactions.
- Filter by month.
- Filter by type.
- Filter by category.
- Filter by payment mode.

Validation tests:

- Zero amount.
- Negative amount.
- Invalid amount.
- Invalid date.
- Missing category.
- Invalid category/type combination.
- Invalid payment mode.
- Duplicate transaction ID.

Expected result: Invalid records must never be saved.

# 5. BUDGET TESTS

Test:

- Create recurring default category budget (`month: null`).
- Create month-specific budget override (`month: "YYYY-MM"`).
- Verify budget resolution: Month-specific override takes precedence over default recurring budget.
- Verify automatic recurrence: Default budget automatically applies to future months without user re-entry.
- Edit budget amounts.
- Delete budget (both default and override).
- Prevent duplicate default budgets for the same category.
- Prevent duplicate overrides for the same category and month.
- Calculate spending for the active month.
- Calculate remaining budget.
- Calculate utilization percentage.

Threshold tests:

| Utilization | Expected color |
| ----------- | -------------- |
| 50%         | Green          |
| 74.99%      | Green          |
| 75%         | Amber          |
| 95%         | Amber          |
| 95.01%      | Red            |
| 100%        | Red            |
| 120%        | Red            |

Test budget recalculation after editing and deleting expenses.

# 6. SAVINGS GOAL TESTS

Test:

- Create goal with target amount.
- Edit goal.
- Delete goal.
- Update saved amount.
- Calculate remaining amount (clamped to ₹0 when target is reached or exceeded).
- Calculate completion percentage.
- Handle goals with saved amount exceeding target (e.g., Target: ₹1,00,000, Saved: ₹1,20,000 -> Expected: 120%, status: exceeded).
- Handle optional target dates.

Invalid cases:

- Zero target amount (`targetPaise <= 0`).
- Negative target amount.
- Negative saved amount (`savedPaise < 0`).
- Non-integer amounts (`!Number.isSafeInteger(amount)`).

# 7. DATE AND MONTH TESTS

Test:

- January to February.
- December to January.
- Leap year.
- Non-leap year.
- Last day of each month.
- First day of each month.
- Different local time zones.
- Month filtering.
- Six-month chart generation.

Expected result: Transactions must always appear in their intended local calendar month.

# 8. STORAGE TESTS

Test:

- Save application data.
- Retrieve application data.
- Update records.
- Delete records.
- Reload application.
- Handle missing storage.
- Handle malformed JSON.
- Handle storage quota exceeded (`QuotaExceededError`).
- Handle failed persistence writes: Verify that in-memory state is NOT modified, UI totals do not reflect unpersisted mutations, and an explicit error notification is shown.
- Validate stored schema with `Number.isSafeInteger`.

Expected result:

Financial data must never be silently discarded.

Failed persistence must never appear as a successful transaction to the user.

# 9. BACKUP AND RESTORE TESTS

Downloadable JSON backups are the **primary disaster recovery mechanism**. Test:

Verify:

- All transactions included.
- All budgets included.
- All savings goals included.
- Preferences included.
- Schema version included.
- Export timestamp included.

## JSON Import

Test:

- Valid backup.
- Invalid JSON.
- Missing properties.
- Unsupported schema version.
- Duplicate IDs.
- Invalid monetary amounts.
- Corrupted records.
- Empty backup.
- Merge import.
- Full restore.

Expected result:

Invalid backups must never partially replace existing application data.

## CSV Export

Test:

- Correct headers.
- Correct amounts.
- Correct dates.
- Correct payment modes.
- UTF-8 encoding.
- Special characters.
- Commas and quotation marks in descriptions.
- Spreadsheet formula injection protection.

# 10. CHART TESTS

## Doughnut Chart

Test:

- Correct expense categories.
- Correct category totals.
- Correct percentages.
- Empty state.
- Chart updates after transaction changes.

## Six-Month Trend

Test:

- Income series.
- Expense series.
- Investment series.
- Missing months represented as zero.
- Correct chronological ordering.
- Correct month boundaries.

# 11. PWA TESTS

Test:

- Application installation.
- Manifest validity.
- Service Worker registration.
- Initial asset caching.
- Offline application launch.
- Offline navigation.
- Offline transaction entry.
- Offline chart rendering.
- Cache updates.
- Application reopening after browser closure.

Ensure no financial operation depends on a network request.

# 12. IPHONE TESTING

Use a real iPhone for final acceptance testing.

Verify:

- Home Screen installation.
- Standalone application appearance.
- Portrait layout.
- Landscape layout.
- Safe-area spacing.
- Dynamic Island compatibility.
- Keyboard behavior.
- Date picker behavior.
- Touch targets.
- Bottom navigation.
- Modal scrolling.
- Long transaction descriptions.
- Large currency values.
- Offline operation.

Also test on desktop and iPad when available.

# 13. AUTOMATED TESTING

Create automated tests for:

- Financial calculation functions (including deficit savings rate and zero income).
- Transaction validation.
- Budget calculations (recurring defaults and month overrides).
- Savings goals (including targets exceeded).
- Date utilities.
- Backup validation and CSV formula injection neutralization.
- Data migration.

Use the built-in Node.js test runner (`node:test` and `node:assert`) without external dependencies:

```bash
node --test tests/*.test.js
```

Tests must run in GitHub Actions as part of a single consolidated CI/CD workflow (`.github/workflows/ci-cd.yml`).

The deployment job must depend strictly on the test job (`needs: test`), guaranteeing that deployment is prevented if any test fails.

# 14. DEPLOYMENT ACCEPTANCE CRITERIA

Before deploying to production:

- All critical automated tests pass.
- No known critical financial calculation errors.
- Transaction CRUD works.
- Budgets work.
- Savings goals work.
- Backup and restoration work.
- Offline operation is verified.
- No critical console errors.
- No horizontal overflow on iPhone.
- Financial data persistence is verified.

If a critical test fails, block deployment.

# 15. BUG REPORTING

Every discovered bug should document:

- Bug description.
- Steps to reproduce.
- Expected result.
- Actual result.
- Severity.
- Affected module.
- Fix applied.
- Verification result.

Prioritize data loss, calculation errors and backup failures above visual issues.

# 16. FINAL QUALITY PRINCIPLE

Financial accuracy and data integrity are non-negotiable.

The application must not be considered production-ready merely because its interface looks correct.

Every financial operation must be tested, and every important data recovery operation must be verified.
