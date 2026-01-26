/**
 * AI Budget Engine Module
 * 
 * Generates rule-based budget recommendations by analyzing user financial data.
 * Provides category-wise budget limits, savings recommendations, expense reduction tips,
 * and short/long-term saving plans.
 * 
 * @module ai
 * 
 * Requirements covered:
 * - 8.1: Analyze monthly income, total expenses, category spending, trends, and savings goal
 * - 8.2: Generate recommended category-wise budget limits based on spending patterns
 * - 8.3: Calculate and display ideal savings percentage
 * - 8.4: Provide actionable tips to reduce expenses in high-spending categories
 * - 8.5: Generate short-term and long-term saving plans
 * - 8.8: Display message requesting more expense history when insufficient data
 */

import { getBudget, getAvailableBudget } from './budget.js';
import { getCurrentMonthTotal, getCategoryBreakdown, getMonthlyTotals, getTopCategories, getMonthOverMonthChange } from './analytics.js';
import { predictNextMonth, calculateTrend } from './forecast.js';

/**
 * Predefined expense categories with recommended budget percentages
 * Based on common financial planning guidelines (50/30/20 rule adapted)
 */
const CATEGORY_GUIDELINES = {
    'Housing': { maxPercentage: 30, priority: 'high', essential: true },
    'Food & Dining': { maxPercentage: 15, priority: 'high', essential: true },
    'Transportation': { maxPercentage: 15, priority: 'high', essential: true },
    'Utilities': { maxPercentage: 10, priority: 'high', essential: true },
    'Healthcare': { maxPercentage: 10, priority: 'high', essential: true },
    'Entertainment': { maxPercentage: 5, priority: 'low', essential: false },
    'Shopping': { maxPercentage: 5, priority: 'low', essential: false },
    'Education': { maxPercentage: 5, priority: 'medium', essential: false },
    'Personal Care': { maxPercentage: 3, priority: 'medium', essential: false },
    'Travel': { maxPercentage: 5, priority: 'low', essential: false },
    'Subscriptions': { maxPercentage: 3, priority: 'low', essential: false },
    'Other': { maxPercentage: 5, priority: 'medium', essential: false }
};

/**
 * Minimum months of data required for full analysis
 */
const MIN_MONTHS_FOR_ANALYSIS = 1;

/**
 * Analyze user's financial data to gather insights for recommendations
 * 
 * @returns {Promise<Object>} Financial analysis object containing:
 *   - monthlyIncome: User's monthly income
 *   - savingsGoal: User's savings goal
 *   - availableBudget: Income minus savings goal
 *   - currentMonthTotal: Total expenses this month
 *   - categoryBreakdown: Spending by category with percentages
 *   - monthlyTotals: Historical monthly spending
 *   - topCategories: Highest spending categories
 *   - monthOverMonth: Month-over-month change
 *   - forecast: Predicted next month spending
 *   - hasEnoughData: Whether sufficient data exists for analysis
 * 
 * Requirements: 8.1
 */
