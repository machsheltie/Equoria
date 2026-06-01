/**
 * HorseDetailPage Training Tab — Complete Flow (Equoria-smnow — split from HorseDetailPage.Training.test.tsx).
 * End-to-end select->confirm->train->result->close and escape-key closes.
 * Shared fixtures live in ./trainingTab.testHelpers; assertions are unchanged.
 */

import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi, describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import HorseDetailPage from '../../HorseDetailPage';
import {
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

describe('HorseDetailPage Training Tab — Complete Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ============================================
  // Complete Training Flow Tests (5 tests)
  // ============================================
  describe('Complete Training Flow', () => {
    test('Full flow: select -> confirm -> train -> view results -> close', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      // Step 1: Select discipline
      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      // Step 2: Confirm modal opens
      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      // Step 3: Confirm training
      await user.click(screen.getByTestId('confirm-button'));

      // Step 4: Result modal opens
      await waitFor(() => {
        expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
      });

      // Step 5: Close result modal
      await user.click(screen.getByTestId('close-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('training-result-modal')).not.toBeInTheDocument();
      });
    });

    test('Can start new training after completing one', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      // Complete first training
      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('close-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('training-result-modal')).not.toBeInTheDocument();
      });

      // Start second training with different discipline
      await user.click(screen.getByRole('button', { name: /show jumping/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
        const modal = screen.getByTestId('training-confirm-modal');
        expect(within(modal).getByTestId('discipline-name')).toHaveTextContent('Show Jumping');
      });
    });

    test('State resets correctly after flow completes', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      // Complete training flow
      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('close-button'));

      // Verify state is reset
      await waitFor(() => {
        // No modals visible
        expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();
        expect(screen.queryByTestId('training-result-modal')).not.toBeInTheDocument();
        // No error displayed
        expect(screen.queryByTestId('training-error')).not.toBeInTheDocument();
        // Discipline picker is ready
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });
    });

    test('Escape key closes confirm modal', async () => {
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

      // Press Escape key
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();
      });
    });

    test('Escape key closes result modal', async () => {
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

      await waitFor(() => {
        expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
      });

      // Press Escape key
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('training-result-modal')).not.toBeInTheDocument();
      });
    });
  });
});
