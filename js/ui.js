/**
 * UI Module
 * 
 * Handles DOM manipulation, view navigation, user feedback, and event listeners.
 * Provides functions for rendering expenses, dashboard analytics, and AI suggestions.
 * 
 * @module ui
 * 
 * Requirements covered:
 * - 12.3: Display success messages after successful operations
 * - 12.4: Display error messages when operations fail
 * - 12.5: Provide loading indicators during asynchronous operations
 * - 12.6: Implement proper error handling for all database and authentication operations
 */

import { validateExpense, validateBudget } from './validation.js';
import { createExpense, getExpenses, updateExpense, deleteExpense } from './expenses.js';
import { getBudget, saveBudget, getAvailableBudget } from './budget.js';
import { getCurrentMonthTotal, checkOverspending, getMonthlyTotals, getTopCategories, getMonthOverMonthChange, getCategoryBreakdown } from './analytics.js';
import { predictNextMonth } from './forecast.js';
import { getBudgetPlan } from './ai.js';
import { renderPieChart, renderLineChart, renderForecastChart, setupResponsiveCanvas } from './charts.js';
import { logout, getCurrentUser } from './auth.js';
import { initImportDialog, openImportDialog, closeImportDialog } from './transactionImport.js';

/**
 * Toast message duration in milliseconds
 */
const TOAST_DURATION = 4000;

/**
 * Store for cleanup functions (e.g., chart resize listeners)
 */
const cleanupFunctions = [];

/**
 * Calendar state
 */
let calendarState = {
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    selectedDate: null,
    startTime: '10:30',
    endTime: '12:30'
};

/**
 * Show a specific view and hide others
 * Updates navigation active state
 * 
 * @param {string} viewId - The ID of the view to show (without '-view' suffix)
 * 
 * Requirements: 12.6
 */
function showView(viewId) {
    // Get all views within main-app
    const views = document.querySelectorAll('#main-app .view');

    // Hide all views
    views.forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });

    // Show the target view
    const targetView = document.getElementById(`${viewId}-view`);
    if (targetView) {
        targetView.classList.remove('hidden');
        targetView.classList.add('active');
    }

    // Update navigation active state (both desktop and mobile)
    const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.view === viewId) {
            link.classList.add('active');
        }
    });

    // Close mobile menu if open
    closeMobileMenu();

    // Load view-specific data
    loadViewData(viewId);
}

/**
 * Open mobile menu
 */
function openMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('mobile-menu-overlay');
    if (mobileMenu) mobileMenu.classList.add('active');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Close mobile menu
 */
function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('mobile-menu-overlay');
    if (mobileMenu) mobileMenu.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

/**
 * Calendar Functions
 */
function openCalendarPopup() {
    const popup = document.getElementById('calendar-popup');
    if (popup) {
        popup.classList.remove('hidden');
        renderCalendar();
    }
}

function closeCalendarPopup() {
    const popup = document.getElementById('calendar-popup');
    if (popup) {
        popup.classList.add('hidden');
    }
}

function renderCalendar() {
    const daysContainer = document.getElementById('calendar-days');
    const monthYearLabel = document.getElementById('calendar-month-year');

    if (!daysContainer || !monthYearLabel) return;

    const { currentMonth, currentYear, selectedDate } = calendarState;
    const today = new Date();

    // Update month/year label
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    monthYearLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    // Get first day of month and total days
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    // Clear container
    daysContainer.innerHTML = '';

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'calendar-day other-month';
        btn.textContent = day;
        btn.addEventListener('click', () => {
            calendarState.currentMonth--;
            if (calendarState.currentMonth < 0) {
                calendarState.currentMonth = 11;
                calendarState.currentYear--;
            }
            calendarState.selectedDate = new Date(calendarState.currentYear, calendarState.currentMonth, day);
            renderCalendar();
        });
        daysContainer.appendChild(btn);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'calendar-day';
        btn.textContent = day;

        const dateToCheck = new Date(currentYear, currentMonth, day);

        // Check if today
        if (today.getDate() === day &&
            today.getMonth() === currentMonth &&
            today.getFullYear() === currentYear) {
            btn.classList.add('today');
        }

        // Check if selected
        if (selectedDate &&
            selectedDate.getDate() === day &&
            selectedDate.getMonth() === currentMonth &&
            selectedDate.getFullYear() === currentYear) {
            btn.classList.add('selected');
        }

        btn.addEventListener('click', () => {
            calendarState.selectedDate = new Date(currentYear, currentMonth, day);
            updateDateTimeDisplay();
            closeCalendarPopup();
        });

        daysContainer.appendChild(btn);
    }

    // Next month days to fill grid
    const totalCells = daysContainer.children.length;
    const remainingCells = 42 - totalCells; // 6 rows * 7 days
    for (let day = 1; day <= remainingCells; day++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'calendar-day other-month';
        btn.textContent = day;
        btn.addEventListener('click', () => {
            calendarState.currentMonth++;
            if (calendarState.currentMonth > 11) {
                calendarState.currentMonth = 0;
                calendarState.currentYear++;
            }
            calendarState.selectedDate = new Date(calendarState.currentYear, calendarState.currentMonth, day);
            renderCalendar();
        });
        daysContainer.appendChild(btn);
    }
}

