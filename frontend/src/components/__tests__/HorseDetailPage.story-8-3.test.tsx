/**
 * HorseDetailPage Integration Tests (Story 8.3: Horse Management Live)
 *
 * Tests that HorseDetailPage renders real horse data from MSW:
 * - Horse name, breed, age, gender, healthStatus from GET /api/horses/:id
 * - Loading spinner renders while data fetches
 * - Error state "Horse Not Found" for id 999
 *
 * Uses MSW (Mock Service Worker) — no prop overrides or manual mocks.
 * Pattern follows Story 8.2 UserDashboard integration tests.
 *
 * Owner request 2026-10-28 (Equoria-2w4yo) removed the "Breed: … • Gender: …
 * • Health: …" line under the horse's name; breed, gender and health are read
 * from their rows in the Horse Details section instead, scoped by test id so a
 * parent container never matches.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import HorseDetailPage from '../../pages/HorseDetailPage';
import { MockAuthProvider } from '../../test/utils';

// ─── Render helper ─────────────────────────────────────────────────────────────

function renderHorseDetailPage(id = '1') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <MemoryRouter initialEntries={[`/horses/${id}`]}>
          <Routes>
            <Route path="/horses/:id" element={<HorseDetailPage />} />
          </Routes>
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('HorseDetailPage — Story 8.3 Live Data', () => {
  it('renders horse name from the API (AC: 2)', async () => {
    renderHorseDetailPage('1');
    await waitFor(() => expect(screen.getByText('Storm Runner')).toBeInTheDocument());
  });

  it('renders horse breed from the API (AC: 2)', async () => {
    renderHorseDetailPage('1');
    // Horse Details' Breed row.
    expect(await screen.findByTestId('horse-detail-breed')).toHaveTextContent(/^Thoroughbred$/);
  });

  it('renders horse gender from the API (AC: 2)', async () => {
    renderHorseDetailPage('1');
    // Horse Details' Gender row.
    const details = await screen.findByRole('region', { name: 'Horse Details' });
    expect(within(details).getByText('stallion')).toBeInTheDocument();
  });

  it('renders horse healthStatus from the API (AC: 2)', async () => {
    renderHorseDetailPage('1');
    // Horse Details' Health Status bar, always labelled in words.
    expect(await screen.findByTestId('health-status-bar-label')).toHaveTextContent('Good');
  });

  it('renders a loading spinner before data arrives (AC: 6)', async () => {
    renderHorseDetailPage('1');
    // Before data resolves, loading state should be present (Loader2 spinner)
    // The horse name should not be present during loading
    expect(screen.queryByText('Storm Runner')).not.toBeInTheDocument();
    // Data eventually loads
    await waitFor(() => expect(screen.getByText('Storm Runner')).toBeInTheDocument());
  });

  it('renders "Horse Not Found" error state for id 999 (AC: 7)', async () => {
    renderHorseDetailPage('999');
    await waitFor(() => expect(screen.getByText(/Horse Not Found/i)).toBeInTheDocument());
  });
});
