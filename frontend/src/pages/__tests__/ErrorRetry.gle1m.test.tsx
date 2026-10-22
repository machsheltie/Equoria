/**
 * Error states must offer a retry (Equoria-gle1m)
 *
 * Five surfaces rendered an honest error but left the player at a dead end.
 * Each case: the request fails -> a visible error with a "try again" control;
 * clicking it re-fetches and the surface recovers (doctrine §1 retry rule).
 *
 * Real components + real hooks + real apiClient; MSW only at the HTTP boundary.
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import { AuthProvider } from '@/contexts/AuthContext';
import { RewardToastProvider } from '@/components/feedback';
import BreedingPairSelection from '../breeding/BreedingPairSelection';
import ConformationShowsPanel from '@/components/competition/ConformationShowsPanel';
import CompetitionResultsPage from '../CompetitionResultsPage';
import TrainingDashboard from '@/components/training/TrainingDashboard';
import OnboardingPage from '../OnboardingPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const fail = (status = 500) => HttpResponse.json({ status: 'error', message: 'boom' }, { status });

/** First request fails, every later one succeeds with `ok()`. */
function failOnce(ok: () => Response) {
  let calls = 0;
  return {
    handler: () => {
      calls += 1;
      return calls === 1 ? fail() : ok();
    },
    calls: () => calls,
  };
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

// ── 1. BreedingPairSelection ──────────────────────────────────────────────

describe('BreedingPairSelection horses error (Equoria-gle1m #1)', () => {
  it('offers Try Again and recovers to the horse list', async () => {
    const horse = {
      id: 1,
      name: 'Thunder',
      age: 5,
      ageYears: 5,
      sex: 'Stallion',
      breed: 'Thoroughbred',
      breedName: 'Thoroughbred',
      healthStatus: 'Healthy',
      dateOfBirth: '2019-01-01',
      level: 10,
      stats: { speed: 85, stamina: 80, agility: 75, strength: 78, intelligence: 70, health: 90 },
      disciplineScores: {},
      traits: [],
    };
    const f = failOnce(() => HttpResponse.json({ success: true, data: [horse] }));
    server.use(http.get(`${base}/api/v1/horses`, f.handler));

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={newClient()}>
        <MockAuthProvider>
          <RewardToastProvider>
            <MemoryRouter>
              <BreedingPairSelection userId="test-user-123" />
            </MemoryRouter>
          </RewardToastProvider>
        </MockAuthProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Failed to load horses/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Thunder')).toBeInTheDocument();
    expect(screen.queryByText(/Failed to load horses/i)).not.toBeInTheDocument();
    expect(f.calls()).toBeGreaterThanOrEqual(2);
  });
});

// ── 2. ConformationShowsPanel ─────────────────────────────────────────────

describe('ConformationShowsPanel competitions error (Equoria-gle1m #2)', () => {
  beforeEach(() => {
    server.use(
      http.get(`${base}/api/v1/horses`, () => HttpResponse.json({ success: true, data: [] }))
    );
  });

  it('offers a retry, does not claim "no open shows", and recovers', async () => {
    const show = {
      id: 9,
      name: 'Spring Classic',
      discipline: 'Show Halter',
      showType: 'conformation',
      entryFee: 50,
      date: '2026-12-01T00:00:00.000Z',
    };
    const f = failOnce(() => HttpResponse.json({ success: true, data: [show] }));
    server.use(http.get(`${base}/api/v1/competition`, f.handler));

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={newClient()}>
        <MemoryRouter>
          <ConformationShowsPanel />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.queryByTestId('conformation-empty-state')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByTestId('conformation-show-row-9')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ── 3. CompetitionResultsPage -> CompetitionResultsList ───────────────────

describe('CompetitionResultsPage results error (Equoria-gle1m #3)', () => {
  it('passes a real retry to the results list and recovers', async () => {
    server.use(
      http.get(`${base}/api/v1/users/123/competition-stats`, () =>
        HttpResponse.json({
          userId: '123',
          totalCompetitions: 1,
          totalWins: 0,
          totalTop3: 0,
          winRate: 0,
          totalPrizeMoney: 0,
          bestPlacement: null,
          mostSuccessfulDiscipline: null,
          recentCompetitions: [],
        })
      )
    );
    const f = failOnce(() => HttpResponse.json({ success: true, results: [], count: 0 }));
    server.use(http.get(`${base}/api/v1/competition/user-results`, f.handler));

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={newClient()}>
        <MockAuthProvider userOverrides={{ id: 123, username: 'TestUser' }}>
          <MemoryRouter>
            <CompetitionResultsPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

    const errorState = await screen.findByTestId('error-state');
    await user.click(within(errorState).getByRole('button', { name: /retry|try again/i }));

    expect(await screen.findByTestId('competition-results-list')).toBeInTheDocument();
    expect(screen.queryByTestId('error-state')).not.toBeInTheDocument();
    expect(f.calls()).toBeGreaterThanOrEqual(2);
  });
});

// ── 4. TrainingDashboard ──────────────────────────────────────────────────

describe('TrainingDashboard horses error (Equoria-gle1m #4)', () => {
  it('offers Try Again in the error state and recovers', async () => {
    const f = failOnce(() => HttpResponse.json({ success: true, data: [] }));
    server.use(http.get(`${base}/api/v1/training/trainable/u-1`, f.handler));

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={newClient()}>
        <MemoryRouter>
          <TrainingDashboard userId="u-1" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const errorState = await screen.findByTestId('error-state');
    expect(errorState).toBeInTheDocument();
    expect(screen.queryByText(/boom/i)).not.toBeInTheDocument();
    await user.click(within(errorState).getByRole('button', { name: /try again/i }));

    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('error-state')).not.toBeInTheDocument();
  });
});

// ── 5. OnboardingPage breeds ──────────────────────────────────────────────

describe('OnboardingPage breeds error (Equoria-gle1m #5)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('equoria-onboarding-step', '1');
  });

  it('offers a Try again button instead of telling the player to refresh, and recovers', async () => {
    const newPlayer = {
      id: 7,
      username: 'NewRider',
      email: 'newrider@equoria.local',
      role: 'user',
      money: 5000,
      level: 1,
      xp: 0,
      completedOnboarding: false,
      onboardingStep: 0,
    };
    const qc = newClient();
    qc.setQueryData(['profile'], { user: newPlayer });
    qc.setQueryData(['verificationStatus'], { verified: true, email: newPlayer.email });

    const f = failOnce(() =>
      HttpResponse.json({
        success: true,
        data: [
          { id: 1, name: 'Thoroughbred', description: 'A fast breed' },
          { id: 2, name: 'Arabian', description: 'An endurance breed' },
        ],
        count: 2,
      })
    );
    server.use(http.get(`${base}/api/v1/breeds`, f.handler));

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/onboarding']}>
            <Routes>
              <Route path="/onboarding" element={<OnboardingPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.queryByText(/try refreshing/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Arabian')).toBeInTheDocument();
    expect(f.calls()).toBeGreaterThanOrEqual(2);
  });
});
