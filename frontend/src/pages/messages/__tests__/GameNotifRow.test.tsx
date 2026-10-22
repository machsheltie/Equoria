/**
 * GameNotifRow — the Steward's Office bells (Equoria-puj1e.1).
 *
 * Staff bells arrive as `staffTicket` ({ ticketId, category }) and
 * `staffTicketUpdate` ({ ticketId, status? } — no status means a reply).
 * They must say what happened in plain words and lead to /steward, never fall
 * through to the unknown row that shows the raw type slug.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from '@/test/utils';
import type { GameNotification } from '@/lib/api-client';
import { GameNotifRow } from '../GameNotifRow';

const notif = (type: string, payload: Record<string, unknown>): GameNotification => ({
  id: '41',
  type,
  isRead: false,
  createdAt: new Date().toISOString(),
  payload,
});

const renderRow = (n: GameNotification) => {
  render(
    <MemoryRouter>
      <GameNotifRow notif={n} />
    </MemoryRouter>
  );
  return screen.getByTestId('game-notif-41');
};

const expectOfficeLink = (row: HTMLElement) => {
  const link = within(row).getByRole('link', { name: "Open the Steward's Office" });
  expect(link).toHaveAttribute('href', '/steward');
};

describe("GameNotifRow — Steward's Office bells", () => {
  it('tells the admin a steward filed a ticket, with its number and category', () => {
    const row = renderRow(notif('staffTicket', { ticketId: 12, category: 'Needs the admin' }));

    expect(row).toHaveTextContent('A steward filed ticket #12 (Needs the admin).');
    expectOfficeLink(row);
    expect(row).not.toHaveTextContent('staffTicket');
  });

  it('says a ticket has a reply when the update carries no status', () => {
    const row = renderRow(notif('staffTicketUpdate', { ticketId: 7 }));

    expect(row).toHaveTextContent('Ticket #7 has a reply.');
    expectOfficeLink(row);
    expect(row).not.toHaveTextContent('staffTicketUpdate');
  });

  it.each([
    ['open', 'Ticket #7 is now open.'],
    ['inProgress', 'Ticket #7 is now in progress.'],
    ['resolved', 'Ticket #7 is now resolved.'],
    ['declined', 'Ticket #7 is now declined.'],
  ])('says the new status %s in plain words', (status, sentence) => {
    const row = renderRow(notif('staffTicketUpdate', { ticketId: 7, status }));

    expect(row).toHaveTextContent(sentence);
    expect(row).not.toHaveTextContent('inProgress');
    expectOfficeLink(row);
  });

  it('stays honest when the payload is missing pieces', () => {
    const row = renderRow(notif('staffTicket', {}));

    expect(row).toHaveTextContent('A steward filed a ticket.');
    expectOfficeLink(row);
  });

  it('keeps the office link out of every other bell', () => {
    renderRow(notif('foalBorn', { foalName: 'Moonflower' }));

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
