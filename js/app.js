/**
 * Personal Finance Analyzer - Main Application Entry Point
 * 
 * This module initializes the application and coordinates all modules.
 * It serves as the entry point for the application.
 */

// Import Supabase client
import { supabase } from './supabaseConfig.js';

// Import validation module
import {
    validateEmail,
    validatePassword,
    validatePhone,
    validateExpense,
    validateBudget
} from './validation.js';

// Import auth module
import {
    register,
    login,
    logout,
    getSession,
    getCurrentUser,
    onAuthStateChange
} from './auth.js';

// Import UI module
import {
    showSuccess,
    showError,
    showLoading,
    hideLoading,
    renderDashboard,
    initEventListeners
} from './ui.js';

// Import transaction import module
import { initImportDialog } from './transactionImport.js';

/**
 * Verify core infrastructure components
 * Logs verification results to console
 */
async function verifyInfrastructure() {
    console.log('=== Core Infrastructure Verification ===\n');

    // 1. Verify Supabase Connection
    console.log('1. Supabase Connection:');
    try {
        const { error } = await supabase.auth.getSession();
        if (error) {
            console.error('   ❌ Supabase connection error:', error.message);
        } else {
            console.log('   ✅ Supabase connected successfully');
        }
    } catch (err) {
        console.error('   ❌ Failed to connect to Supabase:', err);
    }

    // 2. Verify Validation Functions
    console.log('\n2. Validation Functions:');

    // Email validation
    const emailTests = [
        { input: 'test@example.com', expected: true },
        { input: 'invalid-email', expected: false },
        { input: '', expected: false }
    ];
    const emailPassed = emailTests.every(t => validateEmail(t.input) === t.expected);
    console.log(`   ${emailPassed ? '✅' : '❌'} validateEmail()`);

    // Password validation
    const passwordTests = [
        { input: 'password123', expected: true },
        { input: 'short', expected: false },
        { input: '12345678', expected: true }
    ];
    const passwordPassed = passwordTests.every(t => validatePassword(t.input) === t.expected);
    console.log(`   ${passwordPassed ? '✅' : '❌'} validatePassword()`);

    // Phone validation
    const phoneTests = [
        { input: '1234567890', expected: true },
        { input: '+1 (555) 123-4567', expected: true },
        { input: '123', expected: false }
    ];
    const phonePassed = phoneTests.every(t => validatePhone(t.input) === t.expected);
    console.log(`   ${phonePassed ? '✅' : '❌'} validatePhone()`);

    // Expense validation
    const validExpense = { expense_name: 'Lunch', category: 'Food & Dining', amount: 15.50, date: '2024-01-15' };
    const invalidExpense = { expense_name: '', category: '', amount: -10, date: '' };
    const expenseValid = validateExpense(validExpense).valid === true;
    const expenseInvalid = validateExpense(invalidExpense).valid === false;
    console.log(`   ${expenseValid && expenseInvalid ? '✅' : '❌'} validateExpense()`);

    // Budget validation
    const validBudget = { monthly_income: 5000, savings_goal: 1000 };
    const invalidBudget = { monthly_income: -100, savings_goal: -50 };
    const budgetValid = validateBudget(validBudget).valid === true;
    const budgetInvalid = validateBudget(invalidBudget).valid === false;
    console.log(`   ${budgetValid && budgetInvalid ? '✅' : '❌'} validateBudget()`);

    // 3. Verify Auth Module Functions Exist
    console.log('\n3. Authentication Module:');
    console.log(`   ${typeof register === 'function' ? '✅' : '❌'} register() function available`);
    console.log(`   ${typeof login === 'function' ? '✅' : '❌'} login() function available`);
    console.log(`   ${typeof logout === 'function' ? '✅' : '❌'} logout() function available`);
    console.log(`   ${typeof getSession === 'function' ? '✅' : '❌'} getSession() function available`);
    console.log(`   ${typeof getCurrentUser === 'function' ? '✅' : '❌'} getCurrentUser() function available`);
    console.log(`   ${typeof onAuthStateChange === 'function' ? '✅' : '❌'} onAuthStateChange() function available`);

    // Test getSession (should work without authentication)
    try {
        const sessionResult = await getSession();
        console.log(`   ${sessionResult.error === null ? '✅' : '❌'} getSession() executes without error`);
    } catch (err) {
        console.log('   ❌ getSession() threw an error:', err.message);
    }

    console.log('\n=== Verification Complete ===');
}

