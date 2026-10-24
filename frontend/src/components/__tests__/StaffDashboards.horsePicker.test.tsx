/**
 * MyTrainersDashboard + MyRidersDashboard — the "Assign to Horse" picker tells
 * the truth about the horse list (Equoria-gpnck; FRONTEND_ASYNC_STATE_DOCTRINE
 * §1/§3).
 *
 * Boundary-level: REAL useHorses / useUserTrainers / useUserRiders hooks through
 * the REAL api-client, with only the network stubbed (MSW). The defect: the
 * picker destructured only `isLoading`, so a FAILED horses fetch fell through to
 * the hardcoded "No horses available." — telling a player with horses that they
 * have none.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import { server } from '@/test/msw/server';
import MyTrainersDashboard from '../MyTrainersDashboard';
import MyRidersDashboard from '../MyRidersDashboard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const testUserId = 'user-gpnck';
const HORSES = `${base}/api/v1/horses`;

const oneTrainer = [
  {
    id: 10,
    firstName: 'Alice',
    lastName: 'Thornton',
    name: 'Alice Thornton',
    skillLevel: 'expert',
    personality: 'focused',
    speciality: 'Dressage',
    sessionRate: 150,
    experience: 8,
    level: 5,
    careerWeeks: 12,
    retired: false,
  },
];

const oneRider = [
  {
    id: 501,
    name: 'Ada Vane',
    firstName: 'Ada',
    lastName: 'Vane',
    skillLevel: 'experienced',
    personality: 'methodical',
    experience: 300,
    level: 3,
    weeklyRate: 120,
    careerWeeks: 20,
    totalWins: 4,
    totalCompetitions: 12,
    prestige: 30,
    isActive: true,
    retired: false,
    assignedHorseId: null,
    bio: 'Steady in the saddle.',
    hiredDate: '2026-01-01T00:00:00Z',
  },
];

const oneHorse = [{ id: 1, name: 'Storm Runner', breed: 'Thoroughbred', age: 5 }];

function renderWith(node: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>{node}</BrowserRouter>
    </QueryClientProvider>
  );
}

const cases = [
  {
    label: 'MyTrainersDashboard',
    // Owner ruling 2026-10-23 (Equoria-r8a6h): the trainer card button reads "Assign Trainer"
    // (it read "Assign to Horse" before, like the riders card).
    assignLabel: /assign trainer/i,
    node: <MyTrainersDashboard userId={testUserId} />,
    handlers: () => [
      http.get(`${base}/api/v1/trainers/user/${testUserId}`, () => HttpResponse.json(oneTrainer)),
      http.get(`${base}/api/v1/trainers/assignments`, () => HttpResponse.json([])),
    ],
  },
  {
    label: 'MyRidersDashboard',
    assignLabel: /assign to horse/i,
    node: <MyRidersDashboard userId={testUserId} onBrowseMarketplace={() => {}} />,
    handlers: () => [
      http.get(`${base}/api/v1/riders/user/${testUserId}`, () => HttpResponse.json(oneRider)),
      http.get(`${base}/api/v1/riders/assignments`, () => HttpResponse.json([])),
    ],
  },
];

describe.each(cases)('$label — horse picker (Equoria-gpnck)', ({ node, handlers, assignLabel }) => {
  async function openPicker() {
    const user = userEvent.setup();
    renderWith(node);
    await user.click(await screen.findByRole('button', { name: assignLabel }));
    return { user, picker: await screen.findByTestId('horse-picker-modal') };
  }

  it('a failed horses fetch shows an error with retry — never "No horses available."', async () => {
    server.use(
      ...handlers(),
      http.get(HORSES, () =>
        HttpResponse.json({ success: false, message: 'RAW-SERVER-TEXT leak' }, { status: 500 })
      )
    );

    const { picker } = await openPicker();

    expect(await within(picker).findByRole('alert')).toHaveTextContent(/something went wrong/i);
    expect(within(picker).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(within(picker).queryByText(/no horses available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('retry refetches the horses and recovers to the list', async () => {
    let calls = 0;
    server.use(
      ...handlers(),
      http.get(HORSES, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ success: false, message: 'boom' }, { status: 500 })
          : HttpResponse.json(oneHorse);
      })
    );

    const { user, picker } = await openPicker();
    await user.click(await within(picker).findByRole('button', { name: /try again/i }));

    expect(await within(picker).findByText('Storm Runner')).toBeInTheDocument();
    expect(within(picker).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a successful empty horses fetch is the honest "No horses available."', async () => {
    server.use(
      ...handlers(),
      http.get(HORSES, () => HttpResponse.json([]))
    );

    const { picker } = await openPicker();

    expect(await within(picker).findByText(/no horses available/i)).toBeInTheDocument();
    expect(within(picker).queryByRole('alert')).not.toBeInTheDocument();
  });
});
