/**
 * The foal-born notice leads to the newborn (Equoria-nzl9e, audit BRE-12).
 *
 * The foalBorn payload carries { foalName, foalId, damName, sireName }; the
 * foal's name must open its horse page (/horses/:id — there is one horse page,
 * owner ruling 2026-10-16). A payload without a usable id stays plain text.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from '@/test/utils';
import type { GameNotification } from '@/lib/api-client';
import { GameNotifRow } from '../GameNotifRow';

const row = (payload: Record<string, unknown>) => {
  const notif: GameNotification = {
    id: '17',
    type: 'foalBorn',
    isRead: false,
    createdAt: new Date().toISOString(),
    payload,
  };
  render(
    <MemoryRouter>
      <GameNotifRow notif={notif} />
    </MemoryRouter>
  );
  return screen.getByTestId('game-notif-17');
};

describe('GameNotifRow — foal born', () => {
  it("links the foal's name to its horse page", () => {
    const r = row({ foalName: 'Moonflower', foalId: 812, damName: 'Wren', sireName: 'Thunder' });

    const link = within(r).getByRole('link', { name: 'Moonflower' });
    expect(link).toHaveAttribute('href', '/horses/812');
    expect(r).toHaveTextContent('Out of Wren by Thunder.');
  });

  it('shows the name without a link when the payload has no usable foal id', () => {
    const r = row({ foalName: 'Moonflower', foalId: 'abc', damName: 'Wren', sireName: 'Thunder' });

    expect(r).toHaveTextContent('Moonflower');
    expect(within(r).queryByRole('link')).not.toBeInTheDocument();
  });
});
