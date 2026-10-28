/**
 * Riders and grooms back for hire (Equoria-266h7).
 *
 * Owner rulings 2026-10-28: released and unpaid staff return to a hiring pool (q153) at
 * their current level with their reveals intact (q177); a card shows name, stars,
 * personality and only REVEALED items as authored words; hiring is one click with the
 * weekly price on the button and no confirmation box (q230).
 *
 * Boundary-level: the real pool hooks run through the real api-client; only the network
 * is stubbed (MSW), with bodies shaped like the backend's free-agents responses.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import ReturningRiders from '../rider/ReturningRiders';
import ReturningGrooms from '../groom/ReturningGrooms';
import RidersPage from '@/pages/RidersPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const riderPoolUrl = `${base}/api/v1/riders/free-agents`;
const riderHireUrl = `${base}/api/v1/riders/free-agents/hire`;
const groomPoolUrl = `${base}/api/v1/groom-marketplace/free-agents`;
const groomHireUrl = `${base}/api/v1/groom-marketplace/free-agents/hire`;

const growth = (starLevel: string) => ({
  starLevel,
  stars: 2,
  levelLabel: 'Novice',
  personality: 'daring',
  personalityLabel: 'Daring',
  totalItems: 12,
  revealedCount: 3,
  categories: [
    {
      label: 'Horse traits',
      total: 4,
      revealed: [{ label: 'Bold Heart', sign: 'positive', note: 'Strength' }],
    },
    {
      label: 'Disciplines',
      total: 4,
      revealed: [{ label: 'Show Jumping', sign: 'negative', note: 'Weakness' }],
    },
    { label: 'Temperaments', total: 2, revealed: [] },
    {
      label: 'Favourite breeds',
      total: 2,
      revealed: [{ label: 'Thoroughbred', sign: 'positive', note: 'Favourite' }],
    },
  ],
});

const poolRider = {
  id: 41,
  firstName: 'Wren',
  lastName: 'Hollis',
  name: 'Wren Hollis',
  personality: 'daring',
  personalityLabel: 'Daring',
  skillLevel: 'rookie',
  skillLevelLabel: 'Rookie',
  starLevel: 'novice',
  speciality: 'Dressage',
  specialityLabel: 'Dressage',
  bio: 'Back in the saddle.',
  weeklyRate: 200,
  growth: growth('novice'),
};

const poolGroom = {
  id: 77,
  name: 'Maeve Corran',
  personality: 'gentle',
  personalityLabel: 'Gentle',
  skillLevel: 'novice',
  skillLevelLabel: 'Novice',
  starLevel: 'novice',
  speciality: 'foalCare',
  specialityLabel: 'Foal Care',
  bio: 'Knows every foal by name.',
  experience: 3,
  sessionRate: 20,
  weeklyFee: 200,
  growth: growth('novice'),
};

const riderPage = (riders: unknown[], total = riders.length) =>
  HttpResponse.json({ success: true, data: { riders, total } });
const groomPage = (grooms: unknown[], total = grooms.length) =>
  HttpResponse.json({ success: true, data: { grooms, total } });
const refusal = (status: number, code?: string) =>
  HttpResponse.json({ success: false, code, message: 'RAW-SERVER-TEXT leak' }, { status });

function renderWith(node: React.ReactNode, money = 5000) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider userOverrides={{ money }}>
        <MemoryRouter>{node}</MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('ReturningRiders — riders back for hire (Equoria-266h7)', () => {
  it('shows name, stars, personality and only the revealed items, with the weekly price on Hire', async () => {
    server.use(http.get(riderPoolUrl, () => riderPage([poolRider])));
    renderWith(<ReturningRiders />);

    const card = await screen.findByTestId('returning-rider-41');
    expect(within(card).getByRole('heading', { name: 'Wren Hollis' })).toBeInTheDocument();
    // Stars, never "Lv.N".
    expect(within(card).getByTestId('staff-level')).toHaveTextContent('Novice★★');
    expect(card).not.toHaveTextContent(/Lv\.?\s*\d/i);
    expect(within(card).getByTestId('rider-personality-badge')).toHaveTextContent('Daring');

    const reveals = within(card).getByTestId('returning-staff-reveals');
    expect(reveals).toHaveTextContent('Bold Heart');
    expect(reveals).toHaveTextContent('(Strength)');
    expect(reveals).toHaveTextContent('Show Jumping');
    expect(reveals).toHaveTextContent('(Weakness)');
    expect(reveals).toHaveTextContent('Thoroughbred');
    expect(reveals).toHaveTextContent('(Favourite)');
    // Only what was revealed: no empty kinds, no undiscovered slots.
    expect(reveals).not.toHaveTextContent('Temperaments');
    expect(reveals).not.toHaveTextContent(/not yet discovered|\?/i);

    const hire = within(card).getByRole('button', { name: /hire wren hollis, 200 coins a week/i });
    expect(hire).toHaveTextContent('200');
    expect(hire).toHaveTextContent('/wk');
    expect(hire).toBeEnabled();
  });

  it('a rider with nothing revealed says so', async () => {
    const rookie = {
      ...poolRider,
      starLevel: 'rookie',
      growth: {
        ...growth('rookie'),
        revealedCount: 0,
        categories: growth('rookie').categories.map((c) => ({ ...c, revealed: [] })),
      },
    };
    server.use(http.get(riderPoolUrl, () => riderPage([rookie])));
    renderWith(<ReturningRiders />);

    const card = await screen.findByTestId('returning-rider-41');
    expect(within(card).getByTestId('returning-staff-reveals')).toHaveTextContent(
      'Nothing revealed yet.'
    );
  });

  it('a successful empty pool shows the empty state, not an error', async () => {
    server.use(http.get(riderPoolUrl, () => riderPage([])));
    renderWith(<ReturningRiders />);

    expect(await screen.findByText('No riders are back for hire')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a failed load shows an error whose retry refetches the real list', async () => {
    let calls = 0;
    server.use(
      http.get(riderPoolUrl, () => {
        calls += 1;
        return calls === 1 ? refusal(500) : riderPage([poolRider]);
      })
    );
    const user = userEvent.setup();
    renderWith(<ReturningRiders />);

    expect(await screen.findByText("The hiring list didn't load")).toBeInTheDocument();
    expect(screen.queryByText('No riders are back for hire')).not.toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByTestId('returning-rider-41')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('one click hires the rider by id, with no confirmation box, and the card leaves the list', async () => {
    let pool: unknown[] = [poolRider];
    let hiredBody: unknown = null;
    server.use(
      http.get(riderPoolUrl, () => riderPage(pool)),
      http.post(riderHireUrl, async ({ request }) => {
        hiredBody = await request.json();
        pool = [];
        return HttpResponse.json(
          {
            success: true,
            data: {
              rider: { id: 41, name: 'Wren Hollis', starLevel: 'novice' },
              cost: 200,
              remainingMoney: 4800,
            },
          },
          { status: 201 }
        );
      })
    );
    const user = userEvent.setup();
    renderWith(<ReturningRiders />);

    await user.click(await screen.findByTestId('returning-rider-41-hire'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(hiredBody).toEqual({ riderId: 41 }));
    expect(await screen.findByText('Wren Hollis has joined your riders.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('returning-rider-41')).not.toBeInTheDocument());
  });

  it('a rider hired away first says so on the card and the list is fetched again', async () => {
    let listCalls = 0;
    server.use(
      http.get(riderPoolUrl, () => {
        listCalls += 1;
        return riderPage([poolRider]);
      }),
      http.post(riderHireUrl, () => refusal(409))
    );
    const user = userEvent.setup();
    renderWith(<ReturningRiders />);

    await user.click(await screen.findByTestId('returning-rider-41-hire'));

    const alert = await within(screen.getByTestId('returning-rider-41')).findByRole('alert');
    expect(alert).toHaveTextContent('Another stable hired that rider a moment ago.');
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
    await waitFor(() => expect(listCalls).toBe(2));
  });

  it('a coded short-balance refusal names the balance', async () => {
    server.use(
      http.get(riderPoolUrl, () => riderPage([poolRider])),
      http.post(riderHireUrl, () => refusal(400, 'insufficientFunds'))
    );
    const user = userEvent.setup();
    renderWith(<ReturningRiders />);

    await user.click(await screen.findByTestId('returning-rider-41-hire'));

    const alert = await within(screen.getByTestId('returning-rider-41')).findByRole('alert');
    expect(alert).toHaveTextContent("Your balance doesn't cover this hire.");
  });

  it('a rider the player cannot afford keeps the price on a disabled Hire', async () => {
    server.use(http.get(riderPoolUrl, () => riderPage([poolRider])));
    renderWith(<ReturningRiders />, 150);

    const hire = await screen.findByTestId('returning-rider-41-hire');
    expect(hire).toBeDisabled();
    expect(hire).toHaveTextContent('200');
    expect(screen.getByText(/balance doesn.t cover a week/i)).toBeInTheDocument();
  });

  it('says how many more are waiting when the pool is longer than one page', async () => {
    server.use(http.get(riderPoolUrl, () => riderPage([poolRider], 140)));
    renderWith(<ReturningRiders />);

    expect(
      await screen.findByText('Showing the 1 riders who came back most recently, of 140.')
    ).toBeInTheDocument();
  });
});

describe('ReturningGrooms — grooms back for hire (Equoria-266h7)', () => {
  it('shows the groom with stars, personality, care kind and revealed items only', async () => {
    server.use(http.get(groomPoolUrl, () => groomPage([poolGroom])));
    renderWith(<ReturningGrooms />);

    const card = await screen.findByTestId('returning-groom-77');
    expect(within(card).getByRole('heading', { name: 'Maeve Corran' })).toBeInTheDocument();
    expect(within(card).getByTestId('staff-level')).toHaveTextContent('Novice★★');
    expect(card).toHaveTextContent('Gentle');
    expect(card).toHaveTextContent('Foal Care');
    // Stored codes never reach the player.
    expect(card).not.toHaveTextContent('foalCare');
    expect(within(card).getByTestId('returning-staff-reveals')).toHaveTextContent('Bold Heart');
    expect(
      within(card).getByRole('button', { name: /hire maeve corran, 200 coins a week/i })
    ).toBeEnabled();
  });

  it('one click hires the groom by id', async () => {
    let hiredBody: unknown = null;
    server.use(
      http.get(groomPoolUrl, () => groomPage([poolGroom])),
      http.post(groomHireUrl, async ({ request }) => {
        hiredBody = await request.json();
        return HttpResponse.json(
          {
            success: true,
            data: { groom: { id: 77, name: 'Maeve Corran' }, cost: 200, remainingMoney: 4800 },
          },
          { status: 201 }
        );
      })
    );
    const user = userEvent.setup();
    renderWith(<ReturningGrooms />);

    await user.click(await screen.findByTestId('returning-groom-77-hire'));

    await waitFor(() => expect(hiredBody).toEqual({ groomId: 77 }));
    expect(await screen.findByText('Maeve Corran has joined your grooms.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a full groom roster refusal says the roster is full', async () => {
    server.use(
      http.get(groomPoolUrl, () => groomPage([poolGroom])),
      http.post(groomHireUrl, () => refusal(400, 'rosterCapReached'))
    );
    const user = userEvent.setup();
    renderWith(<ReturningGrooms />);

    await user.click(await screen.findByTestId('returning-groom-77-hire'));

    const alert = await within(screen.getByTestId('returning-groom-77')).findByRole('alert');
    expect(alert).toHaveTextContent(/groom roster is full/i);
  });

  it('a successful empty pool shows the empty state', async () => {
    renderWith(<ReturningGrooms />);
    expect(await screen.findByText('No grooms are back for hire')).toBeInTheDocument();
  });
});

describe('Rider Hall — the Hire tab carries riders back for hire (Equoria-266h7)', () => {
  it('shows the returning riders below the rider marketplace', async () => {
    server.use(http.get(riderPoolUrl, () => riderPage([poolRider])));
    const user = userEvent.setup();
    renderWith(<RidersPage />);

    await user.click(await screen.findByTestId('hire-tab'));

    expect(await screen.findByTestId('rider-list')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Riders Back for Hire' })
    ).toBeInTheDocument();
    expect(await screen.findByTestId('returning-rider-41')).toBeInTheDocument();
  });
});
