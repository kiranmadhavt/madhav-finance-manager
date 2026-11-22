/**
 * Madhav Finance Manager - Application Controller & Presentation Layer
 *
 * Coordinates DOM interactions, state subscriptions, view navigation,
 * modal dialogs, transactions, budgets, goals, settings, and chart updates.
 *
 * All monetary operations use exact integer paise math.
 * UI inputs are parsed via parseRupeesToPaise and formatted via formatINR.
 */

import {
  TRANSACTION_TYPES,
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  INVESTMENT_CATEGORIES,
  CATEGORIES_BY_TYPE,
  PAYMENT_MODES,
  THEMES,
  BUDGET_THRESHOLDS
} from './constants.js';

import {
  formatINR,
  formatPercent,
  formatDisplayDate,
  formatDisplayMonth,
  getCurrentMonthString,
  getPreviousMonth,
  getNextMonth,
  getLocalDateString,
  parseRupeesToPaise,
  paiseToRupees,
  escapeHTML
} from './utils.js';

import {
  initStorage,
  getTransactions,
  getBudgets,
  getGoals,
  getPreferences,
  subscribe,
  updatePreferences
} from './storage.js';

import {
  calculateMonthlyIncome,
  calculateMonthlyExpenses,
  calculateMonthlyInvestments,
  calculateNetSurplus,
  calculateSavingsRate
} from './finance.js';

import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  filterTransactions,
  sortTransactionsByDateDesc
} from './transactions.js';

import {
  createBudget,
  updateBudget,
  deleteBudget,
  getMonthlyBudgetStatus
} from './budgets.js';

import {
  createGoal,
  updateGoal,
  deleteGoal,
  updateGoalSavedAmount,
  calculateGoalProgress
} from './goals.js';

import {
  exportJSONBackup,
  importJSONBackup,
  exportTransactionsToCSV
} from './backup.js';

import { updateAllCharts } from './charts.js';

// ============================================================================
// APPLICATION STATE
// ============================================================================

let currentMonth = getCurrentMonthString();
let currentView = 'dashboard';
let activeTxnType = TRANSACTION_TYPES.EXPENSE;
let deleteCallback = null;
let pendingImportJSON = null;

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

/**
 * Displays a non-blocking toast notification.
 *
 * @param {string} message - Notification text.
 * @param {'info'|'success'|'error'} [type='info'] - Notification style.
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Trigger CSS slide-down animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, 250);
  }, 3200);
}

// ============================================================================
// MODAL DIALOG CONTROLLER
// ============================================================================

/**
 * Opens a modal sheet dialog.
 *
 * @param {HTMLElement} modal - The modal backdrop element.
 */
function openModal(modal) {
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

/**
 * Closes an open modal sheet dialog.
 *
 * @param {HTMLElement} modal - The modal backdrop element.
 */
function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

/**
 * Closes all active modal dialogs.
 */
function closeAllModals() {
  document.querySelectorAll('.modal-backdrop.open').forEach((modal) => {
    closeModal(modal);
  });
}

/**
 * Displays the reusable confirmation dialog before destructive actions.
 *
 * @param {string} title - Dialog heading.
 * @param {string} message - Explanation text.
 * @param {Function} onConfirm - Callback to execute on user confirmation.
 */
function showConfirmDelete(title, message, onConfirm) {
  const modal = document.getElementById('modal-confirm-delete');
  const titleEl = document.getElementById('delete-modal-title');
  const msgEl = document.getElementById('delete-modal-msg');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;

  deleteCallback = onConfirm;
  openModal(modal);
}

// ============================================================================
// THEME CONTROLLER
// ============================================================================

/**
 * Checks whether dark mode is currently active (explicit dark or system dark).
 *
 * @returns {boolean} True if dark theme is active.
 */
function isDarkModeActive() {
  const theme = getPreferences().theme || THEMES.SYSTEM;
  if (theme === THEMES.DARK) return true;
  if (theme === THEMES.LIGHT) return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Applies the selected theme to the root element and updates settings UI.
 *
 * @param {string} theme - 'light', 'dark', or 'system'.
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  document.querySelectorAll('.theme-btn').forEach((btn) => {
    const val = btn.getAttribute('data-theme-val');
    btn.classList.toggle('active', val === theme);
  });

  // Refresh charts with updated theme tokens
  const transactions = getTransactions();
  updateAllCharts(transactions, currentMonth, isDarkModeActive());
}

// ============================================================================
// NAVIGATION & VIEW SWITCHING
// ============================================================================

/**
 * Switches the active view across mobile and desktop navigation.
 *
 * @param {string} viewName - Target view id without prefix ('dashboard', 'transactions', etc.).
 */
function navigateTo(viewName) {
  const validViews = ['dashboard', 'transactions', 'budgets', 'goals', 'settings'];
  if (!validViews.includes(viewName)) {
    viewName = 'dashboard';
  }

  currentView = viewName;
  window.location.hash = viewName;

  // Update view sections visibility
  document.querySelectorAll('.view-section').forEach((section) => {
    const isTarget = section.id === `view-${viewName}`;
    section.classList.toggle('active', isTarget);
  });

  // Update desktop navigation links
  document.querySelectorAll('.desktop-nav .nav-link').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('data-view') === viewName);
  });

  // Update mobile bottom navigation items
  document.querySelectorAll('.bottom-nav .nav-item').forEach((item) => {
    item.classList.toggle('active', item.getAttribute('data-view') === viewName);
  });

  // Render content of the activated view
  renderActiveView();
}

/**
 * Updates the global month selector UI labels and overrides.
 */
function updateMonthSelector() {
  const labelEl = document.getElementById('label-current-month');
  if (labelEl) {
    labelEl.textContent = formatDisplayMonth(currentMonth);
  }

  const scopeOverrideLabel = document.getElementById('label-scope-month-override');
  if (scopeOverrideLabel) {
    scopeOverrideLabel.textContent = `Month Override (${formatDisplayMonth(currentMonth)})`;
  }
}

// ============================================================================
// CATEGORY HELPERS
// ============================================================================

