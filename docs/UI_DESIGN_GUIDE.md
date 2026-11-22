# Madhav Finance Manager

# UI Design System & User Experience Guide

**Version:** 1.0  
**Design Direction:** Premium Personal Fintech  
**Primary Device:** iPhone  
**Secondary Device:** Desktop and iPad  
**Platform:** Offline-First PWA

---

# 1. DESIGN OBJECTIVE

Create a premium, modern, elegant and intuitive personal finance application.

The interface should feel polished, trustworthy and easy to use.

Prioritize:

- Financial readability.
- Simple navigation.
- Minimal visual clutter.
- Fast transaction entry.
- One-handed mobile operation.
- Accessibility.
- Consistent visual language.

Avoid:

- Excessive gradients.
- Excessive animations.
- Crowded dashboards.
- Tiny buttons.
- Unnecessary decorative elements.

# 2. COLOR SYSTEM

Use CSS variables for all design colors.

## Light Theme

- Background: #F5F7FA
- Surface: #FFFFFF
- Primary Text: #172033
- Secondary Text: #64748B
- Primary Green: #059669
- Expense Coral: #E76F6F
- Warning Amber: #D97706
- Border: #E2E8F0

## Dark Theme

- Background: #0F172A
- Surface: #1E293B
- Primary Text: #F8FAFC
- Secondary Text: #94A3B8
- Primary Green: #34D399
- Expense Coral: #FB7185
- Warning Amber: #FBBF24
- Border: #334155

Use semantic color variables.

Do not hardcode colors repeatedly throughout CSS.

# 3. TYPOGRAPHY

Use a clean system font stack.

Recommended:

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Typography hierarchy:

- Dashboard heading: 26–30px.
- Section headings: 18–22px.
- KPI values: 24–30px.
- Transaction amounts: 15–17px.
- Body text: 14–16px.
- Supporting labels: 12–13px.

Financial values must remain clearly readable.

Use tabular numerals for monetary values where supported.

# 4. DASHBOARD DESIGN

Create a visually balanced dashboard.

## Header

Display:

- Application name.
- Selected month.
- Theme control.
- Settings access.

## KPI Cards

Display four primary metrics:

1. Monthly Income.
2. Monthly Expenses.
3. Net Monthly Surplus.
4. Savings & Investment Rate.

Use:

- Emerald for income.
- Coral for expenses.
- Emerald for positive surplus; Coral for deficit.
- Neutral accent for positive percentage metrics; Coral for negative percentage metrics (capital deficit). When income is zero, display `0.0%`.

Make the values prominent.

Do not overcrowd the cards with unnecessary information.

On mobile, use a two-column KPI grid.

## Charts

Place:

- Expense category doughnut chart.
- Six-month financial trend chart.

Charts must resize correctly on mobile.

Use readable labels and tooltips.

# 5. MOBILE NAVIGATION

Implement a fixed bottom navigation bar.

Five navigation destinations:

1. Dashboard.
2. Transactions.
3. Budgets.
4. Goals.
5. Settings.

Requirements:

- Clear icons.
- Short labels.
- Active tab indicator.
- Large touch areas.
- Safe-area padding.
- No content hidden behind navigation.

Use simple, consistent icons.

# 6. TRANSACTION ENTRY EXPERIENCE

Transaction entry must be fast and intuitive.

Use a dedicated mobile-friendly form or bottom-sheet-style panel.

Fields:

- Type selector.
- Amount input.
- Date picker.
- Category selector.
- Payment mode selector.
- Description field.

Requirements:

- Numeric keyboard for amount.
- Today's date by default.
- Large input controls.
- Clear validation messages.
- Visible save button.
- Clear cancel action.

Transaction type should control available categories.

The user should not need excessive scrolling to enter an ordinary transaction.

# 7. TRANSACTION HISTORY DESIGN

Display transactions in a clean list or responsive table.

Each transaction should show:

- Description.
- Category.
- Date.
- Payment mode.
- Amount.

