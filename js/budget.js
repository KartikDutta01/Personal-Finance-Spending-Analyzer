/**
 * Budget Module
 * 
 * Manages user budget configuration using Supabase.
 * All operations are scoped to the authenticated user via Row Level Security.
 * 
 * @module budget
 * 
 * Requirements covered:
 * - 4.1: Save budget settings with monthly income and savings goal
 * - 4.2: Update existing budget settings
 * - 4.3: View current budget settings
 */

import { supabase } from './supabaseConfig.js';

/**
 * Get current budget settings for the authenticated user
 * 
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 * Returns the budget object with monthly_income and savings_goal, or null if not set
 * 
 * Requirements: 4.3
 */
async function getBudget() {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return { data: null, error: { message: 'User not authenticated' } };
        }

        const { data, error } = await supabase
            .from('budgets')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error) {
            // PGRST116 means no rows returned - this is expected if user hasn't set budget yet
            if (error.code === 'PGRST116') {
                return { data: null, error: null };
            }
            console.error('Error fetching budget:', error);
            return { data: null, error: { message: 'Unable to load budget settings.' } };
        }

        return { data, error: null };
    } catch (err) {
        console.error('Get budget error:', err);
        return { data: null, error: { message: 'An unexpected error occurred while loading budget.' } };
    }
}

/**
 * Create or update budget settings for the authenticated user
 * Uses upsert to handle both create and update in a single operation
 * 
 * @param {number} monthlyIncome - The user's monthly income (must be >= 0)
 * @param {number} savingsGoal - The user's savings goal (must be >= 0)
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 * 
 * Requirements: 4.1, 4.2
 */
async function saveBudget(monthlyIncome, savingsGoal) {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return { data: null, error: { message: 'User not authenticated' } };
        }

        // Use upsert with user_id as the conflict target (unique constraint)
        const { data, error } = await supabase
            .from('budgets')
            .upsert({
                user_id: user.id,
                monthly_income: monthlyIncome,
                savings_goal: savingsGoal
            }, {
                onConflict: 'user_id'
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving budget:', error);
            return { data: null, error: { message: 'Unable to save budget settings. Please try again.' } };
        }

        return { data, error: null };
    } catch (err) {
        console.error('Save budget error:', err);
        return { data: null, error: { message: 'An unexpected error occurred while saving budget.' } };
    }
}

/**
 * Calculate the available spending budget
 * Available budget = monthly_income - savings_goal
 * 
 * @returns {Promise<number>} The available spending amount, or 0 if budget not set
 * 
 * Requirements: 4.3 (derived from budget settings)
 */
async function getAvailableBudget() {
    try {
        const { data: budget, error } = await getBudget();

        if (error || !budget) {
            return 0;
        }

        const available = parseFloat(budget.monthly_income) - parseFloat(budget.savings_goal);
        return Math.max(0, available); // Ensure non-negative
    } catch (err) {
        console.error('Get available budget error:', err);
        return 0;
    }
}

// Export all budget functions
export {
    getBudget,
    saveBudget,
    getAvailableBudget
};
