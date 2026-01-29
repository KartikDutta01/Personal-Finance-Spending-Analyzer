/**
 * CSV Parser Module
 * 
 * Handles file validation, CSV parsing, and data extraction for transaction import.
 * Supports multiple delimiters (comma, semicolon, tab) and handles quoted fields.
 * 
 * @module csvParser
 * 
 * Requirements covered:
 * - 1.2: Validate .csv extension
 * - 1.5: Enforce 5MB file size limit
 * - 2.1: Parse CSV and extract transaction rows
 * - 2.8: Support different delimiters
 * - 2.9: Trim whitespace from parsed values
 */

/**
 * Maximum file size in bytes (5MB)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Supported file extensions
 */
const SUPPORTED_EXTENSIONS = ['csv', 'pdf', 'png', 'jpg', 'jpeg'];

/**
 * Validation error messages
 */
const VALIDATION_ERRORS = {
    INVALID_EXTENSION: 'Please select a supported file (CSV, PDF, PNG, or JPG)',
    FILE_TOO_LARGE: 'File size exceeds 5MB limit. Please select a smaller file.',
    EMPTY_FILE: 'The selected file is empty. Please select a valid file.',
    NO_FILE: 'No file selected'
};

/**
 * Validate uploaded file for supported extensions and size limit
 * 
 * @param {File} file - The uploaded file
 * @returns {{valid: boolean, error: string|null, fileType: string|null}}
 * 
 * Requirements: 1.2, 1.5
 */
function validateFile(file) {
    if (!file) {
        return { valid: false, error: VALIDATION_ERRORS.NO_FILE, fileType: null };
    }

    // Check file extension
    const fileName = file.name || '';
    const extension = fileName.toLowerCase().split('.').pop();
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
        return { valid: false, error: VALIDATION_ERRORS.INVALID_EXTENSION, fileType: null };
    }

    // Check file size (5MB limit)
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: VALIDATION_ERRORS.FILE_TOO_LARGE, fileType: null };
    }

    // Check for empty file
    if (file.size === 0) {
        return { valid: false, error: VALIDATION_ERRORS.EMPTY_FILE, fileType: null };
    }

    // Determine file type
    let fileType = 'csv';
    if (extension === 'pdf') {
        fileType = 'pdf';
    } else if (['png', 'jpg', 'jpeg'].includes(extension)) {
        fileType = 'image';
    }

    return { valid: true, error: null, fileType };
}


/**
 * Detect the delimiter used in CSV content
 * 
 * @param {string} content - Raw CSV content
 * @returns {string} Detected delimiter (comma, semicolon, or tab)
 */
function detectDelimiter(content) {
    const firstLine = content.split(/\r?\n/)[0] || '';

    // Count occurrences of each potential delimiter
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    // Return the delimiter with the highest count
    if (semicolonCount > commaCount && semicolonCount >= tabCount) {
        return ';';
    }
    if (tabCount > commaCount && tabCount > semicolonCount) {
        return '\t';
    }
    return ',';
}

/**
 * Parse a single CSV line handling quoted fields
 * 
 * @param {string} line - A single line from the CSV
 * @param {string} delimiter - The field delimiter
 * @returns {string[]} Array of field values
 */
function parseLine(line, delimiter) {
    const fields = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (inQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    // Escaped quote
                    currentField += '"';
                    i += 2;
                    continue;
                } else {
                    // End of quoted field
                    inQuotes = false;
                    i++;
                    continue;
                }
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                // Start of quoted field
                inQuotes = true;
            } else if (char === delimiter) {
                // End of field
                fields.push(currentField.trim());
                currentField = '';
            } else {
                currentField += char;
            }
        }
        i++;
    }

    // Add the last field
    fields.push(currentField.trim());

    return fields;
}

/**
 * Parse CSV file content
 * 
 * @param {string} content - Raw CSV content
 * @param {Object} [options] - Parsing options
 * @param {string} [options.delimiter] - Field delimiter (auto-detected if not provided)
 * @param {boolean} [options.hasHeader=true] - Whether first row is header
 * @returns {{data: string[][], headers: string[], errors: Array<{row: number, message: string}>, delimiter: string}}
 * 
 * Requirements: 2.1, 2.8, 2.9
 */
