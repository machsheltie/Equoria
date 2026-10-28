/**
 * HorseDetailPage Training Tab — the Train button (Equoria-smnow — split from HorseDetailPage.Training.test.tsx).
 * Owner ruling q163 (2026-10-28; Equoria-tjh8k): pick the discipline, then one
 * "Train — <fee>" button; no confirm dialog. Covers: no dialog, train, loading,
 * result, error. Old contract: a confirmation modal with a preview and Cancel.
 * Shared fixtures live in ./trainingTab.testHelpers.
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi, describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import HorseDetailPage from '../../HorseDetailPage';
import {
  createMockTrainingResult,
  originalFetch,
  createFetchMock,
  renderWithProviders,
  waitForHorseToLoad,
  navigateToTrainingTab,
} from './trainingTab.testHelpers';

// Pre-warm the lazy TrainingTab chunk (Equoria-q7mn) so Suspense resolves sync.
beforeAll(async () => {
  await import('../TrainingTab');
});

describe('HorseDetailPage Training Tab — Confirmation Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ============================================
  // Train button tests
  // ============================================
  describe('Training Confirmation Flow', () => {
    // Old contract: a Confirm Training dialog previewed the horse, discipline,
    // the +5 gain and no trait modifiers, with Cancel. Owner ruling q163
    // (2026-10-28) removed the dialog: picking a discipline offers one Train
    // button and nothing else.
    test('picking a discipline opens no confirm dialog and trains nothing on its own', async () => {
      const fetchMock = createFetchMock();
      global.fetch = fetchMock;
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('train-button')).toBeInTheDocument();
      const trainingCalls = fetchMock.mock.calls.filter((call) =>
        call[0]?.toString().includes('/api/v1/training/train')
      );
      expect(trainingCalls).toHaveLength(0);
    });

    test('Train button executes training mutation', async () => {
      const fetchMock = createFetchMock();
      global.fetch = fetchMock;
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      // Train, in one click
      await user.click(screen.getByTestId('train-button'));

      // Verify training API was called
      await waitFor(() => {
        const trainingCalls = fetchMock.mock.calls.filter((call) =>
          call[0]?.toString().includes('/api/v1/training/train')
        );
        expect(trainingCalls.length).toBeGreaterThan(0);
      });
    });

    test('Loading state shown during mutation', async () => {
      // Create a delayed fetch mock
      const delayedFetch = vi.fn((url: string | Request, init?: RequestInit) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        const method = init?.method?.toUpperCase() || 'GET';

        if (urlStr.includes('/api/v1/training/train') && method === 'POST') {
          // Add delay to simulate loading
          return new Promise<Response>((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                status: 200,
                json: () =>
                  Promise.resolve({ success: true, data: createMockTrainingResult('dressage') }),
              } as Response);
            }, 100);
          });
        }

        return createFetchMock()(url, init);
      }) as typeof fetch;

      global.fetch = delayedFetch;
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      // Train, in one click
      await user.click(screen.getByTestId('train-button'));

      // Check for loading state
      await waitFor(() => {
        expect(screen.getByTestId('train-button')).toHaveAttribute('aria-busy', 'true');
      });
    });

    test('the result opens after successful training', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await user.click(screen.getByTestId('train-button'));

      await waitFor(() => {
        expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
      });
    });

    test('Error handling for failed training', async () => {
      global.fetch = createFetchMock({
        trainingError: 'Horse is on cooldown',
      });
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await user.click(screen.getByTestId('train-button'));

      // The refusal is said in place
      await waitFor(() => {
        expect(screen.getByTestId('training-error')).toBeInTheDocument();
      });
    });
  });
});
