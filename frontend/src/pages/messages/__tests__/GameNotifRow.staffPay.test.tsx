/**
 * Staff pay notices: a groom or rider who could not be paid, and one who has left after
 * a full unpaid week (owner q111, Equoria-gafyt; groom notices Equoria-ypb7d.3).
 * Players read authored words, never the stored type name.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from '@/test/utils';
import type { GameNotification } from '@/lib/api-client';
import { GameNotifRow } from '../GameNotifRow';

const notice = (type: string, payload: Record<string, unknown>): GameNotification => ({
  id: '61',
  type,
  isRead: false,
  createdAt: new Date().toISOString(),
  payload,
});

const textOf = (n: GameNotification): string => {
  render(
    <MemoryRouter>
      <GameNotifRow notif={n} />
    </MemoryRouter>
  );
  return screen.getByTestId('game-notif-61').textContent ?? '';
};

describe('GameNotifRow — staff pay notices', () => {
  it('tells the player a rider was not paid and cannot ride', () => {
    const text = textOf(notice('riderFeeUnpaid', { riderId: 4, riderName: 'Joss Hale' }));
    expect(text).toContain('Joss Hale');
    expect(text).toContain('cannot ride');
    expect(text).toContain('Rider Not Paid');
    expect(text).not.toContain('riderFeeUnpaid');
  });

  it('tells the player a rider has left and names the horses left without one', () => {
    const text = textOf(
      notice('riderReleased', {
        riderName: 'Joss Hale',
        horses: [
          { id: 1, name: 'Moonflower' },
          { id: 2, name: 'Halcyon' },
        ],
      })
    );
    expect(text).toContain('Rider Left');
    expect(text).toContain('Has left your stable after a full week without pay.');
    expect(text).toContain('Moonflower and Halcyon are without a rider.');
    expect(text).not.toContain('riderReleased');
  });

  it('shows the groom notices in authored words too', () => {
    const unpaid = textOf(notice('groomFeeUnpaid', { groomName: 'Ben Marsh' }));
    expect(unpaid).toContain('Ben Marsh');
    expect(unpaid).toContain('cannot work');
    expect(unpaid).not.toContain('groomFeeUnpaid');
  });

  it('shows a departed groom and the horse left without one', () => {
    const left = textOf(
      notice('groomReleased', { groomName: 'Ben Marsh', horses: [{ id: 3, name: 'Comet' }] })
    );
    expect(left).toContain('Groom Left');
    expect(left).toContain('Comet is without a groom.');
    expect(left).not.toContain('groomReleased');
  });
});
