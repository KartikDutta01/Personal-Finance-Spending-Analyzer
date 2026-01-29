/**
 * Unit Tests: CSV Parser Module
 * 
 * Tests for file validation and CSV parsing functionality.
 * 
 * Requirements covered:
 * - 1.2: Validate .csv extension
 * - 1.5: Enforce 5MB file size limit
 * - 2.1: Parse CSV and extract transaction rows
 * - 2.8: Support different delimiters
 * - 2.9: Trim whitespace from parsed values
 */

import { describe, it, expect } from 'vitest';
import { validateFile, parseCSV, detectDelimiter, parseLine, VALIDATION_ERRORS, MAX_FILE_SIZE } from '../../js/csvParser.js';

describe('CSV Parser - File Validation', () => {
    it('should accept valid CSV file under 5MB', () => {
        const file = { name: 'transactions.csv', size: 1024 };
        const result = validateFile(file);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
        expect(result.fileType).toBe('csv');
    });

    it('should accept PDF file under 5MB', () => {
        const file = { name: 'statement.pdf', size: 1024 };
        const result = validateFile(file);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
        expect(result.fileType).toBe('pdf');
    });

    it('should accept PNG image file under 5MB', () => {
        const file = { name: 'screenshot.png', size: 1024 };
        const result = validateFile(file);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
        expect(result.fileType).toBe('image');
    });

    it('should accept JPG image file under 5MB', () => {
        const file = { name: 'photo.jpg', size: 1024 };
        const result = validateFile(file);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
        expect(result.fileType).toBe('image');
    });

    it('should accept JPEG image file under 5MB', () => {
        const file = { name: 'photo.jpeg', size: 1024 };
        const result = validateFile(file);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
        expect(result.fileType).toBe('image');
    });

    it('should reject unsupported file types', () => {
        const file = { name: 'transactions.txt', size: 1024 };
        const result = validateFile(file);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(VALIDATION_ERRORS.INVALID_EXTENSION);
    });

    it('should reject file over 5MB', () => {
        const file = { name: 'large.csv', size: MAX_FILE_SIZE + 1 };
        const result = validateFile(file);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(VALIDATION_ERRORS.FILE_TOO_LARGE);
    });

    it('should reject empty file', () => {
        const file = { name: 'empty.csv', size: 0 };
        const result = validateFile(file);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(VALIDATION_ERRORS.EMPTY_FILE);
    });

    it('should reject null file', () => {
        const result = validateFile(null);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(VALIDATION_ERRORS.NO_FILE);
    });

    it('should accept file exactly at 5MB limit', () => {
        const file = { name: 'exact.csv', size: MAX_FILE_SIZE };
        const result = validateFile(file);
        expect(result.valid).toBe(true);
    });
});

describe('CSV Parser - Delimiter Detection', () => {
    it('should detect comma delimiter', () => {
        const content = 'date,amount,description\n2024-01-01,100,Test';
        expect(detectDelimiter(content)).toBe(',');
    });

    it('should detect semicolon delimiter', () => {
        const content = 'date;amount;description\n2024-01-01;100;Test';
        expect(detectDelimiter(content)).toBe(';');
    });

    it('should detect tab delimiter', () => {
        const content = 'date\tamount\tdescription\n2024-01-01\t100\tTest';
        expect(detectDelimiter(content)).toBe('\t');
    });
});

describe('CSV Parser - Line Parsing', () => {
    it('should parse simple comma-separated values', () => {
        const result = parseLine('a,b,c', ',');
        expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle quoted fields', () => {
        const result = parseLine('"hello, world",test,value', ',');
        expect(result).toEqual(['hello, world', 'test', 'value']);
    });

    it('should handle escaped quotes', () => {
        const result = parseLine('"say ""hello""",test', ',');
        expect(result).toEqual(['say "hello"', 'test']);
    });

    it('should trim whitespace', () => {
        const result = parseLine('  a  ,  b  ,  c  ', ',');
        expect(result).toEqual(['a', 'b', 'c']);
    });
});