/**
 * Returns human-readable category name.
 *
 * @param {string} type - Transaction type.
 * @param {string} categoryId - Category identifier.
 * @returns {string} Category label.
 */
function getCategoryDisplayName(type, categoryId) {
  const list = CATEGORIES_BY_TYPE[type] || [];
  const item = list.find((c) => c.id === categoryId);
  if (item) return item.name;

  // Search across all types as fallback
  for (const group of Object.values(CATEGORIES_BY_TYPE)) {
    const found = group.find((c) => c.id === categoryId);
    if (found) return found.name;
  }

  return categoryId || 'Other';
}

/**
 * Populates a `<select>` element with category options for a given type.
 *
 * @param {HTMLSelectElement} selectEl - Target select element.
 * @param {string} type - 'income', 'expense', or 'investment'.
 * @param {string} [selectedId=''] - Optional category to select by default.
 */
function populateCategorySelect(selectEl, type, selectedId = '') {
  if (!selectEl) return;
  selectEl.innerHTML = '';

  const categories = CATEGORIES_BY_TYPE[type] || [];
  categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    if (cat.id === selectedId) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });
}

// ============================================================================
// DASHBOARD VIEW
// ============================================================================

/**
 * Renders the dashboard KPI cards, charts, and 5 recent transactions.
 */
function renderDashboard() {
  const transactions = getTransactions();

  // 1. Calculate Monthly Metrics via pure finance domain logic
  const incomePaise = calculateMonthlyIncome(transactions, currentMonth);
  const expensePaise = calculateMonthlyExpenses(transactions, currentMonth);
  const surplusPaise = calculateNetSurplus(transactions, currentMonth);
  const savingsRate = calculateSavingsRate(transactions, currentMonth);

  // 2. Update KPI Elements
  const kpiIncome = document.getElementById('kpi-income');
  if (kpiIncome) kpiIncome.textContent = formatINR(incomePaise);

  const kpiExpense = document.getElementById('kpi-expense');
  if (kpiExpense) kpiExpense.textContent = formatINR(expensePaise);

  const kpiSurplus = document.getElementById('kpi-surplus');
  const cardSurplus = document.getElementById('card-kpi-surplus');
  const surplusSub = document.getElementById('kpi-surplus-sub');

  if (kpiSurplus) {
    kpiSurplus.textContent = formatINR(surplusPaise);
  }
  if (cardSurplus) {
    cardSurplus.classList.toggle('positive', surplusPaise >= 0);
    cardSurplus.classList.toggle('negative', surplusPaise < 0);
  }
  if (surplusSub) {
    surplusSub.textContent = surplusPaise < 0 ? 'Deficit this month' : 'After investments';
  }

  const kpiRate = document.getElementById('kpi-savings-rate');
  const cardRate = document.getElementById('card-kpi-savings-rate');

  if (kpiRate) {
    kpiRate.textContent = formatPercent(savingsRate, 1);
  }
  if (cardRate) {
    cardRate.classList.toggle('positive', savingsRate >= 0);
    cardRate.classList.toggle('negative', savingsRate < 0);
  }

  // 3. Update Chart.js Visualizations
  updateAllCharts(transactions, currentMonth, isDarkModeActive());

  // 4. Render 5 Recent Transactions for the active month (or overall latest)
  const recentContainer = document.getElementById('dashboard-recent-list');
  if (!recentContainer) return;

  recentContainer.innerHTML = '';

  const monthTxns = transactions.filter((t) => t.date.startsWith(currentMonth));
  const sortedTxns = sortTransactionsByDateDesc(monthTxns);
  const topFive = sortedTxns.slice(0, 5);

  if (topFive.length === 0) {
    recentContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No transactions this month</div>
        <div class="empty-state-text">Tap "Add Transaction" to start tracking your income, expenses, and investments.</div>
      </div>
    `;
    return;
  }

  topFive.forEach((txn) => {
    recentContainer.appendChild(createTransactionDOMItem(txn, false));
  });
}

// ============================================================================
// TRANSACTIONS (LEDGER) VIEW
// ============================================================================

/**
 * Creates a DOM node for a single transaction card.
 *
 * @param {Object} txn - Transaction object.
 * @param {boolean} showActions - Whether to include Edit and Delete buttons.
 * @returns {HTMLElement} Transaction DOM item.
 */
function createTransactionDOMItem(txn, showActions = true) {
  const item = document.createElement('div');
  item.className = 'transaction-item';
  item.setAttribute('data-id', txn.id);

  const type = txn.type;
  const isIncome = type === TRANSACTION_TYPES.INCOME;
  const isExpense = type === TRANSACTION_TYPES.EXPENSE;
  const sign = isIncome ? '+' : (isExpense ? '-' : '');

  const categoryName = getCategoryDisplayName(type, txn.category);
  const paymentModeLabel = PAYMENT_MODES[txn.paymentMode]?.name || txn.paymentMode;
  const displayDesc = txn.description ? escapeHTML(txn.description) : categoryName;

  // Icon SVG based on type
  let iconSvg = '';
  if (isIncome) {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
  } else if (isExpense) {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>';
  } else {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>';
  }

  let actionsHtml = '';
  if (showActions) {
    actionsHtml = `
      <div class="txn-actions">
        <button class="icon-btn-sm btn-edit-txn" title="Edit Transaction" aria-label="Edit">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
        </button>
        <button class="icon-btn-sm delete btn-del-txn" title="Delete Transaction" aria-label="Delete">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `;
  }

  item.innerHTML = `
    <div class="txn-left">
      <div class="txn-icon ${type}">
        ${iconSvg}
      </div>
      <div class="txn-details">
        <span class="txn-desc">${displayDesc}</span>
        <div class="txn-meta">
          <span>${formatDisplayDate(txn.date)}</span>
          <span class="meta-dot"></span>
          <span>${escapeHTML(categoryName)}</span>
        </div>
      </div>
    </div>
    <div class="txn-right">
      <span class="txn-amount ${type} tabular-nums">${sign} ${formatINR(txn.amountPaise)}</span>
      <span class="txn-payment-badge">${escapeHTML(paymentModeLabel)}</span>
      ${actionsHtml}
    </div>
  `;

  if (showActions) {
    const editBtn = item.querySelector('.btn-edit-txn');
    const delBtn = item.querySelector('.btn-del-txn');

    if (editBtn) {
      editBtn.addEventListener('click', () => openTransactionModal(txn));
    }

    if (delBtn) {
      delBtn.addEventListener('click', () => {
        showConfirmDelete(
          'Delete Transaction',
          `Are you sure you want to delete this ${formatINR(txn.amountPaise)} transaction from ${formatDisplayDate(txn.date)}?`,
          () => {
            deleteTransaction(txn.id);
            showToast('Transaction deleted', 'info');
          }
        );
      });
    }
  }

  return item;
}

/**
 * Renders the ledger list with current active filters.
 */
function renderLedger() {
  const container = document.getElementById('ledger-transaction-list');
  if (!container) return;

  const searchInput = document.getElementById('filter-search');
  const typeSelect = document.getElementById('filter-type');
  const categorySelect = document.getElementById('filter-category');
  const paymentSelect = document.getElementById('filter-payment-mode');
  const monthScopeSelect = document.getElementById('filter-month-scope');

  const searchQuery = searchInput ? searchInput.value.trim() : '';
  const selectedType = typeSelect ? typeSelect.value : '';
  const selectedCategory = categorySelect ? categorySelect.value : '';
  const selectedPayment = paymentSelect ? paymentSelect.value : '';
  const monthScope = monthScopeSelect ? monthScopeSelect.value : 'current';

  const filterOptions = {
    search: searchQuery,
    type: selectedType,
    category: selectedCategory,
    paymentMode: selectedPayment,
    month: monthScope === 'current' ? currentMonth : ''
  };

  const allTransactions = getTransactions();
  const filtered = filterTransactions(allTransactions, filterOptions);
  const sorted = sortTransactionsByDateDesc(filtered);

  container.innerHTML = '';

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No transactions found</div>
        <div class="empty-state-text">No records match the selected filters or month.</div>
      </div>
    `;
    return;
  }

  sorted.forEach((txn) => {
    container.appendChild(createTransactionDOMItem(txn, true));
  });
}