Use semantic visual distinctions:

- Income: Green.
- Expense: Coral.
- Investment: Appropriate investment accent.

Provide accessible edit and delete actions.

Filtering controls should remain easy to access on mobile.

# 8. BUDGET SCREEN

Display individual category budget cards. Budgets reflect recurring default monthly limits by default, with clear visual indication if a category has a month-specific override for the active month.

Each card should contain:

- Category name.
- Badge indicating whether this is a "Monthly Default" or "Custom Override" for this month.
- Spent amount.
- Budget limit.
- Remaining amount (or Overspent amount in Coral).
- Progress bar.

Progress colors:

- Green: Below 75%.
- Amber: 75% to 95%, inclusive.
- Red: Above 95%.

Make progress bars visually clear.

# 9. SAVINGS GOALS SCREEN

Display savings goals using attractive cards.

Each card should show:

- Goal name.
- Target amount.
- Saved amount.
- Remaining amount (shows "Target Reached" or "Exceeded" when saved amount >= target amount).
- Completion percentage (supports values > 100%, e.g., "112%").
- Visual progress bar:
  - In-progress (<100%): Neutral/Brand fill.
  - Completed (100%): Emerald full fill with checkmark badge.
  - Exceeded (>100%): Emerald full fill with "Goal Exceeded" badge and surplus highlight.
- Target date when available.

Include an obvious action to add a goal.

# 10. SETTINGS SCREEN

Include:

- Theme selection.
- Export CSV.
- Export JSON backup.
- Import JSON backup.
- Application information.
- Data backup guidance.

Clearly explain that financial data is stored locally on the device.

# 11. RESPONSIVE DESIGN

## iPhone

- Mobile-first layout.
- Two-column KPI cards.
- Bottom navigation.
- Large touch targets.
- Safe-area support.
- No horizontal overflow.
- Appropriate keyboard behavior.

## iPad

- Better use of available width.
- Balanced card layouts.
- Optional wider navigation.
- Readable chart dimensions.

## Desktop

- Sidebar navigation.
- Wider dashboard layout.
- Multi-column content.
- Responsive transaction table.

Do not simply stretch the mobile layout across desktop screens.

# 12. IOS VISUAL COMPATIBILITY

Use:

```css
padding-bottom: calc(16px + env(safe-area-inset-bottom));
```

Account for:

- iPhone notch.
- Dynamic Island.
- Home indicator.
- Status bar area.
- On-screen keyboard.

Use appropriate touch interaction sizes.

Do not depend on hover interactions for essential functionality.

# 13. DARK AND LIGHT THEMES

Implement three theme options:

- Light.
- Dark.
- System.

Use CSS custom properties.

Persist the selected preference locally.

Ensure charts adapt to the selected theme.

Maintain sufficient contrast in both themes.

# 14. ACCESSIBILITY

Requirements:

- Semantic HTML.
- Accessible labels.
- Keyboard navigation.
- Visible focus indicators.
- Adequate contrast.
- Accessible button names.
- Clear validation messages.
- Do not rely on color alone to communicate financial status.

# 15. ANIMATION

Use subtle transitions only.

Examples:

- Navigation selection.
- Button feedback.
- Card appearance.
- Progress bar updates.
- Modal presentation.

Respect reduced-motion preferences.

Avoid animations that interfere with quick financial data entry.

# 16. DESIGN CONSISTENCY

Use a consistent spacing system.

Recommended spacing scale:

- 4px
- 8px
- 12px
- 16px
- 20px
- 24px
- 32px

Use consistent:

- Card radius.
- Button radius.
- Input height.
- Section spacing.
- Icon sizing.
- Border styles.

# 17. FINAL DESIGN PRINCIPLE

The application must look like a polished personal finance product rather than a generic admin dashboard.

Financial information must be easy to understand at a glance.

Prioritize a beautiful but practical iPhone experience, with responsive tablet and desktop layouts.

The interface must remain lightweight, fast and fully functional offline.
