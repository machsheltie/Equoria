/**
 * BehavioralFlagsPanel tests (Equoria-yzqhj.8)
 *
 * Exercises the real api-client request/response/unwrap path via MSW at the
 * network (fetch) boundary — NOT a vi.mock of the api-client module (per
 * CLAUDE.md: no new api-client module mocks). MSW returns the REAL backend
 * envelope shape for /api/v1/flags/horses/:id/flags and /care-patterns so the
 * hooks + panel are verified end-to-end through useHorseFlags.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../../test/msw/server';
import BehavioralFlagsPanel from '../BehavioralFlagsPanel';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

const flagsEnvelope = (flags: unknown[], canReceiveMoreFlags = false) => ({
  success: true,
  data: {
    horseId: 1,
    horseName: 'TestFixture-Flagged',
    ageInYears: 2,
    currentBondScore: 60,
    currentStressLevel: 15,
    flagCount: flags.length,
    flags,
    maxFlags: 5,
    canReceiveMoreFlags,
  },
});

describe('BehavioralFlagsPanel (Equoria-yzqhj.8)', () => {
  it('renders behavioral flags with name/description and a positive/negative valence', async () => {
    server.use(
      http.get(`${base}/api/v1/flags/horses/:id/flags`, () =>
        HttpResponse.json(
          flagsEnvelope([
            {
              name: 'brave',
              displayName: 'Brave',
              description: 'Confident in novel situations.',
              type: 'positive',
              sourceCategory: 'care',
              influences: {},
            },
            {
              name: 'fearful',
              displayName: 'Fearful',
              description: 'Easily startled by new stimuli.',
              type: 'negative',
              sourceCategory: 'environment',
              influences: {},
            },
          ])
        )
      ),
      http.get(`${base}/api/v1/flags/horses/:id/care-patterns`, () =>
        HttpResponse.json({ success: true, data: { eligible: false, reason: 'too old' } })
      )
    );

    render(<BehavioralFlagsPanel horseId={1} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('behavioral-flags-list')).toBeInTheDocument();
    });

    expect(screen.getByText('Brave')).toBeInTheDocument();
    expect(screen.getByText('Confident in novel situations.')).toBeInTheDocument();
    expect(screen.getByText('Fearful')).toBeInTheDocument();
    // Distinct positive/negative valence badges.
    expect(screen.getByText('Positive')).toBeInTheDocument();
    expect(screen.getByText('Negative')).toBeInTheDocument();
  });

  it('shows an honest empty state (no fabricated flags) when the horse has none', async () => {
    server.use(
      http.get(`${base}/api/v1/flags/horses/:id/flags`, () =>
        HttpResponse.json(flagsEnvelope([], true))
      ),
      http.get(`${base}/api/v1/flags/horses/:id/care-patterns`, () =>
        HttpResponse.json({ success: true, data: { eligible: false } })
      )
    );

    render(<BehavioralFlagsPanel horseId={1} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('behavioral-flags-empty')).toBeInTheDocument();
    });
    // No fabricated flag cards.
    expect(screen.queryByTestId('behavioral-flag-card')).not.toBeInTheDocument();
  });

  it('surfaces a care-pattern insight only for an eligible (young) horse', async () => {
    server.use(
      http.get(`${base}/api/v1/flags/horses/:id/flags`, () =>
        HttpResponse.json(flagsEnvelope([], true))
      ),
      http.get(`${base}/api/v1/flags/horses/:id/care-patterns`, () =>
        HttpResponse.json({
          success: true,
          data: { eligible: true, ageInYears: 1, patterns: {} },
        })
      )
    );

    render(<BehavioralFlagsPanel horseId={1} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('care-pattern-insight')).toBeInTheDocument();
    });
  });

  it('renders an honest error state when the flags endpoint fails', async () => {
    server.use(
      http.get(`${base}/api/v1/flags/horses/:id/flags`, () =>
        HttpResponse.json({ status: 'error', message: 'Flag service unavailable' }, { status: 500 })
      ),
      http.get(`${base}/api/v1/flags/horses/:id/care-patterns`, () =>
        HttpResponse.json({ success: true, data: { eligible: false } })
      )
    );

    render(<BehavioralFlagsPanel horseId={1} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('behavioral-flags-error')).toBeInTheDocument();
    });
    // No fabricated flag list on error.
    expect(screen.queryByTestId('behavioral-flags-list')).not.toBeInTheDocument();
  });
});