/**
 * Updates the category filter options in the ledger depending on selected type.
 */
function updateLedgerCategoryFilter() {
  const typeSelect = document.getElementById('filter-type');
  const categorySelect = document.getElementById('filter-category');
  if (!categorySelect) return;

  const activeType = typeSelect ? typeSelect.value : '';
  categorySelect.innerHTML = '<option value="">All Categories</option>';

  let categories = [];
  if (activeType && CATEGORIES_BY_TYPE[activeType]) {
    categories = CATEGORIES_BY_TYPE[activeType];
  } else {
    // Combine all categories
    categories = [
      ...Object.values(INCOME_CATEGORIES),
      ...Object.values(EXPENSE_CATEGORIES),
      ...Object.values(INVESTMENT_CATEGORIES)
    ];
  }

  categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    categorySelect.appendChild(opt);
  });
}

// ============================================================================
// TRANSACTION MODAL (ADD & EDIT)
// ============================================================================

/**
 * Opens transaction modal for adding a new transaction or editing an existing one.
 *
 * @param {Object} [existingTxn=null] - Transaction record if editing.
 */
function openTransactionModal(existingTxn = null) {
  const modal = document.getElementById('modal-transaction');
  const title = document.getElementById('txn-modal-title');
  const form = document.getElementById('form-transaction');
  const idInput = document.getElementById('txn-id');
  const amountInput = document.getElementById('txn-amount');
  const dateInput = document.getElementById('txn-date');
  const paymentSelect = document.getElementById('txn-payment-mode');
  const categorySelect = document.getElementById('txn-category');
  const descInput = document.getElementById('txn-desc');

  if (!modal || !form) return;

  form.reset();

  if (existingTxn) {
    if (title) title.textContent = 'Edit Transaction';
    if (idInput) idInput.value = existingTxn.id;
    activeTxnType = existingTxn.type;

    if (amountInput) amountInput.value = paiseToRupees(existingTxn.amountPaise).toFixed(2);
    if (dateInput) dateInput.value = existingTxn.date;
    if (paymentSelect) paymentSelect.value = existingTxn.paymentMode;
    if (descInput) descInput.value = existingTxn.description || '';

    // Update segmented control buttons
    updateSegmentedControlButtons(activeTxnType);
    populateCategorySelect(categorySelect, activeTxnType, existingTxn.category);
  } else {
    if (title) title.textContent = 'New Transaction';
    if (idInput) idInput.value = '';
    activeTxnType = TRANSACTION_TYPES.EXPENSE;

    if (dateInput) dateInput.value = getLocalDateString();
    if (paymentSelect) paymentSelect.value = 'upi';

    updateSegmentedControlButtons(activeTxnType);
    populateCategorySelect(categorySelect, activeTxnType);
  }

  openModal(modal);
}

/**
 * Synchronizes segmented control UI with the current active type.
 *
 * @param {string} type - 'income', 'expense', or 'investment'.
 */
function updateSegmentedControlButtons(type) {
  document.querySelectorAll('.type-segmented-control .segment-btn').forEach((btn) => {
    const btnType = btn.getAttribute('data-type');
    const isActive = btnType === type;
    btn.classList.toggle('active', isActive);
  });
}

/**
 * Handles submission of the Add/Edit Transaction form.
 *
 * @param {Event} e - Form submit event.
 */
