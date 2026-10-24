/**
 * HorseDetailPage Training Tab — assigned trainer (Equoria-r8a6h, owner ruling 2026-10-23).
 * The horse page shows the trainer assigned to this horse with its per-session fee, and
 * the confirm button reads "Train Horse <price>" (the fee charged once per weekly
 * session). With no trainer there is no fee and the button keeps its plain label.
 * Real providers and the real hooks; only the network boundary is stubbed.
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

beforeAll(async () => {
  await import('../TrainingTab');
});

const assignment = (overrides = {}) => ({
  id: 5,
  trainerId: 10,
  horseId: 1,
  horseName: 'Thunder',
  trainerName: 'Alice Thornton',
  trainerPersonality: 'focused',
  trainerSessionRate: 250,
  startDate: '2026-02-01T00:00:00Z',
  isActive: true,
  ...overrides,
});

/** The shared horse/training stub, plus the real assignments endpoint. */
function fetchWithAssignments(assignments: unknown[]) {
  const base = createFetchMock();
  return vi.fn((url: string | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('/api/v1/trainers/assignments')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: assignments }),
      } as Response);
    }
    return base(url, init);
  }) as typeof fetch;
}

describe('HorseDetailPage Training Tab — assigned trainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test('shows the assigned trainer and its per-session fee on the training tab', async () => {
    global.fetch = fetchWithAssignments([assignment()]);
    renderWithProviders(<HorseDetailPage />);
    await waitForHorseToLoad();
    await navigateToTrainingTab();

    const panel = await screen.findByTestId('horse-trainer-panel');
    await waitFor(() => expect(panel).toHaveTextContent('Alice Thornton'));
    expect(panel).toHaveTextContent('250');
  });

  test('the confirm button reads "Train Horse" with the assigned trainer fee', async () => {
    global.fetch = fetchWithAssignments([assignment()]);
    const user = userEvent.setup();
    renderWithProviders(<HorseDetailPage />);
    await waitForHorseToLoad();
    await navigateToTrainingTab();
    await waitFor(() =>
      expect(screen.getByTestId('horse-trainer-panel')).toHaveTextContent('Alice')
    );
    await waitFor(() => expect(screen.getByTestId('discipline-picker')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /dressage/i }));

    const modal = await screen.findByTestId('training-confirm-modal');
    expect(within(modal).getByTestId('confirm-button')).toHaveTextContent(/Train Horse\s*250/);
  });

  test('a trainer assigned to a different horse is not shown on this horse', async () => {
    global.fetch = fetchWithAssignments([assignment({ horseId: 99 })]);
    renderWithProviders(<HorseDetailPage />);
    await waitForHorseToLoad();
    await navigateToTrainingTab();

    const panel = await screen.findByTestId('horse-trainer-panel');
    await waitFor(() =>
      expect(within(panel).getByRole('link', { name: /assign trainer/i })).toBeInTheDocument()
    );
    expect(panel).not.toHaveTextContent('Alice Thornton');
  });

  test('with no trainer the confirm button has no price', async () => {
    global.fetch = fetchWithAssignments([]);
    const user = userEvent.setup();
    renderWithProviders(<HorseDetailPage />);
    await waitForHorseToLoad();
    await navigateToTrainingTab();
    await waitFor(() =>
      expect(
        within(screen.getByTestId('horse-trainer-panel')).getByRole('link', {
          name: /assign trainer/i,
        })
      ).toBeInTheDocument()
    );
    await waitFor(() => expect(screen.getByTestId('discipline-picker')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /dressage/i }));

    const modal = await screen.findByTestId('training-confirm-modal');
    expect(within(modal).getByTestId('confirm-button')).toHaveTextContent('Confirm Training');
  });

  test('shows nothing about trainer fit', async () => {
    global.fetch = fetchWithAssignments([assignment()]);
    renderWithProviders(<HorseDetailPage />);
    await waitForHorseToLoad();
    await navigateToTrainingTab();
    const panel = await screen.findByTestId('horse-trainer-panel');
    await waitFor(() => expect(panel).toHaveTextContent('Alice Thornton'));
    expect(panel).not.toHaveTextContent(/fit|compatib/i);
  });
});
