/**
 * Expenses Module
 * 
 * Manages CRUD operations for expense records using Supabase.
 * All operations are scoped to the authenticated user via Row Level Security.
 * 
 * @module expenses
 * 
 * Requirements covered:
 * - 3.1: Create new expenses
 * - 3.2: Update existing expenses
 * - 3.3: Delete expenses
 * - 3.4: View expenses sorted by date descending
 */

import { supabase } from './supabaseConfig.js';

/**
 * Create a new expense for the current user
 * 
 * @param {Object} expense - The expense data
 * @param {string} expense.expense_name - Name/description of the expense
 * @param {string} expense.category - Category of the expense
 * @param {number} expense.amount - Amount (must be positive)
 * @param {string} expense.date - Date in YYYY-MM-DD format
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 * 
 * Requirements: 3.1
 */
async function createExpense(expense) {
    try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return { data: null, error: { message: 'User not authenticated' } };
        }

        const { data, error } = await supabase
            .from('expenses')
            .insert({
                user_id: user.id,
                expense_name: expense.expense_name,
                category: expense.category,
                amount: expense.amount,
                date: expense.date
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating expense:', error);
            return { data: null, error: { message: 'Unable to save expense. Please try again.' } };
        }

        return { data, error: null };
    } catch (err) {
        console.error('Create expense error:', err);
        return { data: null, error: { message: 'An unexpected error occurred while saving the expense.' } };
    }
}


/**
 * Get all expenses for the current user sorted by date descending
 * 
 * @returns {Promise<{data: Array|null, error: Object|null}>}
 * 
 * Requirements: 3.4
 */
async function getExpenses() {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return { data: null, error: { message: 'User not authenticated' } };
        }

        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching expenses:', error);
            return { data: null, error: { message: 'Unable to load your expenses. Please refresh.' } };
        }

        return { data: data || [], error: null };
    } catch (err) {
        console.error('Get expenses error:', err);
        return { data: null, error: { message: 'An unexpected error occurred while loading expenses.' } };
    }
}

/**
 * Get expenses for a specific month and year
 * 
 * @param {number} year - The year (e.g., 2024)
 * @param {number} month - The month (1-12)
 * @returns {Promise<{data: Array|null, error: Object|null}>}
 */
async function getExpensesByMonth(year, month) {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return { data: null, error: { message: 'User not authenticated' } };
        }

        // Calculate start and end dates for the month
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching expenses by month:', error);
            return { data: null, error: { message: 'Unable to load expenses for this month.' } };
        }

        return { data: data || [], error: null };
    } catch (err) {
        console.error('Get expenses by month error:', err);
        return { data: null, error: { message: 'An unexpected error occurred while loading expenses.' } };
    }
}


/**
 * Update an existing expense
 * 
 * @param {string} id - The expense ID (UUID)
 * @param {Object} updates - The fields to update
 * @param {string} [updates.expense_name] - Updated name
 * @param {string} [updates.category] - Updated category
 * @param {number} [updates.amount] - Updated amount
 * @param {string} [updates.date] - Updated date
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 * 
 * Requirements: 3.2
 */
async function updateExpense(id, updates) {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return { data: null, error: { message: 'User not authenticated' } };
        }

        // Build update object with only provided fields
        const updateData = {};
        if (updates.expense_name !== undefined) updateData.expense_name = updates.expense_name;
        if (updates.category !== undefined) updateData.category = updates.category;
        if (updates.amount !== undefined) updateData.amount = updates.amount;
        if (updates.date !== undefined) updateData.date = updates.date;

        const { data, error } = await supabase
            .from('expenses')
            .update(updateData)
            .eq('id', id)
            .eq('user_id', user.id)  // Ensure user owns this expense
            .select()
            .single();

        if (error) {
            console.error('Error updating expense:', error);
            return { data: null, error: { message: 'Unable to update expense. Please try again.' } };
        }

        return { data, error: null };
    } catch (err) {
        console.error('Update expense error:', err);
        return { data: null, error: { message: 'An unexpected error occurred while updating the expense.' } };
    }
}

/**
 * Delete an expense
 * 
 * @param {string} id - The expense ID (UUID)
 * @returns {Promise<{error: Object|null}>}
 * 
 * Requirements: 3.3
 */
async function deleteExpense(id) {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return { error: { message: 'User not authenticated' } };
        }

        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);  // Ensure user owns this expense

        if (error) {
            console.error('Error deleting expense:', error);
            return { error: { message: 'Unable to delete expense. Please try again.' } };
        }

        return { error: null };
    } catch (err) {
        console.error('Delete expense error:', err);
        return { error: { message: 'An unexpected error occurred while deleting the expense.' } };
    }
}


/**
 * Get expenses grouped by category with totals
 * 
 * @returns {Promise<{data: Array|null, error: Object|null}>}
 * Returns array of objects with category, total, and count
 */
async function getExpensesByCategory() {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return { data: null, error: { message: 'User not authenticated' } };
        }

        // Get all expenses for the user
        const { data: expenses, error } = await supabase
            .from('expenses')
            .select('category, amount')
            .eq('user_id', user.id);

        if (error) {
            console.error('Error fetching expenses by category:', error);
            return { data: null, error: { message: 'Unable to load expense categories.' } };
        }

        // Group by category and calculate totals
        const categoryMap = new Map();

        for (const expense of expenses || []) {
            const existing = categoryMap.get(expense.category);
            if (existing) {
                existing.total += parseFloat(expense.amount);
                existing.count += 1;
            } else {
                categoryMap.set(expense.category, {
                    category: expense.category,
                    total: parseFloat(expense.amount),
                    count: 1
                });
            }
        }

        // Convert to array and sort by total descending
        const result = Array.from(categoryMap.values())
            .sort((a, b) => b.total - a.total);

        return { data: result, error: null };
    } catch (err) {
        console.error('Get expenses by category error:', err);
        return { data: null, error: { message: 'An unexpected error occurred while loading categories.' } };
    }
}

// Export all expense functions
export {
    createExpense,
    getExpenses,
    getExpensesByMonth,
    updateExpense,
    deleteExpense,
    getExpensesByCategory
};