function handleTransactionFormSubmit(e) {
  e.preventDefault();

  const idInput = document.getElementById('txn-id');
  const amountInput = document.getElementById('txn-amount');
  const dateInput = document.getElementById('txn-date');
  const paymentSelect = document.getElementById('txn-payment-mode');
  const categorySelect = document.getElementById('txn-category');
  const descInput = document.getElementById('txn-desc');
  const submitBtn = document.getElementById('btn-save-txn');

  const rawAmount = amountInput ? amountInput.value.trim() : '';
  const amountPaise = parseRupeesToPaise(rawAmount);

  if (amountPaise === null || amountPaise <= 0) {
    showToast('Please enter a valid amount greater than ₹0', 'error');
    if (amountInput) amountInput.focus();
    return;
  }

  const date = dateInput ? dateInput.value : '';
  const paymentMode = paymentSelect ? paymentSelect.value : 'upi';
  const category = categorySelect ? categorySelect.value : '';
  const description = descInput ? descInput.value.trim() : '';
  const txnId = idInput ? idInput.value.trim() : '';

  if (!date) {
    showToast('Please select a valid date', 'error');
    return;
  }
  if (!category) {
    showToast('Please select a category', 'error');
    return;
  }

  // Prevent double submissions
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    if (txnId) {
      updateTransaction(txnId, {
        type: activeTxnType,
        amountPaise,
        category,
        date,
        paymentMode,
        description
      });
      showToast('Transaction updated successfully', 'success');
    } else {
      createTransaction({
        type: activeTxnType,
        amountPaise,
        category,
        date,
        paymentMode,
        description
      });
      showToast('Transaction saved successfully', 'success');
    }

    closeModal(document.getElementById('modal-transaction'));
  } catch (err) {
    showToast(err.message || 'Error saving transaction', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Transaction';
    }
  }
}

// ============================================================================
// BUDGETS VIEW
// ============================================================================

/**
 * Renders the category budgets list for the active month.
 */
