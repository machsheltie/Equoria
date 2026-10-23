/**
 * HealthBadge Sentinel Tests (Equoria-hfep, Rehab Phase 3 A13-A17)
 *
 * OPTIMAL_FIX_DISCIPLINE.md §2: positive test that the check FIRES.
 *
 * Owner ruling 2026-10-23 (Equoria-u0jop): health shows as exactly Excellent,
 * Very Good, Good, Fair or Bad (Poor, Bad and Critical all show as Bad), and a
 * horse must be Fair or better to breed, train or enter a show. Old contract:
 * six lowercase bands (excellent / good / fair / poor / critical / retired)
 * and a warning only for 'critical'.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HealthBadge } from '../HealthBadge';

describe('HealthBadge — the five health words', () => {
  const BANDS: Array<{ band: string; word: string; expectedClass: string }> = [
    { band: 'Excellent', word: 'Excellent', expectedClass: 'bg-emerald-500/20' },
    { band: 'Very Good', word: 'Very Good', expectedClass: 'bg-green-500/20' },
    { band: 'Good', word: 'Good', expectedClass: 'bg-green-500/20' },
    { band: 'Fair', word: 'Fair', expectedClass: 'bg-yellow-500/20' },
    { band: 'Bad', word: 'Bad', expectedClass: 'bg-red-500/20' },
  ];

  it.each(BANDS)('$band shows "$word" with $expectedClass', ({ band, word, expectedClass }) => {
    render(<HealthBadge band={band} />);
    const badge = screen.getByTestId('health-badge');
    expect(badge).toHaveTextContent(word);
    expect(badge.className).toContain(expectedClass);
  });

  it.each(['poor', 'critical', 'Critical', 'Poor'])('a stored "%s" shows as Bad', (band) => {
    render(<HealthBadge band={band} />);
    expect(screen.getByTestId('health-badge')).toHaveTextContent('Bad');
  });

  it('shows Retired for a retired horse', () => {
    render(<HealthBadge band="retired" />);
    const badge = screen.getByTestId('health-badge');
    expect(badge).toHaveTextContent('Retired');
    expect(badge.className).toContain('bg-purple-500/20');
  });

  it('uses the label prop when provided', () => {
    render(<HealthBadge band="Good" label="Healthy" />);
    expect(screen.getByTestId('health-badge')).toHaveTextContent('Healthy');
  });
});

describe('HealthBadge — Bad health warning', () => {
  it('shows the Fair-or-better warning when health is Bad and the warning is asked for', () => {
    render(<HealthBadge band="Bad" showBadHealthWarning />);
    expect(screen.getByTestId('bad-health-warning')).toHaveTextContent(
      'Cannot breed, train or show until Fair or better. Feed and vet to restore health.'
    );
  });

  it('shows the warning for a stored Poor too (Poor is Bad)', () => {
    render(<HealthBadge band="poor" showBadHealthWarning />);
    expect(screen.getByTestId('bad-health-warning')).toBeInTheDocument();
  });

  it('does NOT show the warning when it is not asked for', () => {
    render(<HealthBadge band="Bad" />);
    expect(screen.queryByTestId('bad-health-warning')).not.toBeInTheDocument();
  });

  it('does NOT show the warning for Fair health', () => {
    render(<HealthBadge band="Fair" showBadHealthWarning />);
    expect(screen.queryByTestId('bad-health-warning')).not.toBeInTheDocument();
  });
});