describe('CSV Parser - Full CSV Parsing', () => {
    it('should parse CSV with headers', () => {
        const content = 'date,amount,description\n2024-01-01,100,Test';
        const result = parseCSV(content);
        expect(result.headers).toEqual(['date', 'amount', 'description']);
        expect(result.data).toEqual([['2024-01-01', '100', 'Test']]);
        expect(result.errors).toHaveLength(0);
    });

    it('should parse CSV without headers', () => {
        const content = '2024-01-01,100,Test\n2024-01-02,200,Test2';
        const result = parseCSV(content, { hasHeader: false });
        expect(result.headers).toEqual([]);
        expect(result.data).toHaveLength(2);
    });

    it('should handle different line endings', () => {
        const content = 'a,b\r\nc,d\re,f';
        const result = parseCSV(content, { hasHeader: false });
        expect(result.data).toHaveLength(3);
    });

    it('should skip empty lines', () => {
        const content = 'header1,header2\n\nvalue1,value2\n\n';
        const result = parseCSV(content);
        expect(result.data).toHaveLength(1);
    });

    it('should report column count mismatches', () => {
        const content = 'a,b,c\n1,2\n3,4,5';
        const result = parseCSV(content);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].message).toContain('columns');
    });
});

import { detectColumnMapping, extractTransactions, validateTransaction, parseDate, parseAmount, HEADER_MAPPINGS } from '../../js/csvParser.js';

describe('CSV Parser - Column Mapping Detection', () => {
    it('should detect standard column names', () => {
        const headers = ['date', 'amount', 'description'];
        const result = detectColumnMapping(headers);
        expect(result.detected).toBe(true);
        expect(result.date).toBe(0);
        expect(result.amount).toBe(1);
        expect(result.description).toBe(2);
        expect(result.missingColumns).toHaveLength(0);
    });

    it('should detect case-insensitive column names', () => {
        const headers = ['DATE', 'AMOUNT', 'DESCRIPTION'];
        const result = detectColumnMapping(headers);
        expect(result.detected).toBe(true);
        expect(result.date).toBe(0);
        expect(result.amount).toBe(1);
        expect(result.description).toBe(2);
    });

    it('should detect alternative column names', () => {
        const headers = ['Transaction Date', 'Debit', 'Narration'];
        const result = detectColumnMapping(headers);
        expect(result.detected).toBe(true);
        expect(result.date).toBe(0);
        expect(result.amount).toBe(1);
        expect(result.description).toBe(2);
    });

    it('should report missing columns', () => {
        const headers = ['date', 'other'];
        const result = detectColumnMapping(headers);
        expect(result.detected).toBe(false);
        expect(result.missingColumns).toContain('amount');
        expect(result.missingColumns).toContain('description');
    });

    it('should handle empty headers', () => {
        const result = detectColumnMapping([]);
        expect(result.detected).toBe(false);
        expect(result.missingColumns).toEqual(['date', 'amount', 'description']);
    });

    it('should handle null headers', () => {
        const result = detectColumnMapping(null);
        expect(result.detected).toBe(false);
        expect(result.missingColumns).toEqual(['date', 'amount', 'description']);
    });
});

describe('CSV Parser - Transaction Extraction', () => {
    it('should extract transactions from parsed data', () => {
        const data = [
            ['2024-01-01', '100.00', 'Test transaction'],
            ['2024-01-02', '200.00', 'Another transaction']
        ];
        const mapping = { date: 0, amount: 1, description: 2 };
        const result = extractTransactions(data, mapping);

        expect(result.transactions).toHaveLength(2);
        expect(result.transactions[0].date).toBe('2024-01-01');
        expect(result.transactions[0].amount).toBe('100.00');
        expect(result.transactions[0].description).toBe('Test transaction');
        expect(result.transactions[0].rowNumber).toBe(2);
    });

    it('should handle different column orders', () => {
        const data = [['Description here', '2024-01-01', '50.00']];
        const mapping = { date: 1, amount: 2, description: 0 };
        const result = extractTransactions(data, mapping);

        expect(result.transactions[0].date).toBe('2024-01-01');
        expect(result.transactions[0].amount).toBe('50.00');
        expect(result.transactions[0].description).toBe('Description here');
    });

    it('should return error for invalid mapping', () => {
        const data = [['2024-01-01', '100', 'Test']];
        const mapping = { date: -1, amount: 1, description: 2 };
        const result = extractTransactions(data, mapping);

        expect(result.transactions).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
    });

    it('should handle empty data', () => {
        const mapping = { date: 0, amount: 1, description: 2 };
        const result = extractTransactions([], mapping);

        expect(result.transactions).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
    });
});