function updateDateTimeDisplay() {
    const display = document.getElementById('expense-date-display');
    const dateInput = document.getElementById('expense-date');

    if (!display || !calendarState.selectedDate) return;

    const date = calendarState.selectedDate;

    // Format date
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    const dateStr = date.toLocaleDateString('en-US', options);

    // Update display
    display.value = dateStr;

    // Update hidden input
    if (dateInput) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }
}

function initCalendarListeners() {
    // Toggle button
    const toggleBtn = document.getElementById('calendar-toggle-btn');
    const displayInput = document.getElementById('expense-date-display');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openCalendarPopup();
        });
    }

    if (displayInput) {
        displayInput.addEventListener('click', (e) => {
            e.preventDefault();
            openCalendarPopup();
        });
    }

    // Navigation buttons
    const prevBtn = document.getElementById('prev-month-btn');
    const nextBtn = document.getElementById('next-month-btn');

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            calendarState.currentMonth--;
            if (calendarState.currentMonth < 0) {
                calendarState.currentMonth = 11;
                calendarState.currentYear--;
            }
            renderCalendar();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            calendarState.currentMonth++;
            if (calendarState.currentMonth > 11) {
                calendarState.currentMonth = 0;
                calendarState.currentYear++;
            }
            renderCalendar();
        });
    }

    // Done button
    const doneBtn = document.getElementById('calendar-done-btn');
    if (doneBtn) {
        doneBtn.addEventListener('click', (e) => {
            e.preventDefault();
            updateDateTimeDisplay();
            closeCalendarPopup();
        });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
        const popup = document.getElementById('calendar-popup');
        const wrapper = document.querySelector('.datetime-picker-wrapper');
        if (popup && !popup.classList.contains('hidden') &&
            wrapper && !wrapper.contains(e.target)) {
            closeCalendarPopup();
        }
    });

    // Set default date to today
    calendarState.selectedDate = new Date();
    calendarState.currentMonth = calendarState.selectedDate.getMonth();
    calendarState.currentYear = calendarState.selectedDate.getFullYear();
}


/**
 * Load data specific to a view
 * 
 * @param {string} viewId - The view ID
 */
async function loadViewData(viewId) {
    switch (viewId) {
        case 'dashboard':
            await renderDashboard();
            break;
        case 'expenses':
            await loadExpenseList();
            break;
        case 'budget':
            await loadBudgetSettings();
            break;
        case 'ai-suggestions':
            // AI suggestions are loaded on demand via button click
            break;
    }
}

/**
 * Display a success toast message
 * 
 * @param {string} message - The success message to display
 * 
 * Requirements: 12.3
 */
function showSuccess(message) {
    showToast(message, 'success');
}

/**
 * Display an error toast message
 * 
 * @param {string} message - The error message to display
 * 
 * Requirements: 12.4
 */
function showError(message) {
    showToast(message, 'error');
}

/**
 * Display a toast notification
 * 
 * @param {string} message - The message to display
 * @param {string} type - The toast type ('success' or 'error')
 */
function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, TOAST_DURATION);
}

/**
 * Show the loading overlay
 * 
 * Requirements: 12.5
 */
function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

/**
 * Hide the loading overlay
 * 
 * Requirements: 12.5
 */
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}


/**
 * Format a number as currency
 * 
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

/**
 * Format a date string for display
 * 
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Render the expense list
 * 
 * @param {Array} expenses - Array of expense objects
 */
