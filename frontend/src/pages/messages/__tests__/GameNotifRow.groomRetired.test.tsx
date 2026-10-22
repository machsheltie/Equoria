/**
 * Groom Retired row: the horses it names always add up to the count it was
 * sent (Equoria-d6ru2).
 *
 * The row speaks the horses by name when the payload carries them, and by count
 * otherwise. It chose the named branch on `horseNames.length > 0`, so a payload
 * saying three horses were left unattended but carrying only two usable names
 * read "Moonflower and Halcyon are without a groom" with nothing to account for
 * the third.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from '@/test/utils';
import type { GameNotification } from '@/lib/api-client';
import { GameNotifRow } from '../GameNotifRow';

const retired = (payload: Record<string, unknown>): GameNotification => ({
  id: '41',
  type: 'groomRetired',
  isRead: false,
  createdAt: new Date().toISOString(),
  payload: { groomName: 'Marguerite', ...payload },
});

const bodyOf = (n: GameNotification): string => {
  render(
    <MemoryRouter>
      <GameNotifRow notif={n} />
    </MemoryRouter>
  );
  return screen.getByTestId('game-notif-41').textContent ?? '';
};

describe('GameNotifRow — Groom Retired horses', () => {
  it('names every horse when names and count agree', () => {
    const text = bodyOf(
      retired({
        horsesLeftUnattended: 2,
        horses: [
          { id: 1, name: 'Moonflower' },
          { id: 2, name: 'Halcyon' },
        ],
      })
    );
    expect(text).toContain('Moonflower and Halcyon are without a groom');
  });

  it('accounts for a horse with no usable name instead of dropping it', () => {
    const text = bodyOf(
      retired({
        horsesLeftUnattended: 3,
        horses: [
          { id: 1, name: 'Moonflower' },
          { id: 2, name: 'Halcyon' },
          { id: 3, name: '   ' },
        ],
      })
    );
    expect(text).toContain('Moonflower, Halcyon and 1 other horse are without a groom');
  });

  it('says how many more when the count outruns the names', () => {
    const text = bodyOf(
      retired({ horsesLeftUnattended: 4, horses: [{ id: 1, name: 'Moonflower' }] })
    );
    expect(text).toContain('Moonflower and 3 more are without a groom');
  });

  it('still speaks the count for a notification stored before names existed', () => {
    const text = bodyOf(retired({ horsesLeftUnattended: 3 }));
    expect(text).toContain('3 horses are without a groom');
  });
});
