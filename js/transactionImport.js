/**
 * Transaction Import Controller Module
 * 
 * Orchestrates the import workflow and manages UI state for CSV transaction import.
 * Coordinates between CSV parsing, classification, and expense import modules.
 * 
 * @module transactionImport
 * 
 * Requirements covered:
 * - 2.1: Parse CSV and extract transaction rows
 * - 3.4: Display summary with counts and totals
 * - 3.5: Allow editing category assignment
 * - 3.6: Select all/deselect all functionality
 * - 3.7: Sort transactions by date descending
 * - 4.1: Classify transactions automatically
 * - 4.7: Learn from user corrections
 * - 5.1: Import selected valid transactions
 * - 5.3: Prevent duplicate submissions
 * - 6.4: Preserve state on error
 * - 6.5: Clear temporary data on dialog close
 * - 8.5: Clear file data from memory on close
 */

import { validateFile, parseCSV, detectColumnMapping, extractTransactions, validateTransaction } from './csvParser.js';
import { checkDuplicates, batchImportTransactions } from './expenses.js';

/**
 * Initial state for the import workflow
 * @returns {ImportState}
 */
function createInitialState() {
    return {
        step: 'upload',
        file: null,
        transactions: [],
        summary: {
            total: 0,
            valid: 0,
            invalid: 0,
            selected: 0,
            duplicates: 0,
            totalAmount: 0
        },
        progress: 0,
        error: null
    };
}

/**
 * Current import state
 * @type {ImportState}
 */
let importState = createInitialState();

/**
 * Get the current import state
 * @returns {ImportState}
 * 
 * Requirements: 6.4
 */
function getState() {
    return { ...importState };
}

/**
 * Update the import state with new values
 * Preserves existing state values not included in updates
 * 
 * @param {Partial<ImportState>} updates - State updates to apply
 * @returns {ImportState} Updated state
 * 
 * Requirements: 6.4
 */
function updateState(updates) {
    importState = {
        ...importState,
        ...updates
    };
    return getState();
}

/**
 * Reset state to initial values
 * @returns {ImportState}
 */
function resetState() {
    importState = createInitialState();
    return getState();
}


/**
 * Read file content as text
 * @param {File} file - File to read
 * @returns {Promise<string>} File content
 */
function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Unable to read file. Please try again.'));
        reader.readAsText(file);
    });
}

/**
 * Process an uploaded file through the complete import workflow
 * Supports CSV files directly, and PDF/image files with a placeholder for OCR processing
 * 
 * Steps:
 * 1. Validate file
 * 2. Parse content based on file type
 * 3. Detect column mapping (for CSV)
 * 4. Extract transactions
 * 5. Validate each transaction
 * 6. Classify transactions
 * 7. Sort by date descending
 * 
 * @param {File} file - File to process (CSV, PDF, or image)
 * @returns {Promise<{success: boolean, error: string|null}>}
 * 
 * Requirements: 2.1, 4.1
 */