async function renderExpenseList(expenses) {
    const listContainer = document.getElementById('expense-list');
    const emptyMessage = document.getElementById('no-expenses-message');

    if (!listContainer) return;

    // Clear existing list
    listContainer.innerHTML = '';

    if (!expenses || expenses.length === 0) {
        if (emptyMessage) {
            emptyMessage.classList.remove('hidden');
        }
        return;
    }

    if (emptyMessage) {
        emptyMessage.classList.add('hidden');
    }

    // Render each expense
    for (const expense of expenses) {
        const item = document.createElement('li');
        item.className = 'expense-item';
        item.dataset.id = expense.id;

        // Create expense item structure
        const infoDiv = document.createElement('div');
        infoDiv.className = 'expense-item-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'expense-item-name';
        nameSpan.textContent = expense.expense_name;

        const categorySpan = document.createElement('span');
        categorySpan.className = 'expense-item-category';
        categorySpan.textContent = expense.category;

        infoDiv.appendChild(nameSpan);
        infoDiv.appendChild(categorySpan);

        const amountSpan = document.createElement('span');
        amountSpan.className = 'expense-item-amount';
        amountSpan.textContent = formatCurrency(expense.amount);

        const dateSpan = document.createElement('span');
        dateSpan.className = 'expense-item-date';
        dateSpan.textContent = formatDate(expense.date);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'expense-item-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary edit-expense-btn';
        editBtn.dataset.id = expense.id;
        editBtn.textContent = 'Edit';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger delete-expense-btn';
        deleteBtn.dataset.id = expense.id;
        deleteBtn.textContent = 'Delete';

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        item.appendChild(infoDiv);
        item.appendChild(amountSpan);
        item.appendChild(dateSpan);
        item.appendChild(actionsDiv);

        listContainer.appendChild(item);
    }
}

/**
 * Escape HTML to prevent XSS
 * 
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Load and display the expense list
 */
async function loadExpenseList() {
    showLoading();

    try {
        const { data: expenses, error } = await getExpenses();

        if (error) {
            showError(error.message);
            return;
        }

        renderExpenseList(expenses);
    } catch (err) {
        console.error('Load expense list error:', err);
        showError('Failed to load expenses');
    } finally {
        hideLoading();
    }
}


/**
 * Render the dashboard with analytics data
 * 
 * @param {Object} data - Dashboard data (optional, will fetch if not provided)
 */
