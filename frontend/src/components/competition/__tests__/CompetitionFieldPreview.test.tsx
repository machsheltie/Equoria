/**
 * CompetitionFieldPreview Component Tests
 *
 * Tests the show entry status card with scout expandable section.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { CompetitionFieldPreview } from '../CompetitionFieldPreview';

// Mock recharts (used by ScoreBreakdownRadar in scout view)
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  RadarChart: ({ children }: any) => <svg>{children}</svg>,
  PolarGrid: () => <g />,
  PolarAngleAxis: () => <g />,
  PolarRadiusAxis: () => <g />,
  Radar: () => <g />,
  Tooltip: () => <g />,
  Legend: () => <g />,
}));

const baseShow = {
  id: 1,
  name: 'Spring Championship',
  discipline: 'Dressage',
  entryFee: 500,
  maxEntries: 20,
  entryCount: 12,
  closeDate: '2026-04-01T00:00:00Z',
  status: 'open',
};

const mockEntries = [
  { id: 1, name: 'Thunder', breed: 'Thoroughbred', stats: { speed: 85, stamina: 70 } },
  { id: 2, name: 'Lightning', breed: 'Arabian' },
];

describe('CompetitionFieldPreview', () => {
  it('renders with correct data-testid', () => {
    render(<CompetitionFieldPreview show={baseShow} />);
    expect(screen.getByTestId('competition-field-preview')).toBeInTheDocument();
  });

  it('displays show name and discipline', () => {
    render(<CompetitionFieldPreview show={baseShow} />);
    expect(screen.getByText('Spring Championship')).toBeInTheDocument();
    expect(screen.getByText('Dressage')).toBeInTheDocument();
  });

  it('displays entry count with max entries', () => {
    render(<CompetitionFieldPreview show={baseShow} />);
    expect(screen.getByText('12 / 20')).toBeInTheDocument();
  });

  it('shows entry count without max when maxEntries is null', () => {
    const showNoMax = { ...baseShow, maxEntries: null };
    render(<CompetitionFieldPreview show={showNoMax} />);
    expect(screen.getByText('12 entries')).toBeInTheDocument();
  });

  it('shows full capacity indicator when count >= max', () => {
    const fullShow = { ...baseShow, entryCount: 20 };
    render(<CompetitionFieldPreview show={fullShow} />);
    const countText = screen.getByText('20 / 20');
    // Full capacity: red styling on the count text
    expect(countText.className).toContain('text-red-400');
  });

  it('displays entry fee', () => {
    render(<CompetitionFieldPreview show={baseShow} />);
    expect(screen.getByText('500 gold')).toBeInTheDocument();
  });

  it('does not display entry fee when 0', () => {
    const freeShow = { ...baseShow, entryFee: 0 };
    render(<CompetitionFieldPreview show={freeShow} />);
    expect(screen.queryByText(/gold/)).not.toBeInTheDocument();
  });

  describe('Scout the Field', () => {
    it('does not show scout button when no entries provided', () => {
      render(<CompetitionFieldPreview show={baseShow} />);
      expect(screen.queryByText(/Scout the Field/)).not.toBeInTheDocument();
    });

    it('shows scout button when entries are provided', () => {
      render(<CompetitionFieldPreview show={baseShow} entries={mockEntries} />);
      expect(screen.getByText(/Scout the Field/)).toBeInTheDocument();
    });

    it('toggles scout details on button click', () => {
      render(<CompetitionFieldPreview show={baseShow} entries={mockEntries} />);

      // Initially hidden
      expect(screen.queryByText('Thunder')).not.toBeInTheDocument();

      // Click to show
      fireEvent.click(screen.getByText(/Scout the Field/));
      expect(screen.getByText('Thunder')).toBeInTheDocument();
      expect(screen.getByText('Lightning')).toBeInTheDocument();

      // Click to hide
      fireEvent.click(screen.getByText('Hide Field'));
      expect(screen.queryByText('Thunder')).not.toBeInTheDocument();
    });

    it('shows aria-expanded attribute on scout button', () => {
      render(<CompetitionFieldPreview show={baseShow} entries={mockEntries} />);
      const button = screen.getByText(/Scout the Field/).closest('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(button!);
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('exposes the scouted entry list with role=list / listitem semantics', () => {
      render(<CompetitionFieldPreview show={baseShow} entries={mockEntries} />);
      fireEvent.click(screen.getByText(/Scout the Field/));

      const list = screen.getByRole('list', { name: /entered horses/i });
      expect(list).toBeInTheDocument();
      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(mockEntries.length);
    });

    it('includes stat values in each listitem aria-label', () => {
      render(<CompetitionFieldPreview show={baseShow} entries={mockEntries} />);
      fireEvent.click(screen.getByText(/Scout the Field/));

      // Thunder has stats { speed: 85, stamina: 70 } — those values must be
      // present in the accessible name so screen-reader users get the data.
      const thunderItem = screen.getByRole('listitem', { name: /Thunder/ });
      expect(thunderItem).toHaveAccessibleName(/speed 85/i);
      expect(thunderItem).toHaveAccessibleName(/stamina 70/i);

      // Lightning has no stats — label should still be meaningful (no crash,
      // no "undefined"), and must NOT fabricate stat numbers.
      const lightningItem = screen.getByRole('listitem', { name: /Lightning/ });
      expect(lightningItem).toHaveAccessibleName(/Arabian/);
      expect(lightningItem.getAttribute('aria-label')).not.toMatch(/undefined|NaN/);
    });
  });

  describe('compact variant', () => {
    it('renders a condensed card when variant="compact"', () => {
      render(<CompetitionFieldPreview show={baseShow} variant="compact" />);
      const card = screen.getByTestId('competition-field-preview');
      expect(card).toHaveAttribute('data-variant', 'compact');
      // Still shows core info (name + entry count) in compact form
      expect(screen.getByText('Spring Championship')).toBeInTheDocument();
      expect(screen.getByText('12 / 20')).toBeInTheDocument();
    });

    it('defaults to the full variant when no variant prop given', () => {
      render(<CompetitionFieldPreview show={baseShow} />);
      expect(screen.getByTestId('competition-field-preview')).toHaveAttribute(
        'data-variant',
        'full'
      );
    });

    it('compact variant still exposes accessible scouted list with stat labels', () => {
      render(<CompetitionFieldPreview show={baseShow} entries={mockEntries} variant="compact" />);
      fireEvent.click(screen.getByText(/Scout the Field/));
      expect(screen.getByRole('list', { name: /entered horses/i })).toBeInTheDocument();
      const thunderItem = screen.getByRole('listitem', { name: /Thunder/ });
      expect(thunderItem).toHaveAccessibleName(/speed 85/i);
    });
  });
});
