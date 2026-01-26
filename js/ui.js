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
import { getCurrentMonthTotal, getCategoryBreakdown, checkOverspending, getMonthlyTotals, getTopCategories, getMonthOverMonthChange } from './analytics.js';
import { predictNextMonth } from './forecast.js';
import { getBudgetPlan } from './ai.js';
import { renderPieChart, renderLineChart, renderForecastChart, setupResponsiveCanvas } from './charts.js';
import { logout } from './auth.js';

/**
 * Toast message duration in milliseconds
 */
const TOAST_DURATION = 4000;

/**
 * Store for cleanup functions (e.g., chart resize listeners)
 */
const cleanupFunctions = [];

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

    // Update navigation active state
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.view === viewId) {
            link.classList.add('active');
        }
    });

    // Load view-specific data
    loadViewData(viewId);
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
function renderExpenseList(expenses) {
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
    expenses.forEach(expense => {
        const item = document.createElement('li');
        item.className = 'expense-item';
        item.dataset.id = expense.id;

        item.innerHTML = `
            <div class="expense-item-info">
                <span class="expense-item-name">${escapeHtml(expense.expense_name)}</span>
                <span class="expense-item-category">${escapeHtml(expense.category)}</span>
            </div>
            <span class="expense-item-amount">${formatCurrency(expense.amount)}</span>
            <span class="expense-item-date">${formatDate(expense.date)}</span>
            <div class="expense-item-actions">
                <button class="btn btn-secondary edit-expense-btn" data-id="${expense.id}">Edit</button>
                <button class="btn btn-danger delete-expense-btn" data-id="${expense.id}">Delete</button>
            </div>
        `;

        listContainer.appendChild(item);
    });
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
            availableBudgetEl.textContent = formatCurrency(availableBudget);
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

        if (plan.shortTermPlan) {
            const shortTermDiv = document.createElement('div');
            shortTermDiv.className = 'saving-plan';
            shortTermDiv.innerHTML = `
                <h4>${escapeHtml(plan.shortTermPlan.name)} (Short-term)</h4>
                <p>Target: ${formatCurrency(plan.shortTermPlan.targetAmount)}</p>
                <p>Monthly contribution: ${formatCurrency(plan.shortTermPlan.monthlyContribution)}</p>
                <p>Timeframe: ${plan.shortTermPlan.timeframeMonths} months</p>
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
                <h4>${escapeHtml(plan.longTermPlan.name)} (Long-term)</h4>
                <p>Target: ${formatCurrency(plan.longTermPlan.targetAmount)}</p>
                <p>Monthly contribution: ${formatCurrency(plan.longTermPlan.monthlyContribution)}</p>
                <p>Timeframe: ${plan.longTermPlan.timeframeMonths} months</p>
                <ul>
                    ${plan.longTermPlan.milestones.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
                </ul>
            `;
            savingPlans.appendChild(longTermDiv);
        }

        if (!plan.shortTermPlan && !plan.longTermPlan) {
            savingPlans.innerHTML = '<p>Set up your budget to receive personalized saving plans.</p>';
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
    // Navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = link.dataset.view;
            if (viewId) {
                showView(viewId);
            }
        });
    });

    // Logout buttons (desktop and mobile)
    const handleLogoutClick = async () => {
        showLoading();
        try {
            await logout();
            showSuccess('Logged out successfully');
        } catch (err) {
            showError('Failed to logout');
        } finally {
            hideLoading();
        }
    };

    const logoutBtn = document.getElementById('logout-btn');
    const logoutBtnMobile = document.getElementById('logout-btn-mobile');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogoutClick);
    }
    if (logoutBtnMobile) {
        logoutBtnMobile.addEventListener('click', handleLogoutClick);
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

    if (!formContainer || !form) return;

    // Reset form
    form.reset();
    clearFormErrors(form);

    // Set form title and populate fields if editing
    if (expense) {
        if (formTitle) formTitle.textContent = 'Edit Expense';
        if (expenseIdInput) expenseIdInput.value = expense.id;

        document.getElementById('expense-name').value = expense.expense_name || '';
        document.getElementById('expense-category').value = expense.category || '';
        document.getElementById('expense-amount').value = expense.amount || '';
        document.getElementById('expense-date').value = expense.date || '';
    } else {
        if (formTitle) formTitle.textContent = 'Add Expense';
        if (expenseIdInput) expenseIdInput.value = '';

        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expense-date').value = today;
    }

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
 * Handle clicks on expense list (edit/delete buttons)
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
    cleanup
};
