/**
 * Charts Module
 * Renders canvas-based visualizations for the Personal Finance Analyzer
 * Uses HTML Canvas and vanilla JavaScript only (no external charting libraries)
 */

// Color palette for charts
const CHART_COLORS = [
    '#4F46E5', // Indigo
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#06B6D4', // Cyan
    '#F97316', // Orange
    '#EC4899', // Pink
    '#84CC16', // Lime
    '#6366F1', // Indigo light
    '#14B8A6', // Teal
    '#A855F7'  // Purple
];

/**
 * Prepares canvas for rendering by clearing and setting up dimensions
 * @param {HTMLCanvasElement} canvas - The canvas element to prepare
 * @returns {CanvasRenderingContext2D|null} - The 2D rendering context or null if not supported
 */
function prepareCanvas(canvas) {
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        console.error('Invalid canvas element provided');
        return null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Canvas 2D context not supported');
        return null;
    }

    // Get the display size from CSS
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set the canvas internal dimensions for high DPI displays
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // Scale the context to match the device pixel ratio
    ctx.scale(dpr, dpr);

    // Clear the canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Store display dimensions for use in drawing functions
    canvas.displayWidth = rect.width;
    canvas.displayHeight = rect.height;

    return ctx;
}

/**
 * Draws a legend for the chart
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {Array<{label: string, color: string}>} items - Legend items
 * @param {number} x - Starting x position
 * @param {number} y - Starting y position
 * @param {number} maxWidth - Maximum width for legend
 */
function drawLegend(ctx, items, x, y, maxWidth = 200) {
    if (!ctx || !items || items.length === 0) return;

    const itemHeight = 24;
    const boxSize = 12;
    const boxTextGap = 8;
    let currentY = y;

    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    items.forEach((item, index) => {
        // Draw color box on the left
        ctx.fillStyle = item.color || CHART_COLORS[index % CHART_COLORS.length];
        ctx.fillRect(x, currentY + 2, boxSize, boxSize);

        // Draw label text with proper gap after the box
        ctx.fillStyle = '#374151';
        const textX = x + boxSize + boxTextGap;
        const availableWidth = maxWidth - boxSize - boxTextGap;
        const label = truncateText(ctx, item.label, availableWidth);
        ctx.fillText(label, textX, currentY + boxSize / 2 + 2);

        currentY += itemHeight;
    });
}


/**
 * Truncates text to fit within a maximum width
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {string} text - Text to truncate
 * @param {number} maxWidth - Maximum width in pixels
 * @returns {string} - Truncated text with ellipsis if needed
 */
function truncateText(ctx, text, maxWidth) {
    if (!text) return '';

    const metrics = ctx.measureText(text);
    if (metrics.width <= maxWidth) return text;

    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
}

/**
 * Renders a pie chart showing category-wise spending distribution
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {Array<{category: string, total: number, percentage: number}>} data - Category breakdown data
 */
function renderPieChart(canvas, data) {
    const ctx = prepareCanvas(canvas);
    if (!ctx) {
        displayNoDataMessage(canvas, 'Canvas not supported');
        return;
    }

    if (!data || data.length === 0) {
        displayNoDataMessage(canvas, 'No data available');
        return;
    }

    const width = canvas.displayWidth;
    const height = canvas.displayHeight;

    // Calculate chart dimensions
    const legendWidth = Math.min(150, width * 0.35);
    const chartAreaWidth = width - legendWidth - 20;
    const centerX = chartAreaWidth / 2;
    const centerY = height / 2;
    const radius = Math.min(chartAreaWidth, height) / 2 - 20;

    // Calculate total for percentages
    const total = data.reduce((sum, item) => sum + (item.total || 0), 0);

    if (total === 0) {
        displayNoDataMessage(canvas, 'No spending data');
        return;
    }

    // Draw pie slices
    let startAngle = -Math.PI / 2; // Start from top

    data.forEach((item, index) => {
        const sliceAngle = (item.total / total) * 2 * Math.PI;
        const color = CHART_COLORS[index % CHART_COLORS.length];

        // Draw slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // Draw slice border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw percentage label if slice is large enough
        if (item.total / total > 0.05) {
            const labelAngle = startAngle + sliceAngle / 2;
            const labelRadius = radius * 0.65;
            const labelX = centerX + Math.cos(labelAngle) * labelRadius;
            const labelY = centerY + Math.sin(labelAngle) * labelRadius;

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const percentage = ((item.total / total) * 100).toFixed(1);
            ctx.fillText(`${percentage}%`, labelX, labelY);
        }

        startAngle += sliceAngle;
    });

    // Draw legend
    const legendItems = data.map((item, index) => ({
        label: `${item.category}: ₹${item.total.toLocaleString('en-IN')}`,
        color: CHART_COLORS[index % CHART_COLORS.length]
    }));

    const legendX = chartAreaWidth + 10;
    const legendY = 20;
    drawLegend(ctx, legendItems, legendX, legendY, legendWidth - 10);
}


