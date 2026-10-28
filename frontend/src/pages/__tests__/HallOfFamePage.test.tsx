/**
 * Hall of Fame page (Equoria-vb1n0, owner rulings 2026-10-28)
 *
 * Two sections: Nominees (each opens its horse page and has a Vote button; one
 * vote per round, own horse allowed) and Hall of Fame Horses (with the date
 * each joined). It started empty, and it opens no view of the player's stable.
 *
 * Real page + real hooks + real apiClient; MSW only at the HTTP boundary.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from '@/test/utils';
import { server } from '@/test/msw/server';
import HallOfFamePage from '../HallOfFamePage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const path = `${base}/api/v1/hall-of-fame`;

const round = (myVoteCandidateId: number | null) => ({
  roundId: 9,
  isRunoff: false,
  endsAt: '2026-11-09T05:00:00.000Z',
  myVoteCandidateId,
  nominees: [
    {
      candidateId: 31,
      horseId: 501,
      horseName: 'Old Lantern',
      breedName: 'Arabian',
      ownerName: 'stacey',
    },
    {
      candidateId: 32,
      horseId: 502,
      horseName: 'Silver Bough',
      breedName: null,
      ownerName: 'june',
    },
  ],
});

const empty = { success: true, data: { rounds: [], inductees: [] } };

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/my-stable']}>
        <HallOfFamePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Hall of Fame page (Equoria-vb1n0)', () => {
  it('starts empty, honestly, with no stable view', async () => {
    server.use(http.get(path, () => HttpResponse.json(empty)));
    renderPage();

    expect(
      await screen.findByText(/no one has earned the right to be in the hall of fame yet/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nominees' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hall of Fame Horses' })).toBeInTheDocument();
    expect(screen.queryByText(/stable profile/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('lists nominees that open their horse page, and casts the one vote', async () => {
    let voted: number | null = null;
    server.use(
      http.get(path, () =>
        HttpResponse.json({ success: true, data: { rounds: [round(voted)], inductees: [] } })
      ),
      http.post(`${path}/votes`, async ({ request }) => {
        voted = ((await request.json()) as { candidateId: number }).candidateId;
        return HttpResponse.json(
          { success: true, data: { id: 1, roundId: 9, candidateId: voted } },
          { status: 201 }
        );
      })
    );
    const user = userEvent.setup();
    renderPage();

    const lantern = await screen.findByTestId('hof-nominee-501');
    expect(within(lantern).getByRole('link', { name: 'Old Lantern' })).toHaveAttribute(
      'href',
      '/horses/501'
    );

    await user.click(within(lantern).getByRole('button', { name: 'Vote for Old Lantern' }));

    expect(
      await within(screen.getByTestId('hof-nominee-501')).findByText('Your vote')
    ).toBeInTheDocument();
    expect(voted).toBe(31);
    expect(
      within(screen.getByTestId('hof-nominee-502')).getByRole('button', { name: /vote/i })
    ).toBeDisabled();
  });

  it('shows a refused vote at the vote, not silently', async () => {
    server.use(
      http.get(path, () =>
        HttpResponse.json({ success: true, data: { rounds: [round(null)], inductees: [] } })
      ),
      http.post(`${path}/votes`, () =>
        HttpResponse.json(
          { success: false, message: 'Voting closed', code: 'votingClosed' },
          { status: 400 }
        )
      )
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Vote for Old Lantern' }));
    expect(await screen.findByText(/your vote was not counted/i)).toBeInTheDocument();
  });

  it('lists inducted horses with the date each joined', async () => {
    server.use(
      http.get(path, () =>
        HttpResponse.json({
          success: true,
          data: {
            rounds: [],
            inductees: [
              {
                horseId: 700,
                horseName: 'Moonflower',
                breedName: 'Friesian',
                ownerName: 'stacey',
                inductedAt: '2026-11-16T05:13:00.000Z',
              },
            ],
          },
        })
      )
    );
    renderPage();

    const entry = await screen.findByTestId('hof-inductee-700');
    expect(within(entry).getByRole('link', { name: 'Moonflower' })).toHaveAttribute(
      'href',
      '/horses/700'
    );
    expect(entry).toHaveTextContent(/Joined November 16, 2026/);
  });

  it('shows an error with a real retry when the Hall of Fame cannot load', async () => {
    let fail = true;
    server.use(
      http.get(path, () =>
        fail
          ? HttpResponse.json({ success: false, message: 'boom' }, { status: 500 })
          : HttpResponse.json(empty)
      )
    );
    const user = userEvent.setup();
    renderPage();

    const retry = await screen.findByRole('button', { name: /try again/i });
    fail = false;
    await user.click(retry);
    expect(await screen.findByText(/no one has earned the right/i)).toBeInTheDocument();
  });
});
