/**
 * Forecast Module
 * 
 * Predicts future spending using statistical methods including moving averages
 * and trend estimation. Combines historical data analysis with trend adjustment
 * to provide spending predictions.
 * 
 * @module forecast
 * 
 * Requirements covered:
 * - 7.1: Predict next month's spending using a 3-month moving average
 * - 7.2: Apply trend estimation to adjust predictions based on spending direction
 * - 7.3: Use available data for prediction with confidence disclaimer when < 3 months
 */

import { getMonthlyTotals } from './analytics.js';

/**
 * Calculate the moving average for the last n periods of data
 * 
 * @param {number[]} data - Array of numeric values (e.g., monthly totals)
 * @param {number} period - Number of periods to average (default: 3)
 * @returns {number} The arithmetic mean of the last 'period' values
 * 
 * Requirements: 7.1
 * 
 * Property 15: Moving Average Calculation
 * For any array of n numeric values where n >= period, this function
 * SHALL return the arithmetic mean of the last 'period' values in the array.
 */
function calculateMovingAverage(data, period = 3) {
    // Handle edge cases
    if (!Array.isArray(data) || data.length === 0) {
        return 0;
    }

    // If we have fewer data points than the period, use all available data
    const effectivePeriod = Math.min(period, data.length);

    // Get the last 'effectivePeriod' values
    const relevantData = data.slice(-effectivePeriod);

    // Calculate the sum
    const sum = relevantData.reduce((acc, val) => {
        const numVal = typeof val === 'number' ? val : parseFloat(val) || 0;
        return acc + numVal;
    }, 0);

    // Return the arithmetic mean
    return sum / effectivePeriod;
}

/**
 * Calculate the trend direction and magnitude from a data series
 * Uses simple linear regression to determine slope
 * 
 * @param {number[]} data - Array of numeric values representing time series data
 * @returns {{slope: number, direction: string}} Trend slope and direction
 *   - slope: The rate of change per period (positive = increasing, negative = decreasing)
 *   - direction: "up" if slope > threshold, "down" if slope < -threshold, "stable" otherwise
 * 
 * Requirements: 7.2
 * 
 * Property 16: Trend Estimation
 * For any array of at least 2 numeric values, this function SHALL return:
 * 1. A positive slope if the values are generally increasing
 * 2. A negative slope if the values are generally decreasing
 * 3. A slope near zero if values are stable
 * 4. Direction "up", "down", or "stable" matching the slope sign
 */
function calculateTrend(data) {
    // Handle edge cases
    if (!Array.isArray(data) || data.length < 2) {
        return {
            slope: 0,
            direction: 'stable'
        };
    }

    // Convert all values to numbers
    const numericData = data.map(val => typeof val === 'number' ? val : parseFloat(val) || 0);

    const n = numericData.length;

    // Simple linear regression: y = mx + b
    // We need to find the slope (m)
    // Using least squares method:
    // m = (n * Σ(xy) - Σx * Σy) / (n * Σ(x²) - (Σx)²)

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
        const x = i; // Time index (0, 1, 2, ...)
        const y = numericData[i];

        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
    }

    // Calculate slope
    const denominator = n * sumX2 - sumX * sumX;

    // Avoid division by zero (happens when n = 1, but we already handle that)
    if (denominator === 0) {
        return {
            slope: 0,
            direction: 'stable'
        };
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;

    // Determine direction based on slope
    // Use a threshold relative to the average value to determine significance
    const average = sumY / n;
    const threshold = average * 0.01; // 1% of average as threshold for "stable"

    let direction;
    if (slope > threshold) {
        direction = 'up';
    } else if (slope < -threshold) {
        direction = 'down';
    } else {
        direction = 'stable';
    }

    return {
        slope: Math.round(slope * 100) / 100, // Round to 2 decimal places
        direction
    };
}

/**
 * Predict next month's spending by combining moving average with trend adjustment
 * 
 * @returns {Promise<{prediction: number, confidence: string, basedOnMonths: number, trend: {slope: number, direction: string}}>}
 *   - prediction: The predicted spending amount for next month
 *   - confidence: "high" (3+ months), "medium" (2 months), "low" (1 month or less)
 *   - basedOnMonths: Number of months of data used for prediction
 *   - trend: The trend information used in the prediction
 * 
 * Requirements: 7.1, 7.2, 7.3
 */
async function predictNextMonth() {
    try {
        // Get the last 6 months of data for trend analysis
        const monthlyTotals = await getMonthlyTotals(6);

        // Extract just the totals as an array
        const totals = monthlyTotals.map(m => m.total);
        const basedOnMonths = totals.length;

        // Handle case with no data
        if (basedOnMonths === 0) {
            return {
                prediction: 0,
                confidence: 'low',
                basedOnMonths: 0,
                trend: { slope: 0, direction: 'stable' }
            };
        }

        // Calculate the 3-month moving average (or less if insufficient data)
        const movingAvg = calculateMovingAverage(totals, 3);

        // Calculate the trend
        const trend = calculateTrend(totals);

        // Adjust prediction based on trend
        // Apply trend slope as an adjustment to the moving average
        let prediction = movingAvg;

        // If we have a clear trend, adjust the prediction
        if (trend.direction === 'up') {
            // Add the slope to account for upward trend
            prediction = movingAvg + trend.slope;
        } else if (trend.direction === 'down') {
            // Subtract the absolute slope to account for downward trend
            // But don't let prediction go negative
            prediction = Math.max(0, movingAvg + trend.slope);
        }

        // Determine confidence level based on data availability
        let confidence;
        if (basedOnMonths >= 3) {
            confidence = 'high';
        } else if (basedOnMonths === 2) {
            confidence = 'medium';
        } else {
            confidence = 'low';
        }

        return {
            prediction: Math.round(prediction * 100) / 100, // Round to 2 decimal places
            confidence,
            basedOnMonths,
            trend
        };
    } catch (err) {
        console.error('Predict next month error:', err);
        return {
            prediction: 0,
            confidence: 'low',
            basedOnMonths: 0,
            trend: { slope: 0, direction: 'stable' }
        };
    }
}

// Export all forecast functions
export {
    calculateMovingAverage,
    calculateTrend,
    predictNextMonth
};
