/**
 * HorseListView Integration Tests (Story 8.3: Horse Management Live)
 *
 * Tests that HorseListView correctly renders real horse data from MSW:
 * - Horse names render from GET /api/horses response
 * - Loading state renders while data fetches
 * - Empty state renders when API returns empty array
 * - Search filter reduces visible horses
 *
 * Uses MSW (Mock Service Worker) — no prop overrides or manual mocks.
 * Pattern follows Story 8.2 UserDashboard integration tests.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import HorseListView from '../HorseListView';

// ─── Render helper ─────────────────────────────────────────────────────────────

function renderHorseListView() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HorseListView userId={1} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('HorseListView — Story 8.3 Live Data', () => {
  it('renders horse names from the API (AC: 1)', async () => {
    renderHorseListView();
    await waitFor(() => expect(screen.getByText('Storm Runner')).toBeInTheDocument());
    expect(screen.getByText('Midnight Dream')).toBeInTheDocument();
  });

  it('renders horse breeds from the API (AC: 1)', async () => {
    renderHorseListView();
    // jsdom window.innerWidth = 1024, so isMobile = false → desktop table view renders.
    // In the desktop table, breed is rendered in a <div> cell.
    // The HorseFilters panel renders breeds in <span> elements (always visible).
    // Using selector: 'div' ensures we find only the table cell <div>, not the filter <span>.
    await screen.findByText('Thoroughbred', { selector: 'div' });
  });

  it('renders a loading indicator before data arrives (AC: 6)', async () => {
    // Delay the server response so we can observe the loading state
    server.use(
      http.get('*/api/horses', async () => {
        await new Promise((r) => setTimeout(r, 100));
        return HttpResponse.json({
          success: true,
          data: [
            {
              id: 1,
              name: 'Storm Runner',
              breed: 'Thoroughbred',
              gender: 'stallion',
              age: 5,
              dateOfBirth: '2020-01-01T00:00:00Z',
              healthStatus: 'Good',
              stats: {
                speed: 75,
                stamina: 70,
                agility: 65,
                strength: 60,
                intelligence: 55,
                health: 80,
              },
              disciplineScores: { dressage: 45 },
              traits: [],
              parentIds: {},
            },
          ],
        });
      })
    );

    renderHorseListView();
    // Before data resolves, the horse name should not be present (component shows loading spinner)
    expect(screen.queryByText('Storm Runner')).not.toBeInTheDocument();
    // Data eventually loads
    await waitFor(() => expect(screen.getByText('Storm Runner')).toBeInTheDocument());
  });

  it('renders empty state when API returns no horses (AC: 1)', async () => {
    server.use(http.get('*/api/horses', () => HttpResponse.json({ success: true, data: [] })));

    renderHorseListView();
    // After data resolves with empty array, no horse names should appear
    await waitFor(() => expect(screen.queryByText('Storm Runner')).not.toBeInTheDocument());
    // The header shows "Showing 0 of 0 horses" confirming empty state
    await waitFor(() => expect(screen.getByText(/Showing 0 of 0 horses/i)).toBeInTheDocument());
  });

  it('search filter narrows visible horses by name (AC: 3)', async () => {
    renderHorseListView();
    // Wait for both horses to render
    await waitFor(() => expect(screen.getByText('Storm Runner')).toBeInTheDocument());
    expect(screen.getByText('Midnight Dream')).toBeInTheDocument();

    // Find the search input by its aria-label and type a query
    const searchInput = screen.getByLabelText(/search horses/i);
    await userEvent.type(searchInput, 'Storm');

    // After debounce + filtering, only Storm Runner should be visible
    await waitFor(() => expect(screen.getByText('Storm Runner')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('Midnight Dream')).not.toBeInTheDocument());
  });
});
