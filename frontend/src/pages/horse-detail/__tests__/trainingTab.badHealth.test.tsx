/**
 * HorseDetailPage Training Tab — a horse in Bad health is never offered for
 * training (Equoria-du9bn; owner ruling 2026-10-23: Fair or better to train).
 * Shared fixtures live in ./trainingTab.testHelpers.
 */

import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import HorseDetailPage from '../../HorseDetailPage';
import {
  createMockHorse,
  originalFetch,
  createFetchMock,
  renderWithProviders,
  waitForHorseToLoad,
  navigateToTrainingTab,
} from './trainingTab.testHelpers';

beforeAll(async () => {
  await import('../TrainingTab');
});

describe('HorseDetailPage Training Tab — Bad health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test('shows the horse as ineligible, with the health reason, not ready', async () => {
    global.fetch = createFetchMock({
      horse: createMockHorse({ displayedHealth: 'Bad' }),
    });
    renderWithProviders(<HorseDetailPage />);

    await waitForHorseToLoad();
    await navigateToTrainingTab();

    await waitFor(() => {
      const status = screen.getByTestId('training-status-ineligible');
      expect(within(status).getByText(/Bad health and cannot train/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('training-status-ready')).not.toBeInTheDocument();
  });
});
