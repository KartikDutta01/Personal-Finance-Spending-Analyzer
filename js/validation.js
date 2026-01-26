/**
 * Personal Finance Analyzer - Validation Module
 * 
 * This module provides input validation functions for user registration,
 * expense management, and budget configuration.
 * 
 * Requirements: 1.3, 1.4, 1.5, 3.5, 3.6, 4.4
 */

/**
 * Validates email format
 * @param {string} email - The email address to validate
 * @returns {boolean} True if valid email format, false otherwise
 * 
 * Validates: Requirements 1.3
 */
export function validateEmail(email) {
    if (typeof email !== 'string' || email.trim() === '') {
        return false;
    }

    const trimmedEmail = email.trim();

    // Basic structure check: must have exactly one @
    const atIndex = trimmedEmail.indexOf('@');
    if (atIndex === -1 || atIndex !== trimmedEmail.lastIndexOf('@')) {
        return false;
    }

    const localPart = trimmedEmail.substring(0, atIndex);
    const domainPart = trimmedEmail.substring(atIndex + 1);

    // Local part validation: non-empty, allows common characters
    if (localPart.length === 0 || localPart.length > 64) {
        return false;
    }

    // Domain part validation: must have at least one dot and valid TLD
    if (domainPart.length === 0 || domainPart.length > 255) {
        return false;
    }

    // Check domain has at least one dot (for TLD)
    const lastDotIndex = domainPart.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === 0 || lastDotIndex === domainPart.length - 1) {
        return false;
    }

    // TLD must be at least 2 characters
    const tld = domainPart.substring(lastDotIndex + 1);
    if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
        return false;
    }

    // Local part: allow letters, numbers, dots, hyphens, underscores, plus signs
    // Cannot start or end with a dot, no consecutive dots
    if (/^\.|\.$|\.\./.test(localPart)) {
        return false;
    }
    if (!/^[a-zA-Z0-9._%+-]+$/.test(localPart)) {
        return false;
    }

    // Domain part (excluding TLD): allow letters, numbers, dots, hyphens
    const domainWithoutTld = domainPart.substring(0, lastDotIndex);
    if (/^[-.]|[-.]$|\.\./.test(domainWithoutTld)) {
        return false;
    }
    if (!/^[a-zA-Z0-9.-]+$/.test(domainWithoutTld)) {
        return false;
    }

    return true;
}

/**
 * Validates password meets minimum length requirement
 * @param {string} password - The password to validate
 * @returns {boolean} True if password is 8 or more characters, false otherwise
 * 
 * Validates: Requirements 1.4
 */
export function validatePassword(password) {
    if (typeof password !== 'string') {
        return false;
    }
    return password.length >= 8;
}

/**
 * Validates phone number format
 * @param {string} phone - The phone number to validate
 * @returns {boolean} True if valid phone format, false otherwise
 * 
 * Validates: Requirements 1.5
 */
export function validatePhone(phone) {
    if (typeof phone !== 'string' || phone.trim() === '') {
        return false;
    }

    // Remove common formatting characters for validation
    const cleanedPhone = phone.replace(/[\s\-\(\)\.\+]/g, '');

    // Check if remaining characters are all digits
    if (!/^\d+$/.test(cleanedPhone)) {
        return false;
    }

    // Valid phone numbers should have between 7 and 15 digits
    // (international standard allows up to 15 digits)
    return cleanedPhone.length >= 7 && cleanedPhone.length <= 15;
}

/**
 * Validates expense input object
 * @param {Object} expense - The expense object to validate
 * @param {string} expense.expense_name - Name of the expense
 * @param {string} expense.category - Category of the expense
 * @param {number} expense.amount - Amount of the expense
 * @param {string} expense.date - Date of the expense (YYYY-MM-DD format)
 * @returns {{valid: boolean, errors: string[]}} Validation result with any error messages
 * 
 * Validates: Requirements 3.5, 3.6
 */
export function validateExpense(expense) {
    const errors = [];

    // Check if expense object exists
    if (!expense || typeof expense !== 'object') {
        return { valid: false, errors: ['Expense data is required'] };
    }

    // Validate expense_name (required, non-empty)
    if (!expense.expense_name || typeof expense.expense_name !== 'string' || expense.expense_name.trim() === '') {
        errors.push('Please enter an expense name');
    }

    // Validate category (required, must be selected)
    if (!expense.category || typeof expense.category !== 'string' || expense.category.trim() === '') {
        errors.push('Please select a category');
    }

    // Validate amount (required, must be positive number)
    if (expense.amount === undefined || expense.amount === null) {
        errors.push('Amount is required');
    } else if (typeof expense.amount !== 'number' || isNaN(expense.amount)) {
        errors.push('Amount must be a valid number');
    } else if (expense.amount <= 0) {
        errors.push('Amount must be greater than zero');
    }

    // Validate date (required, valid date format)
    if (!expense.date || typeof expense.date !== 'string' || expense.date.trim() === '') {
        errors.push('Please select a valid date');
    } else {
        // Check if date is valid YYYY-MM-DD format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(expense.date)) {
            errors.push('Please select a valid date');
        } else {
            // Verify it's an actual valid date
            const parsedDate = new Date(expense.date);
            if (isNaN(parsedDate.getTime())) {
                errors.push('Please select a valid date');
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validates budget input
 * @param {Object} budget - The budget object to validate
 * @param {number} budget.monthly_income - Monthly income amount
 * @param {number} budget.savings_goal - Savings goal amount (optional)
 * @returns {{valid: boolean, errors: string[], warnings: string[]}} Validation result with errors and warnings
 * 
 * Validates: Requirements 4.4
 */
export function validateBudget(budget) {
    const errors = [];
    const warnings = [];

    // Check if budget object exists
    if (!budget || typeof budget !== 'object') {
        return { valid: false, errors: ['Budget data is required'], warnings: [] };
    }

    // Validate monthly_income (required, non-negative)
    if (budget.monthly_income === undefined || budget.monthly_income === null) {
        errors.push('Monthly income is required');
    } else if (typeof budget.monthly_income !== 'number' || isNaN(budget.monthly_income)) {
        errors.push('Monthly income must be a valid number');
    } else if (budget.monthly_income < 0) {
        errors.push('Monthly income cannot be negative');
    }

    // Validate savings_goal (optional, but if provided must be non-negative)
    if (budget.savings_goal !== undefined && budget.savings_goal !== null && budget.savings_goal !== '') {
        if (typeof budget.savings_goal !== 'number' || isNaN(budget.savings_goal)) {
            errors.push('Savings goal must be a valid number');
        } else if (budget.savings_goal < 0) {
            errors.push('Savings goal cannot be negative');
        }
    }

    // Check if savings goal exceeds monthly income (warning, not error)
    const savingsGoal = budget.savings_goal || 0;
    if (errors.length === 0 && savingsGoal > 0 && savingsGoal > budget.monthly_income) {
        warnings.push('Savings goal exceeds monthly income');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}
