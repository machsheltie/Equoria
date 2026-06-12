import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw/server';
import TrainingHistoryPanel from '../TrainingHistoryPanel';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const renderPanel = (horseId = 1) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TrainingHistoryPanel horseId={horseId} />
    </QueryClientProvider>
  );
};

/**
 * Equoria-krjw5 — Invalid Date sentinel.
 *
 * TrainingHistoryPanel formats two date fields:
 *   - DisciplineStatus.nextEligibleDate (cooldown label)
 *   - HorseTrainingHistoryEntry.trainedAt (history-row timestamp)
 *
 * Both are optional/nullable and can arrive as '' or a non-parseable string
 * at runtime. Without an isNaN(getTime()) guard, `new Date(x).toLocaleString()`
 * renders the literal "Invalid Date". These tests serve the real failure mode
 * through the real fetch path (MSW override of the actual endpoints — no mock
 * of the api-client per CLAUDE.md §3) and assert the honest "Date unavailable"
 * fallback is shown instead. They are sentinel-positive: a panel WITHOUT the
 * guard renders "Invalid Date" and fails the `queryByText(/Invalid Date/i)`
 * assertion.
 */
describe('TrainingHistoryPanel — Invalid Date handling (Equoria-krjw5)', () => {
  it('renders "Date unavailable", not "Invalid Date", for an unparseable nextEligibleDate', async () => {
    server.use(
      http.get(`${base}/api/v1/training/status/:horseId`, () =>
        HttpResponse.json({
          success: true,
          data: [{ discipline: 'dressage', score: 42, nextEligibleDate: 'not-a-date' }],
        })
      )
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/Cooldown until Date unavailable/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('renders "Date unavailable", not "Invalid Date", for an empty-string nextEligibleDate', async () => {
    // Empty string is falsy, so the outer ternary picks "Ready to train" —
    // assert the defect cannot surface and "Invalid Date" never renders.
    server.use(
      http.get(`${base}/api/v1/training/status/:horseId`, () =>
        HttpResponse.json({
          success: true,
          data: [{ discipline: 'dressage', score: 42, nextEligibleDate: '' }],
        })
      )
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/Ready to train/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('renders "Date unavailable", not "Invalid Date", for an unparseable trainedAt in history', async () => {
    server.use(
      http.get(`${base}/api/v1/training/status/:horseId`, () =>
        HttpResponse.json({ success: true, data: [] })
      ),
      http.get(`${base}/api/v1/horses/:id/training-history`, () =>
        HttpResponse.json({
          success: true,
          data: {
            trainingHistory: [
              { id: 101, discipline: 'dressage', score: 40, trainedAt: 'not-a-date' },
            ],
            disciplineBalance: {},
            trainingFrequency: {},
          },
        })
      )
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Date unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('renders the real formatted dates when nextEligibleDate/trainedAt are valid (guard does not break the happy path)', async () => {
    server.use(
      http.get(`${base}/api/v1/training/status/:horseId`, () =>
        HttpResponse.json({
          success: true,
          data: [{ discipline: 'dressage', score: 42, nextEligibleDate: '2025-12-10T00:00:00Z' }],
        })
      ),
      http.get(`${base}/api/v1/horses/:id/training-history`, () =>
        HttpResponse.json({
          success: true,
          data: {
            trainingHistory: [
              { id: 101, discipline: 'dressage', score: 40, trainedAt: '2025-12-01T00:00:00Z' },
            ],
            disciplineBalance: {},
            trainingFrequency: {},
          },
        })
      )
    );

    renderPanel();

    // A valid ISO date must NOT collapse to the fallback, and must not be
    // "Invalid Date" either — it renders some locale-formatted string.
    await waitFor(() => {
      expect(screen.getByText(/Cooldown until /i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Date unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });
});
