/**
 * HorseDetailPage Training Tab — after training (Equoria-6v2rt).
 * Shared fixtures live in ./trainingTab.testHelpers.
 *
 * Owner ruling q173 (2026-10-28): success feedback is the page itself
 * changing — no popup, no log. Old contract: a successful train opened a
 * "Training Complete" result dialog (TrainingResultModal, removed) with the
 * score breakdown, new score and XP, closed by a button or Escape. Its cases
 * here are replaced by: no dialog opens, the discipline's score and the
 * Training Status change on the page, and a refusal is still said in place.
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
  createMockHorse,
  createMockTrainingOverviewWithCooldown,
  renderWithProviders,
  waitForHorseToLoad,
  navigateToTrainingTab,
} from './trainingTab.testHelpers';

// Pre-warm the lazy TrainingTab chunk (Equoria-q7mn) so Suspense resolves sync.
beforeAll(async () => {
  await import('../TrainingTab');
});

/**
 * The server before and after one dressage session: once the train POST has
 * answered, the horse reads dressage 35 (was 30) and the overview carries a
 * cooldown, as the real routes do.
 */
function serverThatTrains() {
  const before = createFetchMock();
  const after = createFetchMock({
    horse: createMockHorse({
      disciplineScores: { ...createMockHorse().disciplineScores, dressage: 35 },
    }),
    trainingOverview: createMockTrainingOverviewWithCooldown(),
  });
  let trained = false;
  return vi.fn(async (url: string | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('/api/v1/training/train') && init?.method?.toUpperCase() === 'POST') {
      const res = await before(url, init);
      trained = true;
      return res;
    }
    return (trained ? after : before)(url, init);
  }) as typeof fetch;
}

describe('HorseDetailPage Training Tab — after training', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test('no popup: the score and the Training Status change on the page', async () => {
    global.fetch = serverThatTrains();
    const user = userEvent.setup();

    renderWithProviders(<HorseDetailPage />);

    await waitForHorseToLoad();
    await navigateToTrainingTab();

    const picker = await screen.findByTestId('discipline-picker');
    expect(
      within(picker).getByRole('button', { name: /dressage discipline, current score: 30/i })
    ).toBeInTheDocument();
    expect(await screen.findByTestId('training-status-ready')).toBeInTheDocument();

    await user.click(within(picker).getByRole('button', { name: /dressage/i }));
    await user.click(screen.getByTestId('train-button'));

    await waitFor(() => {
      expect(
        within(screen.getByTestId('discipline-picker')).getByRole('button', {
          name: /dressage discipline, current score: 35/i,
        })
      ).toBeInTheDocument();
    });
    expect(await screen.findByTestId('training-status-cooldown')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('training-result-modal')).not.toBeInTheDocument();
    expect(screen.queryByText(/training complete/i)).not.toBeInTheDocument();
    // Nothing is left picked: the Train button goes until she picks again.
    expect(screen.queryByTestId('train-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('training-error')).not.toBeInTheDocument();
  });

  test('a refusal is said in place, and the discipline stays picked', async () => {
    global.fetch = createFetchMock({ trainingError: 'Horse is on cooldown' });
    const user = userEvent.setup();

    renderWithProviders(<HorseDetailPage />);

    await waitForHorseToLoad();
    await navigateToTrainingTab();

    await user.click(
      within(await screen.findByTestId('discipline-picker')).getByRole('button', {
        name: /dressage/i,
      })
    );
    await user.click(screen.getByTestId('train-button'));

    expect(await screen.findByTestId('training-error')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('train-button')).toBeInTheDocument();
  });
});
