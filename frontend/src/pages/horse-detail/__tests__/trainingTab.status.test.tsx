/**
 * HorseDetailPage Training Tab — Status Display & Error Handling (Equoria-smnow — split from HorseDetailPage.Training.test.tsx).
 * Training-status (ready / cooldown / ineligible) display and training-failure error handling.
 * Shared fixtures live in ./trainingTab.testHelpers; assertions are unchanged.
 */

import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi, describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import HorseDetailPage from '../../HorseDetailPage';
import {
  createYoungHorse,
  createMockTrainingOverviewWithCooldown,
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

describe('HorseDetailPage Training Tab — Status Display & Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ============================================
  // Training Status Display Tests (4 tests)
  // ============================================
  describe('Training Status Display', () => {
    test('Shows "Ready to train" when no cooldown', async () => {
      global.fetch = createFetchMock();
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('training-status-ready')).toBeInTheDocument();
        expect(screen.getByText(/ready to train/i)).toBeInTheDocument();
      });
    });

    test('Shows cooldown date when on cooldown', async () => {
      global.fetch = createFetchMock({
        trainingOverview: createMockTrainingOverviewWithCooldown(),
      });
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('training-status-cooldown')).toBeInTheDocument();
        expect(screen.getByText(/next training available/i)).toBeInTheDocument();
      });
    });

    test('Shows ineligible status for young horses', async () => {
      global.fetch = createFetchMock({
        horse: createYoungHorse(),
      });
      renderWithProviders(<HorseDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Foalster')).toBeInTheDocument();
      });

      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('training-status-ineligible')).toBeInTheDocument();
        // Use within to scope the query to the status element
        const statusElement = screen.getByTestId('training-status-ineligible');
        expect(within(statusElement).getByText(/at least 3 years old/i)).toBeInTheDocument();
      });
    });

    test('Displays training eligibility warning for young horses', async () => {
      global.fetch = createFetchMock({
        horse: createYoungHorse(),
      });
      renderWithProviders(<HorseDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Foalster')).toBeInTheDocument();
      });

      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('training-eligibility-warning')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Error Handling Tests (3 tests)
  // ============================================
  describe('Error Handling', () => {
    test('Shows error message if training fails', async () => {
      global.fetch = createFetchMock({
        trainingError: 'Training failed: Horse is too tired',
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

      await waitFor(() => {
        expect(screen.getByTestId('training-error')).toBeInTheDocument();
      });
    });

    test('Keeps modal open on error for retry', async () => {
      global.fetch = createFetchMock({
        trainingError: 'Training failed: Network error',
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

      await waitFor(() => {
        expect(screen.getByTestId('training-error')).toBeInTheDocument();
      });

      // Modal should still be visible for retry
      expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
    });

    test('Error state clears when modal closes', async () => {
      global.fetch = createFetchMock({
        trainingError: 'Training failed: Server error',
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

      await waitFor(() => {
        expect(screen.getByTestId('training-error')).toBeInTheDocument();
      });

      // Close modal
      await user.click(screen.getByTestId('cancel-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();
        expect(screen.queryByTestId('training-error')).not.toBeInTheDocument();
      });
    });
  });
});
