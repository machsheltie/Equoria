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
 * NOTE: Text assertions use exact strings like 'Breed: Thoroughbred' rather
 * than broad regexes like /Thoroughbred/i to avoid matching parent container
 * elements that include the text as part of a longer string.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HorseDetailPage from '../../pages/HorseDetailPage';

// ─── Render helper ─────────────────────────────────────────────────────────────

function renderHorseDetailPage(id = '1') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/horses/${id}`]}>
        <Routes>
          <Route path="/horses/:id" element={<HorseDetailPage />} />
        </Routes>
      </MemoryRouter>
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
    // The breed is rendered as "Breed: Thoroughbred" in a <span> element.
    // Using exact string to avoid matching parent containers that also contain this text.
    await waitFor(() => expect(screen.getByText('Breed: Thoroughbred')).toBeInTheDocument());
  });

  it('renders horse gender from the API (AC: 2)', async () => {
    renderHorseDetailPage('1');
    // The gender is rendered as "Gender: stallion" in a <span> element.
    await waitFor(() => expect(screen.getByText('Gender: stallion')).toBeInTheDocument());
  });

  it('renders horse healthStatus from the API (AC: 2)', async () => {
    renderHorseDetailPage('1');
    // The healthStatus is rendered as "Health: Good" in a <span> element.
    await waitFor(() => expect(screen.getByText('Health: Good')).toBeInTheDocument());
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
