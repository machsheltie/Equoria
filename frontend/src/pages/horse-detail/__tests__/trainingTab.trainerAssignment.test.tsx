/**
 * HorseDetailPage Training Tab — assigned trainer (Equoria-r8a6h, owner ruling 2026-10-23).
 * The horse page shows the trainer assigned to this horse with its per-session fee, and
 * the confirm button reads "Train Horse <price>" (the fee charged once per weekly
 * session). Owner ruling 2026-10-26 (q81): a trainer is REQUIRED to train, so with none
 * assigned the tab offers "Assign Trainer" in place of the discipline picker (the old
 * contract here let an untrained-by-anyone horse reach the confirm button).
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

  test('with no trainer the picker is replaced by an Assign Trainer link to that horse', async () => {
    global.fetch = fetchWithAssignments([]);
    renderWithProviders(<HorseDetailPage />);
    await waitForHorseToLoad();
    await navigateToTrainingTab();

    const cta = await screen.findByTestId('training-assign-trainer');
    expect(cta).toHaveTextContent('Assign Trainer');
    expect(cta).toHaveAttribute('href', '/trainers?horseId=1');
    expect(screen.getByTestId('training-eligibility-warning')).toHaveTextContent(
      /needs a trainer/i
    );
    expect(screen.queryByTestId('discipline-picker')).not.toBeInTheDocument();
    expect(screen.queryByTestId('training-status-ready')).not.toBeInTheDocument();
  });

  test('the trainer panel names the trainer as a link to the trainer page', async () => {
    global.fetch = fetchWithAssignments([assignment()]);
    renderWithProviders(<HorseDetailPage />);
    await waitForHorseToLoad();
    await navigateToTrainingTab();

    const link = await screen.findByTestId('horse-trainer-link');
    await waitFor(() => expect(link).toHaveTextContent('Alice Thornton'));
    expect(link).toHaveAttribute('href', '/trainers/10');
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