async function analyzeFinances() {
    try {
        // Gather all financial data in parallel
        const [
            budgetResult,
            availableBudget,
            currentMonthTotal,
            categoryBreakdown,
            monthlyTotals,
            topCategories,
            monthOverMonth,
            forecast
        ] = await Promise.all([
            getBudget(),
            getAvailableBudget(),
            getCurrentMonthTotal(),
            getCategoryBreakdown(),
            getMonthlyTotals(6),
            getTopCategories(5),
            getMonthOverMonthChange(),
            predictNextMonth()
        ]);

        const budget = budgetResult.data;
        const monthlyIncome = budget ? parseFloat(budget.monthly_income) : 0;
        const savingsGoal = budget ? parseFloat(budget.savings_goal) : 0;

        // Determine if we have enough data for meaningful analysis
        const monthsWithData = monthlyTotals.filter(m => m.total > 0).length;
        const hasEnoughData = monthsWithData >= MIN_MONTHS_FOR_ANALYSIS;

        // Calculate total expenses across all time from category breakdown
        const totalExpenses = categoryBreakdown.reduce((sum, cat) => sum + cat.total, 0);

        // Calculate spending trend from monthly totals
        const totalsArray = monthlyTotals.map(m => m.total);
        const trend = calculateTrend(totalsArray);

        return {
            monthlyIncome,
            savingsGoal,
            availableBudget,
            currentMonthTotal,
            categoryBreakdown,
            monthlyTotals,
            topCategories,
            monthOverMonth,
            forecast,
            totalExpenses,
            trend,
            hasEnoughData,
            monthsWithData
        };
    } catch (err) {
        console.error('Analyze finances error:', err);
        return {
            monthlyIncome: 0,
            savingsGoal: 0,
            availableBudget: 0,
            currentMonthTotal: 0,
            categoryBreakdown: [],
            monthlyTotals: [],
            topCategories: [],
            monthOverMonth: { percentage: 0, direction: 'unchanged' },
            forecast: { prediction: 0, confidence: 'low' },
            totalExpenses: 0,
            trend: { slope: 0, direction: 'stable' },
            hasEnoughData: false,
            monthsWithData: 0
        };
    }
}


/**
 * Generate recommended category-wise budget limits based on spending patterns
 * 
 * @param {Object} analysis - Financial analysis from analyzeFinances()
 * @returns {Array<{category: string, currentSpending: number, recommendedLimit: number, priority: string}>}
 * Array of category limits sorted by priority (high first)
 * 
 * Requirements: 8.2
 * 
 * Property 17: AI Budget Plan Validity
 * The sum of all recommended category limits SHALL NOT exceed monthly_income
 */
function generateCategoryLimits(analysis) {
    const { monthlyIncome, savingsGoal, categoryBreakdown, availableBudget } = analysis;

    if (monthlyIncome <= 0 || categoryBreakdown.length === 0) {
        return [];
    }

    const categoryLimits = [];
    let totalRecommended = 0;

    // Process each category the user has spent in
    for (const category of categoryBreakdown) {
        const guideline = CATEGORY_GUIDELINES[category.category] || CATEGORY_GUIDELINES['Other'];

        // Calculate recommended limit based on available budget (income - savings)
        const maxRecommended = (guideline.maxPercentage / 100) * availableBudget;

        // If current spending is within guidelines, recommend current level
        // If over, recommend the guideline maximum
        // If under, recommend current level (don't push to spend more)
        let recommendedLimit;

        if (category.total > maxRecommended) {
            // Over budget - recommend the guideline limit
            recommendedLimit = maxRecommended;
        } else {
            // Under or at budget - recommend current spending level
            // But ensure it's at least a reasonable minimum
            recommendedLimit = Math.max(category.total, maxRecommended * 0.5);
        }

        // Round to 2 decimal places
        recommendedLimit = Math.round(recommendedLimit * 100) / 100;
        totalRecommended += recommendedLimit;

        categoryLimits.push({
            category: category.category,
            currentSpending: category.total,
            recommendedLimit,
            priority: guideline.priority,
            isEssential: guideline.essential,
            percentageOfBudget: availableBudget > 0
                ? Math.round((recommendedLimit / availableBudget) * 100 * 10) / 10
                : 0
        });
    }

    // Ensure total recommendations don't exceed available budget
    // If they do, scale down proportionally
    if (totalRecommended > availableBudget && availableBudget > 0) {
        const scaleFactor = availableBudget / totalRecommended;
        for (const limit of categoryLimits) {
            limit.recommendedLimit = Math.round(limit.recommendedLimit * scaleFactor * 100) / 100;
            limit.percentageOfBudget = Math.round((limit.recommendedLimit / availableBudget) * 100 * 10) / 10;
        }
    }

    // Sort by priority (high > medium > low) then by current spending (descending)
    const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
    categoryLimits.sort((a, b) => {
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return b.currentSpending - a.currentSpending;
    });

    return categoryLimits;
}

