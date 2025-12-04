/**
 * Currency Utilities Tests
 *
 * TDD tests for currency formatting and display utilities.
 * Story 2.3: Currency Management - AC-1, AC-2
 */

import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCompactCurrency,
  getCurrencySymbol,
  parseCurrency,
  CURRENCY_SYMBOL,
} from '../currency-utils';

describe('currency-utils', () => {
  describe('CURRENCY_SYMBOL', () => {
    it('should export a currency symbol constant', () => {
      expect(CURRENCY_SYMBOL).toBeDefined();
      expect(typeof CURRENCY_SYMBOL).toBe('string');
    });
  });

  describe('formatCurrency', () => {
    it('should format 0 as "0"', () => {
      expect(formatCurrency(0)).toBe('0');
    });

    it('should format positive integers without decimals', () => {
      expect(formatCurrency(100)).toBe('100');
    });

    it('should format thousands with comma separator', () => {
      expect(formatCurrency(1000)).toBe('1,000');
    });

    it('should format large numbers with proper separators', () => {
      expect(formatCurrency(1000000)).toBe('1,000,000');
    });

    it('should format 1234567 correctly', () => {
      expect(formatCurrency(1234567)).toBe('1,234,567');
    });

    it('should handle negative numbers', () => {
      expect(formatCurrency(-500)).toBe('-500');
    });

    it('should handle negative thousands', () => {
      expect(formatCurrency(-1500)).toBe('-1,500');
    });

    it('should handle undefined by returning "0"', () => {
      expect(formatCurrency(undefined as unknown as number)).toBe('0');
    });

    it('should handle null by returning "0"', () => {
      expect(formatCurrency(null as unknown as number)).toBe('0');
    });

    it('should handle NaN by returning "0"', () => {
      expect(formatCurrency(NaN)).toBe('0');
    });
  });

  describe('formatCompactCurrency', () => {
    it('should format numbers under 1000 as-is', () => {
      expect(formatCompactCurrency(500)).toBe('500');
    });

    it('should format 1000 as "1K"', () => {
      expect(formatCompactCurrency(1000)).toBe('1K');
    });

    it('should format 1500 as "1.5K"', () => {
      expect(formatCompactCurrency(1500)).toBe('1.5K');
    });

    it('should format 10000 as "10K"', () => {
      expect(formatCompactCurrency(10000)).toBe('10K');
    });

    it('should format 1000000 as "1M"', () => {
      expect(formatCompactCurrency(1000000)).toBe('1M');
    });

    it('should format 1500000 as "1.5M"', () => {
      expect(formatCompactCurrency(1500000)).toBe('1.5M');
    });

    it('should handle 0', () => {
      expect(formatCompactCurrency(0)).toBe('0');
    });

    it('should handle undefined by returning "0"', () => {
      expect(formatCompactCurrency(undefined as unknown as number)).toBe('0');
    });

    it('should handle null by returning "0"', () => {
      expect(formatCompactCurrency(null as unknown as number)).toBe('0');
    });

    it('should round to one decimal place for K', () => {
      expect(formatCompactCurrency(1234)).toBe('1.2K');
    });

    it('should not show decimal if whole number for K', () => {
      expect(formatCompactCurrency(2000)).toBe('2K');
    });
  });

  describe('getCurrencySymbol', () => {
    it('should return the currency symbol', () => {
      const symbol = getCurrencySymbol();
      expect(symbol).toBe(CURRENCY_SYMBOL);
    });
  });

  describe('parseCurrency', () => {
    it('should parse simple number string', () => {
      expect(parseCurrency('100')).toBe(100);
    });

    it('should parse string with commas', () => {
      expect(parseCurrency('1,000')).toBe(1000);
    });

    it('should parse string with currency symbol', () => {
      expect(parseCurrency(`${CURRENCY_SYMBOL}500`)).toBe(500);
    });

    it('should parse string with symbol and commas', () => {
      expect(parseCurrency(`${CURRENCY_SYMBOL}1,500`)).toBe(1500);
    });

    it('should return 0 for empty string', () => {
      expect(parseCurrency('')).toBe(0);
    });

    it('should return 0 for invalid string', () => {
      expect(parseCurrency('abc')).toBe(0);
    });

    it('should handle negative values', () => {
      expect(parseCurrency('-500')).toBe(-500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large numbers', () => {
      expect(formatCurrency(999999999)).toBe('999,999,999');
    });

    it('should handle decimal input by truncating', () => {
      expect(formatCurrency(100.99)).toBe('100');
    });

    it('should format compact for billions', () => {
      expect(formatCompactCurrency(1000000000)).toBe('1B');
    });

    it('should format compact for 1.5 billion', () => {
      expect(formatCompactCurrency(1500000000)).toBe('1.5B');
    });
  });
});