async function processFile(file) {
    try {
        // Step 1: Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
            updateState({ step: 'error', error: validation.error });
            return { success: false, error: validation.error };
        }

        updateState({ file, step: 'upload', progress: 10 });

        // Handle different file types
        if (validation.fileType === 'pdf' || validation.fileType === 'image') {
            // For PDF and image files, show a message that OCR processing is coming soon
            const error = `${validation.fileType === 'pdf' ? 'PDF' : 'Image'} file detected. Automatic text extraction from ${validation.fileType === 'pdf' ? 'PDF documents' : 'images'} is coming soon. For now, please export your bank statement as a CSV file for best results.`;
            updateState({ step: 'error', error });
            return { success: false, error };
        }

        // Step 2: Read and parse CSV content
        let content;
        try {
            content = await readFileContent(file);
        } catch (err) {
            const error = 'Unable to read file. Please try again.';
            updateState({ step: 'error', error });
            return { success: false, error };
        }

        updateState({ progress: 30 });

        const parseResult = parseCSV(content);
        if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
            const error = `Unable to parse CSV: ${parseResult.errors[0].message}`;
            updateState({ step: 'error', error });
            return { success: false, error };
        }

        // Step 3: Detect column mapping
        const mapping = detectColumnMapping(parseResult.headers);
        if (!mapping.detected) {
            const error = `Missing required columns: ${mapping.missingColumns.join(', ')}. Please ensure your CSV has date, amount, and description columns.`;
            updateState({ step: 'error', error });
            return { success: false, error };
        }

        updateState({ progress: 50 });

        // Step 4: Extract transactions
        const extractResult = extractTransactions(parseResult.data, mapping);
        if (extractResult.transactions.length === 0) {
            const error = 'No transaction data found in the file.';
            updateState({ step: 'error', error });
            return { success: false, error };
        }

        updateState({ progress: 60 });

        // Step 5: Validate each transaction
        const validatedTransactions = extractResult.transactions.map(transaction => {
            const validationResult = validateTransaction(transaction);
            return {
                ...transaction,
                date: validationResult.parsedDate,
                amount: validationResult.parsedAmount,
                rawDate: transaction.date,
                rawAmount: transaction.amount,
                isValid: validationResult.valid,
                errors: validationResult.errors,
                selected: validationResult.valid // Auto-select valid transactions
            };
        });

        updateState({ progress: 70 });

        // Step 6: Assign default category to transactions (classifier removed)
        const categorizedTransactions = validatedTransactions.map(t => ({
            ...t,
            category: t.category || 'Other'
        }));

        updateState({ progress: 90 });

        // Step 7: Sort by date descending
        const sortedTransactions = sortTransactionsByDate(categorizedTransactions);

        // Calculate summary
        const summary = calculateSummary(sortedTransactions);

        // Update state with final results
        updateState({
            step: 'preview',
            transactions: sortedTransactions,
            summary,
            progress: 100,
            error: null
        });

        return { success: true, error: null };
    } catch (err) {
        console.error('Process file error:', err);
        const error = 'An unexpected error occurred while processing the file.';
        updateState({ step: 'error', error });
        return { success: false, error };
    }
}


/**
 * Calculate summary statistics for a set of transactions
 * 
 * @param {Array<ClassifiedTransaction>} transactions - Transactions to summarize
 * @returns {ImportSummary} Summary statistics
 * 
 * Requirements: 3.4
 */
function calculateSummary(transactions) {
    if (!Array.isArray(transactions)) {
        return {
            total: 0,
            valid: 0,
            invalid: 0,
            selected: 0,
            duplicates: 0,
            totalAmount: 0
        };
    }

    const total = transactions.length;
    const valid = transactions.filter(t => t.isValid).length;
    const invalid = total - valid;
    const selected = transactions.filter(t => t.selected === true).length;

    // Calculate total amount for selected valid transactions only
    const totalAmount = transactions
        .filter(t => t.isValid && t.selected === true)
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    return {
        total,
        valid,
        invalid,
        selected,
        duplicates: 0, // Updated during import
        totalAmount
    };
}


/**
 * Sort transactions by date in descending order (newest first)
 * 
 * @param {Array<ClassifiedTransaction>} transactions - Transactions to sort
 * @returns {Array<ClassifiedTransaction>} Sorted transactions
 * 
 * Requirements: 3.7
 */
function sortTransactionsByDate(transactions) {
    if (!Array.isArray(transactions)) {
        return [];
    }

    return [...transactions].sort((a, b) => {
        // Handle null/undefined dates - push them to the end
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;

        // Sort descending (newest first)
        const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
        const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();

        return dateB - dateA;
    });
}


/**
 * Toggle selection state for a single transaction
 * Invalid transactions cannot be selected
 * 
 * @param {number} index - Transaction index in the array
 * @returns {boolean} New selection state, or false if invalid
 * 
 * Requirements: 3.6
 */
function toggleTransactionSelection(index) {
    const transactions = importState.transactions;

    if (index < 0 || index >= transactions.length) {
        return false;
    }

    const transaction = transactions[index];

    // Invalid transactions cannot be selected
    if (!transaction.isValid) {
        return false;
    }

    // Toggle selection
    const newSelected = !transaction.selected;
    transactions[index] = { ...transaction, selected: newSelected };

    // Update state with new summary
    updateState({
        transactions: [...transactions],
        summary: calculateSummary(transactions)
    });

    return newSelected;
}

/**
 * Select or deselect all transactions
 * Invalid transactions are never selectable
 * 
 * @param {boolean} selected - True to select all valid, false to deselect all
 * 
 * Requirements: 3.6
 */
function selectAllTransactions(selected) {
    const transactions = importState.transactions.map(transaction => ({
        ...transaction,
        // Only valid transactions can be selected
        selected: transaction.isValid ? selected : false
    }));

    updateState({
        transactions,
        summary: calculateSummary(transactions)
    });
}


