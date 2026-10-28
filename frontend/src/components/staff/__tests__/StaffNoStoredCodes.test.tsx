/**
 * Moderator screens never show a stored code (Equoria-no441, owner ruling
 * 2026-10-28 q165): a ticket status, ticket subject kind, account role, ledger
 * action or ledger target the word maps do not know reads as a generic authored
 * phrase, and every action the ledger records today reads as a sentence.
 *
 * The real staff hooks over the real apiClient; MSW stubs the HTTP boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StaffActionLog from '../StaffActionLog';
import StaffRoles from '../StaffRoles';
import StaffTickets from '../StaffTickets';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

const json = (body: unknown, status = 200) => HttpResponse.json(body as object, { status });

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

const withClient = (ui: React.ReactElement) => (
  <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
);

describe('StaffTickets: an unlisted status or subject kind', () => {
  it('reads as words, never the stored value', async () => {
    server.use(
      http.get(`${STAFF}/tickets`, () =>
        json({
          tickets: [
            {
              id: 50,
              filedById: 'mod-2',
              filedBy: { id: 'mod-2', username: 'Willow' },
              targetType: 'stableYard',
              targetId: '9',
              category: 'Spam',
              note: 'n',
              status: 'awaitingEscalation',
              createdAt: '2026-10-11T12:00:00.000Z',
              updatedAt: '2026-10-11T12:00:00.000Z',
            },
          ],
        })
      )
    );
    const { container } = render(
      withClient(<StaffTickets canFile={false} canResolve onCheckinRequired={() => undefined} />)
    );
    expect(await screen.findByText(/Record 9/)).toBeInTheDocument();
    expect(screen.getByText(/Status not listed/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/stableYard|awaitingEscalation/);
  });
});

describe('StaffRoles: an unlisted role', () => {
  it('titles a listed steward and a looked-up player in words', async () => {
    server.use(
      http.get(`${STAFF}/roles`, () =>
        json({ staff: [{ id: 'x-1', username: 'Juniper', role: 'seniorSteward' }] })
      ),
      http.post(`${STAFF}/roles/lookup`, () =>
        json({ id: 'x-2', username: 'Rowan', role: 'probationaryHelper' })
      )
    );
    const user = userEvent.setup();
    const { container } = render(withClient(<StaffRoles onCheckinRequired={() => undefined} />));
    expect(await screen.findByText(/Steward/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Player's username"), 'Rowan');
    await user.click(screen.getByRole('button', { name: 'Find' }));
    expect(await screen.findByText('Rowan is without a listed role.')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/seniorSteward|probationaryHelper/);
  });
});

const entry = (
  id: number,
  capability: string,
  targetType: string,
  targetId: string | null,
  after: Record<string, unknown> | null = null
) => ({
  id,
  actorId: 'admin-1',
  actorRole: 'admin',
  capability,
  targetType,
  targetId,
  reason: 'Reason',
  before: null,
  after,
  outcome: 'succeeded',
  error: null,
  reversesId: null,
  createdAt: '2026-10-11T12:00:00.000Z',
});

describe('StaffActionLog: every recorded action reads as a sentence', () => {
  it('names conduct, quarantine and unknown actions and targets in words', async () => {
    server.use(
      http.get(`${STAFF}/log`, () =>
        json({
          entries: [
            entry(1, 'warn', 'player', 'p-1'),
            entry(2, 'freeze', 'player', 'p-1'),
            entry(3, 'ban.account', 'player', 'p-1'),
            entry(4, 'ban.ip', 'playerIp', 'p-1'),
            entry(5, 'ban.device', 'playerDevice', 'p-1'),
            entry(6, 'conduct.lift', 'player', 'p-1'),
            entry(7, 'conduct.lift', 'playerIp', 'p-1'),
            entry(8, 'conduct.lift', 'playerDevice', 'p-1'),
            entry(9, 'shows.quarantine.resolve', 'show', '88'),
            entry(10, 'news.manageAll', 'newsPost', '5'),
            entry(11, 'news.manageAll', 'newsPost', null),
          ],
          nextCursor: null,
        })
      ),
      http.get(`${STAFF}/log/actors`, () => json({ actors: [] })),
      http.get(`${STAFF}/roles`, () =>
        json({
          staff: [
            { id: 'admin-1', username: 'Hazel', role: 'admin' },
            { id: 'p-1', username: 'Mara', role: 'moderator' },
          ],
        })
      )
    );
    const { container } = render(
      withClient(
        <StaffActionLog selfId="other" canSeeNames canFilter onCheckinRequired={() => undefined} />
      )
    );
    expect(await screen.findByText('Hazel warned Mara.')).toBeInTheDocument();
    for (const sentence of [
      "Hazel froze Mara's account.",
      "Hazel banned Mara's account.",
      'Hazel banned the network Mara last signed in from.',
      'Hazel banned the device Mara last signed in from.',
      "Hazel lifted Mara's freeze or ban.",
      'Hazel lifted the network ban placed through Mara.',
      'Hazel lifted the device ban placed through Mara.',
      'Hazel settled held show #88.',
      'Hazel took a staff action on record #5.',
      'Hazel took a staff action on a record.',
    ]) {
      expect(screen.getByText(sentence)).toBeInTheDocument();
    }
    expect(container.textContent).not.toMatch(
      /news\.manageAll|newsPost|playerIp|playerDevice|ban\.(account|ip|device)|conduct\.lift|quarantine/
    );
  });
});
