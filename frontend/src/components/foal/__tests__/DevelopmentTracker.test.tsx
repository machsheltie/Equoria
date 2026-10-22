/**
 * DevelopmentTracker Component Tests
 *
 * Tests the foal development tracker's bond score bar. It carries no player
 * activity cards and no graduated state (Equoria-fr2kg), and no named life
 * stages (Equoria-fr2kg Q5).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DevelopmentTracker } from '../DevelopmentTracker';

describe('DevelopmentTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fix "now" to a known date
    vi.setSystemTime(new Date('2026-03-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with correct data-testid', () => {
    render(<DevelopmentTracker foalName="Little Star" dateOfBirth="2026-03-01T00:00:00Z" />);
    expect(screen.getByTestId('development-tracker')).toBeInTheDocument();
  });

  it('displays foal name', () => {
    render(<DevelopmentTracker foalName="Little Star" dateOfBirth="2026-03-01T00:00:00Z" />);
    expect(screen.getByText('Little Star')).toBeInTheDocument();
  });

  // Equoria-fr2kg Q5. OLD CONTRACT: the tracker derived a named life stage
  // from a real-week clock (Newborn 0–4 wk, Weanling 4–26, Yearling 26–52,
  // 2-Year-Old 52–104), drew a four-stage timeline with "Complete"/"Upcoming"
  // marks and a "Stage N / 4" badge, and on phones a stage card with
  // previous/next navigation. NEW RULING (owner, 2026-10-15): the named life
  // stages are not part of the design; remove them. No stage UI renders at
  // any age.
  describe('No named life stages', () => {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    // dateOfBirth is no longer a prop; it is still passed here, as the old
    // contract did, so a stage clock re-derived from it would be caught.

    it.each([1, 8, 30, 60, 110])('renders no stage timeline at %i weeks old', (weeks) => {
      const dob = new Date(Date.now() - weeks * weekMs).toISOString();
      render(<DevelopmentTracker foalName="Foal" dateOfBirth={dob} />);
      expect(screen.queryByText(/Stage \d+ \/ \d+/)).not.toBeInTheDocument();
      for (const label of ['Newborn', 'Weanling', 'Yearling', '2-Year-Old', 'Current Stage']) {
        expect(screen.queryByText(label)).not.toBeInTheDocument();
      }
      expect(screen.queryByText(/\d+–\d+ wk/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /stage/i })).not.toBeInTheDocument();
    });

    // Equoria-fr2kg. OLD CONTRACT: a foal past 104 weeks showed a
    // "Graduated" badge and a "Development Complete … graduated from the foal
    // development programme" panel. NEW RULING (owner, 2026-10-14/15): there
    // is no graduation, so no graduated state renders at any age.
    it('shows no graduated state for a foal past 104 weeks', () => {
      // 110 weeks ago
      const dob = new Date(Date.now() - 110 * weekMs).toISOString();
      render(<DevelopmentTracker foalName="Foal" dateOfBirth={dob} />);
      expect(screen.queryByText(/graduat/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Development Complete')).not.toBeInTheDocument();
    });
  });

  describe('Bond score bar', () => {
    it('displays bond score value', () => {
      render(
        <DevelopmentTracker foalName="Foal" dateOfBirth="2026-03-01T00:00:00Z" bondScore={65} />
      );
      // Desktop and mobile both render bond score — use getAllByText
      const bondValues = screen.getAllByText('65');
      expect(bondValues.length).toBeGreaterThanOrEqual(1);
    });

    it('renders bond score progressbar with ARIA attributes', () => {
      render(
        <DevelopmentTracker foalName="Foal" dateOfBirth="2026-03-01T00:00:00Z" bondScore={75} />
      );
      // Desktop and mobile both render progressbar
      const progressbars = screen.getAllByRole('progressbar');
      expect(progressbars.length).toBeGreaterThanOrEqual(1);
      expect(progressbars[0]).toHaveAttribute('aria-valuenow', '75');
      expect(progressbars[0]).toHaveAttribute('aria-valuemin', '0');
      expect(progressbars[0]).toHaveAttribute('aria-valuemax', '100');
    });

    it('defaults bond score to 0 when not provided', () => {
      render(<DevelopmentTracker foalName="Foal" dateOfBirth="2026-03-01T00:00:00Z" />);
      const progressbars = screen.getAllByRole('progressbar');
      expect(progressbars[0]).toHaveAttribute('aria-valuenow', '0');
    });
  });

  // Equoria-fr2kg. OLD CONTRACT: each stage listed player-selectable
  // activity cards (Imprinting, Gentle Handling, …) that called
  // onActivitySelect. NEW RULING (owner, 2026-10-14/15): grooms, not players,
  // do the foal's activities, so the tracker lists none.
  it('renders no player activity cards', () => {
    render(<DevelopmentTracker foalName="Foal" dateOfBirth="2026-03-01T00:00:00Z" />);
    expect(screen.queryByText('Imprinting')).not.toBeInTheDocument();
    expect(screen.queryByText('Gentle Handling')).not.toBeInTheDocument();
    expect(screen.queryByText(/available activities/i)).not.toBeInTheDocument();
  });

  it('displays last interaction date when provided', () => {
    render(
      <DevelopmentTracker
        foalName="Foal"
        dateOfBirth="2026-03-01T00:00:00Z"
        lastInteractionAt="2026-03-09T10:00:00Z"
      />
    );
    expect(screen.getByText(/Last interaction/)).toBeInTheDocument();
  });
});