/**
 * Initialize the application
 * Sets up event listeners and checks authentication state
 */
async function initApp() {
    console.log('Personal Finance Analyzer initialized');

    // Run infrastructure verification
    await verifyInfrastructure();

    // Set up auth state listener
    onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);
        if (session) {
            // User is logged in - show main app
            document.getElementById('auth-view').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');

            // Initialize UI event listeners and load dashboard
            initEventListeners();
            await renderDashboard();
        } else {
            // User is logged out - show auth view
            document.getElementById('auth-view').classList.remove('hidden');
            document.getElementById('main-app').classList.add('hidden');
        }
    });

    // Check for existing session
    const { session } = await getSession();
    if (session) {
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');

        // Initialize UI event listeners and load dashboard
        initEventListeners();
        await renderDashboard();
    }

    // Set up form event listeners
    setupAuthForms();
}

/**
 * Set up authentication form event listeners
 */
function setupAuthForms() {
    // Toggle between login and register forms
    document.getElementById('show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form-container').classList.add('hidden');
        document.getElementById('register-form-container').classList.remove('hidden');
    });

    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form-container').classList.add('hidden');
        document.getElementById('login-form-container').classList.remove('hidden');
    });

    // Login form submission
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        // Validate inputs
        if (!validateEmail(email)) {
            document.getElementById('login-email-error').textContent = 'Please enter a valid email address';
            return;
        }
        document.getElementById('login-email-error').textContent = '';

        if (!validatePassword(password)) {
            document.getElementById('login-password-error').textContent = 'Password must be at least 8 characters';
            return;
        }
        document.getElementById('login-password-error').textContent = '';

        // Attempt login
        showLoading();
        const { error } = await login(email, password);
        hideLoading();

        if (error) {
            document.getElementById('login-password-error').textContent = error.message;
            showError(error.message);
        } else {
            showSuccess('Login successful');
            console.log('Login successful');
        }
    });

    // Register form submission
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const phone = document.getElementById('register-phone').value;

        // Validate inputs
        let hasErrors = false;

        if (!name.trim()) {
            document.getElementById('register-name-error').textContent = 'Please enter your name';
            hasErrors = true;
        } else {
            document.getElementById('register-name-error').textContent = '';
        }

        if (!validateEmail(email)) {
            document.getElementById('register-email-error').textContent = 'Please enter a valid email address';
            hasErrors = true;
        } else {
            document.getElementById('register-email-error').textContent = '';
        }

        if (!validatePassword(password)) {
            document.getElementById('register-password-error').textContent = 'Password must be at least 8 characters';
            hasErrors = true;
        } else {
            document.getElementById('register-password-error').textContent = '';
        }

        if (phone && !validatePhone(phone)) {
            document.getElementById('register-phone-error').textContent = 'Please enter a valid phone number';
            hasErrors = true;
        } else {
            document.getElementById('register-phone-error').textContent = '';
        }

        if (hasErrors) return;

        // Attempt registration
        showLoading();
        const { error } = await register(name, email, password, phone);
        hideLoading();

        if (error) {
            document.getElementById('register-email-error').textContent = error.message;
            showError(error.message);
        } else {
            showSuccess('Registration successful');
            console.log('Registration successful');
        }
    });

    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        showLoading();
        await logout();
        hideLoading();
        showSuccess('Logged out successfully');
        console.log('Logged out');
    });
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
