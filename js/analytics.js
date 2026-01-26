/**
 * Analytics Module
 * 
 * Performs spending calculations and trend analysis using expense and budget data.
 * All operations are scoped to the authenticated user via Row Level Security.
 * 
 * @module analytics
 * 
 * Requirements covered:
 * - 5.1: Display total expenses for current month
 * - 5.2: Display category-wise breakdown with amounts
 * - 5.3: Display percentage contribution of each category
 * - 5.4: Display overspending alert when expenses exceed available budget
 * - 6.1: Display monthly spending totals for past 6 months
 * - 6.2: Identify and highlight highest spending categories
 * - 6.4: Calculate month-over-month spending changes as percentages
 */

import { supabase } from './supabaseConfig.js';
import { getBudget, getAvailableBudget } from './budget.js';

/**
 * Get the total expenses for the current month
 * 
 * @returns {Promise<number>} The sum of all expenses for the current month
 * 
 * Requirements: 5.1
 */
async function getCurrentMonthTotal() {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return 0;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // JavaScript months are 0-indexed

        // Calculate start and end dates for the current month
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { data: expenses, error } = await supabase
            .from('expenses')
            .select('amount')
            .eq('user_id', user.id)
            .gte('date', startDate)
            .lte('date', endDate);

        if (error) {
            console.error('Error fetching current month expenses:', error);
            return 0;
        }

        // Sum all expense amounts
        const total = (expenses || []).reduce((sum, expense) => {
            return sum + parseFloat(expense.amount);
        }, 0);

        return total;
    } catch (err) {
        console.error('Get current month total error:', err);
        return 0;
    }
}


/**
 * Get category breakdown with amounts and percentages for the current month
 * 
 * @returns {Promise<Array<{category: string, total: number, percentage: number, count: number}>>}
 * Returns array of category breakdowns sorted by total descending
 * 
 * Requirements: 5.2, 5.3
 */
async function getCategoryBreakdown() {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return [];
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // Calculate start and end dates for the current month
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { data: expenses, error } = await supabase
            .from('expenses')
            .select('category, amount')
            .eq('user_id', user.id)
            .gte('date', startDate)
            .lte('date', endDate);

        if (error) {
            console.error('Error fetching expenses for category breakdown:', error);
            return [];
        }

        if (!expenses || expenses.length === 0) {
            return [];
        }

        // Group by category and calculate totals
        const categoryMap = new Map();
        let overallTotal = 0;

        for (const expense of expenses) {
            const amount = parseFloat(expense.amount);
            overallTotal += amount;

            const existing = categoryMap.get(expense.category);
            if (existing) {
                existing.total += amount;
                existing.count += 1;
            } else {
                categoryMap.set(expense.category, {
                    category: expense.category,
                    total: amount,
                    count: 1
                });
            }
        }

        // Calculate percentages and convert to array
        const result = Array.from(categoryMap.values()).map(cat => ({
            ...cat,
            percentage: overallTotal > 0 ? (cat.total / overallTotal) * 100 : 0
        }));

        // Sort by total descending
        result.sort((a, b) => b.total - a.total);

        return result;
    } catch (err) {
        console.error('Get category breakdown error:', err);
        return [];
    }
}

/**
 * Check if user is overspending based on budget settings
 * Overspending occurs when total expenses exceed (monthly_income - savings_goal)
 * 
 * @returns {Promise<{isOverspending: boolean, amount: number, availableBudget: number}>}
 * Returns overspending status and the amount over budget (if any)
 * 
 * Requirements: 5.4
 */
async function checkOverspending() {
    try {
        const [currentTotal, availableBudget] = await Promise.all([
            getCurrentMonthTotal(),
            getAvailableBudget()
        ]);

        // If no budget is set, available budget is 0, so any spending is "over"
        // But we should only alert if there's actually a budget configured
        const { data: budget } = await getBudget();

        if (!budget) {
            // No budget configured - can't determine overspending
            return {
                isOverspending: false,
                amount: 0,
                availableBudget: 0
            };
        }

        const isOverspending = currentTotal > availableBudget;
        const overAmount = isOverspending ? currentTotal - availableBudget : 0;

        return {
            isOverspending,
            amount: overAmount,
            availableBudget
        };
    } catch (err) {
        console.error('Check overspending error:', err);
        return {
            isOverspending: false,
            amount: 0,
            availableBudget: 0
        };
    }
}


/**
 * Get monthly spending totals for the past N months
 * 
 * @param {number} months - Number of months to retrieve (default: 6)
 * @returns {Promise<Array<{year: number, month: number, total: number, label: string}>>}
 * Returns array of monthly totals sorted by date ascending (oldest first)
 * 
 * Requirements: 6.1
 */
