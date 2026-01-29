/**
 * Category Classifier Module
 * 
 * Handles automatic category assignment for transactions using rule-based
 * pattern matching and AI classification fallback.
 * 
 * @module classifier
 * 
 * Requirements covered:
 * - 4.1: Analyze description to determine appropriate category
 * - 4.2: Use rule-based pattern matching for common merchants
 * - 4.3: Use AI-based classification for unmatched descriptions
 * - 4.4: Assign predefined expense categories
 * - 4.5: Default to "Other" when confidence is low
 * - 4.7: Learn from user corrections for future imports
 */

/**
 * Predefined classification rules with regex patterns for common merchants
 * Rules are checked in priority order (higher priority first)
 * 
 * Requirements: 4.2
 */
const CLASSIFICATION_RULES = [
    // Food & Dining
    {
        id: 'food-delivery',
        pattern: /swiggy|zomato|uber\s*eats|dominos|pizza|mcdonald|kfc|starbucks|cafe|restaurant|food|dining|eatery|bistro|diner|takeout|takeaway/i,
        category: 'Food & Dining',
        priority: 10,
        keywords: ['swiggy', 'zomato', 'uber eats', 'dominos', 'pizza', 'mcdonald', 'kfc', 'starbucks', 'cafe', 'restaurant', 'food']
    },

    // Transportation
    {
        id: 'transportation',
        pattern: /uber|ola|rapido|metro|petrol|fuel|parking|toll|irctc|railway|flight|airline|cab|taxi|lyft|grab|gojek|diesel|gas\s*station/i,
        category: 'Transportation',
        priority: 10,
        keywords: ['uber', 'ola', 'rapido', 'metro', 'petrol', 'fuel', 'parking', 'toll', 'irctc', 'railway', 'flight', 'airline']
    },

    // Shopping
    {
        id: 'shopping',
        pattern: /amazon|flipkart|myntra|ajio|nykaa|mall|store|shop|retail|ebay|walmart|target|costco|ikea|h&m|zara|uniqlo/i,
        category: 'Shopping',
        priority: 10,
        keywords: ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'mall', 'store', 'shop', 'retail']
    },

    // Utilities
    {
        id: 'utilities',
        pattern: /electricity|water|gas|internet|broadband|wifi|mobile|recharge|bill\s*pay|utility|power|sewage|trash|waste/i,
        category: 'Utilities',
        priority: 10,
        keywords: ['electricity', 'water', 'gas', 'internet', 'broadband', 'wifi', 'mobile', 'recharge', 'bill pay']
    },

    // Entertainment
    {
        id: 'entertainment',
        pattern: /netflix|prime|hotstar|spotify|youtube|movie|cinema|pvr|inox|game|gaming|playstation|xbox|nintendo|hulu|disney\+|hbo/i,
        category: 'Entertainment',
        priority: 10,
        keywords: ['netflix', 'prime', 'hotstar', 'spotify', 'youtube', 'movie', 'cinema', 'pvr', 'inox', 'game']
    },

    // Healthcare
    {
        id: 'healthcare',
        pattern: /hospital|clinic|pharmacy|medical|doctor|health|apollo|medplus|1mg|medicine|dental|dentist|optician|lab|diagnostic/i,
        category: 'Healthcare',
        priority: 10,
        keywords: ['hospital', 'clinic', 'pharmacy', 'medical', 'doctor', 'health', 'apollo', 'medplus', '1mg']
    },

    // Subscriptions
    {
        id: 'subscriptions',
        pattern: /subscription|membership|premium|annual|monthly\s*fee|recurring|plan\s*renewal/i,
        category: 'Subscriptions',
        priority: 8,
        keywords: ['subscription', 'membership', 'premium', 'annual', 'monthly fee']
    },

    // Education
    {
        id: 'education',
        pattern: /school|college|university|course|udemy|coursera|book|education|tuition|training|workshop|seminar|certification/i,
        category: 'Education',
        priority: 10,
        keywords: ['school', 'college', 'university', 'course', 'udemy', 'coursera', 'book', 'education', 'tuition']
    },

    // Housing
    {
        id: 'housing',
        pattern: /rent|maintenance|society|housing|apartment|flat|mortgage|property|landlord|lease/i,
        category: 'Housing',
        priority: 10,
        keywords: ['rent', 'maintenance', 'society', 'housing', 'apartment', 'flat']
    },

    // Personal Care
    {
        id: 'personal-care',
        pattern: /salon|spa|gym|fitness|grooming|beauty|haircut|massage|wellness|yoga|pilates/i,
        category: 'Personal Care',
        priority: 10,
        keywords: ['salon', 'spa', 'gym', 'fitness', 'grooming', 'beauty']
    },

    // Travel
    {
        id: 'travel',
        pattern: /hotel|booking|makemytrip|goibibo|airbnb|travel|trip|vacation|resort|hostel|expedia|trivago/i,
        category: 'Travel',
        priority: 10,
        keywords: ['hotel', 'booking', 'makemytrip', 'goibibo', 'airbnb', 'travel', 'trip', 'vacation']
    }
];

