/**
 * Hosting a show (Equoria-oey96.13).
 *
 * Real dialog, real hooks, real AuthProvider; MSW answers only the network
 * boundary. The server derives the prize (10 x the entry fee) and takes it from
 * the host at creation. Owner ruling 2026-10-26 (Equoria-o08zw): the prize is
 * stated on the Host button and hosting is one click, with no balance preview,
 * confirm step or receipt. Refusals are still shown in authored words.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '@/contexts/AuthContext';
import CreateShowDialog from '../CreateShowDialog';
import { server } from '@/test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface World {
  money: number;
  hosted: number;
  limit: number;
  posted: Record<string, unknown>[];
}

const newWorld = (over: Partial<World> = {}): World => ({
  money: 1000,
  hosted: 0,
  limit: 10,
  posted: [],
  ...over,
});

function stage(world: World, refusal?: { status: number; body: Record<string, unknown> }) {
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () =>
      HttpResponse.json({
        status: 'success',
        data: {
          user: {
            id: 1,
            username: 'host',
            email: 'host@example.com',
            firstName: 'Host',
            lastName: 'Player',
            role: 'user',
            money: world.money,
          },
        },
      })
    ),
    http.get(`${base}/api/v1/competition/disciplines`, () =>
      HttpResponse.json({
        success: true,
        data: {
          disciplines: ['Dressage', 'Show Jumping', 'Barrel Racing'],
          disciplineDetails: [],
        },
      })
    ),
    http.get(`${base}/api/v1/shows/hosting`, () =>
      HttpResponse.json({
        success: true,
        data: {
          hostedThisWeek: world.hosted,
          weeklyLimit: world.limit,
          weekStartedAt: '2026-10-19T04:00:00.000Z',
        },
      })
    ),
    http.post(`${base}/api/v1/shows/create`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      world.posted.push(body);
      if (refusal) {
        return HttpResponse.json({ success: false, ...refusal.body }, { status: refusal.status });
      }
      const prize = 10 * (body.entryFee as number);
      world.money -= prize;
      world.hosted += 1;
      return HttpResponse.json(
        {
          success: true,
          data: {
            show: {
              id: 7,
              name: body.name,
              discipline: body.discipline,
              entryFee: body.entryFee,
              prize,
              levelMin: body.level,
              levelMax: body.level,
              runDate: '2026-10-31T12:00:00.000Z',
            },
          },
        },
        { status: 201 }
      );
    })
  );
}

function renderDialog(onOpenChange: (open: boolean) => void = () => {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter>
          <CreateShowDialog open onOpenChange={onOpenChange} />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

type User = ReturnType<typeof userEvent.setup>;

async function fillForm(user: User, fee: string) {
  await user.type(await screen.findByLabelText(/show name/i), 'Starlit Dressage Cup');
  const discipline = await screen.findByLabelText(/discipline/i);
  await waitFor(() => expect(within(discipline).getByText('Dressage')).toBeInTheDocument());
  await user.selectOptions(discipline, 'Dressage');
  await user.selectOptions(screen.getByLabelText(/^level/i), '3');
  const feeInput = screen.getByLabelText(/entry fee/i);
  await user.clear(feeInput);
  await user.type(feeInput, fee);
}

describe('CreateShowDialog (Equoria-oey96.13)', () => {
  it('states how many shows the player has hosted this week', async () => {
    stage(newWorld({ hosted: 3 }));
    renderDialog();
    expect(await screen.findByText('3 of 10 shows this week')).toBeInTheDocument();
  });

  it('offers the disciplines the server lists, as one flat list', async () => {
    stage(newWorld());
    renderDialog();
    const select = (await screen.findByLabelText(/discipline/i)) as HTMLSelectElement;
    await waitFor(() =>
      expect([...select.options].map((o) => o.text)).toEqual(
        expect.arrayContaining(['Dressage', 'Show Jumping', 'Barrel Racing'])
      )
    );
    expect(select.querySelector('optgroup')).toBeNull();
  });

  it('offers levels 1 to 20', async () => {
    stage(newWorld());
    renderDialog();
    const select = (await screen.findByLabelText(/^level/i)) as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(
      Array.from({ length: 20 }, (_, i) => String(i + 1))
    );
  });

  it('states the prize on the Host button and shows no balance preview', async () => {
    const world = newWorld();
    stage(world);
    const user = userEvent.setup();
    renderDialog();
    expect(await screen.findByRole('button', { name: 'Host Show' })).toBeInTheDocument();
    await fillForm(user, '50');
    expect(screen.getByRole('button', { name: 'Host Show (prize 500)' })).toBeInTheDocument();
    expect(screen.queryByText(/your coins/i)).toBeNull();
    expect(screen.queryByTestId('create-show-confirm')).toBeNull();
    expect(world.posted).toHaveLength(0);
  });

  it('hosts the show in one click, sends no prize, and closes with no receipt', async () => {
    const world = newWorld();
    stage(world);
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);
    await fillForm(user, '50');
    await user.click(screen.getByRole('button', { name: 'Host Show (prize 500)' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(world.posted).toEqual([
      { name: 'Starlit Dressage Cup', discipline: 'Dressage', level: 3, entryFee: 50 },
    ]);
    expect(screen.queryByTestId('create-show-receipt')).toBeNull();
    expect(document.body).not.toHaveTextContent(/your coins/i);
  });

  it('labels a free show as free on the button', async () => {
    stage(newWorld());
    const user = userEvent.setup();
    renderDialog();
    await fillForm(user, '0');
    expect(screen.getByRole('button', { name: 'Host Show (free)' })).toBeInTheDocument();
  });

  it('will not host a show whose prize the player cannot cover', async () => {
    const world = newWorld({ money: 100 });
    stage(world);
    const user = userEvent.setup();
    renderDialog();
    await fillForm(user, '50');
    await waitFor(() => expect(screen.getByLabelText(/show name/i)).toBeInTheDocument());
    await user.click(await screen.findByRole('button', { name: /^host show/i }));
    expect(await screen.findByText(/coins don't cover the prize/i)).toBeInTheDocument();
    expect(world.posted).toHaveLength(0);
  });

  it('says the week is full and offers no way to host when the limit is reached', async () => {
    stage(newWorld({ hosted: 10 }));
    const user = userEvent.setup();
    renderDialog();
    expect(await screen.findByText('10 of 10 shows this week')).toBeInTheDocument();
    await fillForm(user, '5');
    expect(screen.getByRole('button', { name: /^host show/i })).toBeDisabled();
    expect(screen.getByText(/new week of hosting begins on monday/i)).toBeInTheDocument();
  });

  it('shows an authored refusal, never the code or the server wording, and keeps the form', async () => {
    stage(newWorld(), {
      status: 409,
      body: {
        code: 'weeklyShowLimitReached',
        message: 'RAW SERVER WORDING weeklyShowLimitReached',
      },
    });
    const user = userEvent.setup();
    renderDialog();
    await fillForm(user, '50');
    await user.click(screen.getByRole('button', { name: /^host show/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/hosted all the shows you can this week/i);
    expect(document.body).not.toHaveTextContent('weeklyShowLimitReached');
    expect(document.body).not.toHaveTextContent('RAW SERVER WORDING');
    expect(screen.getByLabelText(/show name/i)).toHaveValue('Starlit Dressage Cup');
  });

  it('names a taken show name', async () => {
    stage(newWorld(), {
      status: 409,
      body: { code: 'showNameTaken', message: 'A show with that name already exists' },
    });
    const user = userEvent.setup();
    renderDialog();
    await fillForm(user, '5');
    await user.click(screen.getByRole('button', { name: /^host show/i }));
    expect(await screen.findByText(/another show already has that name/i)).toBeInTheDocument();
  });

  it('refuses a name under two characters before hosting', async () => {
    stage(newWorld());
    const user = userEvent.setup();
    renderDialog();
    await user.type(await screen.findByLabelText(/show name/i), 'A');
    const discipline = await screen.findByLabelText(/discipline/i);
    await waitFor(() => expect(within(discipline).getByText('Dressage')).toBeInTheDocument());
    await user.selectOptions(discipline, 'Dressage');
    await user.click(screen.getByRole('button', { name: /^host show/i }));
    expect(await screen.findByText(/at least two characters/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/show name/i)).toBeInTheDocument();
  });
});
