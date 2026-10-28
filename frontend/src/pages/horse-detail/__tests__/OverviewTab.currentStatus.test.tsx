import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw/server';
import { MemoryRouter } from '../../../test/utils';
import OverviewTab from '../OverviewTab';
import type { Horse } from '../HorseDetailPageTypes';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Equoria-0l0tq (owner request 2026-10-23): Current Status shows Health and
 * Hunger status bars (five levels, always labelled) and Last Shod / Last
 * Trained / Last Groomed dates. Shod more than a week ago glows red; Trained and
 * Groomed glow green when the SERVER says the horse can be trained / groomed now.
 * Driven against HTTP-level MSW overrides of the real /overview endpoint.
 *
 * Owner request 2026-10-28 (Equoria-2w4yo) changed this section's contract: the
 * old heading "Current Status" is now "Horse Details", and the facts from the
 * removed line under the horse's name (Color, Breed — provisional, q206 —
 * Markings, Temperament) sit directly below Age / Date of Birth / Gender.
 *
 * Owner rulings 2026-10-28 changed it again: Breed moves above Age (q206, it
 * was provisionally after Color), and the Color row carries the coat's shade,
 * "Bay — Dark" (q214).
 */

const HORSE: Horse = {
  id: 7,
  name: 'TestFixture-Comet',
  breed: 'Thoroughbred',
  age: 5,
  gender: 'Mare',
  dateOfBirth: '2021-01-01T00:00:00Z',
  healthStatus: 'Excellent',
  stats: {} as Horse['stats'],
  disciplineScores: {},
  traits: [],
  displayedHealth: 'Good',
  feedHealth: 'Fair',
};

const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const overview = (data: Record<string, unknown>) =>
  server.use(
    http.get(`${base}/api/v1/horses/:id/overview`, () => HttpResponse.json({ success: true, data }))
  );