/**
 * Calculate the ideal savings percentage based on financial analysis
 * 
 * @param {Object} analysis - Financial analysis from analyzeFinances()
 * @returns {number} Ideal savings percentage (0-100)
 * 
 * Requirements: 8.3
 * 
 * Property 17: AI Budget Plan Validity
 * The idealSavingsPercentage SHALL be between 0 and 100
 */
function calculateIdealSavings(analysis) {
    const { monthlyIncome, currentMonthTotal, savingsGoal, trend } = analysis;

    if (monthlyIncome <= 0) {
        return 0;
    }

    // Base recommendation: 20% savings (standard financial advice)
    let idealPercentage = 20;

    // Calculate current savings rate
    const currentSavingsRate = ((monthlyIncome - currentMonthTotal) / monthlyIncome) * 100;

    // Adjust based on spending trends
    if (trend.direction === 'down') {
        // Spending is decreasing - can potentially save more
        idealPercentage = Math.min(30, idealPercentage + 5);
    } else if (trend.direction === 'up') {
        // Spending is increasing - be more conservative
        idealPercentage = Math.max(10, idealPercentage - 5);
    }

    // If user has a savings goal, factor it in
    if (savingsGoal > 0) {
        const goalPercentage = (savingsGoal / monthlyIncome) * 100;
        // Recommend the higher of the calculated ideal or user's goal
        idealPercentage = Math.max(idealPercentage, goalPercentage);
    }

    // If current spending leaves room for more savings, encourage it
    if (currentSavingsRate > idealPercentage) {
        // User is already saving more than recommended - encourage maintaining
        idealPercentage = Math.min(currentSavingsRate, 50); // Cap at 50%
    }

    // Ensure percentage is within valid range
    idealPercentage = Math.max(0, Math.min(100, idealPercentage));

    return Math.round(idealPercentage * 10) / 10; // Round to 1 decimal place
}


/**
 * Generate actionable tips to reduce expenses in high-spending categories
 * 
 * @param {Object} analysis - Financial analysis from analyzeFinances()
 * @returns {Array<{category: string, message: string, potentialSavings: number, priority: string}>}
 * Array of tips sorted by potential savings (highest first)
 * 
 * Requirements: 8.4
 * 
 * Property 17: AI Budget Plan Validity
 * Each tip SHALL target a category that exists in the user's spending
 */