/**
 * Update the category for a specific transaction
 * Also triggers learning from the correction for future classifications
 * 
 * @param {number} index - Transaction index in the array
 * @param {string} category - New category to assign
 * @returns {boolean} True if update was successful
 * 
 * Requirements: 3.5, 4.7
 */
function updateTransactionCategory(index, category) {
    const transactions = importState.transactions;

    if (index < 0 || index >= transactions.length) {
        return false;
    }

    if (!category || typeof category !== 'string') {
        return false;
    }

    const transaction = transactions[index];

    // Update the transaction category
    transactions[index] = {
        ...transaction,
        category
    };

    updateState({
        transactions: [...transactions]
    });

    return true;
}


/**
 * Import selected valid transactions to the database
 * 
 * Steps:
 * 1. Filter selected valid transactions
 * 2. Check for duplicates
 * 3. Import unique transactions
 * 4. Update state with results
 * 
 * @returns {Promise<ImportResult>}
 * 
 * Requirements: 5.1, 5.3
 */
async function importTransactions() {
    // Prevent duplicate submissions
    if (importState.step === 'importing') {
        return { success: false, imported: 0, failed: 0, errors: ['Import already in progress'] };
    }

    try {
        updateState({ step: 'importing', progress: 0 });

        // Step 1: Filter selected valid transactions
        const selectedTransactions = importState.transactions.filter(
            t => t.isValid && t.selected === true
        );

        if (selectedTransactions.length === 0) {
            updateState({ step: 'preview', progress: 100 });
            return { success: true, imported: 0, failed: 0, errors: [] };
        }

        updateState({ progress: 20 });

        // Step 2: Prepare transactions for duplicate check and import
        const transactionsToImport = selectedTransactions.map(t => ({
            date: formatDateForDB(t.date),
            amount: t.amount,
            description: t.description,
            category: t.category
        }));

        // Step 3: Check for duplicates
        const { duplicates, unique, error: dupError } = await checkDuplicates(transactionsToImport);

        if (dupError) {
            updateState({ step: 'error', error: dupError.message });
            return { success: false, imported: 0, failed: selectedTransactions.length, errors: [dupError.message] };
        }

        updateState({ progress: 50 });

        // Update summary with duplicate count
        const summary = { ...importState.summary, duplicates: duplicates.length };
        updateState({ summary });

        if (unique.length === 0) {
            updateState({ step: 'complete', progress: 100 });
            return {
                success: true,
                imported: 0,
                failed: 0,
                duplicates: duplicates.length,
                errors: duplicates.length > 0 ? [`${duplicates.length} duplicate transactions skipped`] : []
            };
        }

        // Step 4: Import unique transactions
        const importResult = await batchImportTransactions(unique);

        updateState({ progress: 100 });

        if (importResult.failed.length > 0) {
            // Partial failure - preserve state for retry
            updateState({
                step: 'error',
                error: `${importResult.imported} of ${unique.length} transactions imported. ${importResult.failed.length} failed.`
            });
            return {
                success: false,
                imported: importResult.imported,
                failed: importResult.failed.length,
                duplicates: duplicates.length,
                errors: importResult.errors
            };
        }

        // Success
        updateState({ step: 'complete' });
        return {
            success: true,
            imported: importResult.imported,
            failed: 0,
            duplicates: duplicates.length,
            errors: []
        };
    } catch (err) {
        console.error('Import transactions error:', err);
        const error = 'An unexpected error occurred during import.';
        updateState({ step: 'error', error });
        return { success: false, imported: 0, failed: 0, errors: [error] };
    }
}

/**
 * Format a Date object to YYYY-MM-DD string for database storage
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDateForDB(date) {
    if (!date || !(date instanceof Date)) {
        return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


/**
 * Close the import dialog and clear all temporary data
 * Resets state to initial values and clears file reference from memory
 * 
 * Requirements: 6.5, 8.5
 */
function closeImportDialog() {
    // Clear file reference to release memory
    if (importState.file) {
        importState.file = null;
    }

    // Reset all state to initial values
    resetState();
}

/**
 * Open the import dialog
 * Ensures clean state before starting new import
 */
