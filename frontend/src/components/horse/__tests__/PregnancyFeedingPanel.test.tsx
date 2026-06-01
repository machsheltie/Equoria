/**
 * PregnancyFeedingPanel — component tests.
 *
 * Feed-system redesign 2026-04-29 (Equoria-ta4s, parent: Equoria-3gqg).
 *
 * Covers:
 *   1. Renders nothing (returns null) when not in foal.
 *   2. Days remaining countdown from inFoalSinceDate + 7 days.
 *   3. Per-tier feeding counter ("5× Performance", "2× Basic").
 *   4. Live positive/negative chance preview using the same formula as backend.
 *   5. Overdue case (>7 days, foaling job hasn't run yet).
 *   6. Sire name display when supplied.
 *
 * No vi.mock of API client — the panel takes pure props.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PregnancyFeedingPanel } from '../PregnancyFeedingPanel';

const daysAgo = (n: number): string => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

describe('PregnancyFeedingPanel', () => {
  describe('not pregnant', () => {
    it('renders nothing (returns null) when inFoalSinceDate is null', () => {
      const { container } = render(<PregnancyFeedingPanel inFoalSinceDate={null} feedings={{}} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when inFoalSinceDate is undefined', () => {
      const { container } = render(
        <PregnancyFeedingPanel inFoalSinceDate={undefined} feedings={{}} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('countdown', () => {
    it('shows "5 days remaining" for a mare bred 2 days ago', () => {
      render(<PregnancyFeedingPanel inFoalSinceDate={daysAgo(2)} feedings={{ performance: 2 }} />);
      const remaining = screen.getByTestId('pregnancy-days-remaining');
      expect(remaining.textContent).toMatch(/5 days remaining/);
    });

    it('shows "7 days remaining" for a mare bred today (0 days elapsed)', () => {
      render(<PregnancyFeedingPanel inFoalSinceDate={daysAgo(0)} feedings={{}} />);
      expect(screen.getByTestId('pregnancy-days-remaining').textContent).toMatch(
        /7 days remaining/
      );
    });

    it('shows "1 day remaining" for a mare bred 6 days ago (singular form OK)', () => {
      render(<PregnancyFeedingPanel inFoalSinceDate={daysAgo(6)} feedings={{}} />);
      expect(screen.getByTestId('pregnancy-days-remaining').textContent).toMatch(
        /1 day(s)? remaining/
      );
    });

    it('renders the gestation day label inside the panel', () => {
      render(<PregnancyFeedingPanel inFoalSinceDate={daysAgo(2)} feedings={{}} />);
      const panel = screen.getByTestId('pregnancy-feeding-panel');
      // gestation day = elapsed + 1 = 3, capped at 7
      expect(panel.textContent).toMatch(/[Dd]ay 3 of 7/);
    });
  });

  describe('feeding counters', () => {
    it('lists each tier with its count', () => {
      render(
        <PregnancyFeedingPanel
          inFoalSinceDate={daysAgo(2)}
          feedings={{ performance: 5, basic: 2 }}
        />
      );
      const performanceLine = screen.getByTestId('pregnancy-counter-performance');
      expect(performanceLine.textContent).toMatch(/Performance/);
      expect(performanceLine.textContent).toMatch(/5/);

      const basicLine = screen.getByTestId('pregnancy-counter-basic');
      expect(basicLine.textContent).toMatch(/Basic/);
      expect(basicLine.textContent).toMatch(/2/);
    });

    it('does not render counters for tiers with zero or missing entries', () => {
      render(<PregnancyFeedingPanel inFoalSinceDate={daysAgo(0)} feedings={{ elite: 1 }} />);
      expect(screen.queryByTestId('pregnancy-counter-basic')).toBeNull();
      expect(screen.queryByTestId('pregnancy-counter-performance')).toBeNull();
      expect(screen.getByTestId('pregnancy-counter-elite')).toBeInTheDocument();
    });

    it('renders empty state hint when no feedings at all', () => {
      render(<PregnancyFeedingPanel inFoalSinceDate={daysAgo(0)} feedings={{}} />);
      // Just verify the panel still renders and doesn't crash on empty feedings.
      expect(screen.getByTestId('pregnancy-feeding-panel')).toBeInTheDocument();
    });
  });

  describe('bonus preview', () => {
    it('renders correct positive/negative for 5×elite + 2 missed (14.3% / 10%)', () => {
      render(<PregnancyFeedingPanel inFoalSinceDate={daysAgo(5)} feedings={{ elite: 5 }} />);
      const positive = screen.getByTestId('pregnancy-positive-chance');
      const negative = screen.getByTestId('pregnancy-negative-chance');
      expect(positive.textContent).toMatch(/14\.3\s*%/);
      expect(negative.textContent).toMatch(/10\s*%/);
    });

    it('renders 0% positive / 35% negative for zero feedings', () => {
      render(<PregnancyFeedingPanel inFoalSinceDate={daysAgo(0)} feedings={{}} />);
      expect(screen.getByTestId('pregnancy-positive-chance').textContent).toMatch(/0(\.0)?\s*%/);
      expect(screen.getByTestId('pregnancy-negative-chance').textContent).toMatch(/35\s*%/);
    });

    it('renders 20% positive for 7×elite (gestation cap, no missed days)', () => {
      render(<PregnancyFeedingPanel inFoalSinceDate={daysAgo(6)} feedings={{ elite: 7 }} />);
      expect(screen.getByTestId('pregnancy-positive-chance').textContent).toMatch(/20(\.0)?\s*%/);
      expect(screen.getByTestId('pregnancy-negative-chance').textContent).toMatch(/0\s*%/);
    });
  });

  describe('overdue (foaling job pending)', () => {
    it('shows an "awaiting foaling" indicator at exactly 7 days elapsed', () => {
      render(<PregnancyFeedingPanel inFoalSinceDate={daysAgo(7)} feedings={{ elite: 7 }} />);
      const remaining = screen.getByTestId('pregnancy-days-remaining');
      // At day 7+, the foaling job will run; UI tells the player it's imminent.
      expect(remaining.textContent ?? '').toMatch(/[Ff]oaling (imminent|due|awaiting)/);
    });

    it("shows the same imminent indicator at 8+ days (job hasn't run yet)", () => {
      render(<PregnancyFeedingPanel inFoalSinceDate={daysAgo(8)} feedings={{ elite: 7 }} />);
      expect(screen.getByTestId('pregnancy-days-remaining').textContent ?? '').toMatch(
        /[Ff]oaling (imminent|due|awaiting)/
      );
    });
  });

  describe('sire lookup', () => {
    it('displays the sire name when sireName prop is provided', () => {
      render(
        <PregnancyFeedingPanel
          inFoalSinceDate={daysAgo(1)}
          feedings={{ performance: 1 }}
          sireName="Stormcrow"
        />
      );
      const sire = screen.getByTestId('pregnancy-sire-name');
      expect(sire.textContent).toMatch(/Stormcrow/);
    });

    it('renders a fallback "Unknown sire" when sireName is missing but pregnancySireId exists', () => {
      render(
        <PregnancyFeedingPanel
          inFoalSinceDate={daysAgo(1)}
          feedings={{ performance: 1 }}
          pregnancySireId={42}
        />
      );
      const sire = screen.getByTestId('pregnancy-sire-name');
      // Either renders the ID or "Unknown" — but the slot must be present.
      expect(sire.textContent ?? '').toMatch(/(Unknown|#?42)/);
    });

    it('omits the sire row entirely when no sire info is supplied', () => {
      render(<PregnancyFeedingPanel inFoalSinceDate={daysAgo(1)} feedings={{ performance: 1 }} />);
      expect(screen.queryByTestId('pregnancy-sire-name')).toBeNull();
    });
  });

  describe('panel structure', () => {
    it('renders the root panel testid when in foal', () => {
      render(<PregnancyFeedingPanel inFoalSinceDate={daysAgo(2)} feedings={{}} />);
      const panel = screen.getByTestId('pregnancy-feeding-panel');
      expect(panel).toBeInTheDocument();
      // All key data slots present and scoped within the panel.
      expect(within(panel).getByTestId('pregnancy-days-remaining')).toBeInTheDocument();
      expect(within(panel).getByTestId('pregnancy-positive-chance')).toBeInTheDocument();
      expect(within(panel).getByTestId('pregnancy-negative-chance')).toBeInTheDocument();
    });
  });
});