function generateTips(analysis) {
    const { categoryBreakdown, availableBudget, monthOverMonth, trend } = analysis;

    if (categoryBreakdown.length === 0) {
        return [];
    }

    const tips = [];

    // Tip templates for each category
    const tipTemplates = {
        'Food & Dining': [
            'Consider meal prepping on weekends to reduce dining out expenses',
            'Use grocery store apps for coupons and cashback on food purchases',
            'Try cooking at home more often - even 2 extra meals per week can save significantly'
        ],
        'Transportation': [
            'Consider carpooling or public transit for your commute',
            'Combine errands into single trips to save on fuel',
            'Check if your employer offers transit benefits or parking subsidies'
        ],
        'Entertainment': [
            'Look for free local events and activities in your area',
            'Consider sharing streaming subscriptions with family members',
            'Set a monthly entertainment budget and track it separately'
        ],
        'Shopping': [
            'Implement a 24-hour rule before making non-essential purchases',
            'Unsubscribe from retail email lists to reduce impulse buying',
            'Try a no-spend challenge for one week each month'
        ],
        'Subscriptions': [
            'Audit your subscriptions - cancel any you haven\'t used in 30 days',
            'Look for annual payment options that offer discounts',
            'Share family plans for streaming and software services'
        ],
        'Utilities': [
            'Adjust your thermostat by 2 degrees to save on heating/cooling',
            'Switch to LED bulbs and unplug devices when not in use',
            'Consider a programmable thermostat for automatic savings'
        ],
        'Personal Care': [
            'Look for salon schools that offer discounted services',
            'Buy personal care items in bulk when on sale',
            'Try DIY treatments for some personal care routines'
        ],
        'Travel': [
            'Book travel during off-peak seasons for better rates',
            'Use price comparison tools and set fare alerts',
            'Consider staycations or local day trips as alternatives'
        ],
        'Housing': [
            'Review your insurance policies annually for better rates',
            'Consider refinancing if interest rates have dropped',
            'Negotiate with service providers for better rates'
        ],
        'Healthcare': [
            'Use generic medications when available',
            'Take advantage of preventive care covered by insurance',
            'Compare prices at different pharmacies for prescriptions'
        ],
        'Education': [
            'Look for free online courses and educational resources',
            'Check if your employer offers tuition reimbursement',
            'Buy used textbooks or rent instead of buying new'
        ],
        'Other': [
            'Track this spending category more closely to identify patterns',
            'Consider if these expenses can be categorized more specifically',
            'Set a specific budget limit for miscellaneous expenses'
        ]
    };

    // Generate tips for categories where spending exceeds guidelines
    for (const category of categoryBreakdown) {
        const guideline = CATEGORY_GUIDELINES[category.category] || CATEGORY_GUIDELINES['Other'];
        const maxRecommended = (guideline.maxPercentage / 100) * availableBudget;

        // Only generate tips if spending exceeds recommended limit
        if (category.total > maxRecommended && availableBudget > 0) {
            const potentialSavings = Math.round((category.total - maxRecommended) * 100) / 100;
            const templates = tipTemplates[category.category] || tipTemplates['Other'];

            // Select a tip based on the category
            const tipMessage = templates[Math.floor(Math.random() * templates.length)];

            tips.push({
                category: category.category,
                message: tipMessage,
                potentialSavings,
                priority: potentialSavings > availableBudget * 0.1 ? 'high' :
                    potentialSavings > availableBudget * 0.05 ? 'medium' : 'low'
            });
        }
    }

    // Add a general tip based on spending trend
    if (trend.direction === 'up' && monthOverMonth.percentage > 10) {
        tips.push({
            category: 'General',
            message: `Your spending increased by ${monthOverMonth.percentage}% this month. Consider reviewing recent purchases to identify areas to cut back.`,
            potentialSavings: Math.round(monthOverMonth.currentMonth * 0.1 * 100) / 100,
            priority: 'high'
        });
    }

    // Sort by potential savings (highest first)
    tips.sort((a, b) => b.potentialSavings - a.potentialSavings);

    return tips;
}

/**
 * Generate short-term and long-term saving plans
 * 
 * @param {Object} analysis - Financial analysis from analyzeFinances()
 * @returns {{shortTerm: Object, longTerm: Object}} Saving plans with targets and milestones
 * 
 * Requirements: 8.5
 * 
 * Property 17: AI Budget Plan Validity
 * Short-term and long-term plans SHALL have positive targetAmount and monthlyContribution values
 */
function generateSavingPlans(analysis) {
    const { monthlyIncome, currentMonthTotal, savingsGoal, availableBudget, forecast } = analysis;

    // Calculate potential monthly savings
    const potentialMonthlySavings = Math.max(0, monthlyIncome - currentMonthTotal);
    const recommendedMonthlySavings = monthlyIncome * 0.2; // 20% of income

    // Use the lower of potential or recommended as a realistic target
    const realisticMonthlySavings = Math.min(potentialMonthlySavings, recommendedMonthlySavings);

    // Short-term plan: 3-6 months emergency fund
    const shortTermTarget = monthlyIncome * 3; // 3 months of income
    const shortTermMonthly = Math.max(1, Math.round(realisticMonthlySavings * 0.6 * 100) / 100); // 60% of savings
    const shortTermMonths = shortTermMonthly > 0 ? Math.ceil(shortTermTarget / shortTermMonthly) : 36;

    const shortTerm = {
        type: 'short-term',
        name: 'Emergency Fund',
        targetAmount: Math.round(shortTermTarget * 100) / 100,
        monthlyContribution: shortTermMonthly,
        timeframeMonths: Math.min(shortTermMonths, 36), // Cap at 3 years
        milestones: generateMilestones(shortTermTarget, shortTermMonthly, 'short-term')
    };

    // Long-term plan: Based on user's savings goal or default to 1 year of income
    const longTermTarget = savingsGoal > 0 ? savingsGoal * 12 : monthlyIncome * 12;
    const longTermMonthly = Math.max(1, Math.round(realisticMonthlySavings * 0.4 * 100) / 100); // 40% of savings
    const longTermMonths = longTermMonthly > 0 ? Math.ceil(longTermTarget / longTermMonthly) : 120;

    const longTerm = {
        type: 'long-term',
        name: 'Financial Freedom Fund',
        targetAmount: Math.round(longTermTarget * 100) / 100,
        monthlyContribution: longTermMonthly,
        timeframeMonths: Math.min(longTermMonths, 120), // Cap at 10 years
        milestones: generateMilestones(longTermTarget, longTermMonthly, 'long-term')
    };

    return { shortTerm, longTerm };
}