async function renderDashboard(data = null) {
    showLoading();

    try {
        // Fetch all dashboard data in parallel
        const [
            currentMonthTotal,
            availableBudget,
            momChange,
            overspending,
            categoryBreakdown,
            monthlyTotals,
            topCategories,
            forecast
        ] = await Promise.all([
            getCurrentMonthTotal(),
            getAvailableBudget(),
            getMonthOverMonthChange(),
            checkOverspending(),
            getCategoryBreakdown(),
            getMonthlyTotals(6),
            getTopCategories(5),
            predictNextMonth()
        ]);

        // Update summary cards
        const currentMonthEl = document.getElementById('current-month-total');
        if (currentMonthEl) {
            currentMonthEl.textContent = formatCurrency(currentMonthTotal);

            // Change color to red if spending exceeds available budget
            if (availableBudget > 0 && currentMonthTotal > availableBudget) {
                currentMonthEl.classList.add('overspending');
                currentMonthEl.parentElement.classList.add('card-danger');
            } else {
                currentMonthEl.classList.remove('overspending');
                currentMonthEl.parentElement.classList.remove('card-danger');
            }
        }

        const availableBudgetEl = document.getElementById('available-budget');
        if (availableBudgetEl) {
            // Show remaining budget after subtracting current month's spending
            const remainingBudget = availableBudget - currentMonthTotal;
            availableBudgetEl.textContent = formatCurrency(remainingBudget);

            // Add visual feedback based on remaining budget
            if (remainingBudget < 0) {
                // Over budget - show in red
                availableBudgetEl.classList.add('overspending');
                availableBudgetEl.parentElement.classList.add('card-danger');
            } else if (remainingBudget < availableBudget * 0.2) {
                // Less than 20% remaining - show warning
                availableBudgetEl.classList.add('text-warning');
                availableBudgetEl.classList.remove('overspending');
                availableBudgetEl.parentElement.classList.remove('card-danger');
            } else {
                // Healthy budget
                availableBudgetEl.classList.remove('overspending', 'text-warning');
                availableBudgetEl.parentElement.classList.remove('card-danger');
            }
        }

        const momChangeEl = document.getElementById('mom-change');
        if (momChangeEl) {
            const sign = momChange.direction === 'increase' ? '+' :
                momChange.direction === 'decrease' ? '-' : '';
            momChangeEl.textContent = `${sign}${momChange.percentage.toFixed(1)}%`;
            momChangeEl.style.color = momChange.direction === 'increase' ?
                'var(--color-error)' :
                momChange.direction === 'decrease' ? 'var(--color-success)' :
                    'var(--color-gray-600)';
        }

        // Show/hide overspending alert
        const overspendingAlert = document.getElementById('overspending-alert');
        if (overspendingAlert) {
            if (overspending.isOverspending) {
                overspendingAlert.classList.remove('hidden');
                overspendingAlert.innerHTML = `<strong>Warning:</strong> You are overspending by ${formatCurrency(overspending.amount)} this month!`;
            } else {
                overspendingAlert.classList.add('hidden');
            }
        }

        // Render pie chart
        const pieCanvas = document.getElementById('category-pie-chart');
        if (pieCanvas) {
            renderPieChart(pieCanvas, categoryBreakdown);

            // Set up responsive resizing
            const cleanup = setupResponsiveCanvas(pieCanvas, () => {
                renderPieChart(pieCanvas, categoryBreakdown);
            });
            cleanupFunctions.push(cleanup);
        }

        // Render line chart
        const lineCanvas = document.getElementById('trends-line-chart');
        if (lineCanvas) {
            renderLineChart(lineCanvas, monthlyTotals);

            const cleanup = setupResponsiveCanvas(lineCanvas, () => {
                renderLineChart(lineCanvas, monthlyTotals);
            });
            cleanupFunctions.push(cleanup);
        }

        // Render forecast chart
        const forecastCanvas = document.getElementById('forecast-chart');
        if (forecastCanvas) {
            const historicalTotals = monthlyTotals.map(m => m.total);
            renderForecastChart(forecastCanvas, historicalTotals, forecast.prediction);

            const cleanup = setupResponsiveCanvas(forecastCanvas, () => {
                renderForecastChart(forecastCanvas, historicalTotals, forecast.prediction);
            });
            cleanupFunctions.push(cleanup);
        }

        // Update forecast info
        const forecastInfo = document.getElementById('forecast-info');
        if (forecastInfo) {
            if (forecast.basedOnMonths > 0) {
                forecastInfo.textContent = `Predicted spending: ${formatCurrency(forecast.prediction)} (${forecast.confidence} confidence based on ${forecast.basedOnMonths} month(s) of data)`;
            } else {
                forecastInfo.textContent = 'Add more expenses to see spending predictions';
            }
        }

        // Render top categories
        const topCategoriesList = document.getElementById('top-categories-list');
        if (topCategoriesList) {
            topCategoriesList.innerHTML = '';

            if (topCategories.length === 0) {
                topCategoriesList.innerHTML = '<li>No spending data yet</li>';
            } else {
                topCategories.forEach(cat => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span>${escapeHtml(cat.category)}</span>
                        <span>${formatCurrency(cat.total)}</span>
                    `;
                    topCategoriesList.appendChild(li);
                });
            }
        }

    } catch (err) {
        console.error('Render dashboard error:', err);
        showError('Failed to load dashboard data');
    } finally {
        hideLoading();
    }
}


/**
 * Render AI budget suggestions
 * 
 * @param {Object} plan - Budget plan from AI engine
 */
function renderAISuggestions(plan) {
    const container = document.getElementById('ai-suggestions-container');
    const insufficientData = document.getElementById('ai-insufficient-data');

    if (!container) return;

    // Handle insufficient data case
    if (!plan.hasEnoughData || plan.message) {
        container.classList.add('hidden');
        if (insufficientData) {
            insufficientData.classList.remove('hidden');
            insufficientData.textContent = plan.message || 'We need more expense data to provide personalized recommendations.';
        }
        return;
    }

    // Hide insufficient data message
    if (insufficientData) {
        insufficientData.classList.add('hidden');
    }

    // Show suggestions container
    container.classList.remove('hidden');

    // Render summary
    const summaryText = document.getElementById('ai-summary-text');
    if (summaryText) {
        summaryText.textContent = plan.summary || 'Based on your spending patterns, here are our recommendations.';
    }

    // Render ideal savings percentage
    const savingsPercentage = document.getElementById('ai-savings-percentage');
    if (savingsPercentage) {
        savingsPercentage.textContent = `${plan.idealSavingsPercentage}% of your income`;
    }

    // Render category limits
    const categoryLimits = document.getElementById('ai-category-limits');
    if (categoryLimits && plan.categoryLimits) {
        categoryLimits.innerHTML = '';

        if (plan.categoryLimits.length === 0) {
            categoryLimits.innerHTML = '<li>No category recommendations available</li>';
        } else {
            plan.categoryLimits.forEach(limit => {
                const li = document.createElement('li');
                li.className = `priority-${limit.priority}`;
                li.innerHTML = `
                    <strong>${escapeHtml(limit.category)}</strong><br>
                    Current: ${formatCurrency(limit.currentSpending)} → 
                    Recommended: ${formatCurrency(limit.recommendedLimit)}
                    <span class="percentage">(${limit.percentageOfBudget}% of budget)</span>
                `;
                categoryLimits.appendChild(li);
            });
        }
    }

    // Render tips
    const tipsList = document.getElementById('ai-tips');
    if (tipsList && plan.tips) {
        tipsList.innerHTML = '';

        if (plan.tips.length === 0) {
            tipsList.innerHTML = '<li>Great job! No specific tips at this time.</li>';
        } else {
            plan.tips.forEach(tip => {
                const li = document.createElement('li');
                li.className = `priority-${tip.priority}`;
                li.innerHTML = `
                    <strong>${escapeHtml(tip.category)}</strong><br>
                    ${escapeHtml(tip.message)}<br>
                    <em>Potential savings: ${formatCurrency(tip.potentialSavings)}</em>
                `;
                tipsList.appendChild(li);
            });
        }
    }

    // Render saving plans
    const savingPlans = document.getElementById('ai-saving-plans');
    if (savingPlans) {
        savingPlans.innerHTML = '';

        // Helper to format timeframe nicely
        const formatTimeframe = (months) => {
            if (months <= 12) {
                return `${months} month${months > 1 ? 's' : ''}`;
            }
            const years = Math.floor(months / 12);
            const remainingMonths = months % 12;
            if (remainingMonths === 0) {
                return `${years} year${years > 1 ? 's' : ''}`;
            }
            return `${years} year${years > 1 ? 's' : ''} ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
        };

        if (plan.shortTermPlan) {
            const shortTermDiv = document.createElement('div');
            shortTermDiv.className = 'saving-plan';
            shortTermDiv.innerHTML = `
                <h4>🎯 ${escapeHtml(plan.shortTermPlan.name)}</h4>
                <p><span>Goal Amount</span> <strong>${formatCurrency(plan.shortTermPlan.targetAmount)}</strong></p>
                <p><span>Save Monthly</span> <strong>${formatCurrency(plan.shortTermPlan.monthlyContribution)}</strong></p>
                <p><span>Time Needed</span> <strong>${formatTimeframe(plan.shortTermPlan.timeframeMonths)}</strong></p>
                <ul>
                    ${plan.shortTermPlan.milestones.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
                </ul>
            `;
            savingPlans.appendChild(shortTermDiv);
        }

        if (plan.longTermPlan) {
            const longTermDiv = document.createElement('div');
            longTermDiv.className = 'saving-plan';
            longTermDiv.innerHTML = `
                <h4>🚀 ${escapeHtml(plan.longTermPlan.name)}</h4>
                <p><span>Goal Amount</span> <strong>${formatCurrency(plan.longTermPlan.targetAmount)}</strong></p>
                <p><span>Save Monthly</span> <strong>${formatCurrency(plan.longTermPlan.monthlyContribution)}</strong></p>
                <p><span>Time Needed</span> <strong>${formatTimeframe(plan.longTermPlan.timeframeMonths)}</strong></p>
                <ul>
                    ${plan.longTermPlan.milestones.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
                </ul>
            `;
            savingPlans.appendChild(longTermDiv);
        }

        if (!plan.shortTermPlan && !plan.longTermPlan) {
            savingPlans.innerHTML = '<p class="empty-state">Set up your budget to get personalized saving plans!</p>';
        }
    }
}

/**
 * Load budget settings into the form
 */
async function loadBudgetSettings() {
    showLoading();

    try {
        const { data: budget, error } = await getBudget();

        if (error) {
            showError(error.message);
            return;
        }

        // Populate form fields
        const incomeInput = document.getElementById('monthly-income');
        const savingsInput = document.getElementById('savings-goal');

        if (budget) {
            if (incomeInput) incomeInput.value = budget.monthly_income || '';
            if (savingsInput) savingsInput.value = budget.savings_goal || '';

            // Update display
            updateBudgetDisplay(budget.monthly_income, budget.savings_goal);
        } else {
            if (incomeInput) incomeInput.value = '';
            if (savingsInput) savingsInput.value = '';
            updateBudgetDisplay(0, 0);
        }

    } catch (err) {
        console.error('Load budget settings error:', err);
        showError('Failed to load budget settings');
    } finally {
        hideLoading();
    }
}

/**
 * Update the budget display section
 * 
 * @param {number} income - Monthly income
 * @param {number} savings - Savings goal
 */
function updateBudgetDisplay(income, savings) {
    const incomeDisplay = document.getElementById('budget-income-display');
    const savingsDisplay = document.getElementById('budget-savings-display');
    const availableDisplay = document.getElementById('budget-available-display');

    if (incomeDisplay) incomeDisplay.textContent = formatCurrency(income || 0);
    if (savingsDisplay) savingsDisplay.textContent = formatCurrency(savings || 0);
    if (availableDisplay) {
        const available = Math.max(0, (income || 0) - (savings || 0));
        availableDisplay.textContent = formatCurrency(available);
    }
}


/**
 * Initialize all event listeners for UI interactions
 * 
 * Requirements: 12.6
 */
function initEventListeners() {
    // Initialize calendar
    initCalendarListeners();

    // Initialize import dialog
    initImportDialog();

    // Listen for expenses-updated event (from import dialog)
    document.addEventListener('expenses-updated', async () => {
        await loadExpenseList();

        // Also refresh dashboard if visible
        const dashboardView = document.getElementById('dashboard-view');
        if (dashboardView && !dashboardView.classList.contains('hidden')) {
            await renderDashboard();
        }
    });

    // Desktop Navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = link.dataset.view;
            if (viewId) {
                showView(viewId);
            }
        });
    });

    // Mobile Navigation links
    document.querySelectorAll('.mobile-nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = link.dataset.view;
            if (viewId) {
                showView(viewId);
            }
        });
    });

    // Mobile menu button
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', openMobileMenu);
    }

    // Mobile menu close button
    const mobileMenuClose = document.getElementById('mobile-menu-close');
    if (mobileMenuClose) {
        mobileMenuClose.addEventListener('click', closeMobileMenu);
    }

    // Mobile menu overlay click to close
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    if (mobileMenuOverlay) {
        mobileMenuOverlay.addEventListener('click', closeMobileMenu);
    }

    // Mobile logout button
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', async () => {
            closeMobileMenu();
            showLoading();
            try {
                await logout();
                showSuccess('Logged out successfully');
            } catch (err) {
                showError('Failed to logout');
            } finally {
                hideLoading();
            }
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            showLoading();
            try {
                await logout();
                showSuccess('Logged out successfully');
            } catch (err) {
                showError('Failed to logout');
            } finally {
                hideLoading();
            }
        });
    }

    // Add expense button
    const addExpenseBtn = document.getElementById('add-expense-btn');
    if (addExpenseBtn) {
        addExpenseBtn.addEventListener('click', () => {
            showExpenseForm();
        });
    }

    // Cancel expense button
    const cancelExpenseBtn = document.getElementById('cancel-expense-btn');
    if (cancelExpenseBtn) {
        cancelExpenseBtn.addEventListener('click', () => {
            hideExpenseForm();
        });
    }

    // Expense form submission
    const expenseForm = document.getElementById('expense-form');
    if (expenseForm) {
        expenseForm.addEventListener('submit', handleExpenseSubmit);
    }

    // Expense list event delegation for edit/delete buttons
    const expenseList = document.getElementById('expense-list');
    if (expenseList) {
        expenseList.addEventListener('click', handleExpenseListClick);
    }

    // Budget form submission
    const budgetForm = document.getElementById('budget-form');
    if (budgetForm) {
        budgetForm.addEventListener('submit', handleBudgetSubmit);
    }

    // Budget form input change for savings warning
    const savingsGoalInput = document.getElementById('savings-goal');
    const monthlyIncomeInput = document.getElementById('monthly-income');
    if (savingsGoalInput && monthlyIncomeInput) {
        const checkSavingsWarning = () => {
            const income = parseFloat(monthlyIncomeInput.value) || 0;
            const savings = parseFloat(savingsGoalInput.value) || 0;
            const warning = document.getElementById('savings-warning');
            if (warning) {
                if (savings > income && income > 0) {
                    warning.classList.remove('hidden');
                } else {
                    warning.classList.add('hidden');
                }
            }
        };
        savingsGoalInput.addEventListener('input', checkSavingsWarning);
        monthlyIncomeInput.addEventListener('input', checkSavingsWarning);
    }

    // AI Budget Plan button
    const getAIPlanBtn = document.getElementById('get-ai-plan-btn');
    if (getAIPlanBtn) {
        getAIPlanBtn.addEventListener('click', handleGetAIPlan);
    }
}

