/**
 * RidersPage manage/hire + cross-tab jump tests (Equoria-o5hub.30)
 *
 * The Riders location has manage/hire tabs and an onBrowseMarketplace cross-tab
 * handler: the MyRidersDashboard empty state offers "Browse Rider Marketplace",
 * which calls onBrowseMarketplace={() => setActiveTab('hire')}. This is the
 * cross-tab handler the issue calls out. It is RTL-testable against the default
 * MSW handlers (riders/user → [], riders/assignments → [], horses, and
 * riders/marketplace). No vi.mock of our API client (CLAUDE.md §3); MockAuthProvider
 * supplies the authenticated user the page reads for userId.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import RidersPage from '../RidersPage';
import { MockAuthProvider } from '@/test/utils';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <MemoryRouter>
          <RidersPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('RidersPage — manage/hire tabs + cross-tab jump (Equoria-o5hub.30)', () => {
  it('defaults to the Manage tab showing the riders dashboard', async () => {
    renderPage();
    // With no riders, the dashboard's empty state renders (not the hire list).
    expect(await screen.findByTestId('no-riders-state')).toBeInTheDocument();
    expect(screen.queryByTestId('rider-list')).not.toBeInTheDocument();
  });

  it('manually clicking the Hire tab shows the rider marketplace list', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('no-riders-state');

    await user.click(screen.getByTestId('hire-tab'));

    // The hire panel renders the RiderList marketplace surface.
    expect(await screen.findByTestId('rider-list')).toBeInTheDocument();
  });

  it('the dashboard "Browse Rider Marketplace" button jumps to the Hire tab (onBrowseMarketplace)', async () => {
    const user = userEvent.setup();
    renderPage();

    const emptyState = await screen.findByTestId('no-riders-state');
    // The cross-tab handler is wired to this button.
    await user.click(within(emptyState).getByRole('button', { name: /browse rider marketplace/i }));

    // The cross-tab jump switched to hire — the marketplace list is now shown
    // and the manage empty state is gone.
    await waitFor(() => {
      expect(screen.getByTestId('rider-list')).toBeInTheDocument();
      expect(screen.queryByTestId('no-riders-state')).not.toBeInTheDocument();
    });
  });
});
