/**
 * HorseCard color-chip sentinel (Equoria-fhag layer 1).
 *
 * Pins the contract: the horse-card-color-chip data-testid IS rendered when
 * phenotype.colorName is a non-empty string, AND falls back to
 * finalDisplayColor before disappearing. This is the regression sentinel for
 * the 2026-04-30 → 2026-05-04 "all horses Unknown" bug class — the bug
 * existed for months without anyone catching it because no test asserted
 * the chip's presence + content.
 *
 * Per OPTIMAL_FIX_DISCIPLINE.md §2 — sentinel-positive: each test plants a
 * specific state and asserts the visible outcome. The "absent when both
 * fields are absent" test is the negative branch; without it the chip
 * could always render a hardcoded value and still pass the positive tests.
 *
 * Tied to HorseCard.tsx:130:
 *   const colorName = horse.phenotype?.colorName ?? horse.finalDisplayColor ?? null;
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HorseCard } from '../HorseCard';
import type { HorseSummary } from '@/lib/api-client';

function makeHorse(overrides: Partial<HorseSummary> = {}): HorseSummary {
  return {
    id: 1,
    name: 'ChipTest',
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

describe('HorseCard color chip (Equoria-fhag layer 1)', () => {
  it('renders the color chip with phenotype.colorName when present', () => {
    render(<HorseCard horse={makeHorse({ phenotype: { colorName: 'Bay' } })} onClick={() => {}} />);
    const chip = screen.getByTestId('horse-card-color-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('Bay');
  });

  it('falls back to finalDisplayColor when phenotype is absent', () => {
    render(
      <HorseCard
        horse={makeHorse({ phenotype: null, finalDisplayColor: 'Chestnut' })}
        onClick={() => {}}
      />
    );
    const chip = screen.getByTestId('horse-card-color-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('Chestnut');
  });

  it('phenotype.colorName wins over finalDisplayColor when both are set', () => {
    render(
      <HorseCard
        horse={makeHorse({
          phenotype: { colorName: 'Palomino' },
          finalDisplayColor: 'Bay',
        })}
        onClick={() => {}}
      />
    );
    const chip = screen.getByTestId('horse-card-color-chip');
    expect(chip).toHaveTextContent('Palomino');
    expect(chip).not.toHaveTextContent(/^Bay$/);
  });

  it('does NOT render the chip when both fields are absent (negative branch)', () => {
    render(
      <HorseCard
        horse={makeHorse({ phenotype: null, finalDisplayColor: undefined })}
        onClick={() => {}}
      />
    );
    expect(screen.queryByTestId('horse-card-color-chip')).not.toBeInTheDocument();
  });

  it('does NOT render the chip when phenotype.colorName is empty string', () => {
    // Edge: a horse with phenotype set but colorName === '' is the failure
    // mode the backend sentinel (horseColorNullSentinel.test.mjs) catches.
    // The chip must also not render in that state — never display an empty
    // pill, never display "Unknown" or "undefined".
    render(
      <HorseCard
        horse={makeHorse({ phenotype: { colorName: '' }, finalDisplayColor: undefined })}
        onClick={() => {}}
      />
    );
    expect(screen.queryByTestId('horse-card-color-chip')).not.toBeInTheDocument();
  });
});
