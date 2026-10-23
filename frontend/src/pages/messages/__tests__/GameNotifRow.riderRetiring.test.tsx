/**
 * Rider Retiring row: the one-week notice players get before a rider retires
 * (owner ruling 2026-10-23, Equoria-or2ua).
 *
 * The row names the rider and the horses that ride with them. It states no age,
 * no retirement age and no countdown beyond the week the game itself promises.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from '@/test/utils';
import type { GameNotification } from '@/lib/api-client';
import { GameNotifRow } from '../GameNotifRow';

const notice = (payload: Record<string, unknown>): GameNotification => ({
  id: '52',
  type: 'riderRetiring',
  isRead: false,
  createdAt: new Date().toISOString(),
  payload,
});

const bodyOf = (n: GameNotification): string => {
  render(
    <MemoryRouter>
      <GameNotifRow notif={n} />
    </MemoryRouter>
  );
  return screen.getByTestId('game-notif-52').textContent ?? '';
};

describe('GameNotifRow — Rider Retiring', () => {
  it('names the rider and the horses who will need a new rider', () => {
    const text = bodyOf(
      notice({
        riderId: 9,
        riderName: 'Ada Vane',
        horses: [
          { id: 1, name: 'Moonflower' },
          { id: 2, name: 'Halcyon' },
        ],
      })
    );
    expect(text).toContain('Rider Retiring');
    expect(text).toContain('Ada Vane');
    expect(text).toContain('Retires within the week.');
    expect(text).toContain('Moonflower and Halcyon will need a new rider.');
  });

  it('still reads cleanly when no horse rides with them', () => {
    const text = bodyOf(notice({ riderId: 9, riderName: 'Ada Vane', horses: [] }));
    expect(text).toContain('Ada Vane');
    expect(text).toContain('Retires within the week.');
    expect(text).not.toContain('will need a new rider');
  });

  it('falls back to a plain name when the payload carries none', () => {
    expect(bodyOf(notice({}))).toContain('One of your riders');
  });
});
