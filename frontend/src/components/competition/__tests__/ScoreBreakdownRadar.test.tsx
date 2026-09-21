/**
 * ScoreBreakdownRadar — Stat Constellation tests (Equoria-d6a47)
 *
 * The Recharts RadarChart was replaced by an authored inline-SVG stat
 * constellation (owner ruling Equoria-ij7ev, 2026-09-11) that also serves the
 * predicted foal profile in breeding. These tests assert the constellation's
 * substance with real, non-empty stats:
 * - one star per stat, carrying the stat's name and value
 * - a higher value sits farther from the centre than a lower one
 * - the personal-best figure appears only when supplied, with its legend
 * - values are exposed to assistive tech as text
 * - the honest empty state when there are no stats to place
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScoreBreakdownRadar } from '../ScoreBreakdownRadar';

const sampleStats = {
  speed: 80,
  stamina: 75,
  agility: 70,
  balance: 65,
  precision: 60,
};

const personalBest = { speed: 90, stamina: 85, agility: 80, balance: 75, precision: 70 };

describe('ScoreBreakdownRadar (stat constellation)', () => {
  it('renders an inline SVG constellation, not a chart library', () => {
    render(<ScoreBreakdownRadar stats={sampleStats} />);
    const figure = screen.getByTestId('stat-constellation');
    expect(figure.tagName).toBe('FIGURE');
    expect(figure.querySelector('svg')).not.toBeNull();
  });

  it('places one star per stat, each carrying its name and value', () => {
    render(<ScoreBreakdownRadar stats={sampleStats} />);
    const stars = screen.getAllByTestId(/^constellation-star-/);
    expect(stars.length).toBeGreaterThan(0);
    expect(stars).toHaveLength(5);

    const speed = screen.getByTestId('constellation-star-speed');
    expect(speed).toHaveAttribute('data-value', '80');
    expect(speed).toHaveTextContent('Speed');
    expect(speed).toHaveTextContent('80');

    const precision = screen.getByTestId('constellation-star-precision');
    expect(precision).toHaveAttribute('data-value', '60');
    expect(precision).toHaveTextContent('Precision');
  });

  it('sets a higher value farther from the centre than a lower one', () => {
    render(<ScoreBreakdownRadar stats={sampleStats} />);
    const radius = (id: string) =>
      Number(screen.getByTestId(`constellation-star-${id}`).getAttribute('data-radius'));
    expect(radius('speed')).toBeGreaterThan(radius('stamina'));
    expect(radius('stamina')).toBeGreaterThan(radius('precision'));
  });

  it('clamps a value above maxValue to the outer reach', () => {
    render(<ScoreBreakdownRadar stats={{ speed: 140, stamina: 100 }} maxValue={100} />);
    const speed = Number(
      screen.getByTestId('constellation-star-speed').getAttribute('data-radius')
    );
    const stamina = Number(
      screen.getByTestId('constellation-star-stamina').getAttribute('data-radius')
    );
    expect(speed).toBe(stamina);
  });

  it('slugs multi-word stat keys so every star is addressable', () => {
    render(<ScoreBreakdownRadar stats={{ 'Base Stat': 77.5, Luck: -2 }} />);
    const base = screen.getByTestId('constellation-star-base-stat');
    expect(base).toHaveAttribute('data-value', '77.5');
    expect(base).toHaveTextContent('Base Stat');
    // A negative value is still placed (at the inner reach) and still read.
    expect(screen.getByTestId('constellation-star-luck')).toHaveTextContent('-2');
  });

  it('exposes every value as text for assistive technology', () => {
    render(<ScoreBreakdownRadar stats={sampleStats} />);
    const list = screen.getByTestId('constellation-values');
    const terms = within(list).getAllByRole('term');
    expect(terms.map((t) => t.textContent)).toEqual([
      'Speed',
      'Stamina',
      'Agility',
      'Balance',
      'Precision',
    ]);
    const values = within(list).getAllByRole('definition');
    expect(values[0]).toHaveTextContent('80 of 100');
    expect(values[4]).toHaveTextContent('60 of 100');
  });

  describe('personal best', () => {
    it('renders the personal-best figure and legend only when supplied', () => {
      render(<ScoreBreakdownRadar stats={sampleStats} personalBest={personalBest} />);
      const bests = screen.getAllByTestId(/^constellation-best-/);
      expect(bests).toHaveLength(5);
      expect(screen.getByTestId('constellation-best-speed')).toHaveAttribute('data-value', '90');
      expect(screen.getByTestId('constellation-legend')).toHaveTextContent(/personal best/i);
      expect(screen.getByTestId('constellation-values')).toHaveTextContent('personal best 90');
    });

    it('omits the personal-best figure and legend when not supplied', () => {
      render(<ScoreBreakdownRadar stats={sampleStats} />);
      expect(screen.queryAllByTestId(/^constellation-best-/)).toHaveLength(0);
      expect(screen.queryByTestId('constellation-legend')).not.toBeInTheDocument();
    });
  });

  describe('title and size', () => {
    it('displays the title as the figure caption when provided', () => {
      render(<ScoreBreakdownRadar stats={sampleStats} title="Predicted offspring profile" />);
      const figure = screen.getByRole('figure', { name: 'Predicted offspring profile' });
      expect(figure).toBeInTheDocument();
    });

    it('does not display a caption when no title is provided', () => {
      render(<ScoreBreakdownRadar stats={sampleStats} />);
      expect(screen.getByTestId('stat-constellation').querySelector('figcaption')).toBeNull();
    });

    it('honours the height prop and defaults to 280', () => {
      const { unmount } = render(<ScoreBreakdownRadar stats={sampleStats} height={200} />);
      expect(screen.getByTestId('stat-constellation').querySelector('svg')).toHaveAttribute(
        'height',
        '200'
      );
      unmount();
      render(<ScoreBreakdownRadar stats={sampleStats} />);
      expect(screen.getByTestId('stat-constellation').querySelector('svg')).toHaveAttribute(
        'height',
        '280'
      );
    });
  });

  it('renders an honest empty state, and no stars, when there are no stats', () => {
    render(<ScoreBreakdownRadar stats={{}} />);
    expect(screen.getByTestId('constellation-empty')).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^constellation-star-/)).toHaveLength(0);
  });
});