const renderTab = (horse: Horse = HORSE) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <OverviewTab horse={horse} />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('OverviewTab Horse Details (Equoria-2w4yo)', () => {
  const detailed: Horse = {
    ...HORSE,
    temperament: 'Spirited',
    phenotype: { colorName: 'Dapple Grey' },
    markings: { faceMarking: 'blaze', legMarkings: { frontLeft: 'sock' } },
  };

  it('is titled "Horse Details", no longer "Current Status"', () => {
    overview({ lastShod: null, lastTrainedAt: null, lastGroomed: null });
    renderTab(detailed);
    expect(screen.getByRole('heading', { name: 'Horse Details' })).toBeInTheDocument();
    expect(screen.queryByText('Current Status')).not.toBeInTheDocument();
  });

  it('lists Breed above Age, and Color, Markings and Temperament below Age, Date of Birth and Gender', async () => {
    overview({ lastShod: null, lastTrainedAt: null, lastGroomed: null });
    renderTab(detailed);
    await screen.findByTestId('last-shod');

    const section = screen.getByRole('region', { name: 'Horse Details' });
    const labels = within(section)
      .getAllByRole('term')
      .map((dt) => dt.textContent);
    expect(labels).toEqual([
      'Breed',
      'Age',
      'Date of Birth',
      'Gender',
      'Color',
      'Markings',
      'Temperament',
      'Last Shod',
      'Last Trained',
      'Last Groomed',
    ]);

    // The visible colour from the phenotype, the breed by name, the markings in
    // their authored words, the temperament as stored and shown before.
    expect(screen.getByTestId('horse-detail-color')).toHaveTextContent(/^Dapple Grey$/);
    expect(screen.getByTestId('horse-detail-breed')).toHaveTextContent(/^Thoroughbred$/);
    expect(screen.getByTestId('markings-face-value')).toHaveTextContent('Blaze');
    expect(screen.getByTestId('markings-legs')).toHaveTextContent('FL: Sock');
    expect(screen.queryByTestId('markings-panel-title')).not.toBeInTheDocument();
    expect(screen.getByTestId('horse-temperament-value')).toHaveTextContent('Spirited');
  });

  it('reads the coat shade on the Color row, e.g. "Bay — Dark" (q214)', () => {
    overview({ lastShod: null, lastTrainedAt: null, lastGroomed: null });
    renderTab({ ...detailed, phenotype: { colorName: 'Bay', shade: 'dark' } });
    expect(screen.getByTestId('horse-detail-color')).toHaveTextContent(/^Bay — Dark$/);
  });

  it('says "not recorded" for a legacy horse with no colour, markings or temperament', () => {
    overview({ lastShod: null, lastTrainedAt: null, lastGroomed: null });
    renderTab({ ...HORSE, phenotype: null, markings: null, temperament: null });
    expect(screen.getByTestId('horse-detail-color')).toHaveTextContent(/^not recorded$/);
    expect(screen.getByTestId('horse-detail-markings')).toHaveTextContent(/^not recorded$/);
    expect(screen.getByTestId('horse-temperament-value')).toHaveTextContent(/^not recorded$/);
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument();
  });

  it('opens the temperament reference from the Temperament row', async () => {
    overview({ lastShod: null, lastTrainedAt: null, lastGroomed: null });
    const onOpen = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <OverviewTab horse={detailed} onOpenTemperamentReference={onOpen} />
        </QueryClientProvider>
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open temperament reference' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('OverviewTab Horse Details care status (Equoria-0l0tq)', () => {
  it('shows the Health Status and Hunger Status bars filled by level, each labelled', async () => {
    overview({ lastShod: null, lastTrainedAt: null, lastGroomed: null });
    renderTab();

    const health = screen.getByTestId('health-status-bar');
    expect(within(health).getByTestId('health-status-bar-label')).toHaveTextContent('Good');
    expect(within(health).getByRole('meter', { name: 'Health Status' })).toHaveAttribute(
      'aria-valuetext',
      'Good'
    );
    // Good fills three of five segments.
    const filled = (bar: HTMLElement, id: string) =>
      within(bar)
        .getAllByTestId(`${id}-segment`)
        .filter((s) => s.getAttribute('data-filled') === 'true').length;
    expect(filled(health, 'health-status-bar')).toBe(3);

    const hunger = screen.getByTestId('hunger-status-bar');
    expect(within(hunger).getByTestId('hunger-status-bar-label')).toHaveTextContent('Fair');
    expect(filled(hunger, 'hunger-status-bar')).toBe(2);
    expect(await screen.findByTestId('last-shod')).toBeInTheDocument();
  });

  it('glows Last Shod red when it was more than a week ago, and not within a week', async () => {
    overview({ lastShod: daysAgoIso(9), lastTrainedAt: null, lastGroomed: null });
    const { unmount } = renderTab();
    expect(await screen.findByTestId('last-shod')).toHaveAttribute('data-glow', 'overdue');
    // The date only, never the word "bad".
    expect(screen.getByTestId('last-shod').textContent).not.toMatch(/bad/i);
    unmount();

    overview({ lastShod: daysAgoIso(2), lastTrainedAt: null, lastGroomed: null });
    renderTab();
    expect(await screen.findByTestId('last-shod')).toHaveAttribute('data-glow', 'none');
  });

  it("glows Last Trained and Last Groomed green only when the server's verdict says now", async () => {
    overview({
      lastShod: daysAgoIso(1),
      lastTrainedAt: daysAgoIso(10),
      lastGroomed: daysAgoIso(1),
      canTrainNow: true,
      canGroomToday: false,
    });
    renderTab();
    expect(await screen.findByTestId('last-trained')).toHaveAttribute('data-glow', 'ready');
    expect(screen.getByTestId('last-groomed')).toHaveAttribute('data-glow', 'none');
    // Colour is never the only signal.
    expect(screen.getByTestId('last-trained')).toHaveTextContent('(ready now)');
  });

  it('shows "Never" for a horse never trained and glows nothing when the verdict is unknown', async () => {
    overview({ lastShod: daysAgoIso(1), canTrainNow: null, canGroomToday: null });
    renderTab();
    const trained = await screen.findByTestId('last-trained');
    expect(trained).toHaveTextContent('Never');
    expect(trained).toHaveAttribute('data-glow', 'none');
  });

  it('shows an honest error with Try Again when the care status cannot be read', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:id/overview`, () =>
        HttpResponse.json({ success: false, message: 'boom' }, { status: 500 })
      )
    );
    renderTab();
    expect(await screen.findByTestId('care-status-error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
    expect(screen.queryByTestId('last-trained')).not.toBeInTheDocument();
    expect(screen.queryByText(/boom/i)).not.toBeInTheDocument();
  });
});