/**
 * Valid expense categories that can be assigned
 */
const VALID_CATEGORIES = [
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
 * Confidence threshold below which we default to "Other"
 */
const CONFIDENCE_THRESHOLD = 0.5;

/**
 * LocalStorage key for storing user corrections
 */
const CORRECTIONS_STORAGE_KEY = 'classifier_corrections';


/**
 * Get stored user corrections from localStorage
 * 
 * @returns {Object} Map of description patterns to categories
 */
function getStoredCorrections() {
    try {
        const stored = localStorage.getItem(CORRECTIONS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (err) {
        console.error('Error reading corrections from localStorage:', err);
        return {};
    }
}

/**
 * Save corrections to localStorage
 * 
 * @param {Object} corrections - Map of description patterns to categories
 */
function saveCorrections(corrections) {
    try {
        localStorage.setItem(CORRECTIONS_STORAGE_KEY, JSON.stringify(corrections));
    } catch (err) {
        console.error('Error saving corrections to localStorage:', err);
    }
}

/**
 * Match a description against classification rules
 * 
 * @param {string} description - Transaction description to match
 * @returns {{matched: boolean, category: string|null, rule: string|null}}
 * 
 * Requirements: 4.2
 */
function matchRules(description) {
    if (!description || typeof description !== 'string') {
        return { matched: false, category: null, rule: null };
    }

    const normalizedDesc = description.trim().toLowerCase();

    if (normalizedDesc.length === 0) {
        return { matched: false, category: null, rule: null };
    }

    // Sort rules by priority (higher first)
    const sortedRules = [...CLASSIFICATION_RULES].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
        if (rule.pattern.test(normalizedDesc)) {
            return {
                matched: true,
                category: rule.category,
                rule: rule.id
            };
        }
    }

    return { matched: false, category: null, rule: null };
}

/**
 * Check if a description matches any stored user corrections
 * 
 * @param {string} description - Transaction description
 * @returns {{matched: boolean, category: string|null}}
 */
function matchCorrections(description) {
    if (!description || typeof description !== 'string') {
        return { matched: false, category: null };
    }

    const corrections = getStoredCorrections();
    const normalizedDesc = description.trim().toLowerCase();

    // Check for exact match first
    if (corrections[normalizedDesc]) {
        return { matched: true, category: corrections[normalizedDesc] };
    }

    // Check for partial matches (description contains a corrected pattern)
    for (const [pattern, category] of Object.entries(corrections)) {
        if (normalizedDesc.includes(pattern) || pattern.includes(normalizedDesc)) {
            return { matched: true, category };
        }
    }

    return { matched: false, category: null };
}

/**
 * Simple AI-based classification using keyword analysis
 * This is a fallback when rule-based matching fails
 * 
 * @param {string} description - Transaction description
 * @returns {{category: string, confidence: number}}
 * 
 * Requirements: 4.3
 */
function aiClassify(description) {
    if (!description || typeof description !== 'string') {
        return { category: 'Other', confidence: 0 };
    }

    const normalizedDesc = description.trim().toLowerCase();

    if (normalizedDesc.length === 0) {
        return { category: 'Other', confidence: 0 };
    }

    // Score each category based on keyword matches
    const scores = {};

    for (const rule of CLASSIFICATION_RULES) {
        let score = 0;
        for (const keyword of rule.keywords) {
            if (normalizedDesc.includes(keyword.toLowerCase())) {
                score += 1;
            }
        }
        if (score > 0) {
            scores[rule.category] = (scores[rule.category] || 0) + score;
        }
    }

    // Find the category with the highest score
    let bestCategory = 'Other';
    let bestScore = 0;
    let totalScore = 0;

    for (const [category, score] of Object.entries(scores)) {
        totalScore += score;
        if (score > bestScore) {
            bestScore = score;
            bestCategory = category;
        }
    }

    // Calculate confidence based on score distribution
    const confidence = totalScore > 0 ? bestScore / (totalScore + 1) : 0;

    // If confidence is below threshold, default to "Other"
    if (confidence < CONFIDENCE_THRESHOLD) {
        return { category: 'Other', confidence };
    }

    return { category: bestCategory, confidence };
}


/**
 * Classify a single transaction
 * 
 * Classification priority:
 * 1. User corrections (learned from previous feedback)
 * 2. Rule-based pattern matching
 * 3. AI-based classification
 * 4. Default to "Other" if confidence is low
 * 
 * @param {Object} transaction - Transaction to classify
 * @param {string} transaction.description - Transaction description
 * @returns {{category: string, confidence: number, method: 'correction'|'rule'|'ai'}}
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
function classifyTransaction(transaction) {
    const description = transaction?.description || '';

    // 1. Check user corrections first (highest priority)
    const correctionMatch = matchCorrections(description);
    if (correctionMatch.matched) {
        return {
            category: correctionMatch.category,
            confidence: 1.0,
            method: 'correction'
        };
    }

    // 2. Try rule-based matching
    const ruleMatch = matchRules(description);
    if (ruleMatch.matched) {
        return {
            category: ruleMatch.category,
            confidence: 1.0,
            method: 'rule'
        };
    }

    // 3. Fall back to AI classification
    const aiResult = aiClassify(description);

    // 4. Default to "Other" if confidence is low
    if (aiResult.confidence < CONFIDENCE_THRESHOLD) {
        return {
            category: 'Other',
            confidence: aiResult.confidence,
            method: 'ai'
        };
    }

    return {
        category: aiResult.category,
        confidence: aiResult.confidence,
        method: 'ai'
    };
}

/**
 * Classify multiple transactions in batch
 * 
 * @param {Array<Object>} transactions - Array of transactions to classify
 * @returns {Array<Object>} Array of classified transactions with category, confidence, and method
 * 
 * Requirements: 4.1
 */
function classifyBatch(transactions) {
    if (!Array.isArray(transactions)) {
        return [];
    }

    return transactions.map(transaction => {
        const classification = classifyTransaction(transaction);
        return {
            ...transaction,
            category: classification.category,
            confidence: classification.confidence,
            method: classification.method
        };
    });
}

/**
 * Learn from a user category correction
 * Stores the correction for future classifications
 * 
 * @param {string} description - Transaction description
 * @param {string} category - Correct category assigned by user
 * 
 * Requirements: 4.7
 */
function learnFromCorrection(description, category) {
    if (!description || typeof description !== 'string') {
        return;
    }

    if (!category || !VALID_CATEGORIES.includes(category)) {
        return;
    }

    const normalizedDesc = description.trim().toLowerCase();

    if (normalizedDesc.length === 0) {
        return;
    }

    const corrections = getStoredCorrections();
    corrections[normalizedDesc] = category;
    saveCorrections(corrections);
}

/**
 * Get all classification rules
 * 
 * @returns {Array<Object>} Array of classification rules
 */
function getRules() {
    return [...CLASSIFICATION_RULES];
}

/**
 * Get all valid categories
 * 
 * @returns {Array<string>} Array of valid category names
 */
function getValidCategories() {
    return [...VALID_CATEGORIES];
}

/**
 * Clear all stored corrections (useful for testing)
 */
function clearCorrections() {
    try {
        localStorage.removeItem(CORRECTIONS_STORAGE_KEY);
    } catch (err) {
        console.error('Error clearing corrections:', err);
    }
}

// Export all classifier functions
export {
    CLASSIFICATION_RULES,
    VALID_CATEGORIES,
    CONFIDENCE_THRESHOLD,
    matchRules,
    matchCorrections,
    aiClassify,
    classifyTransaction,
    classifyBatch,
    learnFromCorrection,
    getRules,
    getValidCategories,
    clearCorrections,
    getStoredCorrections
};