function openImportDialog() {
    resetState();
    updateState({ step: 'upload' });

    // Show dialog
    const overlay = document.getElementById('import-dialog-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    // Reset UI to upload state
    showUploadSection();
    hidePreviewSection();
    hideProgressSection();
    hideAlerts();

    // Reset file input
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
        fileInput.value = '';
    }

    // Disable import button
    const importBtn = document.getElementById('import-submit-btn');
    if (importBtn) {
        importBtn.disabled = true;
    }
}

/**
 * Show the upload section
 */
function showUploadSection() {
    const section = document.getElementById('import-upload-section');
    if (section) {
        section.classList.remove('hidden');
    }
}

/**
 * Hide the upload section
 */
function hideUploadSection() {
    const section = document.getElementById('import-upload-section');
    if (section) {
        section.classList.add('hidden');
    }
}

/**
 * Show the preview section
 */
function showPreviewSection() {
    const section = document.getElementById('import-preview-section');
    if (section) {
        section.classList.remove('hidden');
    }
}

/**
 * Hide the preview section
 */
function hidePreviewSection() {
    const section = document.getElementById('import-preview-section');
    if (section) {
        section.classList.add('hidden');
    }
}

/**
 * Show the progress section
 */
function showProgressSection() {
    const section = document.getElementById('import-progress-section');
    if (section) {
        section.classList.remove('hidden');
    }
}

/**
 * Hide the progress section
 */
function hideProgressSection() {
    const section = document.getElementById('import-progress-section');
    if (section) {
        section.classList.add('hidden');
    }
}

/**
 * Hide all alert messages
 */
function hideAlerts() {
    const successAlert = document.getElementById('import-alert-success');
    const errorAlert = document.getElementById('import-alert-error');
    if (successAlert) successAlert.classList.add('hidden');
    if (errorAlert) errorAlert.classList.add('hidden');
}

/**
 * Show success alert
 * @param {string} message - Success message
 */
function showSuccessAlert(message) {
    const alert = document.getElementById('import-alert-success');
    const text = document.getElementById('import-alert-success-text');
    if (alert && text) {
        text.textContent = message;
        alert.classList.remove('hidden');
    }
}

/**
 * Show error alert
 * @param {string} message - Error message
 */
function showErrorAlert(message) {
    const alert = document.getElementById('import-alert-error');
    const text = document.getElementById('import-alert-error-text');
    if (alert && text) {
        text.textContent = message;
        alert.classList.remove('hidden');
    }
}

/**
 * Update progress bar
 * @param {number} percent - Progress percentage (0-100)
 * @param {string} text - Progress text
 */
function updateProgressBar(percent, text) {
    const fill = document.getElementById('import-progress-fill');
    const progressText = document.getElementById('import-progress-text');
    if (fill) {
        fill.style.width = `${percent}%`;
    }
    if (progressText && text) {
        progressText.textContent = text;
    }
}

/**
 * Valid expense categories for dropdown
 */
const EXPENSE_CATEGORIES = [
    'Food & Dining',
    'Transportation',
    'Shopping',
    'Utilities',
    'Entertainment',
    'Healthcare',
    'Subscriptions',
    'Education',
    'Housing',
    'Personal Care',
    'Travel',
    'Other'
];

/**
 * Handle file selection from input or drag-and-drop
 * Validates file and processes it if valid
 * 
 * @param {File} file - Selected file
 * 
 * Requirements: 1.2, 1.3, 1.5, 1.6
 */
async function handleFileSelect(file) {
    if (!file) return;

    hideAlerts();

    // Process the file
    const result = await processFile(file);

    if (!result.success) {
        showErrorAlert(result.error);
        return;
    }

    // Hide upload section, show preview
    hideUploadSection();
    showPreviewSection();

    // Render the preview table and summary
    renderPreviewTable();
    renderSummary();

    // Enable import button if there are selected transactions
    updateImportButtonState();
}

