import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
 * Equoria-gzvwa — absent-server-date sentinel.
 *
 * TrainingTab previously fabricated a client-side cooldown date when the
 * server omitted `nextEligible`:
 *
 *   nextTrainingDate: result.nextEligible
 *     ? new Date(result.nextEligible)
 *     : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)   // ← fabrication
 *
 * That `now + 7 days` guess masks a missing authoritative value and lies to
 * the player about when training is actually available. The fix passes the
 * real server value through (null when absent) so TrainingResultModal renders
 * its honest "Date unavailable" empty state.
 *
 * These tests drive the REAL TrainingTab flow (select discipline → confirm →
 * real train mutation) against an HTTP-level MSW override of the actual
 * /api/v1/training/train endpoint — no vi.mock of the api-client per
 * CLAUDE.md §3. They are sentinel-positive: a TrainingTab that still
 * fabricated now+7d would render that formatted date and FAIL the
 * `queryByText(now+7d)` / `getByText('Date unavailable')` assertions.
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

// The exact format TrainingResultModal.formatNextTrainingDate produces — used
// to assert the fabricated now+7-days date is NOT rendered anywhere.
const NEXT_TRAINING_LOCALE_OPTS: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
};

describe('TrainingTab — absent server nextEligible (Equoria-gzvwa)', () => {
  it('renders "Date unavailable", NOT a fabricated now+7-days date, when the train response omits nextEligible', async () => {
    const user = userEvent.setup();

    // Eligible horse: empty training overview → no cooldown → DisciplinePicker active.
    server.use(
      http.get(`${base}/api/v1/training/status/:horseId`, () =>
        HttpResponse.json({ success: true, data: [] })
      ),
      // Train response intentionally OMITS nextEligible AND nextEligibleDate —
      // this is the "absent server value" case. The api-client normalizes both
      // missing fields to nextEligible: null.
      http.post(`${base}/api/v1/training/train`, () =>
        HttpResponse.json({
          success: true,
          message: 'Training complete',
          updatedScore: 15,
          statGain: { stat: 'precision', amount: 1 },
          xpAwarded: 5,
        })
      )
    );

    renderTab();

    // Wait for the eligible state, then select the Dressage discipline.
    const dressageButton = await screen.findByRole('button', {
      name: /Select Dressage discipline/i,
    });
    await user.click(dressageButton);

    // Confirm modal opens — confirm the training session (fires the real mutation).
    const confirmButton = await screen.findByTestId('confirm-button');
    await user.click(confirmButton);

    // Result modal appears. The next-training line must be the honest empty
    // state, never a fabricated date.
    await waitFor(() => {
      expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
    });

    expect(screen.getByTestId('next-training-date')).toHaveTextContent(
      'Next Training Available: Date unavailable'
    );

    // Sentinel: the OLD fabrication would have produced a now+7-days date.
    // Assert that exact formatted string is absent from the document.
    const fabricated = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(
      'en-US',
      NEXT_TRAINING_LOCALE_OPTS
    );
    expect(
      screen.queryByText(new RegExp(fabricated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('renders the REAL server date when the train response provides nextEligible (fix does not break the happy path)', async () => {
    const user = userEvent.setup();
    const realDate = '2026-08-15T00:00:00Z';

    server.use(
      http.get(`${base}/api/v1/training/status/:horseId`, () =>
        HttpResponse.json({ success: true, data: [] })
      ),
      http.post(`${base}/api/v1/training/train`, () =>
        HttpResponse.json({
          success: true,
          message: 'Training complete',
          updatedScore: 15,
          statGain: { stat: 'precision', amount: 1 },
          xpAwarded: 5,
          // Real backend uses the flat (deprecated) nextEligibleDate field.
          nextEligibleDate: realDate,
        })
      )
    );

    renderTab();

    const dressageButton = await screen.findByRole('button', {
      name: /Select Dressage discipline/i,
    });
    await user.click(dressageButton);

    const confirmButton = await screen.findByTestId('confirm-button');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
    });

    // The real server date renders as a formatted string — NOT the fallback.
    const expected = new Date(realDate).toLocaleDateString('en-US', NEXT_TRAINING_LOCALE_OPTS);
    expect(screen.getByTestId('next-training-date')).toHaveTextContent(expected);
    expect(screen.getByTestId('next-training-date')).not.toHaveTextContent('Date unavailable');
  });
});
