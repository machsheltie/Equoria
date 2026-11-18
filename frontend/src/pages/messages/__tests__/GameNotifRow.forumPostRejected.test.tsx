/**
 * Rejected-post note (Equoria-puj1e.3, owner ruling q376): when a moderator does
 * not accept a held post, its author gets a short note. Authored words only; the
 * stored type name never shows.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from '@/test/utils';
import type { GameNotification } from '@/lib/api-client';
import { GameNotifRow } from '../GameNotifRow';

const notice = (payload: Record<string, unknown>): GameNotification => ({
  id: '62',
  type: 'forumPostRejected',
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
  return screen.getByTestId('game-notif-62').textContent ?? '';
};

describe('GameNotifRow: rejected forum post', () => {
  it('names the thread a rejected reply was in', () => {
    const text = bodyOf(notice({ threadTitle: 'Spring foals', startedThread: false }));
    expect(text).toContain('A post was not accepted');
    expect(text).toContain('Your reply in “Spring foals” was not accepted by a moderator');
    expect(text).not.toContain('forumPostRejected');
  });

  it('names a rejected new thread', () => {
    const text = bodyOf(notice({ threadTitle: 'Coins', startedThread: true }));
    expect(text).toContain('Your new thread “Coins” was not accepted by a moderator');
  });

  it('still reads cleanly without a title', () => {
    expect(bodyOf(notice({}))).toContain('Your reply was not accepted by a moderator');
  });
});