function parseCSV(content, options = {}) {
    const errors = [];

    if (!content || typeof content !== 'string') {
        return { data: [], headers: [], errors: [{ row: 0, message: 'Empty or invalid content' }], delimiter: ',' };
    }

    // Normalize line endings and split into lines
    const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    // Remove empty lines at the end
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
    }

    if (lines.length === 0) {
        return { data: [], headers: [], errors: [{ row: 0, message: 'No data rows found' }], delimiter: ',' };
    }

    // Detect or use provided delimiter
    const delimiter = options.delimiter || detectDelimiter(content);
    const hasHeader = options.hasHeader !== false;

    // Parse header row
    let headers = [];
    let dataStartIndex = 0;

    if (hasHeader && lines.length > 0) {
        headers = parseLine(lines[0], delimiter);
        dataStartIndex = 1;
    }

    // Parse data rows
    const data = [];
    const expectedColumns = headers.length || (lines.length > 0 ? parseLine(lines[0], delimiter).length : 0);

    for (let i = dataStartIndex; i < lines.length; i++) {
        const line = lines[i];

        // Skip empty lines
        if (line.trim() === '') {
            continue;
        }

        const row = parseLine(line, delimiter);

        // Validate column count
        if (row.length !== expectedColumns && expectedColumns > 0) {
            errors.push({
                row: i + 1,
                message: `Row has ${row.length} columns, expected ${expectedColumns}`
            });
        }

        data.push(row);
    }

    return { data, headers, errors, delimiter };
}

/**
 * Predefined header mappings for common column names
 * Maps standard field names to arrays of possible header variations
 */
const HEADER_MAPPINGS = {
    date: ['date', 'transaction date', 'txn date', 'value date', 'posting date', 'trans date'],
    amount: ['amount', 'debit', 'credit', 'withdrawal', 'deposit', 'transaction amount', 'txn amount'],
    description: ['description', 'narration', 'particulars', 'details', 'remarks', 'transaction details', 'memo']
};

/**
 * Detect column mappings from CSV headers
 * Matches headers against predefined column name mappings (case-insensitive)
 * 
 * @param {string[]} headers - CSV headers
 * @returns {{date: number, amount: number, description: number, detected: boolean, missingColumns: string[]}}
 * 
 * Requirements: 2.3, 2.4
 */
function detectColumnMapping(headers) {
    const mapping = {
        date: -1,
        amount: -1,
        description: -1,
        detected: false,
        missingColumns: []
    };

    if (!headers || !Array.isArray(headers) || headers.length === 0) {
        mapping.missingColumns = ['date', 'amount', 'description'];
        return mapping;
    }

    // Normalize headers for case-insensitive matching
    const normalizedHeaders = headers.map(h => (h || '').toLowerCase().trim());

    // Find date column
    for (let i = 0; i < normalizedHeaders.length; i++) {
        const header = normalizedHeaders[i];
        if (HEADER_MAPPINGS.date.some(pattern => header === pattern || header.includes(pattern))) {
            mapping.date = i;
            break;
        }
    }

    // Find amount column
    for (let i = 0; i < normalizedHeaders.length; i++) {
        const header = normalizedHeaders[i];
        if (HEADER_MAPPINGS.amount.some(pattern => header === pattern || header.includes(pattern))) {
            mapping.amount = i;
            break;
        }
    }

    // Find description column
    for (let i = 0; i < normalizedHeaders.length; i++) {
        const header = normalizedHeaders[i];
        if (HEADER_MAPPINGS.description.some(pattern => header === pattern || header.includes(pattern))) {
            mapping.description = i;
            break;
        }
    }

    // Check for missing columns
    if (mapping.date === -1) {
        mapping.missingColumns.push('date');
    }
    if (mapping.amount === -1) {
        mapping.missingColumns.push('amount');
    }
    if (mapping.description === -1) {
        mapping.missingColumns.push('description');
    }

    // Set detected flag if all required columns are found
    mapping.detected = mapping.missingColumns.length === 0;

    return mapping;
}

/**
 * Extract raw transactions from parsed CSV data using column mapping
 * 
 * @param {string[][]} data - Parsed CSV rows (without header)
 * @param {{date: number, amount: number, description: number}} mapping - Column index mapping
 * @returns {{transactions: Array<{date: string, amount: string, description: string, rowNumber: number}>, errors: Array<{row: number, message: string}>}}
 * 
 * Requirements: 2.1
 */
function extractTransactions(data, mapping) {
    const transactions = [];
    const errors = [];

    if (!data || !Array.isArray(data)) {
        return { transactions: [], errors: [{ row: 0, message: 'No data provided' }] };
    }

    if (!mapping || mapping.date === -1 || mapping.amount === -1 || mapping.description === -1) {
        return { transactions: [], errors: [{ row: 0, message: 'Invalid column mapping' }] };
    }

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        // Row number is 1-indexed, and accounts for header row (+2: 1 for 0-index, 1 for header)
        const rowNumber = i + 2;

        if (!row || !Array.isArray(row)) {
            errors.push({ row: rowNumber, message: 'Invalid row data' });
            continue;
        }

        // Extract values from mapped columns
        const dateValue = row[mapping.date] !== undefined ? row[mapping.date] : '';
        const amountValue = row[mapping.amount] !== undefined ? row[mapping.amount] : '';
        const descriptionValue = row[mapping.description] !== undefined ? row[mapping.description] : '';

        transactions.push({
            date: dateValue,
            amount: amountValue,
            description: descriptionValue,
            rowNumber: rowNumber
        });
    }

    return { transactions, errors };
}