function renderBudgets() {
  const container = document.getElementById('budgets-container');
  if (!container) return;

  const budgets = getBudgets();
  const transactions = getTransactions();
  const statusList = getMonthlyBudgetStatus(budgets, transactions, currentMonth);

  container.innerHTML = '';

  if (statusList.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No category budgets defined</div>
        <div class="empty-state-text">Set recurring monthly limits or month overrides to track your spending.</div>
      </div>
    `;
    return;
  }

  statusList.forEach((bgt) => {
    const card = document.createElement('div');
    card.className = 'budget-card';

    const categoryName = getCategoryDisplayName(TRANSACTION_TYPES.EXPENSE, bgt.category);
    const scopeClass = bgt.isOverride ? 'override' : 'default';
    const scopeLabel = bgt.isOverride ? `Override (${formatDisplayMonth(currentMonth)})` : 'Default';

    let fillClass = 'normal';
    if (bgt.thresholdStatus === BUDGET_THRESHOLDS.STATUS.DANGER) {
      fillClass = 'danger';
    } else if (bgt.thresholdStatus === BUDGET_THRESHOLDS.STATUS.WARNING) {
      fillClass = 'warning';
    }

    const clampedPercent = Math.min(Math.max(bgt.spentPercent, 0), 100);

    let remainingHtml = '';
    if (bgt.remainingPaise < 0) {
      const overPaise = Math.abs(bgt.remainingPaise);
      remainingHtml = `<span style="color: var(--color-danger); font-weight: 700;">+${formatINR(overPaise)} Over Budget</span>`;
    } else {
      remainingHtml = `<span>${formatINR(bgt.remainingPaise)} Remaining</span>`;
    }

    card.innerHTML = `
      <div class="card-top">
        <div class="card-title-group">
          <span class="card-title">${escapeHTML(categoryName)}</span>
          <span class="badge-tag ${scopeClass}">${scopeLabel}</span>
        </div>
        <div class="card-actions">
          <button class="icon-btn-sm btn-edit-bgt" title="Edit Budget" aria-label="Edit">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button class="icon-btn-sm delete btn-del-bgt" title="Delete Budget" aria-label="Delete">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
      <div class="card-metric-row">
        <span class="metric-spent tabular-nums">${formatINR(bgt.spentPaise)}</span>
        <span class="metric-limit tabular-nums">of ${formatINR(bgt.limitPaise)}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${fillClass}" style="width: ${clampedPercent}%;"></div>
      </div>
      <div class="card-footer-info">
        <span>${bgt.spentPercent.toFixed(1)}% spent</span>
        ${remainingHtml}
      </div>
    `;

    const editBtn = card.querySelector('.btn-edit-bgt');
    const delBtn = card.querySelector('.btn-del-bgt');

    if (editBtn) {
      editBtn.addEventListener('click', () => openBudgetModal(bgt));
    }

    if (delBtn) {
      delBtn.addEventListener('click', () => {
        showConfirmDelete(
          'Delete Budget',
          `Are you sure you want to remove the budget for ${categoryName}?`,
          () => {
            deleteBudget(bgt.id);
            showToast('Budget deleted', 'info');
          }
        );
      });
    }

    container.appendChild(card);
  });
}

/**
 * Opens budget modal for creation or editing.
 *
 * @param {Object} [existingBgt=null] - Budget record if editing.
 */
function openBudgetModal(existingBgt = null) {
  const modal = document.getElementById('modal-budget');
  const title = document.getElementById('bgt-modal-title');
  const form = document.getElementById('form-budget');
  const idInput = document.getElementById('bgt-id');
  const catSelect = document.getElementById('bgt-category');
  const limitInput = document.getElementById('bgt-limit');
  const scopeDefaultRadio = document.getElementById('bgt-scope-default');
  const scopeOverrideRadio = document.getElementById('bgt-scope-override');

  if (!modal || !form) return;
  form.reset();

  populateCategorySelect(catSelect, TRANSACTION_TYPES.EXPENSE);

  if (existingBgt) {
    if (title) title.textContent = 'Edit Category Budget';
    if (idInput) idInput.value = existingBgt.id;
    if (catSelect) {
      catSelect.value = existingBgt.category;
      catSelect.disabled = true; // Category cannot be changed during edit
    }
    if (limitInput) limitInput.value = paiseToRupees(existingBgt.limitPaise).toFixed(0);

    if (existingBgt.month) {
      if (scopeOverrideRadio) scopeOverrideRadio.checked = true;
    } else {
      if (scopeDefaultRadio) scopeDefaultRadio.checked = true;
    }
  } else {
    if (title) title.textContent = 'Set Category Budget';
    if (idInput) idInput.value = '';
    if (catSelect) catSelect.disabled = false;
    if (scopeDefaultRadio) scopeDefaultRadio.checked = true;
  }

  openModal(modal);
}

/**
 * Handles submission of the Add/Edit Budget form.
 *
 * @param {Event} e - Form submit event.
 */
function handleBudgetFormSubmit(e) {
  e.preventDefault();

  const idInput = document.getElementById('bgt-id');
  const catSelect = document.getElementById('bgt-category');
  const limitInput = document.getElementById('bgt-limit');
  const scopeOverrideRadio = document.getElementById('bgt-scope-override');
  const submitBtn = document.getElementById('btn-save-bgt');

  const bgtId = idInput ? idInput.value.trim() : '';
  const category = catSelect ? catSelect.value : '';
  const rawLimit = limitInput ? limitInput.value.trim() : '';
  const limitPaise = parseRupeesToPaise(rawLimit);

  if (limitPaise === null || limitPaise <= 0) {
    showToast('Please enter a valid monthly limit greater than ₹0', 'error');
    if (limitInput) limitInput.focus();
    return;
  }

  const isOverride = scopeOverrideRadio && scopeOverrideRadio.checked;
  const targetMonth = isOverride ? currentMonth : null;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    if (bgtId) {
      updateBudget(bgtId, { limitPaise, month: targetMonth });
      showToast('Budget updated successfully', 'success');
    } else {
      createBudget({ category, limitPaise, month: targetMonth });
      showToast('Budget created successfully', 'success');
    }

    closeModal(document.getElementById('modal-budget'));
  } catch (err) {
    showToast(err.message || 'Error saving budget', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Budget';
    }
  }
}

// ============================================================================
// SAVINGS GOALS VIEW
// ============================================================================

/**
 * Renders savings goals cards with progress calculation.
 */
function renderGoals() {
  const container = document.getElementById('goals-container');
  if (!container) return;

  const goals = getGoals();
  container.innerHTML = '';

  if (goals.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No savings goals yet</div>
        <div class="empty-state-text">Create targets for emergency funds, vacations, or asset purchases.</div>
      </div>
    `;
    return;
  }

  goals.forEach((goal) => {
    const card = document.createElement('div');
    card.className = 'goal-card';

    const progress = calculateGoalProgress(goal);
    const clampedFillPercent = Math.min(progress.progressPercent, 100);

    let fillClass = 'goal-brand';
    let badgeHtml = '';
    let metricFooterHtml = '';

    if (progress.isExceeded) {
      fillClass = 'goal-complete';
      badgeHtml = '<span class="badge-tag exceeded">Exceeded</span>';
      metricFooterHtml = `<span style="color: var(--color-income); font-weight: 700;">Surplus: ${formatINR(progress.surplusPaise)}</span>`;
    } else if (progress.isComplete) {
      fillClass = 'goal-complete';
      badgeHtml = '<span class="badge-tag exceeded">Achieved</span>';
      metricFooterHtml = `<span style="color: var(--color-income); font-weight: 700;">Target Reached!</span>`;
    } else {
      metricFooterHtml = `<span>Remaining: ${formatINR(progress.remainingPaise)}</span>`;
    }

    const dueDateHtml = goal.targetDate
      ? `<span style="font-size: 0.76rem; color: var(--text-muted);">Due: ${formatDisplayDate(goal.targetDate)}</span>`
      : '';

    card.innerHTML = `
      <div class="card-top">
        <div class="card-title-group">
          <span class="card-title">${escapeHTML(goal.name)}</span>
          ${badgeHtml}
        </div>
        <div class="card-actions">
          <button class="btn btn-outline btn-sm btn-quick-balance" style="padding: 4px 10px; font-size: 0.78rem; min-height: 32px;">
            Update
          </button>
          <button class="icon-btn-sm btn-edit-goal" title="Edit Goal" aria-label="Edit">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button class="icon-btn-sm delete btn-del-goal" title="Delete Goal" aria-label="Delete">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
      <div class="card-metric-row">
        <span class="metric-spent tabular-nums">${formatINR(goal.savedPaise)}</span>
        <span class="metric-limit tabular-nums">of ${formatINR(goal.targetPaise)}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${fillClass}" style="width: ${clampedFillPercent}%;"></div>
      </div>
      <div class="card-footer-info">
        <span>${progress.progressPercent.toFixed(1)}% saved</span>
        ${dueDateHtml}
        ${metricFooterHtml}
      </div>
    `;

    const quickBalBtn = card.querySelector('.btn-quick-balance');
    const editBtn = card.querySelector('.btn-edit-goal');
    const delBtn = card.querySelector('.btn-del-goal');

    if (quickBalBtn) {
      quickBalBtn.addEventListener('click', () => openQuickBalanceModal(goal));
    }

    if (editBtn) {
      editBtn.addEventListener('click', () => openGoalModal(goal));
    }

    if (delBtn) {
      delBtn.addEventListener('click', () => {
        showConfirmDelete(
          'Delete Goal',
          `Are you sure you want to delete "${goal.name}"?`,
          () => {
            deleteGoal(goal.id);
            showToast('Goal deleted', 'info');
          }
        );
      });
    }

    container.appendChild(card);
  });
}

/**
 * Opens goal modal for creation or editing.
 *
 * @param {Object} [existingGoal=null] - Goal record if editing.
 */
function openGoalModal(existingGoal = null) {
  const modal = document.getElementById('modal-goal');
  const title = document.getElementById('gol-modal-title');
  const form = document.getElementById('form-goal');
  const idInput = document.getElementById('gol-id');
  const nameInput = document.getElementById('gol-name');
  const targetInput = document.getElementById('gol-target');
  const savedInput = document.getElementById('gol-saved');
  const dateInput = document.getElementById('gol-date');

  if (!modal || !form) return;
  form.reset();

  if (existingGoal) {
    if (title) title.textContent = 'Edit Savings Goal';
    if (idInput) idInput.value = existingGoal.id;
    if (nameInput) nameInput.value = existingGoal.name;
    if (targetInput) targetInput.value = paiseToRupees(existingGoal.targetPaise).toFixed(0);
    if (savedInput) savedInput.value = paiseToRupees(existingGoal.savedPaise).toFixed(2);
    if (dateInput) dateInput.value = existingGoal.targetDate || '';
  } else {
    if (title) title.textContent = 'New Savings Goal';
    if (idInput) idInput.value = '';
    if (savedInput) savedInput.value = '0.00';
  }

  openModal(modal);
}

