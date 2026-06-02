/**
 * HorseDetailPage — page-level API integration + pregnancy feeding panel
 * suites (Equoria-snx5i).
 *
 * Split verbatim from the former 886-line
 * frontend/src/pages/__tests__/HorseDetailPage.test.tsx (API Integration +
 * Pregnancy feeding panel describe blocks) per the Equoria-g6aed
 * 300-line-per-file AC. Assertions are unchanged; only their file home moved.
 * Shared fixtures live in pageDetail.testHelpers.tsx.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import HorseDetailPage from '../../HorseDetailPage';
import {
  mockHorse,
  originalFetch,
  createFetchMock,
  createTestWrapper,
} from './pageDetail.testHelpers';

describe('HorseDetailPage Component', () => {
  beforeEach(() => {
    // Set default mock that handles genetics endpoints
    global.fetch = createFetchMock();
  });

  afterEach(() => {
    // Clean up after each test
    global.fetch = originalFetch;
  });

  describe('API Integration', () => {
    test('uses correct API endpoint', async () => {
      const fetchSpy = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: mockHorse }),
        } as Response)
      );

      global.fetch = fetchSpy;

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          // API_BASE_URL is now '' (relative URL) — see src/lib/api-client.ts.
          // horsesApi.get() calls /api/v1/horses/:id?t=<timestamp> (v1 path with cache-buster).
          expect.stringMatching(/^\/api\/v1\/horses\/1(\?t=\d+)?$/),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
          })
        );
      });
    });

    test('includes credentials in request', async () => {
      const fetchSpy = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: mockHorse }),
        } as Response)
      );

      global.fetch = fetchSpy;

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          // API_BASE_URL is now '' (relative URL) — see src/lib/api-client.ts.
          // horsesApi.get() calls /api/v1/horses/:id?t=<timestamp> (v1 path with cache-buster).
          expect.stringMatching(/^\/api\/v1\/horses\/1(\?t=\d+)?$/),
          expect.objectContaining({
            credentials: 'include',
          })
        );
      });
    });
  });

  // ─── Pregnancy panel — feed-system redesign 2026-04-29 (B6, Equoria-ta4s) ───
  describe('Pregnancy feeding panel', () => {
    const inFoalMare = {
      ...mockHorse,
      id: 7,
      name: 'Brood',
      gender: 'Mare',
      // Bred ~3 days ago (UTC-safe — comparison is absolute ms).
      inFoalSinceDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      pregnancySireId: 99,
      pregnancyFeedingsByTier: { performance: 2, basic: 1 },
    };

    test('renders the panel for a mare with inFoalSinceDate set', async () => {
      // Fetch returns the in-foal mare for both /horses/7 (the mare) and
      // /horses/99 (the sire lookup). Genetics endpoints fall through to
      // the success-empty handlers in createFetchMock.
      global.fetch = vi.fn(((url: string) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/epigenetic-insights')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true, data: { traits: [] } }),
          } as Response);
        }
        if (urlStr.includes('/trait-interactions')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true, data: { interactions: [] } }),
          } as Response);
        }
        if (urlStr.includes('/trait-timeline')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true, data: { timeline: [] } }),
          } as Response);
        }
        // /horses/99 → sire (just need a name)
        if (urlStr.includes('/api/horses/99')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                success: true,
                data: { ...mockHorse, id: 99, name: 'StallionSire' },
              }),
          } as Response);
        }
        // /horses/7 (or default) → in-foal mare
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: inFoalMare }),
        } as Response);
      }) as unknown as typeof fetch);

      const TestWrapper = createTestWrapper('7');
      window.history.pushState({}, 'Test', '/horses/7');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Brood')).toBeInTheDocument();
      });

      // Panel + key data slots are present.
      expect(screen.getByTestId('pregnancy-feeding-panel')).toBeInTheDocument();
      expect(screen.getByTestId('pregnancy-days-remaining')).toBeInTheDocument();
      expect(screen.getByTestId('pregnancy-counter-performance').textContent).toMatch(
        /Performance/
      );
      expect(screen.getByTestId('pregnancy-counter-basic').textContent).toMatch(/Basic/);
    });

    test('does NOT render the panel for a non-pregnant horse', async () => {
      // mockHorse has no inFoalSinceDate → panel must be absent.
      global.fetch = createFetchMock({ success: true, data: mockHorse });

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('pregnancy-feeding-panel')).toBeNull();
    });
  });
});
