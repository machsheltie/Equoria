import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw/server';
import type { TrainableHorse } from '@/lib/api-client';
import TrainingSessionModal from '../TrainingSessionModal';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const mockHorse: TrainableHorse = {
  id: 1,
  name: 'Thunder',
  level: 5,
  gender: 'Stallion',
  age: 5,
  canTrain: true,
  bestDisciplines: ['Barrel Racing'],
};

const renderModal = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TrainingSessionModal horse={mockHorse} onClose={vi.fn()} />
    </QueryClientProvider>
  );
};

/**
 * Equoria-krjw5 — Invalid Date sentinel.
 *
 * TrainingSessionModal formats one date field in its status summary:
 *   - DisciplineStatus.nextEligibleDate (cooldown label)
 *
 * It is optional/nullable and can arrive as a non-parseable string at runtime.
 * Without an isNaN(getTime()) guard, `new Date(x).toLocaleString()` renders the
 * literal "Invalid Date". These tests serve the real failure mode through the
 * real fetch path (MSW override of the actual training-status endpoint — no
 * mock of the api-client per CLAUDE.md §3) and assert the honest "Date
 * unavailable" fallback. Sentinel-positive: a modal WITHOUT the guard renders
 * "Invalid Date" and fails the `queryByText(/Invalid Date/i)` assertion.
 */
describe('TrainingSessionModal — Invalid Date handling (Equoria-krjw5)', () => {
  it('renders "Date unavailable", not "Invalid Date", for an unparseable nextEligibleDate', async () => {
    server.use(
      http.get(`${base}/api/v1/training/status/:horseId/:discipline`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            discipline: params.discipline,
            score: 42,
            nextEligibleDate: 'not-a-date',
            lastTrainedAt: '2025-12-01T00:00:00Z',
          },
        })
      )
    );

    renderModal();

    await waitFor(() => {
      expect(screen.getByText(/Cooldown until Date unavailable/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('renders the real formatted cooldown when nextEligibleDate is a valid ISO string (guard does not break the happy path)', async () => {
    server.use(
      http.get(`${base}/api/v1/training/status/:horseId/:discipline`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            discipline: params.discipline,
            score: 42,
            nextEligibleDate: '2025-12-10T00:00:00Z',
            lastTrainedAt: '2025-12-01T00:00:00Z',
          },
        })
      )
    );

    renderModal();

    await waitFor(() => {
      expect(screen.getByText(/Cooldown until /i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Date unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('shows "Ready" (not a date) when nextEligibleDate is null, never "Invalid Date"', async () => {
    server.use(
      http.get(`${base}/api/v1/training/status/:horseId/:discipline`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            discipline: params.discipline,
            score: 42,
            nextEligibleDate: null,
            lastTrainedAt: '2025-12-01T00:00:00Z',
          },
        })
      )
    );

    renderModal();

    await waitFor(() => {
      expect(screen.getByText(/Score 42 - Ready/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });
});
