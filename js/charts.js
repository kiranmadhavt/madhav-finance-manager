/**
 * Madhav Finance Manager - Chart.js Controller
 *
 * Renders and manages the expense distribution doughnut chart and the 6-month
 * income vs expense vs investment historical trend chart.
 *
 * Implements safe instance cleanup (destroy()) before recreating charts to prevent
 * canvas memory leaks. Adapts colors and grid lines to light and dark themes.
 */

import { formatINR, formatDisplayMonth, paiseToRupees } from './utils.js';
import { calculateCategoryBreakdown, calculateTrendHistory } from './finance.js';
import { TRANSACTION_TYPES } from './constants.js';

// Chart instances
let expenseDoughnutChart = null;
let trendHistoryChart = null;

// Premium Fintech Palette for Doughnut Chart slices
const DOUGHNUT_COLORS = [
  '#059669', // Emerald
  '#2563EB', // Blue
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#E11D48', // Rose
  '#0891B2', // Cyan
  '#EA580C', // Orange
  '#4F46E5', // Indigo
  '#16A34A', // Green
  '#9333EA', // Purple
  '#64748B'  // Slate
];

/**
 * Destroys all active chart instances cleanly.
 */
export function destroyCharts() {
  if (expenseDoughnutChart) {
    expenseDoughnutChart.destroy();
    expenseDoughnutChart = null;
  }
  if (trendHistoryChart) {
    trendHistoryChart.destroy();
    trendHistoryChart = null;
  }
}

/**
 * Returns theme-appropriate color tokens for Chart.js text and gridlines.
 *
 * @param {boolean} isDark - Whether dark mode is currently active.
 * @returns {Object} Chart theme tokens.
 */
function getChartTheme(isDark) {
  return {
    textColor: isDark ? '#94A3B8' : '#64748B',
    gridColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)',
    tooltipBg: isDark ? '#1E293B' : '#0F172A',
    tooltipText: isDark ? '#F8FAFC' : '#FFFFFF',
    borderColor: isDark ? '#1E293B' : '#FFFFFF'
  };
}

/**
 * Renders the expense breakdown doughnut chart.
 *
 * @param {HTMLCanvasElement} canvas - Canvas element.
 * @param {Array<Object>} transactions - List of transactions.
 * @param {string} targetMonth - Active month YYYY-MM.
 * @param {boolean} isDark - Dark theme flag.
 */
export function renderExpenseDoughnut(canvas, transactions, targetMonth, isDark) {
  if (!canvas || typeof window === 'undefined' || !window.Chart) return;

  if (expenseDoughnutChart) {
    expenseDoughnutChart.destroy();
    expenseDoughnutChart = null;
  }

  const breakdown = calculateCategoryBreakdown(transactions, targetMonth, TRANSACTION_TYPES.EXPENSE);
  const theme = getChartTheme(isDark);

  if (breakdown.length === 0) {
    // Render clean empty doughnut placeholder
    expenseDoughnutChart = new window.Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['No Expenses Recorded'],
        datasets: [{
          data: [1],
          backgroundColor: [isDark ? '#334155' : '#E2E8F0'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        cutout: '72%'
      }
    });
    return;
  }

  const labels = breakdown.map((item) => item.categoryName);
  const dataValues = breakdown.map((item) => paiseToRupees(item.totalPaise));
  const colors = breakdown.map((_, i) => DOUGHNUT_COLORS[i % DOUGHNUT_COLORS.length]);

  expenseDoughnutChart = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: dataValues,
        backgroundColor: colors,
        borderColor: theme.borderColor,
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: theme.textColor,
            padding: 14,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 12, family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }
          }
        },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label(context) {
              const item = breakdown[context.dataIndex];
              const formattedAmt = formatINR(item.totalPaise);
              const pct = item.percentage.toFixed(1);
              return ` ${item.categoryName}: ${formattedAmt} (${pct}%)`;
            }
          }
        }
      },
      cutout: '68%'
    }
  });
}

/**
 * Renders the 6-month historical trend chart (Income vs Expenses vs Investments).
 *
 * @param {HTMLCanvasElement} canvas - Canvas element.
 * @param {Array<Object>} transactions - List of transactions.
 * @param {string} targetMonth - Active month YYYY-MM.
 * @param {boolean} isDark - Dark theme flag.
 */
export function renderTrendHistory(canvas, transactions, targetMonth, isDark) {
  if (!canvas || typeof window === 'undefined' || !window.Chart) return;

  if (trendHistoryChart) {
    trendHistoryChart.destroy();
    trendHistoryChart = null;
  }

  const history = calculateTrendHistory(transactions, targetMonth, 6);
  const theme = getChartTheme(isDark);

  const labels = history.map((h) => formatDisplayMonth(h.targetMonth, true));
  const incomeData = history.map((h) => paiseToRupees(h.incomePaise));
  const expenseData = history.map((h) => paiseToRupees(h.expensePaise));
  const investmentData = history.map((h) => paiseToRupees(h.investmentPaise));

  const incomeColor = isDark ? '#34D399' : '#059669';
  const expenseColor = isDark ? '#FB7185' : '#E76F6F';
  const investmentColor = isDark ? '#818CF8' : '#4F46E5';

  trendHistoryChart = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: incomeColor,
          borderRadius: 4,
          maxBarThickness: 24
        },
        {
          label: 'Expenses',
          data: expenseData,
          backgroundColor: expenseColor,
          borderRadius: 4,
          maxBarThickness: 24
        },
        {
          label: 'Investments',
          data: investmentData,
          backgroundColor: investmentColor,
          borderRadius: 4,
          maxBarThickness: 24
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: theme.textColor,
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            font: { size: 12, family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }
          }
        },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label(context) {
              const valRupees = context.parsed.y || 0;
              const paise = Math.round(valRupees * 100);
              return ` ${context.dataset.label}: ${formatINR(paise)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: theme.textColor,
            font: { size: 11 }
          }
        },
        y: {
          grid: { color: theme.gridColor },
          ticks: {
            color: theme.textColor,
            font: { size: 11 },
            callback(val) {
              if (val >= 100000) {
                return `₹${(val / 100000).toFixed(0)}L`;
              }
              if (val >= 1000) {
                return `₹${(val / 1000).toFixed(0)}k`;
              }
              return `₹${val}`;
            }
          }
        }
      }
    }
  });
}

/**
 * High-level coordinator to refresh all charts on state or theme change.
 *
 * @param {Array<Object>} transactions - Current transaction records.
 * @param {string} targetMonth - Active month YYYY-MM.
 * @param {boolean} isDark - Dark mode flag.
 */
export function updateAllCharts(transactions, targetMonth, isDark) {
  const doughnutCanvas = document.getElementById('expense-doughnut-chart');
  const trendCanvas = document.getElementById('trend-history-chart');

  if (doughnutCanvas) {
    renderExpenseDoughnut(doughnutCanvas, transactions, targetMonth, isDark);
  }

  if (trendCanvas) {
    renderTrendHistory(trendCanvas, transactions, targetMonth, isDark);
  }
}