describe('CSV Parser - Transaction Validation', () => {
    it('should validate a correct transaction', () => {
        const transaction = {
            date: '2024-01-15',
            amount: '100.50',
            description: 'Test purchase',
            rowNumber: 2
        };
        const result = validateTransaction(transaction);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.parsedDate).toBeInstanceOf(Date);
        expect(result.parsedAmount).toBe(100.50);
    });

    it('should reject invalid date format', () => {
        const transaction = {
            date: 'not-a-date',
            amount: '100',
            description: 'Test',
            rowNumber: 2
        };
        const result = validateTransaction(transaction);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Invalid date'))).toBe(true);
    });

    it('should reject negative amount', () => {
        const transaction = {
            date: '2024-01-15',
            amount: '-50',
            description: 'Test',
            rowNumber: 2
        };
        const result = validateTransaction(transaction);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('positive'))).toBe(true);
    });

    it('should reject non-numeric amount', () => {
        const transaction = {
            date: '2024-01-15',
            amount: 'abc',
            description: 'Test',
            rowNumber: 2
        };
        const result = validateTransaction(transaction);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Invalid amount'))).toBe(true);
    });

    it('should reject empty description', () => {
        const transaction = {
            date: '2024-01-15',
            amount: '100',
            description: '',
            rowNumber: 2
        };
        const result = validateTransaction(transaction);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Missing description'))).toBe(true);
    });

    it('should support DD/MM/YYYY date format', () => {
        const transaction = {
            date: '15/01/2024',
            amount: '100',
            description: 'Test',
            rowNumber: 2
        };
        const result = validateTransaction(transaction);

        expect(result.valid).toBe(true);
        expect(result.parsedDate.getDate()).toBe(15);
    });

    it('should handle amounts with currency symbols', () => {
        const transaction = {
            date: '2024-01-15',
            amount: '$1,234.56',
            description: 'Test',
            rowNumber: 2
        };
        const result = validateTransaction(transaction);

        expect(result.valid).toBe(true);
        expect(result.parsedAmount).toBe(1234.56);
    });
});

describe('CSV Parser - Date Parsing', () => {
    it('should parse YYYY-MM-DD format', () => {
        const result = parseDate('2024-01-15');
        expect(result.valid).toBe(true);
        expect(result.date.getFullYear()).toBe(2024);
    });

    it('should parse DD/MM/YYYY format', () => {
        const result = parseDate('15/01/2024');
        expect(result.valid).toBe(true);
        expect(result.date.getDate()).toBe(15);
    });

    it('should reject invalid date string', () => {
        const result = parseDate('invalid');
        expect(result.valid).toBe(false);
        expect(result.date).toBeNull();
    });
});

describe('CSV Parser - Amount Parsing', () => {
    it('should parse simple number', () => {
        const result = parseAmount('100.50');
        expect(result.valid).toBe(true);
        expect(result.amount).toBe(100.50);
    });

    it('should parse amount with currency symbol', () => {
        const result = parseAmount('$100');
        expect(result.valid).toBe(true);
        expect(result.amount).toBe(100);
    });

    it('should parse amount with thousand separator', () => {
        const result = parseAmount('1,234.56');
        expect(result.valid).toBe(true);
        expect(result.amount).toBe(1234.56);
    });

    it('should reject zero amount', () => {
        const result = parseAmount('0');
        expect(result.valid).toBe(false);
    });

    it('should reject negative amount', () => {
        const result = parseAmount('-100');
        expect(result.valid).toBe(false);
    });
});
