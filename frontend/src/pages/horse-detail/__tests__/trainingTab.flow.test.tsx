/**
 * HorseDetailPage Training Tab — Complete Flow (Equoria-smnow — split from HorseDetailPage.Training.test.tsx).
 * End-to-end select->train, then the page is ready for the next session.
 * Shared fixtures live in ./trainingTab.testHelpers.
 *
 * Owner ruling q163 (2026-10-28; Equoria-tjh8k): pick the discipline, then one
 * "Train — <fee>" button. Old contract: picking a discipline opened a Confirm
 * Training dialog; its steps and the "Escape closes the confirm dialog" case
 * went with it, replaced by "picking a discipline opens no dialog".
 *
 * Owner ruling q173 (2026-10-28; Equoria-6v2rt): no result popup; the page
 * updates in place. Old contract: a result dialog opened, closed by its
 * button or Escape; the close steps and the "Escape closes the result" case
 * went with it (trainingTab.result covers the in-place update).
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
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
    test('Full flow: select -> train, no dialog', async () => {
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

      // Step 2: Train, in one click
      await user.click(screen.getByTestId('train-button'));

      // Step 3: the session is done in place, with no dialog
      await waitFor(() => {
        expect(screen.queryByTestId('train-button')).not.toBeInTheDocument();
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

      await user.click(screen.getByTestId('train-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('train-button')).not.toBeInTheDocument();
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Start second training with different discipline
      await user.click(screen.getByRole('button', { name: /show jumping/i }));

      await waitFor(() => {
        expect(screen.getByTestId('train-button')).toBeInTheDocument();
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

      await user.click(screen.getByTestId('train-button'));

      // Verify state is reset
      await waitFor(() => {
        // No dialog, and no discipline left picked
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByTestId('train-button')).not.toBeInTheDocument();
        // No error displayed
        expect(screen.queryByTestId('training-error')).not.toBeInTheDocument();
        // Discipline picker is ready
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });
    });

    test('picking a discipline opens no dialog; the Train button waits below the picker', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('train-button')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /dressage/i }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('train-button')).toBeInTheDocument();
    });
  });
});