/**
 * Generate milestone markers for a saving plan
 * 
 * @param {number} target - Target amount
 * @param {number} monthly - Monthly contribution
 * @param {string} type - Plan type ('short-term' or 'long-term')
 * @returns {Array<string>} Array of milestone descriptions
 */
function generateMilestones(target, monthly, type) {
    const milestones = [];

    if (monthly <= 0 || target <= 0) {
        return ['Set up automatic transfers to start saving'];
    }

    const percentages = type === 'short-term' ? [25, 50, 75, 100] : [10, 25, 50, 75, 100];

    for (const pct of percentages) {
        const amount = (target * pct) / 100;
        const months = Math.ceil(amount / monthly);
        const formattedAmount = `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

        if (months <= 1) {
            milestones.push(`${pct}% (${formattedAmount}) - Achievable in your first month!`);
        } else if (months <= 12) {
            milestones.push(`${pct}% (${formattedAmount}) - Target: ${months} months`);
        } else {
            const years = Math.floor(months / 12);
            const remainingMonths = months % 12;
            if (remainingMonths === 0) {
                milestones.push(`${pct}% (${formattedAmount}) - Target: ${years} year${years > 1 ? 's' : ''}`);
            } else {
                milestones.push(`${pct}% (${formattedAmount}) - Target: ${years} year${years > 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`);
            }
        }
    }

    return milestones;
}


/**
 * Get complete AI budget plan with all recommendations
 * This is the main entry point for the AI Budget Engine
 * 
 * @returns {Promise<Object>} Complete budget plan containing:
 *   - categoryLimits: Recommended spending limits per category
 *   - idealSavingsPercentage: Recommended savings rate
 *   - tips: Actionable expense reduction tips
 *   - shortTermPlan: Short-term saving plan
 *   - longTermPlan: Long-term saving plan
 *   - summary: Human-readable summary of recommendations
 *   - hasEnoughData: Whether sufficient data exists for analysis
 *   - message: Message if insufficient data
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.8
 * 
 * Property 17: AI Budget Plan Validity
 * For any financial analysis with valid income and expense data, this function SHALL return a plan where:
 * 1. The sum of all recommended category limits does not exceed monthly_income
 * 2. The idealSavingsPercentage is between 0 and 100
 * 3. Each tip targets a category that exists in the user's spending
 * 4. Short-term and long-term plans have positive targetAmount and monthlyContribution values
 */
async function getBudgetPlan() {
    try {
        // First, analyze the user's finances
        const analysis = await analyzeFinances();

        // Check if we have enough data for meaningful recommendations
        if (!analysis.hasEnoughData) {
            return {
                categoryLimits: [],
                idealSavingsPercentage: 20, // Default recommendation
                tips: [],
                shortTermPlan: null,
                longTermPlan: null,
                summary: '',
                hasEnoughData: false,
                message: `We need at least ${MIN_MONTHS_FOR_ANALYSIS} months of expense data to provide personalized recommendations. You currently have ${analysis.monthsWithData} month(s) of data. Keep tracking your expenses and check back soon!`
            };
        }

        // Check if budget is configured
        if (analysis.monthlyIncome <= 0) {
            return {
                categoryLimits: [],
                idealSavingsPercentage: 20,
                tips: [],
                shortTermPlan: null,
                longTermPlan: null,
                summary: '',
                hasEnoughData: true,
                message: 'Please set up your budget with your monthly income to receive personalized recommendations.'
            };
        }

        // Generate all recommendations
        const categoryLimits = generateCategoryLimits(analysis);
        const idealSavingsPercentage = calculateIdealSavings(analysis);
        const tips = generateTips(analysis);
        const { shortTerm, longTerm } = generateSavingPlans(analysis);

        // Generate summary
        const summary = generateSummary(analysis, categoryLimits, idealSavingsPercentage, tips);

        return {
            categoryLimits,
            idealSavingsPercentage,
            tips,
            shortTermPlan: shortTerm,
            longTermPlan: longTerm,
            summary,
            hasEnoughData: true,
            message: null,
            // Include analysis data for UI display
            analysis: {
                monthlyIncome: analysis.monthlyIncome,
                currentMonthTotal: analysis.currentMonthTotal,
                availableBudget: analysis.availableBudget,
                savingsGoal: analysis.savingsGoal,
                trend: analysis.trend,
                forecast: analysis.forecast
            }
        };
    } catch (err) {
        console.error('Get budget plan error:', err);
        return {
            categoryLimits: [],
            idealSavingsPercentage: 0,
            tips: [],
            shortTermPlan: null,
            longTermPlan: null,
            summary: '',
            hasEnoughData: false,
            message: 'An error occurred while generating your budget plan. Please try again.'
        };
    }
}

/**
 * Generate a human-readable summary of the budget recommendations
 * 
 * @param {Object} analysis - Financial analysis
 * @param {Array} categoryLimits - Generated category limits
 * @param {number} idealSavingsPercentage - Recommended savings rate
 * @param {Array} tips - Generated tips
 * @returns {string} Summary text
 */
function generateSummary(analysis, categoryLimits, idealSavingsPercentage, tips) {
    const { monthlyIncome, currentMonthTotal, availableBudget, trend, forecast } = analysis;

    const parts = [];

    // Overall financial health assessment
    const spendingRatio = currentMonthTotal / availableBudget;
    if (spendingRatio <= 0.8) {
        parts.push('Great job! You\'re spending within your budget this month.');
    } else if (spendingRatio <= 1) {
        parts.push('You\'re close to your budget limit this month. Consider reviewing your spending.');
    } else {
        parts.push('You\'ve exceeded your available budget this month. Let\'s work on getting back on track.');
    }

    // Trend insight
    if (trend.direction === 'up') {
        parts.push('Your spending has been trending upward recently.');
    } else if (trend.direction === 'down') {
        parts.push('Good news! Your spending has been trending downward.');
    }

    // Savings recommendation
    const currentSavingsRate = ((monthlyIncome - currentMonthTotal) / monthlyIncome) * 100;
    if (currentSavingsRate < idealSavingsPercentage) {
        parts.push(`We recommend saving ${idealSavingsPercentage}% of your income. You're currently at ${Math.round(currentSavingsRate)}%.`);
    } else {
        parts.push(`Excellent! You're saving ${Math.round(currentSavingsRate)}% of your income, which exceeds our recommendation of ${idealSavingsPercentage}%.`);
    }

    // Top tip highlight
    if (tips.length > 0) {
        const topTip = tips[0];
        parts.push(`Top suggestion: Focus on ${topTip.category} where you could save up to ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(topTip.potentialSavings)}.`);
    }

    // Forecast mention
    if (forecast.confidence !== 'low') {
        parts.push(`Based on your patterns, we predict next month's spending will be around ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(forecast.prediction)}.`);
    }

    return parts.join(' ');
}

// Export all AI module functions
export {
    analyzeFinances,
    generateCategoryLimits,
    calculateIdealSavings,
    generateTips,
    generateSavingPlans,
    getBudgetPlan
};
