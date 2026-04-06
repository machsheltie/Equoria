/**
 * PrizeTransactionRow Component Tests
 *
 * Comprehensive test suite for the prize transaction row component.
 * Tests cover:
 * - Rendering all transaction data correctly
 * - Date and currency formatting
 * - Placement badge colors and icons
 * - Layout variants (table/card)
 * - Click interactions for competition and horse
 * - Accessibility compliance
 *
 * Target: 12 tests following TDD methodology
 * Story 5-3: Competition History Display - Task 3
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrizeTransactionRow, {
  type PrizeTransactionRowProps,
  type PrizeTransaction,
} from '../PrizeTransactionRow';

/**
 * Wraps a table-row component in a valid <table><tbody> context to avoid
 * invalid DOM nesting warnings (a <tr> must be a descendant of <table>).
 */
const renderInTable = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }) => (
      <table>
        <tbody>{children}</tbody>
      </table>
    ),
  });

describe('PrizeTransactionRow', () => {
  const mockOnViewCompetition = vi.fn();
  const mockOnViewHorse = vi.fn();

  // Sample transaction data for testing
  const sampleTransaction: PrizeTransaction = {
    transactionId: 'txn-001',
    date: '2026-01-25',
    competitionId: 1,
    competitionName: 'Spring Derby Championship',
    horseId: 101,
    horseName: 'Thunder Bolt',
    discipline: 'Racing',
    placement: 1,
    prizeMoney: 5000,
    xpGained: 150,
    claimed: true,
    claimedAt: '2026-01-25T15:30:00Z',
  };

  const secondPlaceTransaction: PrizeTransaction = {
    ...sampleTransaction,
    transactionId: 'txn-002',
    placement: 2,
    prizeMoney: 2500,
    xpGained: 100,
  };

  const thirdPlaceTransaction: PrizeTransaction = {
    ...sampleTransaction,
    transactionId: 'txn-003',
    placement: 3,
    prizeMoney: 1000,
    xpGained: 75,
  };

  const defaultProps: PrizeTransactionRowProps = {
    transaction: sampleTransaction,
    onViewCompetition: mockOnViewCompetition,
    onViewHorse: mockOnViewHorse,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================
  // 1. Rendering Tests (6 tests)
  // =========================================
  describe('Rendering Tests', () => {
    it('renders all transaction data correctly', () => {
      renderInTable(<PrizeTransactionRow {...defaultProps} />);

      expect(screen.getByTestId('prize-transaction-row')).toBeInTheDocument();
      expect(screen.getByText('Spring Derby Championship')).toBeInTheDocument();
      expect(screen.getByText('Thunder Bolt')).toBeInTheDocument();
      expect(screen.getByText('Racing')).toBeInTheDocument();
    });

    it('formats date properly', () => {
      renderInTable(<PrizeTransactionRow {...defaultProps} />);

      // Should format as "Jan 24, 2026" or "Jan 25, 2026" depending on timezone
      expect(screen.getByTestId('transaction-date')).toHaveTextContent(/Jan 2[45], 2026/);
    });

    it('formats prize money with currency', () => {
      renderInTable(<PrizeTransactionRow {...defaultProps} />);

      // Uses DollarSign icon plus formatted number (without $ prefix in text)
      expect(screen.getByTestId('prize-money')).toHaveTextContent('5,000');
    });

    it('shows placement badge with correct color', () => {
      renderInTable(<PrizeTransactionRow {...defaultProps} />);

      const badge = screen.getByTestId('placement-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('1st');
    });

    it('shows XP with proper formatting', () => {
      renderInTable(<PrizeTransactionRow {...defaultProps} />);

      const xpElement = screen.getByTestId('xp-gained');
      expect(xpElement).toHaveTextContent('150');
      expect(screen.getByText(/XP/i)).toBeInTheDocument();
    });

    it('displays discipline correctly', () => {
      renderInTable(<PrizeTransactionRow {...defaultProps} />);

      expect(screen.getByTestId('discipline-badge')).toHaveTextContent('Racing');
    });
  });

  // =========================================
  // 2. Layout Tests (2 tests)
  // =========================================
  describe('Layout Tests', () => {
    it('renders table layout by default (desktop)', () => {
      renderInTable(<PrizeTransactionRow {...defaultProps} layout="table" />);

      const row = screen.getByTestId('prize-transaction-row');
      expect(row).toHaveAttribute('data-layout', 'table');
      // Table row should have table-related structure
      expect(row.tagName).toBe('TR');
    });

    it('renders card layout when specified (mobile)', () => {
      render(<PrizeTransactionRow {...defaultProps} layout="card" />);

      const row = screen.getByTestId('prize-transaction-row');
      expect(row).toHaveAttribute('data-layout', 'card');
      // Card should be a div
      expect(row.tagName).toBe('DIV');
    });
  });

  // =========================================
  // 3. Interaction Tests (2 tests)
  // =========================================
  describe('Interaction Tests', () => {
    it('competition name is clickable and calls onViewCompetition', async () => {
      const user = userEvent.setup();
      renderInTable(<PrizeTransactionRow {...defaultProps} />);

      const competitionLink = screen.getByTestId('competition-link');
      await user.click(competitionLink);

      expect(mockOnViewCompetition).toHaveBeenCalledWith(1); // competitionId
    });

    it('horse name is clickable and calls onViewHorse', async () => {
      const user = userEvent.setup();
      renderInTable(<PrizeTransactionRow {...defaultProps} />);

      const horseLink = screen.getByTestId('horse-link');
      await user.click(horseLink);

      expect(mockOnViewHorse).toHaveBeenCalledWith(101); // horseId
    });
  });

  // =========================================
  // 4. Visual Tests (2 tests)
  // =========================================
  describe('Visual Tests', () => {
    it('1st place has gold badge styling', () => {
      renderInTable(<PrizeTransactionRow {...defaultProps} />);

      const badge = screen.getByTestId('placement-badge');
      expect(badge).toHaveClass('bg-yellow-400');
    });

    it('2nd place has silver badge and 3rd has bronze badge', () => {
      // Test 2nd place
      const { rerender } = renderInTable(
        <PrizeTransactionRow {...defaultProps} transaction={secondPlaceTransaction} />
      );

      let badge = screen.getByTestId('placement-badge');
      expect(badge).toHaveClass('bg-gray-300');

      // Test 3rd place
      rerender(<PrizeTransactionRow {...defaultProps} transaction={thirdPlaceTransaction} />);

      badge = screen.getByTestId('placement-badge');
      expect(badge).toHaveClass('bg-orange-400');
    });
  });
});
