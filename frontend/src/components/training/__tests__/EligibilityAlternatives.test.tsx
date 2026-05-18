/**
 * EligibilityAlternatives tests (Equoria-9zluc)
 *
 * Proves the "No dead ends" UX-spec rule: when a horse is ineligible the
 * component surfaces concrete, REAL-data alternatives (the user's other
 * currently-eligible horses) and lets the user act on them — instead of
 * showing only the reason and stopping.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EligibilityAlternatives from '../EligibilityAlternatives';
import type { TrainableHorse } from '@/lib/api-client';

const horses: TrainableHorse[] = [
  {
    id: 1,
    horseId: 1,
    name: 'Blocked Star',
    canTrain: false,
    nextEligibleAt: '2999-01-01T00:00:00Z',
  },
  { id: 2, horseId: 2, name: 'Ready Comet', canTrain: true },
  { id: 3, horseId: 3, name: 'Ready Nova', canTrain: true },
  {
    id: 4,
    horseId: 4,
    name: 'Cooldown Luna',
    canTrain: false,
    nextEligibleAt: '2999-02-01T00:00:00Z',
  },
];

describe('EligibilityAlternatives (Equoria-9zluc)', () => {
  it('lists the user other currently-eligible horses (real canTrain data)', () => {
    render(
      <EligibilityAlternatives
        blockedHorseId={1}
        trainableHorses={horses}
        onSelectAlternative={vi.fn()}
      />
    );
    expect(screen.getByTestId('eligibility-alternatives')).toBeInTheDocument();
    const options = screen.getAllByTestId('eligibility-alternative-option');
    const names = options.map((o) => o.textContent);
    expect(names.some((n) => n?.includes('Ready Comet'))).toBe(true);
    expect(names.some((n) => n?.includes('Ready Nova'))).toBe(true);
    // Blocked + cooldown horses must NOT be suggested.
    expect(names.some((n) => n?.includes('Blocked Star'))).toBe(false);
    expect(names.some((n) => n?.includes('Cooldown Luna'))).toBe(false);
  });

  it('invokes onSelectAlternative with the chosen eligible horse', () => {
    const onSelect = vi.fn();
    render(
      <EligibilityAlternatives
        blockedHorseId={1}
        trainableHorses={horses}
        onSelectAlternative={onSelect}
      />
    );
    fireEvent.click(screen.getAllByTestId('eligibility-alternative-option')[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ canTrain: true });
  });

  it('shows an honest empty state (no fake suggestions) when none are eligible', () => {
    const allBlocked: TrainableHorse[] = [
      { id: 1, horseId: 1, name: 'A', canTrain: false, nextEligibleAt: '2999-03-01T00:00:00Z' },
      { id: 2, horseId: 2, name: 'B', canTrain: false, nextEligibleAt: '2999-01-15T00:00:00Z' },
    ];
    render(
      <EligibilityAlternatives
        blockedHorseId={1}
        trainableHorses={allBlocked}
        onSelectAlternative={vi.fn()}
      />
    );
    expect(screen.getByTestId('eligibility-alternatives-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('eligibility-alternative-option')).toBeNull();
    // Soonest next-eligible time is surfaced (still actionable info, no dead end).
    expect(screen.getByTestId('eligibility-alternatives-empty').textContent).toMatch(
      /next one becomes available/i
    );
  });

  it('shows a loading state while the real trainable list is fetching', () => {
    render(
      <EligibilityAlternatives
        blockedHorseId={1}
        trainableHorses={undefined}
        isLoading
        onSelectAlternative={vi.fn()}
      />
    );
    expect(screen.getByTestId('eligibility-alternatives-loading')).toBeInTheDocument();
  });

  it('respects the limit prop', () => {
    render(
      <EligibilityAlternatives
        blockedHorseId={99}
        trainableHorses={horses}
        onSelectAlternative={vi.fn()}
        limit={1}
      />
    );
    expect(screen.getAllByTestId('eligibility-alternative-option')).toHaveLength(1);
  });
});
