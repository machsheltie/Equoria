/**
 * CareArea — tonight's care on the horse page (Equoria-j765w.2; owner ruling
 * q67, 2026-10-26).
 *
 * Real CareArea, real useGroomCare hooks, real apiClient (CSRF round trip
 * included). Only the HTTP boundary is stubbed, with MSW, in the shapes of the
 * care agent's contract v1 (GET/POST /api/v1/grooms/care/...).
 *
 * Proves: tonight's care shows open; one press closes it; a foal picks one of
 * the day's activities first and the press sends that activity; refusal codes
 * and activity ids never reach the screen; a horse with no groom offers
 * "Assign a groom" carrying the horse; a failed read shows an honest error with
 * a working retry; a refused press keeps the chosen activity.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import CareArea from '../CareArea';
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

/**
 * A server that remembers: after a successful groom, GET answers the tended
 * status too (the page re-reads the horse after grooming).
 */
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

const renderCare = (name = 'TestFixture-Moonflower', path = `/horses/${horseId}`) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <CareArea horseId={horseId} horseName={name} />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('CareArea (Equoria-j765w.2)', () => {
  it("shows tonight's care as open, and one press of Groom closes it", async () => {
    const posts: { body: unknown; csrf: string | null }[] = [];
    serveGroomable(adultOpen, adultTended, posts);
    const user = userEvent.setup();
    renderCare();

    const section = await screen.findByTestId('horse-care');
    await waitFor(() => expect(section).toHaveAttribute('data-state', 'open'));
    expect(screen.getByTestId('horse-care-line')).toHaveTextContent(
      /^Tonight.s care for TestFixture-Moonflower is still open\. Hazel Brook is ready when you are\.$/
    );
    // An adult has no activity choice.
    expect(screen.queryByTestId('horse-care-activities')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Groom TestFixture-Moonflower' }));

    await waitFor(() => expect(section).toHaveAttribute('data-state', 'tended'));
    expect(posts).toEqual([{ body: {}, csrf: 'test-csrf-token' }]);
    expect(screen.getByTestId('horse-care-line')).toHaveTextContent(
      'TestFixture-Moonflower has been groomed tonight by Hazel Brook.'
    );
    expect(screen.queryByRole('button', { name: /Groom/ })).not.toBeInTheDocument();
    // No receipt and no before/after numbers.
    expect(section.textContent).not.toMatch(/35|40|\+5/);
  });

  it("asks a foal's player to pick one of the day's activities, then sends it", async () => {
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
    renderCare('TestFixture-Starling');

    const choices = await screen.findByTestId('horse-care-activities');
    expect(within(choices).getByText(/Day 4 of TestFixture-Starling.s life/)).toBeInTheDocument();
    expect(within(choices).getByText(/Socialization and Environment/)).toBeInTheDocument();
    const groomButton = screen.getByRole('button', { name: 'Groom TestFixture-Starling' });
    expect(groomButton).toBeDisabled();

    await user.click(within(choices).getByRole('radio', { name: 'Tying' }));
    expect(groomButton).toBeEnabled();
    await user.click(groomButton);

    expect(await screen.findByTestId('horse-care-todays-activity')).toHaveTextContent(
      /^Today.s activity: Tying\.$/
    );
    expect(posts).toEqual([{ body: { activity: 'tyingPractice' }, csrf: 'test-csrf-token' }]);
    // Code names never reach the screen.
    const text = screen.getByTestId('horse-care').textContent ?? '';
    expect(text).not.toMatch(/tyingPractice|socialEnvironment|alreadyGroomedToday/);
  });

  it('keeps the chosen activity and says why when the press is refused', async () => {
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
    renderCare('TestFixture-Starling');

    const leading = await screen.findByRole('radio', { name: 'Leading' });
    await user.click(leading);
    await user.click(screen.getByRole('button', { name: 'Groom TestFixture-Starling' }));

    expect(
      await screen.findByText(
        /That activity is not on today.s list any more\. Please choose again\./
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Leading' })).toBeChecked();
    expect(screen.queryByText('server words')).not.toBeInTheDocument();
    expect(screen.queryByText(/activityNotOffered/)).not.toBeInTheDocument();
  });

  it('re-reads the status after a 409 so the Care area shows the real reason', async () => {
    let reads = 0;
    server.use(
      http.get(careUrl, () => {
        reads += 1;
        return HttpResponse.json({
          success: true,
          data:
            reads === 1
              ? adultOpen
              : {
                  ...adultOpen,
                  canGroomToday: false,
                  groom: null,
                  refusal: { code: 'noGroomAssigned', message: 'Moonflower has no groom now.' },
                },
        });
      }),
      http.post(`${careUrl}/groom`, () =>
        HttpResponse.json(
          { success: false, message: 'x', data: { code: 'noGroomAssigned' } },
          { status: 409 }
        )
      )
    );
    const user = userEvent.setup();
    renderCare();

    await user.click(await screen.findByRole('button', { name: 'Groom TestFixture-Moonflower' }));

    expect(await screen.findByTestId('horse-care-refusal')).toHaveTextContent(
      'Moonflower has no groom now.'
    );
    expect(screen.getByTestId('horse-care')).toHaveAttribute('data-state', 'waiting');
  });

  it('offers "Assign a groom" for this horse when it has no groom', async () => {
    serveStatus({
      ...adultOpen,
      canGroomToday: false,
      groom: null,
      refusal: { code: 'noGroomAssigned', message: 'Moonflower needs a groom first.' },
    });
    renderCare();

    const link = await screen.findByTestId('horse-care-assign-groom');
    expect(link).toHaveAttribute('href', `/grooms?horseId=${horseId}`);
    expect(screen.getByTestId('horse-care-refusal')).toHaveTextContent(
      'Moonflower needs a groom first.'
    );
    expect(screen.queryByRole('button', { name: /Groom/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/noGroomAssigned/)).not.toBeInTheDocument();
  });

  it('shows an honest error with a retry that really re-reads', async () => {
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
    renderCare();

    expect(await screen.findByTestId('horse-care-error')).toBeInTheDocument();
    expect(screen.queryByText(/db exploded/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Groom/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(
      await screen.findByRole('button', { name: 'Groom TestFixture-Moonflower' })
    ).toBeInTheDocument();
  });

  it('takes focus when a home reminder opens it with #care', async () => {
    serveStatus(adultOpen);
    renderCare('TestFixture-Moonflower', `/horses/${horseId}#care`);
    const section = await screen.findByTestId('horse-care');
    await waitFor(() => expect(section).toHaveFocus());
  });
});
