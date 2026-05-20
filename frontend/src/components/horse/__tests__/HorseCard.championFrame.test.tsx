/**
 * HorseCard championship-frame sentinel (Equoria-55bo.6)
 *
 * Spec 11.3.13 reserves the ornate GoldBorderFrame for championship horses.
 * The non-HoF stable/dashboard cards consume the base useHorses() list
 * payload, which now carries a REAL per-card championship signal
 * (`hasChampionship`, derived by the GET /horses serializer from the horse's
 * actual 1st-place CompetitionResult rows — NOT a hardcoded flag, 21R).
 *
 * Per OPTIMAL_FIX_DISCIPLINE.md §2 — sentinel-positive: the positive test
 * plants hasChampionship:true and asserts the frame wrapper IS rendered AND
 * the GoldBorderFrame's decorative gold corners are present inside it (proves
 * the frame is visually applied, not merely imported). The negative tests
 * (false / undefined) prove a non-champion card stays bare — without them the
 * frame could always render and still pass the positive test.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HorseCard } from '../HorseCard';
import type { HorseSummary } from '@/lib/api-client';

function makeHorse(overrides: Partial<HorseSummary> = {}): HorseSummary {
  return {
    id: 7,
    name: 'FrameTest',
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

describe('HorseCard championship frame (Equoria-55bo.6)', () => {
  it('wraps the card in GoldBorderFrame when hasChampionship is true', () => {
    render(
      <HorseCard
        horse={makeHorse({ id: 7, hasChampionship: true, firstPlaceWins: 2 })}
        onClick={() => {}}
      />
    );
    const frame = screen.getByTestId('horse-card-champion-frame-7');
    expect(frame).toBeInTheDocument();
    // The actual card must live inside the frame wrapper.
    expect(within(frame).getByTestId('horse-card')).toBeInTheDocument();
    // GoldBorderFrame draws 4 aria-hidden decorative corner nodes — assert
    // they are present so the frame is visually applied, not just a wrapper.
    const corners = frame.querySelectorAll('.gold-corner-animate');
    expect(corners.length).toBe(4);
  });

  it('does NOT wrap the card when hasChampionship is false', () => {
    render(
      <HorseCard
        horse={makeHorse({ id: 7, hasChampionship: false, firstPlaceWins: 0 })}
        onClick={() => {}}
      />
    );
    expect(screen.queryByTestId('horse-card-champion-frame-7')).not.toBeInTheDocument();
    // The card itself still renders, just without the frame.
    expect(screen.getByTestId('horse-card')).toBeInTheDocument();
    expect(document.querySelectorAll('.gold-corner-animate').length).toBe(0);
  });

  it('does NOT wrap the card when hasChampionship is undefined (legacy payload)', () => {
    render(<HorseCard horse={makeHorse({ id: 7 })} onClick={() => {}} />);
    expect(screen.queryByTestId('horse-card-champion-frame-7')).not.toBeInTheDocument();
    expect(screen.getByTestId('horse-card')).toBeInTheDocument();
  });
});
