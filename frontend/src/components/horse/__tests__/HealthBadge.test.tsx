/**
 * HealthBadge Sentinel Tests (Equoria-hfep, Rehab Phase 3 A13-A17)
 *
 * OPTIMAL_FIX_DISCIPLINE.md §2: positive test that the check FIRES.
 * Verifies each band renders the correct colour class and that the
 * critical-warning only appears when band=critical AND showCriticalWarning=true.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HealthBadge } from '../HealthBadge';

describe('HealthBadge — colour bands', () => {
  const BANDS: Array<{ band: Parameters<typeof HealthBadge>[0]['band']; expectedClass: string }> = [
    { band: 'excellent', expectedClass: 'bg-emerald-500/20' },
    { band: 'good', expectedClass: 'bg-green-500/20' },
    { band: 'fair', expectedClass: 'bg-yellow-500/20' },
    { band: 'poor', expectedClass: 'bg-orange-500/20' },
    { band: 'critical', expectedClass: 'bg-red-500/20' },
    { band: 'retired', expectedClass: 'bg-purple-500/20' },
  ];

  it.each(BANDS)(
    '$band band renders correct colour class ($expectedClass)',
    ({ band, expectedClass }) => {
      render(<HealthBadge band={band} />);
      const badge = screen.getByTestId('health-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain(expectedClass);
    }
  );

  it('uses the label prop when provided', () => {
    render(<HealthBadge band="good" label="Healthy" />);
    expect(screen.getByTestId('health-badge')).toHaveTextContent('Healthy');
  });

  it('falls back to band name when no label', () => {
    render(<HealthBadge band="fair" />);
    expect(screen.getByTestId('health-badge')).toHaveTextContent('fair');
  });
});

describe('HealthBadge — critical warning', () => {
  it('shows critical warning when band=critical and showCriticalWarning=true', () => {
    render(<HealthBadge band="critical" showCriticalWarning />);
    expect(screen.getByTestId('critical-warning')).toBeInTheDocument();
    expect(screen.getByTestId('critical-warning')).toHaveTextContent('Cannot breed or compete');
  });

  it('does NOT show critical warning when band=critical and showCriticalWarning is omitted', () => {
    render(<HealthBadge band="critical" />);
    expect(screen.queryByTestId('critical-warning')).not.toBeInTheDocument();
  });

  it('does NOT show critical warning when band is non-critical even with showCriticalWarning=true', () => {
    render(<HealthBadge band="good" showCriticalWarning />);
    expect(screen.queryByTestId('critical-warning')).not.toBeInTheDocument();
  });
});
