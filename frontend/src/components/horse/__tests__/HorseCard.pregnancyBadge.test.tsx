/**
 * HorseCard in-foal badge sentinel (Equoria-yyn7).
 *
 * Pins the contract: a mare with inFoalSinceDate set shows a visible
 * in-foal indicator on the card with a days-remaining tooltip, and the
 * indicator is ABSENT for a horse with no inFoalSinceDate.
 *
 * Per OPTIMAL_FIX_DISCIPLINE.md §2 — sentinel-positive: each test plants a
 * specific state and asserts the visible outcome. The negative branch
 * guards against the badge always rendering.
 *
 * No new API call: the badge consumes the existing inFoalSinceDate field
 * already present in the horse list payload (api-client HorseSummary).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HorseCard } from '../HorseCard';
import type { HorseSummary } from '@/lib/api-client';

function makeHorse(overrides: Partial<HorseSummary> = {}): HorseSummary {
  return {
    id: 1,
    name: 'PregTest',
    breed: 'Thoroughbred',
    age: 5,
    sex: 'Mare',
    imageUrl: null as unknown as string,
    healthStatus: 'Excellent',
    stats: {
      speed: 50,
      stamina: 50,
      agility: 50,
      strength: 50,
      intelligence: 50,
      precision: 50,
      balance: 50,
      boldness: 50,
      flexibility: 50,
      obedience: 50,
      focus: 50,
      endurance: 50,
    },
    ...overrides,
  } as HorseSummary;
}

describe('HorseCard in-foal badge (Equoria-yyn7)', () => {
  it('renders the in-foal badge with days-remaining tooltip when inFoalSinceDate is set', () => {
    // Started 2 days ago → 5 days remaining of a 7-day gestation.
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    render(
      <HorseCard horse={makeHorse({ inFoalSinceDate: twoDaysAgo })} onClick={() => {}} />
    );
    const badge = screen.getByTestId('horse-card-pregnancy-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute('title')).toMatch(/5 days remaining/i);
  });

  it('shows "imminent" when the gestation window has fully elapsed', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    render(
      <HorseCard horse={makeHorse({ inFoalSinceDate: tenDaysAgo })} onClick={() => {}} />
    );
    const badge = screen.getByTestId('horse-card-pregnancy-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute('title')).toMatch(/imminent/i);
  });

  it('does NOT render the badge when inFoalSinceDate is absent (negative branch)', () => {
    render(<HorseCard horse={makeHorse({ inFoalSinceDate: null })} onClick={() => {}} />);
    expect(screen.queryByTestId('horse-card-pregnancy-badge')).not.toBeInTheDocument();
  });

  it('does NOT render the badge when inFoalSinceDate is an unparseable string', () => {
    render(
      <HorseCard horse={makeHorse({ inFoalSinceDate: 'not-a-date' })} onClick={() => {}} />
    );
    expect(screen.queryByTestId('horse-card-pregnancy-badge')).not.toBeInTheDocument();
  });
});
