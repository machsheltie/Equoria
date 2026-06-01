/**
 * HorseDetailPage Training Tab — Confirmation Flow (Equoria-smnow — split from HorseDetailPage.Training.test.tsx).
 * Training confirmation modal: open, score/trait preview, cancel, confirm, loading, error.
 * Shared fixtures live in ./trainingTab.testHelpers; assertions are unchanged.
 */

import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
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
  // Training Confirmation Flow Tests (8 tests)
  // ============================================
  describe('Training Confirmation Flow', () => {
    test('Confirm modal opens with correct horse and discipline data', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      // Click discipline
      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        const modal = screen.getByTestId('training-confirm-modal');
        expect(within(modal).getByTestId('horse-name')).toHaveTextContent('Thunder');
        expect(within(modal).getByTestId('discipline-name')).toHaveTextContent('Dressage');
      });
    });

    test('Shows correct expected score gain', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        const modal = screen.getByTestId('training-confirm-modal');
        // Base score gain is +5
        expect(within(modal).getByTestId('base-score-gain')).toHaveTextContent('+5');
      });
    });

    test('Shows trait modifiers if any', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        const modal = screen.getByTestId('training-confirm-modal');
        // Horse has "Fast Learner" trait which adds +1
        expect(within(modal).getByTestId('trait-modifiers-list')).toBeInTheDocument();
      });
    });

    test('Cancel button closes modal without training', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      // Click cancel
      await user.click(screen.getByTestId('cancel-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();
      });
    });

    test('Confirm button executes training mutation', async () => {
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

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      // Click confirm
      await user.click(screen.getByTestId('confirm-button'));

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

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      // Click confirm
      await user.click(screen.getByTestId('confirm-button'));

      // Check for loading state
      await waitFor(() => {
        expect(screen.getByTestId('confirm-button')).toHaveAttribute('aria-busy', 'true');
      });
    });

    test('Modal closes after successful training', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      // Wait for confirm modal to close and result modal to open
      await waitFor(() => {
        expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();
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

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      // Modal should stay open on error
      await waitFor(() => {
        expect(screen.getByTestId('training-error')).toBeInTheDocument();
      });
    });
  });
});
