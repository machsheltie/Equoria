/**
 * HorseDetailPage — page-level error handling + responsive design suites
 * (Equoria-snx5i).
 *
 * Split verbatim from the former 886-line
 * frontend/src/pages/__tests__/HorseDetailPage.test.tsx (Error Handling +
 * Responsive Design describe blocks) per the Equoria-g6aed 300-line-per-file AC.
 * Assertions are unchanged; only their file home moved. Shared fixtures live in
 * pageDetail.testHelpers.tsx.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  describe('Error Handling', () => {
    test('displays error message when fetch fails', async () => {
      // Mock failed fetch
      global.fetch = createFetchMock({
        ok: false,
        status: 500,
        success: false,
        message: 'Internal server error',
      });

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      // Should show error message (use specific heading text to avoid multiple matches)
      await waitFor(() => {
        const errorHeading = screen.getByText('Error Loading Horse');
        expect(errorHeading).toBeInTheDocument();
      });

      // Verify retry button is present
      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();
    });

    test('displays 404 error for non-existent horse', async () => {
      // Mock 404 response
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ success: false, message: 'Horse not found' }),
        } as Response)
      );

      const TestWrapper = createTestWrapper('999');
      window.history.pushState({}, 'Test', '/horses/999');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      // Should show 404 error
      await waitFor(() => {
        const notFoundText = screen.queryByText(/horse not found/i);
        expect(notFoundText).toBeInTheDocument();
      });
    });

    test('retry button refetches data after error', async () => {
      // global.fetch mock pattern (matches the rest of the file). MSW would be
      // cleaner, but `originalFetch` captured at module-load time is the
      // pre-MSW fetch, so MSW handlers never see calls routed through this
      // file's mock-fetch chain. Counter only increments on the horse-detail
      // path so genetics-endpoint pre-fetches don't consume retry attempts.
      let horseFetchCount = 0;

      global.fetch = vi.fn(((url: string) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        // Pass-through mocks for adjacent endpoints the page also fetches.
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

        // Horse-detail path — first call fails, subsequent calls succeed.
        if (urlStr.match(/\/api(?:\/v1)?\/horses\/1(?:\?|$)/)) {
          horseFetchCount++;
          if (horseFetchCount === 1) {
            return Promise.resolve({
              ok: false,
              status: 500,
              json: () => Promise.resolve({ success: false, message: 'Server error' }),
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true, data: mockHorse }),
          } as Response);
        }

        // Any other path: empty success so unrelated queries don't get stuck.
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: {} }),
        } as Response);
      }) as typeof fetch);

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      // Wait for error state (use specific heading text to avoid multiple matches)
      await waitFor(() => {
        expect(screen.getByText('Error Loading Horse')).toBeInTheDocument();
      });

      // Click retry button (use exact text)
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      // Should now show horse data
      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      expect(horseFetchCount).toBe(2);
    });
  });

  describe('Responsive Design', () => {
    test('renders without crashing on mobile viewport', async () => {
      // Mock mobile viewport
      global.innerWidth = 375;
      global.innerHeight = 667;
      fireEvent(window, new Event('resize'));

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: mockHorse }),
        } as Response)
      );

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

      // Component should render without errors
      expect(screen.getAllByText(/thoroughbred/i).length).toBeGreaterThan(0);
    });

    test('renders without crashing on desktop viewport', async () => {
      // Mock desktop viewport
      global.innerWidth = 1920;
      global.innerHeight = 1080;
      fireEvent(window, new Event('resize'));

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: mockHorse }),
        } as Response)
      );

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

      // Component should render without errors
      expect(screen.getAllByText(/thoroughbred/i).length).toBeGreaterThan(0);
    });
  });
});