/**
 * Renders a line chart showing monthly spending trends
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {Array<{year: number, month: number, total: number, label: string}>} data - Monthly totals data
 */
function renderLineChart(canvas, data) {
    const ctx = prepareCanvas(canvas);
    if (!ctx) {
        displayNoDataMessage(canvas, 'Canvas not supported');
        return;
    }

    if (!data || data.length === 0) {
        displayNoDataMessage(canvas, 'No data available');
        return;
    }

    const width = canvas.displayWidth;
    const height = canvas.displayHeight;

    // Chart margins
    const margin = { top: 30, right: 20, bottom: 50, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Find data range
    const values = data.map(d => d.total);
    const maxValue = Math.max(...values);
    const minValue = Math.min(0, Math.min(...values));
    const valueRange = maxValue - minValue || 1;

    // Calculate scales
    const xStep = chartWidth / Math.max(data.length - 1, 1);
    const yScale = chartHeight / valueRange;

    // Draw grid lines
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = margin.top + (chartHeight / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(width - margin.right, y);
        ctx.stroke();

        // Y-axis labels
        const value = maxValue - (valueRange / gridLines) * i;
        ctx.fillStyle = '#6B7280';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${formatNumber(value)}`, margin.left - 8, y);
    }

    // Draw axes
    ctx.strokeStyle = '#9CA3AF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, height - margin.bottom);
    ctx.lineTo(width - margin.right, height - margin.bottom);
    ctx.stroke();

    // Draw line
    ctx.strokeStyle = '#4F46E5';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const points = [];
    data.forEach((item, index) => {
        const x = margin.left + index * xStep;
        const y = margin.top + chartHeight - ((item.total - minValue) * yScale);
        points.push({ x, y, item });

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();

    // Draw area fill
    ctx.fillStyle = 'rgba(79, 70, 229, 0.1)';
    ctx.beginPath();
    ctx.moveTo(margin.left, height - margin.bottom);
    points.forEach((point) => {
        ctx.lineTo(point.x, point.y);
    });
    ctx.lineTo(points[points.length - 1].x, height - margin.bottom);
    ctx.closePath();
    ctx.fill();

    // Draw data points and labels
    points.forEach((point, index) => {
        // Draw point
        ctx.fillStyle = '#4F46E5';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw x-axis label
        ctx.fillStyle = '#6B7280';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const label = point.item.label || `${point.item.month}/${point.item.year}`;
        ctx.save();
        ctx.translate(point.x, height - margin.bottom + 8);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText(label, 0, 0);
        ctx.restore();
    });

    // Draw title
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Monthly Spending Trend', width / 2, 5);
}


/**
 * Renders a forecast chart with historical data and prediction
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {number[]} historical - Array of historical monthly totals
 * @param {number} forecast - Predicted next month value
 */
function renderForecastChart(canvas, historical, forecast) {
    const ctx = prepareCanvas(canvas);
    if (!ctx) {
        displayNoDataMessage(canvas, 'Canvas not supported');
        return;
    }

    if (!historical || historical.length === 0) {
        displayNoDataMessage(canvas, 'Insufficient data for forecast');
        return;
    }

    const width = canvas.displayWidth;
    const height = canvas.displayHeight;

    // Chart margins
    const margin = { top: 40, right: 20, bottom: 50, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Combine historical and forecast data
    const allValues = [...historical, forecast];
    const maxValue = Math.max(...allValues);
    const minValue = Math.min(0, Math.min(...allValues));
    const valueRange = maxValue - minValue || 1;

    // Calculate scales
    const totalPoints = historical.length + 1;
    const xStep = chartWidth / Math.max(totalPoints - 1, 1);
    const yScale = chartHeight / valueRange;

    // Draw grid lines
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;

    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = margin.top + (chartHeight / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(width - margin.right, y);
        ctx.stroke();

        // Y-axis labels
        const value = maxValue - (valueRange / gridLines) * i;
        ctx.fillStyle = '#6B7280';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${formatNumber(value)}`, margin.left - 8, y);
    }

    // Draw axes
    ctx.strokeStyle = '#9CA3AF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, height - margin.bottom);
    ctx.lineTo(width - margin.right, height - margin.bottom);
    ctx.stroke();

    // Calculate points
    const historicalPoints = historical.map((value, index) => ({
        x: margin.left + index * xStep,
        y: margin.top + chartHeight - ((value - minValue) * yScale),
        value
    }));

    const forecastPoint = {
        x: margin.left + historical.length * xStep,
        y: margin.top + chartHeight - ((forecast - minValue) * yScale),
        value: forecast
    };

    // Draw historical line
    ctx.strokeStyle = '#4F46E5';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    historicalPoints.forEach((point, index) => {
        if (index === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });
    ctx.stroke();

    // Draw forecast line (dashed)
    if (historicalPoints.length > 0) {
        const lastHistorical = historicalPoints[historicalPoints.length - 1];
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(lastHistorical.x, lastHistorical.y);
        ctx.lineTo(forecastPoint.x, forecastPoint.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw historical points
    historicalPoints.forEach((point, index) => {
        ctx.fillStyle = '#4F46E5';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // X-axis label
        ctx.fillStyle = '#6B7280';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`Month ${index + 1}`, point.x, height - margin.bottom + 8);
    });

    // Draw forecast point
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(forecastPoint.x, forecastPoint.y, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(forecastPoint.x, forecastPoint.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Forecast label
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Forecast', forecastPoint.x, height - margin.bottom + 8);

    // Draw forecast value label
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${formatNumber(forecast)}`, forecastPoint.x, forecastPoint.y - 12);

    // Draw title
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Spending Forecast', width / 2, 5);

    // Draw legend
    const legendY = 22;

    // Historical legend
    ctx.fillStyle = '#4F46E5';
    ctx.fillRect(width / 2 - 80, legendY, 12, 12);
    ctx.fillStyle = '#6B7280';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Historical', width / 2 - 64, legendY + 6);

    // Forecast legend
    ctx.fillStyle = '#10B981';
    ctx.fillRect(width / 2 + 20, legendY, 12, 12);
    ctx.fillStyle = '#6B7280';
    ctx.fillText('Forecast', width / 2 + 36, legendY + 6);
}


/**
 * Displays a "no data" message on the canvas
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {string} message - Message to display
 */
function displayNoDataMessage(canvas, message = 'No data available') {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw message
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, rect.width / 2, rect.height / 2);
}

/**
 * Formats a number for display (adds K/M suffix for large numbers)
 * @param {number} value - Number to format
 * @returns {string} - Formatted number string with rupee symbol
 */
function formatNumber(value) {
    if (value >= 10000000) {
        return '₹' + (value / 10000000).toFixed(1) + 'Cr';
    }
    if (value >= 100000) {
        return '₹' + (value / 100000).toFixed(1) + 'L';
    }
    if (value >= 1000) {
        return '₹' + (value / 1000).toFixed(1) + 'K';
    }
    return '₹' + value.toFixed(0);
}

/**
 * Sets up responsive canvas resizing
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {Function} renderCallback - Function to call when canvas needs re-rendering
 * @returns {Function} - Cleanup function to remove event listener
 */
function setupResponsiveCanvas(canvas, renderCallback) {
    if (!canvas || typeof renderCallback !== 'function') {
        console.error('Invalid canvas or callback provided');
        return () => { };
    }

    let resizeTimeout;

    const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            renderCallback();
        }, 150); // Debounce resize events
    };

    window.addEventListener('resize', handleResize);

    // Return cleanup function
    return () => {
        clearTimeout(resizeTimeout);
        window.removeEventListener('resize', handleResize);
    };
}

/**
 * Calculates pie chart slice angles for given data
 * Used for testing Property 19: Pie Chart Data Accuracy
 * @param {Array<{total: number}>} data - Category data with totals
 * @returns {Array<{angle: number, percentage: number}>} - Calculated angles in radians
 */
function calculatePieSliceAngles(data) {
    if (!data || data.length === 0) return [];

    const total = data.reduce((sum, item) => sum + (item.total || 0), 0);
    if (total === 0) return data.map(() => ({ angle: 0, percentage: 0 }));

    return data.map(item => {
        const percentage = (item.total / total) * 100;
        const angle = (item.total / total) * 2 * Math.PI;
        return { angle, percentage };
    });
}

/**
 * Calculates line chart point positions for given data
 * Used for testing Property 20: Line Chart Data Accuracy
 * @param {Array<{total: number}>} data - Monthly data with totals
 * @param {number} chartHeight - Available chart height in pixels
 * @returns {Array<{yPosition: number, normalizedValue: number}>} - Calculated y positions
 */
function calculateLineChartPoints(data, chartHeight) {
    if (!data || data.length === 0 || chartHeight <= 0) return [];

    const values = data.map(d => d.total || 0);
    const maxValue = Math.max(...values);
    const minValue = Math.min(0, Math.min(...values));
    const valueRange = maxValue - minValue || 1;

    return data.map(item => {
        const normalizedValue = (item.total - minValue) / valueRange;
        const yPosition = chartHeight - (normalizedValue * chartHeight);
        return { yPosition, normalizedValue };
    });
}

// Export functions for use in other modules
export {
    prepareCanvas,
    renderPieChart,
    renderLineChart,
    renderForecastChart,
    drawLegend,
    setupResponsiveCanvas,
    displayNoDataMessage,
    calculatePieSliceAngles,
    calculateLineChartPoints,
    CHART_COLORS
};

/**
 * Renders an interactive spending trends line chart with smooth transitions and tooltips
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {Array<{periodKey: string, periodLabel: string, total: number}>} data - Spending trends data
 * @param {Object} options - Chart options
 * @param {Function} options.onHover - Callback when hovering over a data point
 * @param {boolean} options.animate - Whether to animate the chart
 */
export function renderSpendingTrendsChart(canvas, data, options = {}) {
    const ctx = prepareCanvas(canvas);
    if (!ctx) {
        displayNoDataMessage(canvas, 'Canvas not supported');
        return;
    }

    if (!data || data.length === 0) {
        displayNoDataMessage(canvas, 'No spending data available');
        return;
    }

    const width = canvas.displayWidth;
    const height = canvas.displayHeight;

    // Chart margins
    const margin = { top: 30, right: 30, bottom: 60, left: 70 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Find data range
    const values = data.map(d => d.total);
    const maxValue = Math.max(...values) * 1.1; // Add 10% padding
    const minValue = Math.min(0, Math.min(...values));
    const valueRange = maxValue - minValue || 1;

    // Calculate scales
    const xStep = chartWidth / Math.max(data.length - 1, 1);
    const yScale = chartHeight / valueRange;

    // Draw background grid
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = margin.top + (chartHeight / gridLines) * i;
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(margin.left, y);
        ctx.lineTo(width - margin.right, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Y-axis labels
        const value = maxValue - (valueRange / gridLines) * i;
        ctx.fillStyle = '#6B7280';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${formatNumber(value)}`, margin.left - 10, y);
    }

    // Draw axes
    ctx.strokeStyle = '#D1D5DB';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, height - margin.bottom);
    ctx.lineTo(width - margin.right, height - margin.bottom);
    ctx.stroke();

    // Calculate points
    const points = data.map((item, index) => ({
        x: margin.left + index * xStep,
        y: margin.top + chartHeight - ((item.total - minValue) * yScale),
        data: item
    }));

    // Draw gradient fill under the line
    const gradient = ctx.createLinearGradient(0, margin.top, 0, height - margin.bottom);
    gradient.addColorStop(0, 'rgba(8, 145, 178, 0.3)');
    gradient.addColorStop(1, 'rgba(8, 145, 178, 0.02)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(margin.left, height - margin.bottom);

    // Use bezier curves for smooth line
    if (points.length > 1) {
        ctx.lineTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    } else if (points.length === 1) {
        ctx.lineTo(points[0].x, points[0].y);
    }

    ctx.lineTo(points[points.length - 1]?.x || margin.left, height - margin.bottom);
    ctx.closePath();
    ctx.fill();

    // Draw the line with smooth curves
    ctx.strokeStyle = '#0891b2';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    if (points.length > 1) {
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    } else if (points.length === 1) {
        ctx.moveTo(points[0].x - 5, points[0].y);
        ctx.lineTo(points[0].x + 5, points[0].y);
    }
    ctx.stroke();

    // Draw data points
    points.forEach((point, index) => {
        // Outer circle
        ctx.fillStyle = '#0891b2';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
        ctx.fill();

        // Inner circle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // X-axis labels
        ctx.fillStyle = '#6B7280';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Rotate labels if there are many data points
        const label = point.data.periodLabel || point.data.periodKey;
        if (data.length > 6) {
            ctx.save();
            ctx.translate(point.x, height - margin.bottom + 8);
            ctx.rotate(-Math.PI / 4);
            ctx.textAlign = 'right';
            ctx.fillText(truncateText(ctx, label, 60), 0, 0);
            ctx.restore();
        } else {
            ctx.fillText(label, point.x, height - margin.bottom + 8);
        }
    });

    // Store points for hover detection
    canvas._chartPoints = points;
    canvas._chartMargin = margin;

    // Set up hover interaction if callback provided
    if (options.onHover) {
        setupChartHoverInteraction(canvas, points, options.onHover);
    }
}

/**
 * Set up hover interaction for chart
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {Array} points - Data points with x, y coordinates
 * @param {Function} onHover - Callback when hovering
 */
function setupChartHoverInteraction(canvas, points, onHover) {
    const handleMouseMove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Find closest point
        let closestPoint = null;
        let minDistance = Infinity;

        points.forEach(point => {
            const distance = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));
            if (distance < minDistance && distance < 30) {
                minDistance = distance;
                closestPoint = point;
            }
        });

        if (closestPoint) {
            canvas.style.cursor = 'pointer';
            onHover({
                point: closestPoint,
                x: closestPoint.x,
                y: closestPoint.y,
                data: closestPoint.data
            });
        } else {
            canvas.style.cursor = 'default';
            onHover(null);
        }
    };

    const handleMouseLeave = () => {
        canvas.style.cursor = 'default';
        onHover(null);
    };

    // Remove existing listeners
    canvas.removeEventListener('mousemove', canvas._hoverHandler);
    canvas.removeEventListener('mouseleave', canvas._leaveHandler);

    // Add new listeners
    canvas._hoverHandler = handleMouseMove;
    canvas._leaveHandler = handleMouseLeave;
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
}

