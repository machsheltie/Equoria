/**
 * Riders and grooms back for hire (Equoria-266h7, Equoria-hwboq).
 *
 * Owner rulings 2026-10-28: released and unpaid staff return to a hiring pool (q153) at
 * their current level with their reveals intact (q177); a card shows name, stars,
 * personality and only REVEALED items as authored words; hiring is one click with the
 * weekly price on the button and no confirmation box (q230).
 *
 * Owner ruling 2026-10-29 (q284): they sit in the SAME list as the newly generated
 * staff, with no separate section. (Old contract, Equoria-266h7: a "Riders / Grooms
 * Back for Hire" section below the marketplace, with its own empty state.)
 *
 * Boundary-level: the real pool hooks run through the real api-client; only the network
 * is stubbed (MSW), with bodies shaped like the backend's free-agents responses. The
 * new staff come in through the lists' marketplaceData prop.
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
import RiderList from '../RiderList';
import GroomList from '../GroomList';
import RidersPage from '@/pages/RidersPage';
import type { RiderMarketplaceData } from '@/lib/api/types';
import type { MarketplaceData } from '@/lib/api/groomStaffTypes';

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
      label: 'Favorite breeds',
      total: 2,
      revealed: [{ label: 'Thoroughbred', sign: 'positive', note: 'Favorite' }],
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
  starLevel: 'novice',
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

// One newly generated rider / groom, so a test can see both kinds in one list.
const riderMarket: RiderMarketplaceData = {
  riders: [
    {
      marketplaceId: 'mkt_rider_new',
      firstName: 'Ada',
      lastName: 'Brooks',
      skillLevel: 'rookie',
      starLevel: 'rookie',
      personality: 'methodical',
      experience: 0,
      weeklyRate: 100,
      bio: 'New to the circuit.',
      availability: true,
    },
  ],
  lastRefresh: '2026-10-29T00:00:00Z',
  nextFreeRefresh: '2026-10-30T00:00:00Z',
  refreshCost: 0,
  canRefreshFree: true,
};

const groomMarket: MarketplaceData = {
  grooms: [
    {
      marketplaceId: 'mkt_groom_new',
      firstName: 'Zed',
      lastName: 'Fisher',
      specialty: 'general',
      skillLevel: 'novice',
      starLevel: 'rookie',
      weeklyFee: 100,
      personality: 'calm',
      experience: 1,
      sessionRate: 15,
      bio: 'Steady hands.',
      availability: true,
    },
  ],
  lastRefresh: '2026-10-29T00:00:00Z',
  nextFreeRefresh: '2026-10-30T00:00:00Z',
  refreshCost: 0,
  canRefreshFree: true,
  refreshCount: 0,
  maxHorsesPerGroom: 4,
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

const riderList = <RiderList marketplaceData={riderMarket} />;
const groomList = <GroomList marketplaceData={groomMarket} />;

describe('riders back for hire, in the rider hire list (Equoria-266h7, q284)', () => {
  it('sits in the same list as the new riders, with no separate section', async () => {
    server.use(http.get(riderPoolUrl, () => riderPage([poolRider])));
    renderWith(riderList);

    const grid = await screen.findByTestId('rider-grid');
    expect(await within(grid).findByTestId('returning-rider-41')).toBeInTheDocument();
    expect(within(grid).getByTestId('rider-card-mkt_rider_new')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /back for hire/i })).not.toBeInTheDocument();
  });

  it('is filtered and sorted with the new riders', async () => {
    server.use(http.get(riderPoolUrl, () => riderPage([poolRider])));
    const user = userEvent.setup();
    renderWith(riderList);

    const grid = await screen.findByTestId('rider-grid');
    await within(grid).findByTestId('returning-rider-41');
    // By name: Ada Brooks, then Wren Hollis.
    const names = within(grid)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(names).toEqual(['Ada Brooks', 'Wren Hollis']);

    await user.selectOptions(screen.getByTestId('star-level-filter'), 'novice');
    expect(within(grid).getByTestId('returning-rider-41')).toBeInTheDocument();
    expect(within(grid).queryByTestId('rider-card-mkt_rider_new')).not.toBeInTheDocument();
  });

  it('shows name, stars, personality and only the revealed items, with the weekly price on Hire', async () => {
    server.use(http.get(riderPoolUrl, () => riderPage([poolRider])));
    renderWith(riderList);

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
    expect(reveals).toHaveTextContent('(Favorite)');
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
    renderWith(riderList);

    const card = await screen.findByTestId('returning-rider-41');
    expect(within(card).getByTestId('returning-staff-reveals')).toHaveTextContent(
      'Nothing revealed yet.'
    );
  });

  it('a successful empty pool leaves just the new riders, and no error', async () => {
    server.use(http.get(riderPoolUrl, () => riderPage([])));
    renderWith(riderList);

    expect(await screen.findByTestId('rider-card-mkt_rider_new')).toBeInTheDocument();
    expect(screen.queryByTestId('rider-pool-error')).not.toBeInTheDocument();
  });

  it('a failed load says so beside the list, keeps the new riders, and its retry refetches', async () => {
    let calls = 0;
    server.use(
      http.get(riderPoolUrl, () => {
        calls += 1;
        return calls === 1 ? refusal(500) : riderPage([poolRider]);
      })
    );
    const user = userEvent.setup();
    renderWith(riderList);

    const failure = await screen.findByTestId('rider-pool-error');
    expect(failure).toHaveTextContent("The riders back for hire didn't load.");
    expect(screen.getByTestId('rider-card-mkt_rider_new')).toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();

    await user.click(within(failure).getByRole('button', { name: /try again/i }));

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
    renderWith(riderList);

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
    renderWith(riderList);

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
    renderWith(riderList);

    await user.click(await screen.findByTestId('returning-rider-41-hire'));

    const alert = await within(screen.getByTestId('returning-rider-41')).findByRole('alert');
    expect(alert).toHaveTextContent("Your balance doesn't cover this hire.");
  });

  it('a rider the player cannot afford keeps the price on a disabled Hire', async () => {
    server.use(http.get(riderPoolUrl, () => riderPage([poolRider])));
    renderWith(riderList, 150);

    const hire = await screen.findByTestId('returning-rider-41-hire');
    expect(hire).toBeDisabled();
    expect(hire).toHaveTextContent('200');
    expect(screen.getByText(/balance doesn.t cover a week/i)).toBeInTheDocument();
  });

  it('says how many more are waiting when the pool is longer than one page', async () => {
    server.use(http.get(riderPoolUrl, () => riderPage([poolRider], 140)));
    renderWith(riderList);

    expect(
      await screen.findByText('Showing the 1 riders who came back most recently, of 140.')
    ).toBeInTheDocument();
  });
});

describe('grooms back for hire, in the groom hire list (Equoria-266h7, q284)', () => {
  it('sits in the same list as the new grooms, with stars, personality, care kind and revealed items only', async () => {
    server.use(http.get(groomPoolUrl, () => groomPage([poolGroom])));
    renderWith(groomList);

    const grid = await screen.findByTestId('groom-grid');
    const card = await within(grid).findByTestId('returning-groom-77');
    expect(within(grid).getByTestId('groom-card-mkt_groom_new')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /back for hire/i })).not.toBeInTheDocument();

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

  it('the specialty filter applies to grooms back for hire too', async () => {
    server.use(http.get(groomPoolUrl, () => groomPage([poolGroom])));
    const user = userEvent.setup();
    renderWith(groomList);

    await screen.findByTestId('returning-groom-77');
    await user.selectOptions(screen.getByTestId('specialty-filter'), 'general');
    expect(screen.queryByTestId('returning-groom-77')).not.toBeInTheDocument();
    expect(screen.getByTestId('groom-card-mkt_groom_new')).toBeInTheDocument();
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
    renderWith(groomList);

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
    renderWith(groomList);

    await user.click(await screen.findByTestId('returning-groom-77-hire'));

    const alert = await within(screen.getByTestId('returning-groom-77')).findByRole('alert');
    expect(alert).toHaveTextContent(/groom roster is full/i);
  });
});

describe('Rider Hall — the Hire tab is one list (q284)', () => {
  it('shows a returning rider in the rider marketplace grid, with no "Back for Hire" section', async () => {
    server.use(http.get(riderPoolUrl, () => riderPage([poolRider])));
    const user = userEvent.setup();
    renderWith(<RidersPage />);

    await user.click(await screen.findByTestId('hire-tab'));

    const list = await screen.findByTestId('rider-list');
    expect(await within(list).findByTestId('returning-rider-41')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Riders Back for Hire' })).not.toBeInTheDocument();
  });
});