/**
 * Show the expense form for adding a new expense
 * 
 * @param {Object} expense - Optional expense object for editing
 */
function showExpenseForm(expense = null) {
    const formContainer = document.getElementById('expense-form-container');
    const formTitle = document.getElementById('expense-form-title');
    const form = document.getElementById('expense-form');
    const expenseIdInput = document.getElementById('expense-id');
    const dateDisplay = document.getElementById('expense-date-display');

    if (!formContainer || !form) return;

    // Reset form
    form.reset();
    clearFormErrors(form);

    // Reset calendar state
    const today = new Date();
    calendarState.currentMonth = today.getMonth();
    calendarState.currentYear = today.getFullYear();
    calendarState.selectedDate = today;

    // Set form title and populate fields if editing
    if (expense) {
        if (formTitle) formTitle.textContent = 'Edit Expense';
        if (expenseIdInput) expenseIdInput.value = expense.id;

        document.getElementById('expense-name').value = expense.expense_name || '';
        document.getElementById('expense-category').value = expense.category || '';
        document.getElementById('expense-amount').value = expense.amount || '';
        document.getElementById('expense-date').value = expense.date || '';

        // Update calendar with existing date
        if (expense.date) {
            const expenseDate = new Date(expense.date);
            calendarState.selectedDate = expenseDate;
            calendarState.currentMonth = expenseDate.getMonth();
            calendarState.currentYear = expenseDate.getFullYear();
        }
    } else {
        if (formTitle) formTitle.textContent = 'Add Expense';
        if (expenseIdInput) expenseIdInput.value = '';

        // Set default date to today
        const todayStr = today.toISOString().split('T')[0];
        document.getElementById('expense-date').value = todayStr;
    }

    // Update date display
    updateDateTimeDisplay();

    formContainer.classList.remove('hidden');
}

