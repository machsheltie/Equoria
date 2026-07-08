/**
 * HorseMarketplacePage — browse / my-listings / history four-state tests
 * (Equoria-l22ki)
 *
 * Regression guard for the "swallow-fetch-error-as-false-empty" defect: each of
 * the three tabs destructured only `{ data, isLoading }` from
 * useMarketplaceListings / useMyListings / useSaleHistory, so a FAILED fetch
 * rendered the honest empty state ("No horses listed for sale right now", "No
 * Active Listings", "No Sale History") — indistinguishable from a genuinely-empty
 * result. Per FRONTEND_ASYNC_STATE_DOCTRINE §1 the states are
 * LOADING → ERROR (visible + retry) → EMPTY (only via success) → SUCCESS.
 *
 * Boundary-level test: real hooks over the real apiClient, HTTP boundary stubbed
 * by MSW. No vi.mock of the hooks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { MemoryRouter } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import HorseMarketplacePage from '../HorseMarketplacePage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MARKETPLACE = `${base}/api/v1/marketplace`;
const MY_LISTINGS = `${base}/api/v1/marketplace/my-listings`;
const HISTORY = `${base}/api/v1/marketplace/history`;
const PROFILE = `${base}/api/v1/auth/profile`;

const sampleListing = {
  id: 4242,
  horseId: 4242,
  name: 'TestFixture-l22ki-listing',
  breed: 'Thoroughbred',
  age: 4,
  sex: 'Mare',
  salePrice: 5000,
  seller: 'TestFixture-seller',
  imageUrl: null,
  stats: { speed: 50, stamina: 50, agility: 50 },
};

const sampleMyListing = {
  id: 77,
  horseId: 77,
  name: 'TestFixture-l22ki-mine',
  breed: 'Arabian',
  age: 3,
  sex: 'Stallion',
  salePrice: 3000,
  imageUrl: null,
};

function stubProfile() {
  server.use(
    http.get(PROFILE, () =>
      HttpResponse.json({
        success: true,
        data: { user: { id: 1, username: 'tester', role: 'user', money: 100000 } },
      })
    )
  );
}

function browseEnvelope(listings: Array<Record<string, unknown>>) {
  return {
    success: true,
    data: { listings, pagination: { page: 1, totalPages: 1, total: listings.length } },
  };
}

describe('HorseMarketplacePage — Browse tab four-state (Equoria-l22ki)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    stubProfile();
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/marketplace']}>
          <HorseMarketplacePage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('shows a loading region while the browse fetch is pending', async () => {
    server.use(
      http.get(MARKETPLACE, async () => {
        await delay(150);
        return HttpResponse.json(browseEnvelope([]));
      })
    );

    renderPage();

    expect(await screen.findByRole('status', { name: /loading listings/i })).toBeInTheDocument();
    expect(screen.queryByText('No horses listed for sale right now')).not.toBeInTheDocument();
  });

  it('renders an error state with retry (not a false empty) when the browse fetch fails', async () => {
    server.use(
      http.get(MARKETPLACE, () =>
        HttpResponse.json({ status: 'error', message: 'market boom detail' }, { status: 500 })
      )
    );

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText('No horses listed for sale right now')).not.toBeInTheDocument();
    expect(screen.queryByText(/market boom detail/i)).not.toBeInTheDocument();
  });

  it('renders the honest empty state on a successful but empty browse fetch', async () => {
    server.use(http.get(MARKETPLACE, () => HttpResponse.json(browseEnvelope([]))));

    renderPage();

    expect(await screen.findByText('No horses listed for sale right now')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders listing cards on a successful browse fetch with data', async () => {
    server.use(http.get(MARKETPLACE, () => HttpResponse.json(browseEnvelope([sampleListing]))));

    renderPage();

    expect(await screen.findByText('TestFixture-l22ki-listing')).toBeInTheDocument();
    expect(screen.queryByText('No horses listed for sale right now')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('retry re-fetches and renders cards (refetch is wired to the error retry)', async () => {
    let calls = 0;
    server.use(
      http.get(MARKETPLACE, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ status: 'error', message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json(browseEnvelope([sampleListing]));
      })
    );

    const user = userEvent.setup();
    renderPage();

    const retryBtn = await screen.findByRole('button', { name: /try again/i });
    await user.click(retryBtn);

    expect(await screen.findByText('TestFixture-l22ki-listing')).toBeInTheDocument();
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});

describe('HorseMarketplacePage — My Listings + History tabs four-state (Equoria-l22ki)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    stubProfile();
    // Browse tab is the default mount; keep it benign so the page renders.
    server.use(http.get(MARKETPLACE, () => HttpResponse.json(browseEnvelope([]))));
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/marketplace']}>
          <HorseMarketplacePage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('My Listings: renders error+retry (not a false empty) on a failed fetch', async () => {
    server.use(
      http.get(MY_LISTINGS, () =>
        HttpResponse.json({ status: 'error', message: 'mine boom' }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('tab-my-listings'));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText('No Active Listings')).not.toBeInTheDocument();
    expect(screen.queryByText(/mine boom/i)).not.toBeInTheDocument();
  });

  it('My Listings: renders the honest empty state on a successful empty fetch', async () => {
    server.use(http.get(MY_LISTINGS, () => HttpResponse.json({ success: true, data: [] })));

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('tab-my-listings'));

    expect(await screen.findByText('No Active Listings')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('My Listings: renders rows on a successful fetch with data', async () => {
    server.use(
      http.get(MY_LISTINGS, () => HttpResponse.json({ success: true, data: [sampleMyListing] }))
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('tab-my-listings'));

    expect(await screen.findByText('TestFixture-l22ki-mine')).toBeInTheDocument();
    expect(screen.queryByText('No Active Listings')).not.toBeInTheDocument();
  });

  it('Sale History: renders error+retry (not a false empty) on a failed fetch', async () => {
    server.use(
      http.get(HISTORY, () =>
        HttpResponse.json({ status: 'error', message: 'history boom' }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('tab-history'));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText('No Sale History')).not.toBeInTheDocument();
    expect(screen.queryByText(/history boom/i)).not.toBeInTheDocument();
  });

  it('Sale History: renders the honest empty state on a successful empty fetch', async () => {
    server.use(http.get(HISTORY, () => HttpResponse.json({ success: true, data: [] })));

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('tab-history'));

    expect(await screen.findByText('No Sale History')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
