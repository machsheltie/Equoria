/**
 * DevelopmentTracker Component Tests
 *
 * Tests the foal development tracker with age stage computation,
 * bond score bar, and activity cards.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

  describe('Age stage computation', () => {
    it('shows newborn stage for foal < 4 weeks old', () => {
      // 9 days old = ~1.3 weeks = newborn
      render(<DevelopmentTracker foalName="Foal" dateOfBirth="2026-03-01T00:00:00Z" />);
      expect(screen.getByText('Stage 1 / 4')).toBeInTheDocument();
    });

    it('shows weanling stage for foal 4-26 weeks old', () => {
      // 8 weeks ago
      const dob = new Date('2026-01-13T00:00:00Z').toISOString();
      render(<DevelopmentTracker foalName="Foal" dateOfBirth={dob} />);
      expect(screen.getByText('Stage 2 / 4')).toBeInTheDocument();
    });

    it('shows yearling stage for foal 26-52 weeks old', () => {
      // 30 weeks ago
      const dob = new Date(Date.now() - 30 * 7 * 24 * 60 * 60 * 1000).toISOString();
      render(<DevelopmentTracker foalName="Foal" dateOfBirth={dob} />);
      expect(screen.getByText('Stage 3 / 4')).toBeInTheDocument();
    });

    it('shows 2-year-old stage for foal 52-104 weeks old', () => {
      // 60 weeks ago
      const dob = new Date(Date.now() - 60 * 7 * 24 * 60 * 60 * 1000).toISOString();
      render(<DevelopmentTracker foalName="Foal" dateOfBirth={dob} />);
      expect(screen.getByText('Stage 4 / 4')).toBeInTheDocument();
    });

    it('shows graduated state (trophy) for foal 104+ weeks old', () => {
      // 110 weeks ago
      const dob = new Date(Date.now() - 110 * 7 * 24 * 60 * 60 * 1000).toISOString();
      render(<DevelopmentTracker foalName="Foal" dateOfBirth={dob} />);
      expect(screen.getByText('Graduated')).toBeInTheDocument();
      expect(screen.getByText('Development Complete')).toBeInTheDocument();
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

  describe('Activity cards', () => {
    it('renders activity cards for newborn stage', () => {
      render(<DevelopmentTracker foalName="Foal" dateOfBirth="2026-03-01T00:00:00Z" />);
      // Desktop and mobile both render activities — use getAllByText
      const imprintingCards = screen.getAllByText('Imprinting');
      expect(imprintingCards.length).toBeGreaterThanOrEqual(1);
      const gentleCards = screen.getAllByText('Gentle Handling');
      expect(gentleCards.length).toBeGreaterThanOrEqual(1);
    });

    it('calls onActivitySelect when activity card is clicked', () => {
      const onSelect = vi.fn();
      render(
        <DevelopmentTracker
          foalName="Foal"
          dateOfBirth="2026-03-01T00:00:00Z"
          onActivitySelect={onSelect}
        />
      );
      // Click the first (desktop) activity card
      const imprintingCards = screen.getAllByText('Imprinting');
      fireEvent.click(imprintingCards[0]);
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'imprinting', label: 'Imprinting' })
      );
    });
  });

  it('does not show activities for graduated foals', () => {
    const dob = new Date(Date.now() - 110 * 7 * 24 * 60 * 60 * 1000).toISOString();
    render(<DevelopmentTracker foalName="Foal" dateOfBirth={dob} />);
    // No activity cards should be present
    expect(screen.queryByText('Imprinting')).not.toBeInTheDocument();
    expect(screen.queryByText('Ground Work')).not.toBeInTheDocument();
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
