/**
 * HorseDetailPage Training Tab — Result Display (Equoria-smnow — split from HorseDetailPage.Training.test.tsx).
 * Training result modal: score breakdown, new score, stat/XP gains, close-resets-state.
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

describe('HorseDetailPage Training Tab — Result Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ============================================
  // Training Result Display Tests (6 tests)
  // ============================================
  describe('Training Result Display', () => {
    test('Result modal opens after successful training', async () => {
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

      // Wait for result modal
      await waitFor(() => {
        expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
      });
    });

    test('Shows correct score gain breakdown', async () => {
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
        const modal = screen.getByTestId('training-result-modal');
        expect(within(modal).getByTestId('score-breakdown')).toBeInTheDocument();
      });
    });

    test('Displays new score value', async () => {
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
        const modal = screen.getByTestId('training-result-modal');
        expect(within(modal).getByTestId('new-score')).toBeInTheDocument();
      });
    });

    test('Shows stat gains if any', async () => {
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
        const modal = screen.getByTestId('training-result-modal');
        // Mock result includes speed stat gain
        expect(within(modal).getByTestId('stat-gain-speed')).toBeInTheDocument();
      });
    });

    test('Shows XP gain if any', async () => {
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
        const modal = screen.getByTestId('training-result-modal');
        // Mock result includes XP gain
        expect(within(modal).getByTestId('xp-gain')).toBeInTheDocument();
      });
    });

    test('Closing result modal resets training state', async () => {
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

      // Close result modal
      await user.click(screen.getByTestId('close-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('training-result-modal')).not.toBeInTheDocument();
      });

      // State should be reset - can start new training
      expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
    });
  });
});