/**
 * Hide the expense form
 */
function hideExpenseForm() {
    const formContainer = document.getElementById('expense-form-container');
    if (formContainer) {
        formContainer.classList.add('hidden');
    }
}

/**
 * Clear form error messages
 * 
 * @param {HTMLFormElement} form - The form element
 */
function clearFormErrors(form) {
    const errorMessages = form.querySelectorAll('.error-message');
    errorMessages.forEach(el => {
        el.textContent = '';
    });

    const errorInputs = form.querySelectorAll('.error');
    errorInputs.forEach(el => {
        el.classList.remove('error');
    });
}


/**
 * Handle expense form submission
 * 
 * @param {Event} e - Form submit event
 */
async function handleExpenseSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const expenseId = document.getElementById('expense-id').value;

    // Gather form data
    const expenseData = {
        expense_name: document.getElementById('expense-name').value.trim(),
        category: document.getElementById('expense-category').value,
        amount: parseFloat(document.getElementById('expense-amount').value),
        date: document.getElementById('expense-date').value
    };

    // Validate
    const validation = validateExpense(expenseData);

    if (!validation.valid) {
        // Show validation errors
        clearFormErrors(form);
        validation.errors.forEach(error => {
            if (error.includes('expense name')) {
                document.getElementById('expense-name-error').textContent = error;
                document.getElementById('expense-name').classList.add('error');
            } else if (error.includes('category')) {
                document.getElementById('expense-category-error').textContent = error;
                document.getElementById('expense-category').classList.add('error');
            } else if (error.includes('Amount') || error.includes('amount')) {
                document.getElementById('expense-amount-error').textContent = error;
                document.getElementById('expense-amount').classList.add('error');
            } else if (error.includes('date')) {
                document.getElementById('expense-date-error').textContent = error;
                document.getElementById('expense-date').classList.add('error');
            }
        });
        return;
    }

    showLoading();

    try {
        let result;

        if (expenseId) {
            // Update existing expense
            result = await updateExpense(expenseId, expenseData);
        } else {
            // Create new expense
            result = await createExpense(expenseData);
        }

        if (result.error) {
            showError(result.error.message);
            return;
        }

        showSuccess(expenseId ? 'Expense updated successfully' : 'Expense added successfully');
        hideExpenseForm();
        await loadExpenseList();

        // Refresh dashboard charts if visible
        const dashboardView = document.getElementById('dashboard-view');
        if (dashboardView && !dashboardView.classList.contains('hidden')) {
            await renderDashboard();
        }

    } catch (err) {
        console.error('Expense submit error:', err);
        showError('Failed to save expense');
    } finally {
        hideLoading();
    }
}