/**
 * Renders a bar chart for category comparison
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {Array<{category: string, total: number, percentage: number}>} data - Category breakdown data
 * @param {Object} options - Chart options
 */
export function renderCategoryBarChart(canvas, data, options = {}) {
    const ctx = prepareCanvas(canvas);
    if (!ctx) {
        displayNoDataMessage(canvas, 'Canvas not supported');
        return;
    }

    if (!data || data.length === 0) {
        displayNoDataMessage(canvas, 'No category data available');
        return;
    }

    const width = canvas.displayWidth;
    const height = canvas.displayHeight;

    // Chart margins
    const margin = { top: 20, right: 20, bottom: 80, left: 70 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Find max value
    const maxValue = Math.max(...data.map(d => d.total)) * 1.1;

    // Calculate bar dimensions
    const barCount = data.length;
    const barGap = 10;
    const barWidth = Math.min(50, (chartWidth - (barCount - 1) * barGap) / barCount);
    const totalBarsWidth = barCount * barWidth + (barCount - 1) * barGap;
    const startX = margin.left + (chartWidth - totalBarsWidth) / 2;

    // Draw horizontal grid lines
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    const gridLines = 5;

    for (let i = 0; i <= gridLines; i++) {
        const y = margin.top + (chartHeight / gridLines) * i;
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(margin.left, y);
        ctx.lineTo(width - margin.right, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Y-axis labels
        const value = maxValue - (maxValue / gridLines) * i;
        ctx.fillStyle = '#6B7280';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${formatNumber(value)}`, margin.left - 10, y);
    }

    // Draw bars
    data.forEach((item, index) => {
        const x = startX + index * (barWidth + barGap);
        const barHeight = (item.total / maxValue) * chartHeight;
        const y = margin.top + chartHeight - barHeight;

        // Draw bar with gradient
        const gradient = ctx.createLinearGradient(x, y, x, margin.top + chartHeight);
        const color = CHART_COLORS[index % CHART_COLORS.length];
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, adjustColorBrightness(color, -20));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
        ctx.fill();

        // Draw category label
        ctx.fillStyle = '#6B7280';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        ctx.save();
        ctx.translate(x + barWidth / 2, height - margin.bottom + 8);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = 'right';
        ctx.fillText(truncateText(ctx, item.category, 70), 0, 0);
        ctx.restore();

        // Draw value on top of bar
        if (barHeight > 20) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`${item.percentage.toFixed(1)}%`, x + barWidth / 2, y - 4);
        }
    });
}

/**
 * Adjust color brightness
 * @param {string} color - Hex color
 * @param {number} amount - Amount to adjust (-100 to 100)
 * @returns {string} Adjusted hex color
 */
function adjustColorBrightness(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}


/**
 * Renders a donut chart for category distribution
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {Array<{category: string, total: number, percentage: number}>} data - Category breakdown data
 * @param {Object} options - Chart options
 * @param {Object} options.highlights - Category highlights (highest, fastestGrowing, mostReduced)
 */
export function renderCategoryDonutChart(canvas, data, options = {}) {
    const ctx = prepareCanvas(canvas);
    if (!ctx) {
        displayNoDataMessage(canvas, 'Canvas not supported');
        return;
    }

    if (!data || data.length === 0) {
        displayNoDataMessage(canvas, 'No category data available');
        return;
    }

    const width = canvas.displayWidth;
    const height = canvas.displayHeight;

    // Calculate chart dimensions
    const legendWidth = Math.min(160, width * 0.4);
    const chartAreaWidth = width - legendWidth - 20;
    const centerX = chartAreaWidth / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(chartAreaWidth, height) / 2 - 20;
    const innerRadius = outerRadius * 0.55; // Donut hole

    // Calculate total
    const total = data.reduce((sum, item) => sum + (item.total || 0), 0);

    if (total === 0) {
        displayNoDataMessage(canvas, 'No spending data');
        return;
    }

    // Get highlight categories
    const highlights = options.highlights || {};
    const highlightCategories = new Set();
    if (highlights.highest) highlightCategories.add(highlights.highest.category);
    if (highlights.fastestGrowing) highlightCategories.add(highlights.fastestGrowing.category?.category);
    if (highlights.mostReduced) highlightCategories.add(highlights.mostReduced.category?.category);

    // Draw donut slices
    let startAngle = -Math.PI / 2;

    data.forEach((item, index) => {
        const sliceAngle = (item.total / total) * 2 * Math.PI;
        const color = CHART_COLORS[index % CHART_COLORS.length];
        const isHighlighted = highlightCategories.has(item.category);

        // Calculate slice position (explode highlighted slices)
        let sliceCenterX = centerX;
        let sliceCenterY = centerY;
        if (isHighlighted) {
            const midAngle = startAngle + sliceAngle / 2;
            sliceCenterX += Math.cos(midAngle) * 8;
            sliceCenterY += Math.sin(midAngle) * 8;
        }

        // Draw outer arc
        ctx.beginPath();
        ctx.arc(sliceCenterX, sliceCenterY, outerRadius, startAngle, startAngle + sliceAngle);
        ctx.arc(sliceCenterX, sliceCenterY, innerRadius, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // Draw slice border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw percentage label if slice is large enough
        if (item.total / total > 0.08) {
            const labelAngle = startAngle + sliceAngle / 2;
            const labelRadius = (outerRadius + innerRadius) / 2;
            const labelX = sliceCenterX + Math.cos(labelAngle) * labelRadius;
            const labelY = sliceCenterY + Math.sin(labelAngle) * labelRadius;

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const percentage = ((item.total / total) * 100).toFixed(1);
            ctx.fillText(`${percentage}%`, labelX, labelY);
        }

        startAngle += sliceAngle;
    });

    // Draw center text
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Total', centerX, centerY - 10);

    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#0891b2';
    ctx.fillText(formatNumber(total), centerX, centerY + 12);

    // Draw legend
    const legendItems = data.slice(0, 8).map((item, index) => {
        let label = item.category;
        if (highlights.highest?.category === item.category) {
            label += ' ★';
        }
        return {
            label: `${label}: ${formatNumber(item.total)}`,
            color: CHART_COLORS[index % CHART_COLORS.length]
        };
    });

    const legendX = chartAreaWidth + 10;
    const legendY = 20;
    drawLegend(ctx, legendItems, legendX, legendY, legendWidth - 10);
}

/**
 * Renders category toggle controls
 * @param {HTMLElement} container - Container element for toggles
 * @param {Array<{category: string, total: number, isVisible: boolean}>} categories - Category data
 * @param {Function} onToggle - Callback when a category is toggled
 */
export function renderCategoryToggleControls(container, categories, onToggle) {
    if (!container) return;

    const html = categories.map((cat, index) => {
        const color = CHART_COLORS[index % CHART_COLORS.length];
        return `
            <label class="category-toggle" style="--toggle-color: ${color}">
                <input type="checkbox" 
                       value="${cat.category}" 
                       ${cat.isVisible !== false ? 'checked' : ''}
                       data-category="${cat.category}">
                <span class="toggle-color" style="background-color: ${color}"></span>
                <span class="toggle-label">${cat.category}</span>
                <span class="toggle-amount">₹${cat.total.toLocaleString('en-IN')}</span>
            </label>
        `;
    }).join('');

    container.innerHTML = html;

    // Add event listeners
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            if (onToggle) {
                onToggle(e.target.dataset.category, e.target.checked);
            }
        });
    });
}

/**
 * Update category toggle state
 * @param {HTMLElement} container - Container element
 * @param {string} category - Category to update
 * @param {boolean} isVisible - New visibility state
 */
export function updateCategoryToggle(container, category, isVisible) {
    if (!container) return;

    const checkbox = container.querySelector(`input[data-category="${category}"]`);
    if (checkbox) {
        checkbox.checked = isVisible;
    }
}
