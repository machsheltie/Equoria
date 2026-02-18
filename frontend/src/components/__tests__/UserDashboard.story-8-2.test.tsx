/**
 * UserDashboard Integration Tests (Story 8.2: User Dashboard Live Data)
 *
 * Tests that the UserDashboard component wires correctly to live API data:
 * - AC 1: Real username, level, XP from GET /api/users/:id/progress
 * - AC 2: Real money from GET /api/users/dashboard/:id (not progressData.money)
 * - AC 3: Real horse count from GET /api/users/dashboard/:id
 * - AC 4: Activity feed from GET /api/users/:id/activity (empty = "silent" state)
 * - AC 5: Loading spinner appears while data fetches
 * - AC 6: "Connection Severed" error state renders on API failure
 *
 * Uses MSW handlers (already in test/msw/handlers.ts) — no prop overrides.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from '../../test/utils';
import UserDashboard from '../UserDashboard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderDashboard(userId = 1) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UserDashboard userId={userId} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ─── Loading state (AC: 5) ────────────────────────────────────────────────────

describe('UserDashboard loading state (AC: 5)', () => {
  it('shows loading spinner before data arrives', () => {
    renderDashboard(1);
    // Loading state renders immediately before queries complete
    expect(screen.getByText(/Summoning Dashboard/i)).toBeInTheDocument();
  });
});

// ─── Live data rendering (AC: 1–4) ───────────────────────────────────────────

describe('UserDashboard live data (Story 8.2)', () => {
  it('renders username from dashboardData.user.username (AC: 1)', async () => {
    renderDashboard(1);
    await waitFor(() => expect(screen.getByText(/testuser/i)).toBeInTheDocument());
  });

  it('renders level from progressData.level (AC: 1)', async () => {
    renderDashboard(1);
    await waitFor(() => expect(screen.getByText(/Level 1/i)).toBeInTheDocument());
  });

  it('renders XP progress bar from progressData (AC: 1)', async () => {
    renderDashboard(1);
    // MSW returns xp: 50, xpToNextLevel: 50 → renders "50 / 50 XP"
    await waitFor(() => expect(screen.getByText(/50 \/ 50 XP/i)).toBeInTheDocument());
  });

  it('renders money from dashboardData.user.money — not progressData (AC: 2)', async () => {
    renderDashboard(1);
    // MSW handler returns money: 1000 in dashboard endpoint
    await waitFor(() => {
      const moneyEl = screen.getByText('1,000');
      expect(moneyEl).toBeInTheDocument();
    });
  });

  it('renders horse count from dashboardData.horses.total (AC: 3)', async () => {
    renderDashboard(1);
    // MSW handler returns horses.total: 2
    await waitFor(() => expect(screen.getByText(/2 Horses/i)).toBeInTheDocument());
  });

  it('renders "chronicle is silent" for empty activity feed (AC: 4)', async () => {
    renderDashboard(1);
    // MSW handler returns empty array for /api/users/:id/activity
    await waitFor(() => expect(screen.getByText(/The chronicle is silent/i)).toBeInTheDocument());
  });
});

// ─── Error state (AC: 6) ─────────────────────────────────────────────────────

describe('UserDashboard error state (AC: 6)', () => {
  it('renders "Connection Severed" error when both APIs fail', async () => {
    // userId 999999 → MSW returns 404 for both progress and dashboard
    renderDashboard(999999);
    await waitFor(() => expect(screen.getByText(/Connection Severed/i)).toBeInTheDocument());
  });

  it('renders reconnect button in error state (AC: 6)', async () => {
    renderDashboard(999999);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Reconnect/i })).toBeInTheDocument()
    );
  });
});
