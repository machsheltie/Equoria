/**
 * Breeding notifications (Equoria-q4uem.9; owner ruling q110, 2026-10-27: a
 * gold star for now). Each says what happened in plain words; no stored type,
 * decline code or server message reaches the screen.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from '@/test/utils';
import type { GameNotification } from '@/lib/api-client';
import { GameNotifRow } from '../GameNotifRow';

const row = (type: string, payload: Record<string, unknown>) => {
  const notif: GameNotification = {
    id: '9',
    type,
    isRead: false,
    createdAt: new Date().toISOString(),
    payload,
  };
  render(
    <MemoryRouter>
      <GameNotifRow notif={notif} />
    </MemoryRouter>
  );
  return screen.getByTestId('game-notif-9');
};

const base = {
  requestId: 4,
  sireId: 5,
  sireName: 'Thunder Orchard',
  damId: 6,
  damName: 'Wren',
  fee: 500,
};

describe('GameNotifRow — breeding at stud', () => {
  it.each([
    [
      'studRequestReceived',
      { ...base, mareOwnerName: 'Maple Run' },
      'Maple Run asks to breed Wren to Thunder Orchard.',
    ],
    [
      'studBooked',
      { ...base, mareOwnerName: 'Heron Fields' },
      'Heron Fields bred Wren to Thunder Orchard. You earned 500.',
    ],
    ['studRequestApproved', base, 'Accepted. Wren is in foal to Thunder Orchard, due in 7 days.'],
    [
      'studRequestDeclined',
      { ...base, declineReason: 'rejected' },
      'The request for Wren to Thunder Orchard was declined.',
    ],
    [
      'studRequestDeclined',
      { ...base, declineReason: 'stallionUnavailable', message: 'RAW server words' },
      'The request for Wren to Thunder Orchard could not go ahead.',
    ],
    ['studRequestCancelled', base, 'The request for Wren to Thunder Orchard was withdrawn.'],
  ])('%s says what happened, with a star', (type, payload, sentence) => {
    const el = row(type, payload);
    expect(el).toHaveTextContent(sentence);
    expect(el.querySelector('svg.stud-star')).not.toBeNull();
    expect(el).not.toHaveTextContent(type);
    expect(el).not.toHaveTextContent(/rejected|stallionUnavailable|RAW server words/);
  });

  // Equoria-pjvp8.4: the old server's spelling, for the minutes a deploy serves
  // this client against the old server. Phase 6 removes it.
  it("still reads the old server's REJECTED as the owner's no during a deploy", () => {
    const el = row('studRequestDeclined', { ...base, declineReason: 'REJECTED' });
    expect(el).toHaveTextContent('The request for Wren to Thunder Orchard was declined.');
  });

  it('an unknown notification never shows its stored type', () => {
    const el = row('somethingNewInternal', {});
    expect(el).not.toHaveTextContent('somethingNewInternal');
    expect(el).toHaveTextContent('Notice');
  });
});
