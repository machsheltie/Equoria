/**
 * Staff Manage tabs — offline ends in the honest error (Equoria-i2xxj)
 *
 * Owner ruling 2026-10-23 (Equoria-i2xxj): the staff screens get the same real
 * error path as the community hub and breeding compatibility screens if they
 * also fail to show an error offline. They did worse than hang: TanStack's
 * default networkMode 'online' PAUSES an offline query (no data, no error,
 * isLoading false), so each dashboard skipped both its loading and its error
 * branch and told the player "No Riders/Trainers/Grooms Hired" — a false empty.
 *
 * Real dashboards, real hooks, real api-client; only the HTTP transport is
 * stubbed by MSW. onlineManager is the real TanStack online signal the
 * browser's offline event drives.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import { server } from '@/test/msw/server';
import MyRidersDashboard from '../MyRidersDashboard';
import MyTrainersDashboard from '../MyTrainersDashboard';
import MyGroomsDashboard from '../MyGroomsDashboard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const USER_ID = 'user-i2xxj';
const offline = () => HttpResponse.error();

function renderOffline(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  onlineManager.setOnline(false);
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Staff Manage tabs — offline shows the error, never a false empty (Equoria-i2xxj)', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('riders: offline ends in "Couldn\'t load your riders" with Try Again', async () => {
    server.use(
      http.get(`${base}/api/v1/riders/user/:userId`, offline),
      http.get(`${base}/api/v1/riders/assignments`, offline)
    );
    renderOffline(<MyRidersDashboard userId={USER_ID} onBrowseMarketplace={() => {}} />);

    expect(await screen.findByText(/couldn't load your riders/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/no riders hired/i)).not.toBeInTheDocument();
  });

  it('trainers: offline ends in "Couldn\'t load your trainers" with Try Again', async () => {
    server.use(
      http.get(`${base}/api/v1/trainers/user/:userId`, offline),
      http.get(`${base}/api/v1/trainers/assignments`, offline)
    );
    renderOffline(<MyTrainersDashboard userId={USER_ID} />);

    expect(await screen.findByText(/couldn't load your trainers/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/no trainers hired/i)).not.toBeInTheDocument();
  });

  it('grooms: offline ends in "Couldn\'t load your grooms" with Try Again', async () => {
    server.use(
      http.get(`${base}/api/v1/grooms/user/:userId`, offline),
      http.get(`${base}/api/v1/groom-assignments`, offline),
      http.get(`${base}/api/v1/groom-salaries/cost`, offline)
    );
    renderOffline(<MyGroomsDashboard userId={USER_ID} onBrowseMarketplace={() => {}} />);

    expect(await screen.findByText(/couldn't load your grooms/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/no grooms hired/i)).not.toBeInTheDocument();
  });
});
