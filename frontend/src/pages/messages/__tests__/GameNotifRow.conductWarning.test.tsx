/**
 * Warning row: a steward's warning reaches the player in the steward's own words
 * (Equoria-w47x7). The player sees an authored title, never the stored type name.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from '@/test/utils';
import type { GameNotification } from '@/lib/api-client';
import { GameNotifRow } from '../GameNotifRow';

const notice = (payload: Record<string, unknown>): GameNotification => ({
  id: '61',
  type: 'conductWarning',
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
  return screen.getByTestId('game-notif-61').textContent ?? '';
};

describe('GameNotifRow: conduct warning', () => {
  it('shows the steward reason under an authored title', () => {
    const text = bodyOf(notice({ reason: 'Please keep the forum friendly.' }));
    expect(text).toContain('A warning from the stewards');
    expect(text).toContain('Please keep the forum friendly.');
    expect(text).not.toContain('conductWarning');
  });

  it('still reads cleanly without a reason', () => {
    const text = bodyOf(notice({}));
    expect(text).toContain('The stewards have warned your account.');
  });
});