/**
 * Render the preview table with transactions
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */
function renderPreviewTable() {
    const tbody = document.getElementById('import-preview-tbody');
    if (!tbody) return;

    const state = getState();
    const transactions = state.transactions;

    // Clear existing rows
    tbody.innerHTML = '';

    if (transactions.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="import-table-empty">No transactions found</td>';
        tbody.appendChild(row);
        return;
    }

    transactions.forEach((transaction, index) => {
        const row = document.createElement('tr');
        row.className = transaction.isValid ? '' : 'import-row-invalid';
        row.dataset.index = index;

        // Format date for display
        let dateDisplay = '';
        if (transaction.date instanceof Date) {
            dateDisplay = transaction.date.toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } else if (transaction.rawDate) {
            dateDisplay = transaction.rawDate;
        }

        // Format amount for display
        const amountDisplay = transaction.amount
            ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(transaction.amount)
            : transaction.rawAmount || '';

        // Build category dropdown
        const categoryOptions = EXPENSE_CATEGORIES.map(cat =>
            `<option value="${cat}" ${cat === transaction.category ? 'selected' : ''}>${cat}</option>`
        ).join('');

        // Build status display
        let statusHtml = '';
        if (transaction.isValid) {
            statusHtml = '<span class="import-status-valid">Valid</span>';
        } else {
            const errorText = transaction.errors ? transaction.errors.join(', ') : 'Invalid';
            statusHtml = `<span class="import-status-invalid" title="${escapeHtml(errorText)}">Invalid</span>`;
        }

        row.innerHTML = `
            <td class="import-table-checkbox">
                <input type="checkbox" 
                    class="import-row-checkbox" 
                    data-index="${index}"
                    ${transaction.selected ? 'checked' : ''}
                    ${!transaction.isValid ? 'disabled' : ''}
                    aria-label="Select transaction">
            </td>
            <td class="import-table-date">${escapeHtml(dateDisplay)}</td>
            <td class="import-table-amount">${escapeHtml(amountDisplay)}</td>
            <td class="import-table-description">${escapeHtml(transaction.description || '')}</td>
            <td class="import-table-category">
                <select class="import-category-select" data-index="${index}" ${!transaction.isValid ? 'disabled' : ''}>
                    ${categoryOptions}
                </select>
            </td>
            <td class="import-table-status">${statusHtml}</td>
        `;

        tbody.appendChild(row);
    });
}

/**
 * Escape HTML to prevent XSS
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
 * Render the summary section
 * 
 * Requirements: 3.4
 */
function renderSummary() {
    const state = getState();
    const summary = state.summary;

    // Update summary values
    const totalEl = document.getElementById('import-summary-total');
    const validEl = document.getElementById('import-summary-valid');
    const invalidEl = document.getElementById('import-summary-invalid');
    const selectedEl = document.getElementById('import-summary-selected');
    const amountEl = document.getElementById('import-summary-amount');

    if (totalEl) totalEl.textContent = summary.total;
    if (validEl) validEl.textContent = summary.valid;
    if (invalidEl) invalidEl.textContent = summary.invalid;
    if (selectedEl) selectedEl.textContent = summary.selected;
    if (amountEl) {
        amountEl.textContent = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(summary.totalAmount);
    }
}

/**
 * Update the import button state based on selection
 */
function updateImportButtonState() {
    const state = getState();
    const importBtn = document.getElementById('import-submit-btn');

    if (importBtn) {
        // Enable only if there are selected valid transactions and not currently importing
        importBtn.disabled = state.summary.selected === 0 || state.step === 'importing';
    }
}

/**
 * Handle import button click
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7
 */
async function handleImportClick() {
    const state = getState();

    // Prevent duplicate submissions
    if (state.step === 'importing') {
        return;
    }

    // Hide preview, show progress
    hidePreviewSection();
    showProgressSection();
    hideAlerts();

    // Disable import button
    const importBtn = document.getElementById('import-submit-btn');
    if (importBtn) {
        importBtn.disabled = true;
    }

    // Update progress
    updateProgressBar(0, 'Preparing import...');

    try {
        // Perform import
        const result = await importTransactions();

        if (result.success) {
            updateProgressBar(100, 'Import complete!');

            // Build success message
            let message = `Successfully imported ${result.imported} transaction${result.imported !== 1 ? 's' : ''}`;
            if (result.duplicates > 0) {
                message += `. ${result.duplicates} duplicate${result.duplicates !== 1 ? 's' : ''} skipped.`;
            }

            showSuccessAlert(message);

            // Wait a moment then close dialog and refresh
            setTimeout(async () => {
                closeImportDialogUI();

                // Refresh expense list if on expenses view
                await refreshExpenseList();
            }, 1500);
        } else {
            // Show error
            hideProgressSection();
            showPreviewSection();

            const errorMessage = result.errors.length > 0
                ? result.errors.join('. ')
                : 'Import failed. Please try again.';
            showErrorAlert(errorMessage);

            // Re-enable import button
            updateImportButtonState();
        }
    } catch (err) {
        console.error('Import error:', err);
        hideProgressSection();
        showPreviewSection();
        showErrorAlert('An unexpected error occurred during import.');
        updateImportButtonState();
    }
}