/**
 * Handles submission of the Add/Edit Goal form.
 *
 * @param {Event} e - Form submit event.
 */
function handleGoalFormSubmit(e) {
  e.preventDefault();

  const idInput = document.getElementById('gol-id');
  const nameInput = document.getElementById('gol-name');
  const targetInput = document.getElementById('gol-target');
  const savedInput = document.getElementById('gol-saved');
  const dateInput = document.getElementById('gol-date');
  const submitBtn = document.getElementById('btn-save-gol');

  const goalId = idInput ? idInput.value.trim() : '';
  const name = nameInput ? nameInput.value.trim() : '';
  const rawTarget = targetInput ? targetInput.value.trim() : '';
  const rawSaved = savedInput ? savedInput.value.trim() : '0';
  const targetDate = dateInput && dateInput.value ? dateInput.value : null;

  if (!name) {
    showToast('Please enter a goal name', 'error');
    if (nameInput) nameInput.focus();
    return;
  }

  const targetPaise = parseRupeesToPaise(rawTarget);
  if (targetPaise === null || targetPaise <= 0) {
    showToast('Please enter a target amount greater than ₹0', 'error');
    if (targetInput) targetInput.focus();
    return;
  }

  const savedPaise = parseRupeesToPaise(rawSaved);
  if (savedPaise === null || savedPaise < 0) {
    showToast('Please enter a valid non-negative saved amount', 'error');
    if (savedInput) savedInput.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    if (goalId) {
      updateGoal(goalId, { name, targetPaise, savedPaise, targetDate });
      showToast('Goal updated successfully', 'success');
    } else {
      createGoal({ name, targetPaise, savedPaise, targetDate });
      showToast('Goal created successfully', 'success');
    }

    closeModal(document.getElementById('modal-goal'));
  } catch (err) {
    showToast(err.message || 'Error saving goal', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Goal';
    }
  }
}

/**
 * Opens quick balance update modal for a specific goal.
 *
 * @param {Object} goal - Goal record.
 */
function openQuickBalanceModal(goal) {
  const modal = document.getElementById('modal-goal-balance');
  const idInput = document.getElementById('gol-bal-id');
  const nameDisplay = document.getElementById('gol-bal-name');
  const savedInput = document.getElementById('gol-bal-saved');

  if (!modal) return;

  if (idInput) idInput.value = goal.id;
  if (nameDisplay) nameDisplay.textContent = goal.name;
  if (savedInput) {
    savedInput.value = paiseToRupees(goal.savedPaise).toFixed(2);
    savedInput.focus();
  }

  openModal(modal);
}

/**
 * Handles submission of the quick balance update form.
 *
 * @param {Event} e - Form submit event.
 */
function handleQuickBalanceFormSubmit(e) {
  e.preventDefault();

  const idInput = document.getElementById('gol-bal-id');
  const savedInput = document.getElementById('gol-bal-saved');

  const goalId = idInput ? idInput.value.trim() : '';
  const rawSaved = savedInput ? savedInput.value.trim() : '';
  const newSavedPaise = parseRupeesToPaise(rawSaved);

  if (newSavedPaise === null || newSavedPaise < 0) {
    showToast('Please enter a valid non-negative saved balance', 'error');
    return;
  }

  try {
    updateGoalSavedAmount(goalId, newSavedPaise);
    showToast('Goal balance updated', 'success');
    closeModal(document.getElementById('modal-goal-balance'));
  } catch (err) {
    showToast(err.message || 'Error updating balance', 'error');
  }
}

// ============================================================================
// SETTINGS & BACKUP VIEW
// ============================================================================

/**
 * Triggers a client-side file download.
 *
 * @param {string} content - Text file content.
 * @param {string} filename - Name of downloaded file.
 * @param {string} mimeType - MIME type.
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports versioned JSON backup and triggers download.
 */
function handleJSONExport() {
  try {
    const jsonStr = exportJSONBackup();
    const filename = `madhav-finance-backup-${getLocalDateString()}.json`;
    downloadFile(jsonStr, filename, 'application/json');
    showToast('JSON Backup downloaded', 'success');
  } catch (err) {
    showToast(err.message || 'Error generating backup', 'error');
  }
}

/**
 * Exports CSV ledger statement and triggers download.
 */
function handleCSVExport() {
  try {
    const transactions = getTransactions();
    const csvStr = exportTransactionsToCSV(transactions);
    const filename = `madhav-finance-statement-${getLocalDateString()}.csv`;
    downloadFile(csvStr, filename, 'text/csv;charset=utf-8;');
    showToast('CSV statement downloaded', 'success');
  } catch (err) {
    showToast(err.message || 'Error exporting CSV', 'error');
  }
}

/**
 * Handles file selection for JSON backup import and opens the preview modal.
 *
 * @param {Event} e - File input change event.
 */
function handleJSONFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const content = event.target.result;
      const parsed = JSON.parse(content);

      if (!parsed || parsed.schemaVersion !== 1 || !parsed.data) {
        throw new Error('Unsupported or invalid backup file format.');
      }

      pendingImportJSON = content;

      const txnCount = parsed.data.transactions ? parsed.data.transactions.length : 0;
      const bgtCount = parsed.data.budgets ? parsed.data.budgets.length : 0;
      const golCount = parsed.data.goals ? parsed.data.goals.length : 0;
      const exportedAt = parsed.exportedAt ? formatDisplayDate(parsed.exportedAt.slice(0, 10)) : 'Unknown';

      const previewBody = document.getElementById('import-preview-body');
      if (previewBody) {
        previewBody.innerHTML = `
          <div style="background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; font-size: 0.88rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="color: var(--text-secondary);">Exported On:</span>
              <strong>${exportedAt}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="color: var(--text-secondary);">Transactions:</span>
              <strong>${txnCount}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="color: var(--text-secondary);">Budgets:</span>
              <strong>${bgtCount}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Savings Goals:</span>
              <strong>${golCount}</strong>
            </div>
          </div>
        `;
      }

      openModal(document.getElementById('modal-import-preview'));
    } catch (err) {
      showToast(err.message || 'Failed to read backup file', 'error');
    } finally {
      // Clear input so same file can be selected again if needed
      e.target.value = '';
    }
  };

  reader.readAsText(file);
}

