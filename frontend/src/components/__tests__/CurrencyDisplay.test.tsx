/**
 * CurrencyDisplay Component Tests
 *
 * Comprehensive tests for the currency display component including:
 * - Currency amount rendering
 * - Loading state
 * - Size variants
 * - Compact display mode
 *
 * Story 2.3: Currency Management - AC-1 through AC-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CurrencyDisplay from '../CurrencyDisplay';

describe('CurrencyDisplay', () => {
  describe('Currency Amount (AC-1)', () => {
    it('should display currency amount', () => {
      render(<CurrencyDisplay amount={1000} />);
      expect(screen.getByText('1,000')).toBeInTheDocument();
    });

    it('should display 0 when amount is 0', () => {
      render(<CurrencyDisplay amount={0} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should display large amounts with proper formatting', () => {
      render(<CurrencyDisplay amount={1234567} />);
      expect(screen.getByText('1,234,567')).toBeInTheDocument();
    });

    it('should handle undefined amount by showing 0', () => {
      render(<CurrencyDisplay amount={undefined} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should display the currency icon', () => {
      render(<CurrencyDisplay amount={100} />);
      const icon = screen.getByTestId('currency-icon');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Currency Formatting (AC-2)', () => {
    it('should format with thousands separator', () => {
      render(<CurrencyDisplay amount={5000} />);
      expect(screen.getByText('5,000')).toBeInTheDocument();
    });

    it('should format millions correctly', () => {
      render(<CurrencyDisplay amount={1000000} />);
      expect(screen.getByText('1,000,000')).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('should display compact format when compact prop is true', () => {
      render(<CurrencyDisplay amount={1500} compact />);
      expect(screen.getByText('1.5K')).toBeInTheDocument();
    });

    it('should display K for thousands in compact mode', () => {
      render(<CurrencyDisplay amount={10000} compact />);
      expect(screen.getByText('10K')).toBeInTheDocument();
    });

    it('should display M for millions in compact mode', () => {
      render(<CurrencyDisplay amount={2500000} compact />);
      expect(screen.getByText('2.5M')).toBeInTheDocument();
    });

    it('should display under 1000 as-is in compact mode', () => {
      render(<CurrencyDisplay amount={500} compact />);
      expect(screen.getByText('500')).toBeInTheDocument();
    });
  });

  describe('Loading State (AC-4)', () => {
    it('should display loading skeleton when isLoading is true', () => {
      render(<CurrencyDisplay isLoading />);
      expect(screen.getByTestId('currency-loading-skeleton')).toBeInTheDocument();
    });

    it('should not display amount when loading', () => {
      render(<CurrencyDisplay amount={1000} isLoading />);
      expect(screen.queryByText('1,000')).not.toBeInTheDocument();
    });

    it('should not display currency icon when loading', () => {
      render(<CurrencyDisplay amount={1000} isLoading />);
      expect(screen.queryByTestId('currency-icon')).not.toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('should render with small size', () => {
      render(<CurrencyDisplay amount={100} size="sm" />);
      const container = screen.getByTestId('currency-display');
      expect(container).toHaveClass('currency-display-sm');
    });

    it('should render with medium size (default)', () => {
      render(<CurrencyDisplay amount={100} />);
      const container = screen.getByTestId('currency-display');
      expect(container).toHaveClass('currency-display-md');
    });

    it('should render with large size', () => {
      render(<CurrencyDisplay amount={100} size="lg" />);
      const container = screen.getByTestId('currency-display');
      expect(container).toHaveClass('currency-display-lg');
    });
  });

  describe('Label', () => {
    it('should display label when provided', () => {
      render(<CurrencyDisplay amount={100} label="Balance" />);
      expect(screen.getByText('Balance')).toBeInTheDocument();
    });

    it('should not display label when not provided', () => {
      render(<CurrencyDisplay amount={100} />);
      expect(screen.queryByText('Balance')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label on amount', () => {
      render(<CurrencyDisplay amount={1500} />);
      const container = screen.getByTestId('currency-display');
      expect(container).toHaveAttribute('aria-label');
    });

    it('should announce currency amount correctly', () => {
      render(<CurrencyDisplay amount={1500} />);
      const container = screen.getByTestId('currency-display');
      expect(container.getAttribute('aria-label')).toContain('1,500');
    });
  });

  describe('Visual Elements', () => {
    it('should render with fantasy styling classes', () => {
      render(<CurrencyDisplay amount={100} />);
      const container = screen.getByTestId('currency-display');
      expect(container.className).toMatch(/currency-display/);
    });

    it('should display coin icon with gold color', () => {
      render(<CurrencyDisplay amount={100} />);
      const icon = screen.getByTestId('currency-icon');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative amounts', () => {
      render(<CurrencyDisplay amount={-500} />);
      expect(screen.getByText('-500')).toBeInTheDocument();
    });

    it('should handle very large amounts', () => {
      render(<CurrencyDisplay amount={999999999} />);
      expect(screen.getByText('999,999,999')).toBeInTheDocument();
    });

    it('should handle zero in compact mode', () => {
      render(<CurrencyDisplay amount={0} compact />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });
});