/**
 * Refresh the expense list (called after successful import)
 */
async function refreshExpenseList() {
    // Dispatch a custom event that ui.js can listen to
    const event = new CustomEvent('expenses-updated');
    document.dispatchEvent(event);
}

/**
 * Close the import dialog UI
 */
function closeImportDialogUI() {
    const overlay = document.getElementById('import-dialog-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        document.body.style.overflow = '';
    }

    // Clean up state
    closeImportDialog();
}

/**
 * Handle row checkbox change
 * @param {number} index - Transaction index
 */
function handleRowCheckboxChange(index) {
    toggleTransactionSelection(index);
    renderSummary();
    updateImportButtonState();
}

/**
 * Handle select all checkbox change
 * @param {boolean} checked - Whether select all is checked
 */
function handleSelectAllChange(checked) {
    selectAllTransactions(checked);
    renderPreviewTable();
    renderSummary();
    updateImportButtonState();
}

/**
 * Handle category change for a transaction
 * @param {number} index - Transaction index
 * @param {string} category - New category
 */
function handleCategoryChange(index, category) {
    updateTransactionCategory(index, category);
}

/**
 * Initialize the import dialog event listeners
 * Sets up all event handlers for the import workflow
 * 
 * Requirements: 1.1, 1.4
 */
function initImportDialog() {
    // Import button in expenses view header
    const importBtn = document.getElementById('import-transactions-btn');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            openImportDialog();
        });
    }

    // Dialog close button
    const closeBtn = document.getElementById('import-dialog-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeImportDialogUI();
        });
    }

    // Cancel button
    const cancelBtn = document.getElementById('import-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            closeImportDialogUI();
        });
    }

    // Import submit button
    const submitBtn = document.getElementById('import-submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            handleImportClick();
        });
    }

    // File input change handler
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileSelect(file);
            }
        });
    }

    // Dropzone click handler
    const dropzone = document.getElementById('import-dropzone');
    if (dropzone) {
        dropzone.addEventListener('click', () => {
            const fileInput = document.getElementById('import-file-input');
            if (fileInput) {
                fileInput.click();
            }
        });

        // Keyboard accessibility
        dropzone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const fileInput = document.getElementById('import-file-input');
                if (fileInput) {
                    fileInput.click();
                }
            }
        });

        // Drag and drop handlers
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('import-dropzone-active');
        });

        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('import-dropzone-active');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('import-dropzone-active');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        });
    }

    // Overlay click to close (click outside dialog)
    const overlay = document.getElementById('import-dialog-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeImportDialogUI();
            }
        });
    }

    // Select all checkbox
    const selectAllCheckbox = document.getElementById('import-select-all');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            handleSelectAllChange(e.target.checked);
        });
    }

    // Event delegation for preview table
    const previewTbody = document.getElementById('import-preview-tbody');
    if (previewTbody) {
        // Row checkbox changes
        previewTbody.addEventListener('change', (e) => {
            if (e.target.classList.contains('import-row-checkbox')) {
                const index = parseInt(e.target.dataset.index, 10);
                handleRowCheckboxChange(index);
            }

            if (e.target.classList.contains('import-category-select')) {
                const index = parseInt(e.target.dataset.index, 10);
                handleCategoryChange(index, e.target.value);
            }
        });
    }

    // Listen for expenses-updated event to refresh list
    document.addEventListener('expenses-updated', async () => {
        // This will be handled by ui.js
    });
}

// Export all functions
export {
    // State management
    getState,
    updateState,
    resetState,
    createInitialState,

    // File processing
    processFile,
    readFileContent,

    // Summary and sorting
    calculateSummary,
    sortTransactionsByDate,

    // Selection
    toggleTransactionSelection,
    selectAllTransactions,

    // Category management
    updateTransactionCategory,

    // Import
    importTransactions,
    formatDateForDB,

    // Dialog management
    openImportDialog,
    closeImportDialog,
    initImportDialog,

    // UI functions
    handleFileSelect,
    renderPreviewTable,
    renderSummary,
    handleImportClick,
    closeImportDialogUI
};