/**
 * Handle clicks on expense list (edit/delete/split buttons)
 * 
 * @param {Event} e - Click event
 */
async function handleExpenseListClick(e) {
    const target = e.target;

    // Handle edit button
    if (target.classList.contains('edit-expense-btn')) {
        const expenseId = target.dataset.id;
        await handleEditExpense(expenseId);
    }

    // Handle delete button
    if (target.classList.contains('delete-expense-btn')) {
        const expenseId = target.dataset.id;
        await handleDeleteExpense(expenseId);
    }
}

/**
 * Handle editing an expense
 * 
 * @param {string} expenseId - The expense ID to edit
 */
async function handleEditExpense(expenseId) {
    showLoading();

    try {
        const { data: expenses, error } = await getExpenses();

        if (error) {
            showError(error.message);
            return;
        }

        const expense = expenses.find(e => e.id === expenseId);

        if (expense) {
            showExpenseForm(expense);
        } else {
            showError('Expense not found');
        }

    } catch (err) {
        console.error('Edit expense error:', err);
        showError('Failed to load expense');
    } finally {
        hideLoading();
    }
}

/**
 * Handle deleting an expense
 * 
 * @param {string} expenseId - The expense ID to delete
 */
async function handleDeleteExpense(expenseId) {
    if (!confirm('Are you sure you want to delete this expense?')) {
        return;
    }

    showLoading();

    try {
        const { error } = await deleteExpense(expenseId);

        if (error) {
            showError(error.message);
            return;
        }

        showSuccess('Expense deleted successfully');
        await loadExpenseList();

        // Refresh dashboard charts if visible
        const dashboardView = document.getElementById('dashboard-view');
        if (dashboardView && !dashboardView.classList.contains('hidden')) {
            await renderDashboard();
        }

    } catch (err) {
        console.error('Delete expense error:', err);
        showError('Failed to delete expense');
    } finally {
        hideLoading();
    }
}