/**
 * Supported date formats for parsing
 */
const DATE_FORMATS = [
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, parse: (m) => new Date(m[1], m[2] - 1, m[3]) },           // YYYY-MM-DD
    { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, parse: (m) => new Date(m[3], m[2] - 1, m[1]) },        // DD/MM/YYYY
    { regex: /^(\d{2})-(\d{2})-(\d{4})$/, parse: (m) => new Date(m[3], m[2] - 1, m[1]) },          // DD-MM-YYYY
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, parse: (m) => new Date(m[3], m[1] - 1, m[2]) },    // MM/DD/YYYY (US format)
    { regex: /^(\d{4})\/(\d{2})\/(\d{2})$/, parse: (m) => new Date(m[1], m[2] - 1, m[3]) }         // YYYY/MM/DD
];

/**
 * Parse a date string into a Date object
 * 
 * @param {string} dateStr - Date string to parse
 * @returns {{valid: boolean, date: Date|null}}
 */
function parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
        return { valid: false, date: null };
    }

    const trimmed = dateStr.trim();

    for (const format of DATE_FORMATS) {
        const match = trimmed.match(format.regex);
        if (match) {
            const date = format.parse(match);
            // Check if the date is valid
            if (!isNaN(date.getTime())) {
                return { valid: true, date };
            }
        }
    }

    return { valid: false, date: null };
}

/**
 * Parse an amount string into a number
 * 
 * @param {string} amountStr - Amount string to parse
 * @returns {{valid: boolean, amount: number|null}}
 */
function parseAmount(amountStr) {
    if (amountStr === undefined || amountStr === null || amountStr === '') {
        return { valid: false, amount: null };
    }

    // Convert to string if needed
    const str = String(amountStr).trim();

    // Remove currency symbols and thousand separators
    const cleaned = str.replace(/[$€£₹,\s]/g, '');

    // Parse the number
    const amount = parseFloat(cleaned);

    if (isNaN(amount)) {
        return { valid: false, amount: null };
    }

    // Amount must be positive
    if (amount <= 0) {
        return { valid: false, amount: null };
    }

    return { valid: true, amount };
}

/**
 * Validate a single transaction row
 * 
 * @param {{date: string, amount: string, description: string, rowNumber: number}} transaction - Transaction to validate
 * @returns {{valid: boolean, errors: string[], parsedDate: Date|null, parsedAmount: number|null}}
 * 
 * Requirements: 2.5, 2.6, 2.7
 */
function validateTransaction(transaction) {
    const errors = [];
    let parsedDate = null;
    let parsedAmount = null;

    if (!transaction) {
        return { valid: false, errors: ['Invalid transaction data'], parsedDate: null, parsedAmount: null };
    }

    const rowNum = transaction.rowNumber || '?';

    // Validate date
    if (!transaction.date || transaction.date.trim() === '') {
        errors.push(`Row ${rowNum}: Missing date`);
    } else {
        const dateResult = parseDate(transaction.date);
        if (!dateResult.valid) {
            errors.push(`Row ${rowNum}: Invalid date format '${transaction.date}'`);
        } else {
            parsedDate = dateResult.date;
        }
    }

    // Validate amount
    if (transaction.amount === undefined || transaction.amount === null || String(transaction.amount).trim() === '') {
        errors.push(`Row ${rowNum}: Missing amount`);
    } else {
        const amountResult = parseAmount(transaction.amount);
        if (!amountResult.valid) {
            const amountStr = String(transaction.amount).trim();
            if (parseFloat(amountStr.replace(/[$€£₹,\s]/g, '')) <= 0) {
                errors.push(`Row ${rowNum}: Amount must be positive '${transaction.amount}'`);
            } else {
                errors.push(`Row ${rowNum}: Invalid amount '${transaction.amount}'`);
            }
        } else {
            parsedAmount = amountResult.amount;
        }
    }

    // Validate description
    if (!transaction.description || transaction.description.trim() === '') {
        errors.push(`Row ${rowNum}: Missing description`);
    }

    return {
        valid: errors.length === 0,
        errors,
        parsedDate,
        parsedAmount
    };
}

// Export functions and constants
export {
    validateFile,
    parseCSV,
    detectDelimiter,
    parseLine,
    detectColumnMapping,
    extractTransactions,
    validateTransaction,
    parseDate,
    parseAmount,
    VALIDATION_ERRORS,
    MAX_FILE_SIZE,
    SUPPORTED_EXTENSIONS,
    HEADER_MAPPINGS,
    DATE_FORMATS
};
