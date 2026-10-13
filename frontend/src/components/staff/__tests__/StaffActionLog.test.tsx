/**
 * StaffActionLog: entries by a steward who is no longer on staff (Equoria-2yugk)
 *
 * The real staff hooks over the real apiClient; MSW stubs the HTTP boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StaffActionLog from '../StaffActionLog';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

const entry = (id: number, actorId: string, actorRole: string, targetId: string) => ({
  id,
  actorId,
  actorRole,
  capability: 'ticket.file',
  targetType: 'ticket',
  targetId,
  reason: 'Spam',
  before: null,
  after: null,
  outcome: 'succeeded',
  error: null,
  reversesId: null,
  createdAt: '2026-10-11T12:00:00.000Z',
});

describe('StaffActionLog: a former steward', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('names a listed steward and calls an unlisted actor a former steward with a short id', async () => {
    server.use(
      http.get(`${STAFF}/log`, () =>
        HttpResponse.json({
          entries: [
            entry(2, '1a2b3c4d-erased-account', 'moderator', '41'),
            entry(1, 'mod-willow-id', 'moderator', '40'),
          ],
          nextCursor: null,
        })
      ),
      http.get(`${STAFF}/roles`, () =>
        HttpResponse.json({
          staff: [
            { id: 'admin-1', username: 'Hazel', role: 'admin' },
            { id: 'mod-willow-id', username: 'Willow', role: 'moderator' },
          ],
        })
      )
    );

    render(
      <QueryClientProvider client={queryClient}>
        <StaffActionLog
          selfId="admin-1"
          canSeeNames
          canFilter
          onCheckinRequired={() => undefined}
        />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Willow filed ticket #40.')).toBeInTheDocument();
    expect(
      await screen.findByText('A former steward (#1a2b3c4d) filed ticket #41.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Moderator #1a2b3c4d/)).not.toBeInTheDocument();
  });
});
