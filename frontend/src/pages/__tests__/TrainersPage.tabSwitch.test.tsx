/**
 * TrainersPage manage/hire tab tests (Equoria-o5hub.30)
 *
 * The Trainers location has manage/hire tabs. Unlike Riders/Grooms, TrainersPage
 * does NOT pass onBrowseMarketplace to MyTrainersDashboard (no cross-tab jump
 * from the dashboard), so this covers the manage/hire manual switch and the
 * dashboard empty state. RTL-testable with per-test MSW handlers at the network
 * boundary (no trainer handlers ship in the default registry). No vi.mock of our
 * API client (CLAUDE.md §3); MockAuthProvider supplies the user the page reads.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import React from 'react';
import TrainersPage from '../TrainersPage';
import { MockAuthProvider } from '@/test/utils';

function trainerHandlers() {
  return [
    http.get('*/api/v1/trainers/user/:userId', () =>
      HttpResponse.json({ success: true, data: [] })
    ),
    http.get('*/api/v1/trainers/assignments', () => HttpResponse.json({ success: true, data: [] })),
    http.get('*/api/v1/trainers/marketplace', () =>
      HttpResponse.json({
        success: true,
        data: {
          trainers: [],
          lastRefresh: '2026-05-01T00:00:00Z',
          nextFreeRefresh: '2026-05-08T00:00:00Z',
          refreshCost: 500,
          canRefreshFree: true,
        },
      })
    ),
  ];
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <MemoryRouter>
          <TrainersPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('TrainersPage — manage/hire tab switch (Equoria-o5hub.30)', () => {
  beforeEach(() => {
    server.use(...trainerHandlers());
  });

  it('defaults to the Manage tab showing the trainers dashboard empty state', async () => {
    renderPage();
    // No trainers → the dashboard renders its empty state, not the hire list.
    expect(await screen.findByTestId('no-trainers-state')).toBeInTheDocument();
    expect(screen.queryByTestId('trainer-list')).not.toBeInTheDocument();
  });

  it('clicking the Hire tab shows the trainer marketplace list', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('no-trainers-state');

    await user.click(screen.getByTestId('hire-tab'));

    expect(await screen.findByTestId('trainer-list')).toBeInTheDocument();
    expect(screen.queryByTestId('no-trainers-state')).not.toBeInTheDocument();
  });

  it('switching back to Manage from Hire restores the dashboard', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('no-trainers-state');

    await user.click(screen.getByTestId('hire-tab'));
    await screen.findByTestId('trainer-list');

    await user.click(screen.getByTestId('manage-tab'));
    await waitFor(() => {
      expect(screen.getByTestId('no-trainers-state')).toBeInTheDocument();
      expect(screen.queryByTestId('trainer-list')).not.toBeInTheDocument();
    });
  });
});
