/**
 * Compete from a horse arrives with that horse chosen (Equoria-vlpz4, NAV-02).
 *
 * The horse page and Next Actions send /competitions?horseId=<id>; the page
 * read only ?horse=, so the entry form fell back to the first horse in the
 * stable. Real page, real hooks and apiClient; only the network is stubbed (MSW
 * default horses: 1 Storm Runner, 2 Midnight Dream).
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router';
import { http, HttpResponse } from 'msw';
import CompetitionBrowserPage from '../CompetitionBrowserPage';
import { MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const closes = new Date(Date.now() + 3 * 24 * 3_600_000).toISOString();

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe" data-search={location.search} />;
}

function renderAt(url: string) {
  server.use(
    http.get(`${base}/api/v1/competition`, () =>
      HttpResponse.json({
        success: true,
        data: [
          {
            id: 1,
            name: 'Silverbrook Dressage Cup',
            discipline: 'Dressage',
            showType: 'ridden',
            runDate: closes,
            closeDate: closes,
            prizePool: 100,
            entryFee: 0,
            status: 'open',
          },
        ],
      })
    )
  );
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <MemoryRouter initialEntries={[url]}>
          <CompetitionBrowserPage />
          <LocationProbe />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

async function openShowAndReadHorse(): Promise<string> {
  const user = userEvent.setup();
  const panel = await screen.findByTestId('ridden-tab-panel');
  await user.click(await within(panel).findByText('Silverbrook Dressage Cup'));
  const select = (await screen.findByTestId('competition-entry-horse-select')) as HTMLSelectElement;
  return select.value;
}

describe('CompetitionBrowserPage — ?horseId= from a horse (Equoria-vlpz4)', () => {
  it('chooses the horse the player came from, then drops the consumed param', async () => {
    renderAt('/competitions?horseId=2');
    await waitFor(() =>
      expect(screen.getByTestId('location-probe').getAttribute('data-search')).toBe('')
    );
    expect(await openShowAndReadHorse()).toBe('2');
  });

  it('still honors the older ?horse= link', async () => {
    renderAt('/competitions?horse=2');
    await waitFor(() =>
      expect(screen.getByTestId('location-probe').getAttribute('data-search')).toBe('')
    );
    expect(await openShowAndReadHorse()).toBe('2');
  });
});