/**
 * Confirms and executes the backup restoration.
 */
function handleConfirmImport() {
  if (!pendingImportJSON) {
    showToast('No backup file loaded', 'error');
    return;
  }

  const selectedModeInput = document.querySelector('input[name="import-mode"]:checked');
  const mode = selectedModeInput ? selectedModeInput.value : 'restore';
  const confirmBtn = document.getElementById('btn-confirm-import');

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Importing...';
  }

  try {
    const result = importJSONBackup(pendingImportJSON, mode);
    closeModal(document.getElementById('modal-import-preview'));
    pendingImportJSON = null;

    showToast(
      `Backup imported: ${result.transactions} txns, ${result.budgets} budgets, ${result.goals} goals`,
      'success'
    );
  } catch (err) {
    showToast(err.message || 'Restoration failed', 'error');
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm Import';
    }
  }
}

// ============================================================================
// MAIN RENDER COORDINATOR
// ============================================================================

/**
 * Re-renders the currently active view and updates the month selector.
 */
function renderActiveView() {
  updateMonthSelector();

  switch (currentView) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'transactions':
      renderLedger();
      break;
    case 'budgets':
      renderBudgets();
      break;
    case 'goals':
      renderGoals();
      break;
    case 'settings':
      // Settings view is mostly static controls + dynamic theme state
      break;
    default:
      renderDashboard();
      break;
  }
}

// ============================================================================
// EVENT LISTENERS INITIALIZATION
// ============================================================================

/**
 * Attaches all DOM event listeners for buttons, forms, modals, and filters.
 */
function setupEventListeners() {
  // 1. Navigation Links (Desktop & Mobile)
  document.querySelectorAll('.desktop-nav .nav-link, .bottom-nav .nav-item').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = link.getAttribute('data-view');
      navigateTo(targetView);
    });
  });

  // 2. Global Month Selector
  const btnPrevMonth = document.getElementById('btn-prev-month');
  const btnNextMonth = document.getElementById('btn-next-month');

  if (btnPrevMonth) {
    btnPrevMonth.addEventListener('click', () => {
      currentMonth = getPreviousMonth(currentMonth);
      renderActiveView();
    });
  }

  if (btnNextMonth) {
    btnNextMonth.addEventListener('click', () => {
      currentMonth = getNextMonth(currentMonth);
      renderActiveView();
    });
  }

  // 3. Quick Add Transaction (Header button & FAB)
  const btnHeaderAdd = document.getElementById('btn-header-add');
  const fabAdd = document.getElementById('fab-add-txn');

  if (btnHeaderAdd) {
    btnHeaderAdd.addEventListener('click', () => openTransactionModal());
  }
  if (fabAdd) {
    fabAdd.addEventListener('click', () => openTransactionModal());
  }

  // 4. Dashboard View-All Link
  const btnViewAll = document.getElementById('btn-dashboard-view-all');
  if (btnViewAll) {
    btnViewAll.addEventListener('click', () => navigateTo('transactions'));
  }

  // 5. Transaction Modal Segmented Type Buttons
  document.querySelectorAll('.type-segmented-control .segment-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      activeTxnType = type;
      updateSegmentedControlButtons(type);
      populateCategorySelect(document.getElementById('txn-category'), type);
    });
  });

  // 6. Transaction Form Submission
  const formTxn = document.getElementById('form-transaction');
  if (formTxn) {
    formTxn.addEventListener('submit', handleTransactionFormSubmit);
  }

  // 7. Ledger Filters
  const filterSearch = document.getElementById('filter-search');
  const filterType = document.getElementById('filter-type');
  const filterCategory = document.getElementById('filter-category');
  const filterPayment = document.getElementById('filter-payment-mode');
  const filterMonthScope = document.getElementById('filter-month-scope');

  if (filterSearch) {
    filterSearch.addEventListener('input', () => renderLedger());
  }

  if (filterType) {
    filterType.addEventListener('change', () => {
      updateLedgerCategoryFilter();
      renderLedger();
    });
  }

  if (filterCategory) {
    filterCategory.addEventListener('change', () => renderLedger());
  }
  if (filterPayment) {
    filterPayment.addEventListener('change', () => renderLedger());
  }
  if (filterMonthScope) {
    filterMonthScope.addEventListener('change', () => renderLedger());
  }

  // 8. Budgets View Add Button & Form
  const btnAddBgt = document.getElementById('btn-add-budget');
  if (btnAddBgt) {
    btnAddBgt.addEventListener('click', () => openBudgetModal());
  }

  const formBgt = document.getElementById('form-budget');
  if (formBgt) {
    formBgt.addEventListener('submit', handleBudgetFormSubmit);
  }

  // 9. Goals View Add Button & Form
  const btnAddGol = document.getElementById('btn-add-goal');
  if (btnAddGol) {
    btnAddGol.addEventListener('click', () => openGoalModal());
  }

  const formGol = document.getElementById('form-goal');
  if (formGol) {
    formGol.addEventListener('submit', handleGoalFormSubmit);
  }

  const formGolBal = document.getElementById('form-goal-balance');
  if (formGolBal) {
    formGolBal.addEventListener('submit', handleQuickBalanceFormSubmit);
  }

  // 10. Settings & Theme Buttons
  document.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const themeVal = btn.getAttribute('data-theme-val');
      updatePreferences({ theme: themeVal });
      applyTheme(themeVal);
    });
  });

  const btnExportJSON = document.getElementById('btn-export-json');
  if (btnExportJSON) {
    btnExportJSON.addEventListener('click', handleJSONExport);
  }

  const btnExportCSV = document.getElementById('btn-export-csv');
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', handleCSVExport);
  }

  const inputImportJSON = document.getElementById('input-import-json');
  if (inputImportJSON) {
    inputImportJSON.addEventListener('change', handleJSONFileSelected);
  }

  const btnConfirmImport = document.getElementById('btn-confirm-import');
  if (btnConfirmImport) {
    btnConfirmImport.addEventListener('click', handleConfirmImport);
  }

  // 11. Modal Close Buttons and Backdrop Dismiss
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-backdrop');
      if (modal) closeModal(modal);
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });

  // 12. Reusable Delete Confirmation Button
  const btnConfirmDeleteAction = document.getElementById('btn-confirm-delete-action');
  if (btnConfirmDeleteAction) {
    btnConfirmDeleteAction.addEventListener('click', () => {
      if (typeof deleteCallback === 'function') {
        deleteCallback();
        deleteCallback = null;
      }
      closeModal(document.getElementById('modal-confirm-delete'));
    });
  }

  // 13. Keyboard Accessibility: Close active modal on Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });

  // 14. OS Color Scheme Change Listener (for system theme)
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const currentTheme = getPreferences().theme || THEMES.SYSTEM;
      if (currentTheme === THEMES.SYSTEM) {
        applyTheme(THEMES.SYSTEM);
      }
    });
  }

  // 15. URL Hash Change Listener (handles browser back/forward buttons)
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && hash !== currentView) {
      navigateTo(hash);
    }
  });
}

