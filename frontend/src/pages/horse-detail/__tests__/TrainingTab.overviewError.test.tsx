import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw/server';
import TrainingTab from '../TrainingTab';
import type { Horse } from '../HorseDetailPageTypes';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Equoria-llhf6 — overview-error must never render the false "Ready to train!".
 *
 * TrainingTab previously destructured only `data`/`isLoading` from
 * useTrainingOverview. On a FAILED overview fetch `trainingOverview` is
 * undefined → getGlobalCooldown() returns null → isOnCooldown=false → the
 * status section fell through to the actionable "Ready to train!" state (and
 * the DisciplinePicker rendered fully enabled). A failed read presented as a
 * positive, actionable state — the exact defect FRONTEND_ASYNC_STATE_DOCTRINE
 * §1/§4 forbids.
 *
 * These tests drive the REAL TrainingTab against HTTP-level MSW overrides of
 * the actual /api/v1/training/status/:horseId endpoint — no vi.mock of the
 * api-client / hook per CLAUDE.md §3. They are sentinel-positive: the
 * pre-fix TrainingTab renders `training-status-ready` on the 500 case and
 * FAILS the error/no-ready assertions below.
 */

const HORSE: Horse = {
  id: 1,
  name: 'TestFixture-Comet',
  breed: 'Thoroughbred',
  age: 5,
  gender: 'Mare',
  dateOfBirth: '2021-01-01T00:00:00Z',
  healthStatus: 'Good',
  stats: {
    precision: 50,
    strength: 50,
    speed: 50,
    agility: 50,
    endurance: 50,
    intelligence: 50,
    stamina: 50,
    balance: 50,
    boldness: 50,
    flexibility: 50,
    obedience: 50,
    focus: 50,
  },
  disciplineScores: { dressage: 10 },
  traits: [],
};

const renderTab = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TrainingTab horse={HORSE} />
    </QueryClientProvider>
  );
};

describe('TrainingTab — overview fetch error (Equoria-llhf6)', () => {
  it('renders an error status with a retry affordance — NOT "Ready to train!" — when the overview fetch fails', async () => {
    server.use(
      http.get(`${base}/api/v1/training/status/:horseId`, () =>
        HttpResponse.json({ success: false, message: 'boom' }, { status: 500 })
      )
    );

    renderTab();

    // ERROR state renders (honest, class-mapped copy — never the raw server body).
    expect(await screen.findByTestId('training-status-error')).toBeInTheDocument();

    // The false-positive actionable states must be ABSENT on a failed read.
    expect(screen.queryByTestId('training-status-ready')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready to train!')).not.toBeInTheDocument();
    // The discipline picker is a positive-actionable surface — suppressed on error.
    expect(screen.queryByText('Select Discipline')).not.toBeInTheDocument();

    // Retry affordance is present (5xx is retryable per userMessageFor).
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();

    // The raw server body ("boom") must never leak into the UI (§3 taxonomy).
    expect(screen.queryByText(/boom/i)).not.toBeInTheDocument();
  });

  it('retry is wired to refetch: clicking Try Again re-runs the query and, on success, shows the ready state', async () => {
    let calls = 0;
    server.use(
      http.get(`${base}/api/v1/training/status/:horseId`, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ success: false, message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json({ success: true, data: [] });
      })
    );

    const user = userEvent.setup();
    renderTab();

    const retry = await screen.findByRole('button', { name: /Try Again/i });
    await user.click(retry);

    // Refetch succeeded (empty overview → no cooldown) → the honest ready state.
    expect(await screen.findByTestId('training-status-ready')).toBeInTheDocument();
    expect(screen.queryByTestId('training-status-error')).not.toBeInTheDocument();
  });

  it('success + on cooldown → cooldown UI (not error, not ready)', async () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    server.use(
      http.get(`${base}/api/v1/training/status/:horseId`, () =>
        HttpResponse.json({
          success: true,
          data: [{ discipline: 'dressage', nextEligibleDate: future }],
        })
      )
    );

    renderTab();

    expect(await screen.findByTestId('training-status-cooldown')).toBeInTheDocument();
    expect(screen.queryByTestId('training-status-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('training-status-ready')).not.toBeInTheDocument();
  });

  it('success + no cooldown (empty overview) → ready state (not error)', async () => {
    server.use(
      http.get(`${base}/api/v1/training/status/:horseId`, () =>
        HttpResponse.json({ success: true, data: [] })
      )
    );

    renderTab();

    expect(await screen.findByTestId('training-status-ready')).toBeInTheDocument();
    expect(screen.queryByTestId('training-status-error')).not.toBeInTheDocument();
  });
});
