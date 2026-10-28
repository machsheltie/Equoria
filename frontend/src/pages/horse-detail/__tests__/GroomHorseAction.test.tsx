/**
 * Groom Horse in the horse page's Quick Actions (owner ruling 2026-10-28,
 * Equoria-7dje4). Old contract, replaced by that ruling: a "Tonight's Care"
 * block in the middle of the page (CareArea, Equoria-j765w.2) held the press.
 *
 * Real GroomHorseAction, real useGroomCare hooks, real apiClient (CSRF round
 * trip included). Only the HTTP boundary is stubbed, with MSW, in the shapes of
 * GET/POST /api/v1/grooms/care/...
 *
 * Proves: an adult horse grooms in one press and the button says it is done; a
 * foal's press opens today's activities and choosing one sends it; refusal
 * codes and activity ids never reach the screen; a horse with no groom offers
 * Assign Groom carrying the horse; a failed read shows the mapped copy with a
 * retry that really re-reads.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import GroomHorseAction from '../GroomHorseAction';
import type { CareStatus } from '@/lib/api/groomCare';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const horseId = 314;
const careUrl = `${base}/api/v1/grooms/care/${horseId}`;

const adultOpen: CareStatus = {
  horseId,
  horseName: 'TestFixture-Moonflower',
  bond: 35,
  lastGroomedAt: null,
  groomedToday: false,
  canGroomToday: true,
  refusal: null,
  groom: { id: 7, name: 'Hazel Brook' },
  foal: null,
};

const adultTended: CareStatus = {
  ...adultOpen,
  bond: 40,
  groomedToday: true,
  canGroomToday: false,
  lastGroomedAt: new Date().toISOString(),
  refusal: { code: 'alreadyGroomedToday', message: 'Already groomed today. Come back tomorrow.' },
};

const foalOpen: CareStatus = {
  ...adultOpen,
  horseName: 'TestFixture-Starling',
  foal: {
    day: 4,
    band: {
      id: 'socialEnvironment',
      label: 'Socialization and Environment',
      firstDay: 3,
      lastDay: 4,
    },
    activities: [
      { id: 'leading', label: 'Leading' },
      { id: 'tyingPractice', label: 'Tying' },
    ],
    todaysActivity: null,
  },
};

const serveStatus = (status: CareStatus) =>
  server.use(http.get(careUrl, () => HttpResponse.json({ success: true, data: status })));

/** After a successful groom, GET answers the tended status too. */
const serveGroomable = (
  open: CareStatus,
  tended: CareStatus,
  seen: { body: unknown; csrf: string | null }[]
) => {
  let groomed = false;
  server.use(
    http.get(careUrl, () => HttpResponse.json({ success: true, data: groomed ? tended : open })),
    http.post(`${careUrl}/groom`, async ({ request }) => {
      seen.push({ body: await request.json(), csrf: request.headers.get('X-CSRF-Token') });
      groomed = true;
      return HttpResponse.json({ success: true, data: tended });
    })
  );
};

const Where: React.FC = () => {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
};

const renderAction = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/horses/${horseId}`]}>
        <Routes>
          <Route path="/horses/:id" element={<GroomHorseAction horseId={horseId} />} />
          <Route path="/grooms" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Groom Horse in Quick Actions (Equoria-7dje4)', () => {
  it('grooms an adult horse in one press, then says it is groomed today', async () => {
    const posts: { body: unknown; csrf: string | null }[] = [];
    serveGroomable(adultOpen, adultTended, posts);
    const user = userEvent.setup();
    renderAction();

    const button = await screen.findByRole('button', { name: 'Groom Horse' });
    await waitFor(() => expect(button).toBeEnabled());
    // An adult has no activity choice.
    expect(button).not.toHaveAttribute('aria-expanded');

    await user.click(button);

    expect(await screen.findByRole('button', { name: 'Groomed Today' })).toBeDisabled();
    expect(posts).toEqual([{ body: {}, csrf: 'test-csrf-token' }]);
    expect(screen.queryByTestId('groom-activity-picker')).not.toBeInTheDocument();
  });

  it("opens a foal's activities for today, and choosing one grooms with it", async () => {
    const posts: { body: unknown; csrf: string | null }[] = [];
    serveGroomable(
      foalOpen,
      {
        ...foalOpen,
        groomedToday: true,
        canGroomToday: false,
        refusal: { code: 'alreadyGroomedToday', message: 'Already groomed today.' },
        foal: { ...foalOpen.foal!, todaysActivity: { id: 'tyingPractice', label: 'Tying' } },
      },
      posts
    );
    const user = userEvent.setup();
    renderAction();

    const button = await screen.findByRole('button', { name: 'Groom Horse' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');

    const picker = screen.getByTestId('groom-activity-picker');
    expect(picker).toHaveTextContent(/Day 4, Socialization and Environment/);
    await user.click(within(picker).getByRole('button', { name: 'Tying' }));

    expect(await screen.findByRole('button', { name: 'Groomed Today' })).toBeDisabled();
    expect(posts).toEqual([{ body: { activity: 'tyingPractice' }, csrf: 'test-csrf-token' }]);
    expect(screen.queryByTestId('groom-activity-picker')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/tyingPractice|socialEnvironment/);
  });

  it('says why when a press is refused, in authored words, never the code', async () => {
    serveStatus(foalOpen);
    server.use(
      http.post(`${careUrl}/groom`, () =>
        HttpResponse.json(
          { success: false, message: 'server words', data: { code: 'activityNotOffered' } },
          { status: 400 }
        )
      )
    );
    const user = userEvent.setup();
    renderAction();

    const button = await screen.findByRole('button', { name: 'Groom Horse' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    await user.click(screen.getByRole('button', { name: 'Leading' }));

    expect(
      await screen.findByText(
        /That activity is not on today.s list any more\. Please choose again\./
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('server words')).not.toBeInTheDocument();
    expect(screen.queryByText(/activityNotOffered/)).not.toBeInTheDocument();
  });

  it('offers Assign Groom for this horse when it has no groom', async () => {
    serveStatus({
      ...adultOpen,
      canGroomToday: false,
      groom: null,
      refusal: { code: 'noGroomAssigned', message: 'Moonflower needs a groom first.' },
    });
    const user = userEvent.setup();
    renderAction();

    await user.click(await screen.findByRole('button', { name: 'Assign Groom' }));
    expect(screen.getByTestId('where')).toHaveTextContent(`/grooms?horseId=${horseId}`);
  });

  it('shows the mapped copy and a retry that really re-reads when the care read fails', async () => {
    let reads = 0;
    server.use(
      http.get(careUrl, () => {
        reads += 1;
        return reads === 1
          ? HttpResponse.json({ success: false, message: 'db exploded' }, { status: 500 })
          : HttpResponse.json({ success: true, data: adultOpen });
      })
    );
    const user = userEvent.setup();
    renderAction();

    expect(await screen.findByTestId('groom-status-retry')).toBeInTheDocument();
    expect(screen.queryByText(/db exploded/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Groom Horse' })).toBeDisabled();

    await user.click(screen.getByTestId('groom-status-retry'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Groom Horse' })).toBeEnabled());
  });
});
