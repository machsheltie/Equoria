/**
 * PrizeTransactionRow — Claim Button Tests (Equoria-bx52)
 *
 * Verifies the claim-prize button visibility + wiring on
 * PrizeTransactionRow. Per docs/beta-route-truth-table.md the /prizes
 * row lists POST /api/competition/:competitionId/claim-prizes as a
 * primary action — the row must render a Claim button when the
 * transaction is unclaimed, and the click must invoke the provided
 * onClaim handler with the competitionId.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrizeTransactionRow, { type PrizeTransaction } from '../PrizeTransactionRow';

const renderInTable = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }) => (
      <table>
        <tbody>{children}</tbody>
      </table>
    ),
  });

const baseTransaction: PrizeTransaction = {
  transactionId: 'txn-001',
  date: '2026-01-25',
  competitionId: 99,
  competitionName: 'TestFixture-Spring Derby',
  horseId: 101,
  horseName: 'TestFixture-Thunder',
  discipline: 'Racing',
  placement: 1,
  prizeMoney: 5000,
  xpGained: 150,
  claimed: false,
};

describe('PrizeTransactionRow — Claim button (Equoria-bx52)', () => {
  describe('table layout', () => {
    it('renders a Claim button when transaction.claimed === false', () => {
      const onClaim = vi.fn();
      renderInTable(
        <PrizeTransactionRow transaction={baseTransaction} onClaim={onClaim} layout="table" />
      );

      expect(screen.getByRole('button', { name: /claim/i })).toBeInTheDocument();
    });

    it('does NOT render a Claim button when transaction.claimed === true', () => {
      const claimed: PrizeTransaction = { ...baseTransaction, claimed: true };
      const onClaim = vi.fn();
      renderInTable(<PrizeTransactionRow transaction={claimed} onClaim={onClaim} layout="table" />);

      expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument();
    });

    it('invokes onClaim(competitionId) when the Claim button is clicked', async () => {
      const user = userEvent.setup();
      const onClaim = vi.fn();
      renderInTable(
        <PrizeTransactionRow transaction={baseTransaction} onClaim={onClaim} layout="table" />
      );

      await user.click(screen.getByRole('button', { name: /claim/i }));
      expect(onClaim).toHaveBeenCalledWith(99);
    });
  });

  describe('card layout', () => {
    it('renders a Claim button when transaction.claimed === false', () => {
      const onClaim = vi.fn();
      render(<PrizeTransactionRow transaction={baseTransaction} onClaim={onClaim} layout="card" />);

      expect(screen.getByRole('button', { name: /claim/i })).toBeInTheDocument();
    });

    it('invokes onClaim(competitionId) when clicked in card layout', async () => {
      const user = userEvent.setup();
      const onClaim = vi.fn();
      render(<PrizeTransactionRow transaction={baseTransaction} onClaim={onClaim} layout="card" />);

      await user.click(screen.getByRole('button', { name: /claim/i }));
      expect(onClaim).toHaveBeenCalledWith(99);
    });
  });

  it('renders no Claim button when onClaim handler is not provided', () => {
    renderInTable(<PrizeTransactionRow transaction={baseTransaction} layout="table" />);
    expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument();
  });

  it('disables the Claim button when isClaiming is true', () => {
    const onClaim = vi.fn();
    renderInTable(
      <PrizeTransactionRow
        transaction={baseTransaction}
        onClaim={onClaim}
        isClaiming
        layout="table"
      />
    );

    const btn = screen.getByRole('button', { name: /claim/i });
    expect(btn).toBeDisabled();
  });
});