async function getMonthlyTotals(months = 6) {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return [];
        }

        // Calculate the date range for the past N months
        const now = new Date();
        const endYear = now.getFullYear();
        const endMonth = now.getMonth() + 1;

        // Calculate start date (N months ago)
        let startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth() + 1;

        const startDateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(endYear, endMonth, 0).getDate();
        const endDateStr = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { data: expenses, error } = await supabase
            .from('expenses')
            .select('amount, date')
            .eq('user_id', user.id)
            .gte('date', startDateStr)
            .lte('date', endDateStr);

        if (error) {
            console.error('Error fetching expenses for monthly totals:', error);
            return [];
        }

        // Group expenses by month
        const monthlyMap = new Map();

        // Initialize all months in range with zero
        for (let i = 0; i < months; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const key = `${year}-${month}`;
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            monthlyMap.set(key, {
                year,
                month,
                total: 0,
                label: `${monthNames[month - 1]} ${year}`
            });
        }

        // Sum expenses into their respective months
        for (const expense of expenses || []) {
            const expenseDate = new Date(expense.date);
            const year = expenseDate.getFullYear();
            const month = expenseDate.getMonth() + 1;
            const key = `${year}-${month}`;

            if (monthlyMap.has(key)) {
                monthlyMap.get(key).total += parseFloat(expense.amount);
            }
        }

        // Convert to array and sort by date ascending
        const result = Array.from(monthlyMap.values()).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
        });

        return result;
    } catch (err) {
        console.error('Get monthly totals error:', err);
        return [];
    }
}

/**
 * Get the top spending categories ranked by total amount
 * 
 * @param {number} limit - Maximum number of categories to return (default: 5)
 * @returns {Promise<Array<{category: string, total: number, count: number}>>}
 * Returns array of categories sorted by total descending
 * 
 * Requirements: 6.2
 */
async function getTopCategories(limit = 5) {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return [];
        }

        // Get all expenses for the user (all time)
        const { data: expenses, error } = await supabase
            .from('expenses')
            .select('category, amount')
            .eq('user_id', user.id);

        if (error) {
            console.error('Error fetching expenses for top categories:', error);
            return [];
        }

        if (!expenses || expenses.length === 0) {
            return [];
        }

        // Group by category and calculate totals
        const categoryMap = new Map();

        for (const expense of expenses) {
            const amount = parseFloat(expense.amount);
            const existing = categoryMap.get(expense.category);

            if (existing) {
                existing.total += amount;
                existing.count += 1;
            } else {
                categoryMap.set(expense.category, {
                    category: expense.category,
                    total: amount,
                    count: 1
                });
            }
        }

        // Convert to array, sort by total descending, and limit
        const result = Array.from(categoryMap.values())
            .sort((a, b) => b.total - a.total)
            .slice(0, limit);

        return result;
    } catch (err) {
        console.error('Get top categories error:', err);
        return [];
    }
}


/**
 * Calculate month-over-month spending change as a percentage
 * Compares current month to previous month
 * 
 * @returns {Promise<{percentage: number, direction: string, currentMonth: number, previousMonth: number}>}
 * Returns percentage change and direction ("increase", "decrease", or "unchanged")
 * 
 * Requirements: 6.4
 */
async function getMonthOverMonthChange() {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return {
                percentage: 0,
                direction: 'unchanged',
                currentMonth: 0,
                previousMonth: 0
            };
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        // Calculate previous month
        let prevYear = currentYear;
        let prevMonth = currentMonth - 1;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = currentYear - 1;
        }

        // Get current month expenses
        const currentStartDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
        const currentLastDay = new Date(currentYear, currentMonth, 0).getDate();
        const currentEndDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentLastDay).padStart(2, '0')}`;

        // Get previous month expenses
        const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
        const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
        const prevEndDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;

        const [currentResult, prevResult] = await Promise.all([
            supabase
                .from('expenses')
                .select('amount')
                .eq('user_id', user.id)
                .gte('date', currentStartDate)
                .lte('date', currentEndDate),
            supabase
                .from('expenses')
                .select('amount')
                .eq('user_id', user.id)
                .gte('date', prevStartDate)
                .lte('date', prevEndDate)
        ]);

        if (currentResult.error || prevResult.error) {
            console.error('Error fetching month-over-month data');
            return {
                percentage: 0,
                direction: 'unchanged',
                currentMonth: 0,
                previousMonth: 0
            };
        }

        // Calculate totals
        const currentTotal = (currentResult.data || []).reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const prevTotal = (prevResult.data || []).reduce((sum, e) => sum + parseFloat(e.amount), 0);

        // Calculate percentage change
        let percentage = 0;
        let direction = 'unchanged';

        if (prevTotal === 0) {
            // If previous month was 0, we can't calculate a percentage
            // If current is also 0, unchanged; otherwise it's an increase from nothing
            if (currentTotal > 0) {
                percentage = 100; // Represent as 100% increase from nothing
                direction = 'increase';
            }
        } else {
            percentage = ((currentTotal - prevTotal) / prevTotal) * 100;

            if (percentage > 0) {
                direction = 'increase';
            } else if (percentage < 0) {
                direction = 'decrease';
                percentage = Math.abs(percentage); // Return absolute value for display
            }
        }

        return {
            percentage: Math.round(percentage * 100) / 100, // Round to 2 decimal places
            direction,
            currentMonth: currentTotal,
            previousMonth: prevTotal
        };
    } catch (err) {
        console.error('Get month-over-month change error:', err);
        return {
            percentage: 0,
            direction: 'unchanged',
            currentMonth: 0,
            previousMonth: 0
        };
    }
}

// Export all analytics functions
export {
    getCurrentMonthTotal,
    getCategoryBreakdown,
    checkOverspending,
    getMonthlyTotals,
    getTopCategories,
    getMonthOverMonthChange
};