// ============================================================================
// BOOTSTRAP APPLICATION
// ============================================================================

/**
 * Initializes application storage, subscriptions, theme, and initial view.
 */
function bootstrap() {
  try {
    // 1. Initialize LocalStorage schema
    initStorage();

    // 2. Initialize Theme
    const prefs = getPreferences();
    const initialTheme = prefs.theme || THEMES.SYSTEM;
    applyTheme(initialTheme);

    // 3. Initialize Ledger Category Filter
    updateLedgerCategoryFilter();

    // 4. Setup Event Listeners
    setupEventListeners();

    // 5. Subscribe to State Changes (automatic re-render when storage updates)
    subscribe(() => {
      renderActiveView();
    });

    // 6. Navigate to initial view based on hash or default to dashboard
    const initialHash = window.location.hash.replace('#', '');
    navigateTo(initialHash || 'dashboard');

    // 7. Register Service Worker for PWA Offline Functionality
    registerServiceWorker();
  } catch (err) {
    console.error('Fatal initialization error:', err);
    showToast(err.message || 'Initialization error', 'error');
  }
}

// ============================================================================
// SERVICE WORKER & PWA UPDATE REGISTRATION
// ============================================================================

/**
 * Registers the Service Worker with relative scope for GitHub Pages compatibility.
 * Provides a non-intrusive notification when a new version is available.
 */
function registerServiceWorker() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .then((registration) => {
          // If a worker is already waiting, offer update
          if (registration.waiting && navigator.serviceWorker.controller) {
            showUpdateToast(registration.waiting);
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // A new update is ready - inform the user non-intrusively
                  showUpdateToast(newWorker);
                }
              });
            }
          });
        })
        .catch((err) => {
          // Normal when running under file:// or unsupported context
          console.warn('Service worker registration note:', err.message);
        });
    });
  }
}

/**
 * Displays a non-intrusive update notification with an action button.
 * Never interrupts active transaction entry.
 *
 * @param {ServiceWorker} worker - Installing/waiting service worker instance.
 */
function showUpdateToast(worker) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  if (document.getElementById('pwa-update-toast')) return;

  const updateToast = document.createElement('div');
  updateToast.id = 'pwa-update-toast';
  updateToast.className = 'toast info';
  updateToast.style.display = 'flex';
  updateToast.style.alignItems = 'center';
  updateToast.style.justifyContent = 'space-between';
  updateToast.style.gap = '12px';

  const text = document.createElement('span');
  text.textContent = 'App update ready.';

  const btnGroup = document.createElement('div');
  btnGroup.style.display = 'flex';
  btnGroup.style.gap = '6px';

  const btnUpdate = document.createElement('button');
  btnUpdate.className = 'btn btn-sm btn-primary';
  btnUpdate.style.padding = '4px 10px';
  btnUpdate.style.fontSize = '0.78rem';
  btnUpdate.style.minHeight = '28px';
  btnUpdate.style.backgroundColor = '#FFFFFF';
  btnUpdate.style.color = 'var(--color-primary)';
  btnUpdate.textContent = 'Update';

  const btnLater = document.createElement('button');
  btnLater.className = 'btn btn-sm btn-secondary';
  btnLater.style.padding = '4px 8px';
  btnLater.style.fontSize = '0.78rem';
  btnLater.style.minHeight = '28px';
  btnLater.style.background = 'transparent';
  btnLater.style.border = 'none';
  btnLater.style.color = '#FFFFFF';
  btnLater.textContent = 'Later';

  btnUpdate.addEventListener('click', () => {
    // Check if any modal is currently open with input
    const anyModalOpen = document.querySelector('.modal-backdrop.open');
    if (anyModalOpen) {
      const confirmReload = window.confirm(
        'You have an open form or dialog. Updating now will reload the page and any unsaved input will be lost. Continue with update?'
      );
      if (!confirmReload) return;
    }

    worker.postMessage({ action: 'skipWaiting' });
  });

  btnLater.addEventListener('click', () => {
    updateToast.classList.remove('show');
    setTimeout(() => {
      if (updateToast.parentNode === container) {
        container.removeChild(updateToast);
      }
    }, 250);
  });

  btnGroup.appendChild(btnUpdate);
  btnGroup.appendChild(btnLater);
  updateToast.appendChild(text);
  updateToast.appendChild(btnGroup);
  container.appendChild(updateToast);

  requestAnimationFrame(() => updateToast.classList.add('show'));
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