/**
 * Handle budget form submission
 * 
 * @param {Event} e - Form submit event
 */
async function handleBudgetSubmit(e) {
    e.preventDefault();

    const form = e.target;

    // Gather form data - savings_goal is optional
    const savingsValue = document.getElementById('savings-goal').value;
    const budgetData = {
        monthly_income: parseFloat(document.getElementById('monthly-income').value),
        savings_goal: savingsValue === '' ? 0 : parseFloat(savingsValue)
    };

    // Validate
    const validation = validateBudget(budgetData);

    if (!validation.valid) {
        // Show validation errors
        clearFormErrors(form);
        validation.errors.forEach(error => {
            if (error.includes('income')) {
                document.getElementById('monthly-income-error').textContent = error;
                document.getElementById('monthly-income').classList.add('error');
            } else if (error.includes('Savings') || error.includes('savings')) {
                document.getElementById('savings-goal-error').textContent = error;
                document.getElementById('savings-goal').classList.add('error');
            }
        });
        return;
    }

    showLoading();

    try {
        const { data, error } = await saveBudget(budgetData.monthly_income, budgetData.savings_goal);

        if (error) {
            showError(error.message);
            return;
        }

        showSuccess('Budget saved successfully');
        updateBudgetDisplay(budgetData.monthly_income, budgetData.savings_goal);

        // Refresh dashboard if visible
        const dashboardView = document.getElementById('dashboard-view');
        if (dashboardView && !dashboardView.classList.contains('hidden')) {
            await renderDashboard();
        }

    } catch (err) {
        console.error('Budget submit error:', err);
        showError('Failed to save budget');
    } finally {
        hideLoading();
    }
}

/**
 * Handle Get AI Budget Plan button click
 */
async function handleGetAIPlan() {
    showLoading();

    try {
        const plan = await getBudgetPlan();
        renderAISuggestions(plan);

        if (plan.hasEnoughData && !plan.message) {
            showSuccess('AI budget plan generated successfully');
        }

    } catch (err) {
        console.error('Get AI plan error:', err);
        showError('Failed to generate AI budget plan');
    } finally {
        hideLoading();
    }
}

/**
 * Clean up resources (e.g., event listeners for chart resizing)
 */
function cleanup() {
    cleanupFunctions.forEach(fn => {
        if (typeof fn === 'function') {
            fn();
        }
    });
    cleanupFunctions.length = 0;
}

// Export all UI functions
export {
    showView,
    showSuccess,
    showError,
    showLoading,
    hideLoading,
    renderExpenseList,
    renderDashboard,
    renderAISuggestions,
    initEventListeners,
    loadExpenseList,
    loadBudgetSettings,
    formatCurrency,
    formatDate,
    cleanup,
    openImportDialog,
    closeImportDialog
};
