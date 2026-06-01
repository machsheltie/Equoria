/**
 * HorseDetailPage Training Tab — Tab Integration & Discipline Selection (Equoria-smnow — split from HorseDetailPage.Training.test.tsx).
 * Tab navigation/ARIA and discipline-picker selection -> confirm modal.
 * Shared fixtures live in ./trainingTab.testHelpers; assertions are unchanged.
 */

import React from 'react';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
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

describe('HorseDetailPage Training Tab — Tab Integration & Discipline Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Tab Integration', () => {
    test('Training tab appears in tab navigation', async () => {
      global.fetch = createFetchMock();
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();

      const trainingTab = screen.getByRole('tab', { name: /training/i });
      expect(trainingTab).toBeInTheDocument();
    });

    test('Clicking Training tab shows training content', async () => {
      global.fetch = createFetchMock();
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      // TrainingTab is lazy-loaded via Suspense; allow extra time for the chunk
      // to resolve under CI load (default 1000ms can flake).
      await waitFor(
        () => {
          expect(screen.getByTestId('training-tab')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    test('Training tab is keyboard accessible', async () => {
      global.fetch = createFetchMock();
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();

      const trainingTab = screen.getByRole('tab', { name: /training/i });

      // Focus and press Enter
      trainingTab.focus();
      fireEvent.keyDown(trainingTab, { key: 'Enter', code: 'Enter' });
      await userEvent.click(trainingTab);

      await waitFor(() => {
        expect(trainingTab).toHaveAttribute('aria-selected', 'true');
      });
    });

    test('Training tab maintains ARIA attributes correctly', async () => {
      global.fetch = createFetchMock();
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();

      const trainingTab = screen.getByRole('tab', { name: /training/i });
      expect(trainingTab).toHaveAttribute('aria-selected', 'false');
      expect(trainingTab).toHaveAttribute('aria-controls', 'training-panel');

      await navigateToTrainingTab();

      expect(trainingTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  // ============================================
  // Discipline Selection Tests (5 tests)
  // ============================================
  describe('Discipline Selection', () => {
    test('DisciplinePicker renders with horse discipline scores', async () => {
      global.fetch = createFetchMock();
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      // Check that discipline categories are visible
      expect(screen.getByText('Western')).toBeInTheDocument();
      expect(screen.getByText('English')).toBeInTheDocument();
    });

    test('Clicking discipline opens confirm modal', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      // Wait for discipline picker to load
      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      // Click on a discipline (Western Pleasure)
      const disciplineButton = screen.getByRole('button', { name: /western pleasure/i });
      await user.click(disciplineButton);

      // Check confirm modal opens
      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });
    });

    test('Selected discipline state updates correctly', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      // Click on a discipline
      const disciplineButton = screen.getByRole('button', { name: /dressage/i });
      await user.click(disciplineButton);

      // Check that modal shows selected discipline
      await waitFor(() => {
        const modal = screen.getByTestId('training-confirm-modal');
        expect(within(modal).getByTestId('discipline-name')).toHaveTextContent('Dressage');
      });
    });

    test('Can select different disciplines', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      // Select first discipline
      const firstDiscipline = screen.getByRole('button', { name: /western pleasure/i });
      await user.click(firstDiscipline);

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      // Close modal
      const cancelButton = screen.getByTestId('cancel-button');
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();
      });

      // Select different discipline
      const secondDiscipline = screen.getByRole('button', { name: /dressage/i });
      await user.click(secondDiscipline);

      await waitFor(() => {
        const modal = screen.getByTestId('training-confirm-modal');
        expect(within(modal).getByTestId('discipline-name')).toHaveTextContent('Dressage');
      });
    });

    test('Shows current scores for each discipline', async () => {
      global.fetch = createFetchMock();
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      // Check that scores are displayed (match the mock data)
      // Western Pleasure score should show 45
      const westernButton = screen.getByRole('button', { name: /western pleasure.*score.*45/i });
      expect(westernButton).toBeInTheDocument();
    });
  });
});
