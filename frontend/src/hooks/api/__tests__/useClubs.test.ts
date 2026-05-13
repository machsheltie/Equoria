/**
 * useClubs hook tests (Equoria-5oaf)
 *
 * Tests for Epic 19B-3 clubs hooks: useClubs, useMyClubs, useClub, useJoinClub,
 * useLeaveClub, useCreateClub, useClubElections, useNominate, useVote,
 * useElectionResults, useTransferLeadership.
 *
 * Relies on MSW global handlers (clubs section of handlers.ts).
 * Per-test overrides via server.use() for error paths and mutation assertions.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';
import React from 'react';
import {
  useClubs,
  useMyClubs,
  useClub,
  useJoinClub,
  useLeaveClub,
  useCreateClub,
  useClubElections,
  useNominate,
  useVote,
  useElectionResults,
  useTransferLeadership,
} from '../useClubs';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// ── useClubs ─────────────────────────────────────────────────────────────────

describe('useClubs', () => {
  it('starts in loading state', () => {
    const { result } = renderHook(() => useClubs(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches all clubs with correct shape', async () => {
    const { result } = renderHook(() => useClubs(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.clubs).toBeDefined();
    expect(Array.isArray(result.current.data?.clubs)).toBe(true);
    expect(result.current.data!.clubs.length).toBeGreaterThan(0);

    const club = result.current.data!.clubs[0];
    expect(club).toHaveProperty('id');
    expect(club).toHaveProperty('name');
    expect(club).toHaveProperty('type');
    expect(club).toHaveProperty('category');
    expect(club).toHaveProperty('memberCount');
  });

  it('filters clubs by type', async () => {
    const { result } = renderHook(() => useClubs('breed'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.clubs.every((c) => c.type === 'breed')).toBe(true);
  });

  it('exposes error on API failure', async () => {
    server.use(http.get('/api/v1/clubs', () => HttpResponse.json({}, { status: 500 })));

    const { result } = renderHook(() => useClubs(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useMyClubs ────────────────────────────────────────────────────────────────

describe('useMyClubs', () => {
  it('fetches memberships with correct shape', async () => {
    const { result } = renderHook(() => useMyClubs(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.memberships).toBeDefined();
    expect(Array.isArray(result.current.data?.memberships)).toBe(true);

    const membership = result.current.data!.memberships[0];
    expect(membership).toHaveProperty('id');
    expect(membership).toHaveProperty('club');
    expect(membership).toHaveProperty('role');
    expect(membership).toHaveProperty('joinedAt');
  });
});

// ── useClub ───────────────────────────────────────────────────────────────────

describe('useClub', () => {
  it('does not fetch when id is 0', () => {
    const { result } = renderHook(() => useClub(0), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches club detail with members for valid id', async () => {
    const { result } = renderHook(() => useClub(10), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.club).toBeDefined();
    expect(result.current.data!.club.id).toBe(10);
    expect(result.current.data!.club).toHaveProperty('name');
    expect(result.current.data!.club).toHaveProperty('members');
    expect(Array.isArray(result.current.data!.club.members)).toBe(true);
  });

  it('exposes error on 404', async () => {
    const { result } = renderHook(() => useClub(999), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useJoinClub ───────────────────────────────────────────────────────────────

describe('useJoinClub', () => {
  it('calls POST /api/v1/clubs/:id/join and returns membership', async () => {
    let joinedId = '';
    server.use(
      http.post('/api/v1/clubs/:id/join', ({ params }) => {
        joinedId = String(params.id);
        return HttpResponse.json(
          {
            membership: {
              id: 500,
              club: {
                id: Number(params.id),
                name: 'Dressage Enthusiasts',
                type: 'discipline',
                category: 'Dressage',
                description: 'For lovers of classical dressage.',
                leader: { id: 'user-3', username: 'horsepro' },
                memberCount: 43,
                createdAt: '2025-06-01T00:00:00Z',
              },
              role: 'member',
              joinedAt: new Date().toISOString(),
            },
          },
          { status: 201 }
        );
      })
    );

    const { result } = renderHook(() => useJoinClub(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate(10);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(joinedId).toBe('10');
    expect(result.current.data?.membership.role).toBe('member');
  });
});

// ── useLeaveClub ──────────────────────────────────────────────────────────────

describe('useLeaveClub', () => {
  it('calls DELETE /api/v1/clubs/:id/leave', async () => {
    let deletedId = '';
    server.use(
      http.delete('/api/v1/clubs/:id/leave', ({ params }) => {
        deletedId = String(params.id);
        return HttpResponse.json({ success: true });
      })
    );

    const { result } = renderHook(() => useLeaveClub(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate(10);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(deletedId).toBe('10');
  });
});

// ── useCreateClub ─────────────────────────────────────────────────────────────

describe('useCreateClub', () => {
  it('calls POST /api/v1/clubs and returns created club', async () => {
    let called = false;
    server.use(
      http.post('/api/v1/clubs', () => {
        called = true;
        return HttpResponse.json(
          {
            club: {
              id: 200,
              name: 'New Jumping Club',
              type: 'discipline',
              category: 'Show Jumping',
              description: 'For show jumping fans.',
              leader: { id: 'user-1', username: 'testuser' },
              memberCount: 1,
              createdAt: new Date().toISOString(),
            },
          },
          { status: 201 }
        );
      })
    );

    const { result } = renderHook(() => useCreateClub(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({
        name: 'New Jumping Club',
        type: 'discipline',
        category: 'Show Jumping',
        description: 'For show jumping fans.',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(called).toBe(true);
    expect(result.current.data?.club.name).toBe('New Jumping Club');
  });
});

// ── useClubElections ──────────────────────────────────────────────────────────

describe('useClubElections', () => {
  it('does not fetch when clubId is 0', () => {
    const { result } = renderHook(() => useClubElections(0), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches elections for a valid club id', async () => {
    const { result } = renderHook(() => useClubElections(10), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.elections).toBeDefined();
    expect(Array.isArray(result.current.data?.elections)).toBe(true);

    const election = result.current.data!.elections[0];
    expect(election).toHaveProperty('id');
    expect(election).toHaveProperty('position');
    expect(election).toHaveProperty('status');
    expect(election).toHaveProperty('startsAt');
    expect(election).toHaveProperty('endsAt');
  });
});

// ── useElectionResults ────────────────────────────────────────────────────────

describe('useElectionResults', () => {
  it('does not fetch when electionId is 0', () => {
    const { result } = renderHook(() => useElectionResults(0), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches election results with candidates', async () => {
    const { result } = renderHook(() => useElectionResults(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.election).toBeDefined();
    expect(result.current.data?.candidates).toBeDefined();
    expect(Array.isArray(result.current.data?.candidates)).toBe(true);
    expect(result.current.data!.candidates.length).toBeGreaterThan(0);

    const candidate = result.current.data!.candidates[0];
    expect(candidate).toHaveProperty('id');
    expect(candidate).toHaveProperty('user');
    expect(candidate).toHaveProperty('statement');
    expect(candidate).toHaveProperty('voteCount');
  });
});

// ── useNominate ───────────────────────────────────────────────────────────────

describe('useNominate', () => {
  it('calls POST /api/v1/clubs/elections/:id/nominate', async () => {
    let nominatedElectionId = '';
    server.use(
      http.post('/api/v1/clubs/elections/:id/nominate', ({ params }) => {
        nominatedElectionId = String(params.id);
        return HttpResponse.json({}, { status: 201 });
      })
    );

    const { result } = renderHook(() => useNominate(1), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate('I will serve this club well.');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(nominatedElectionId).toBe('1');
  });
});

// ── useVote ───────────────────────────────────────────────────────────────────

describe('useVote', () => {
  it('calls POST /api/v1/clubs/elections/:id/vote with candidateId', async () => {
    let votedElectionId = '';
    server.use(
      http.post('/api/v1/clubs/elections/:id/vote', ({ params }) => {
        votedElectionId = String(params.id);
        return HttpResponse.json({}, { status: 201 });
      })
    );

    const { result } = renderHook(() => useVote(1), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate(2);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(votedElectionId).toBe('1');
  });
});

// ── useTransferLeadership ─────────────────────────────────────────────────────

describe('useTransferLeadership', () => {
  it('calls PATCH /api/v1/clubs/:id/transfer-leadership', async () => {
    let patchedClubId = '';
    server.use(
      http.patch('/api/v1/clubs/:id/transfer-leadership', ({ params }) => {
        patchedClubId = String(params.id);
        return HttpResponse.json({ success: true });
      })
    );

    const { result } = renderHook(() => useTransferLeadership(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ clubId: 10, newPresidentId: 'user-2' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(patchedClubId).toBe('10');
  });
});
