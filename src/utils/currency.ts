/**
 * Currency formatting utilities for Sudanese Pounds (SDG)
 */

/**
 * Format a number as Sudanese Pounds currency
 * @param amount - The amount to format
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: number | string,
  options: {
    showSymbol?: boolean;
    symbolPosition?: 'before' | 'after';
    locale?: string;
  } = {}
): string => {
  const {
    showSymbol = true,
    symbolPosition = 'before',
    locale = 'en-US',
  } = options;

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return showSymbol ? (symbolPosition === 'before' ? 'SDG 0' : '0 SDG') : '0';
  }

  const formatted = Math.abs(numAmount).toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const sign = numAmount < 0 ? '-' : '';
  
  if (!showSymbol) {
    return `${sign}${formatted}`;
  }

  // Sudanese Pound symbol: SDG or ج.س. (Arabic)
  const symbol = locale.startsWith('ar') ? 'ج.س.' : 'SDG';
  
  if (symbolPosition === 'after') {
    return `${sign}${formatted} ${symbol}`;
  } else {
    return `${sign}${symbol} ${formatted}`;
  }
};

/**
 * Format currency for chart Y-axis labels
 * Simplified format for charts
 */
export const formatCurrencyShort = (amount: number): string => {
  if (isNaN(amount)) return 'SDG 0';
  
  // Format large numbers with K, M, etc.
  if (amount >= 1000000) {
    return `SDG ${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `SDG ${(amount / 1000).toFixed(0)}K`;
  }
  
  return `SDG ${Math.round(amount).toLocaleString()}`;
};

