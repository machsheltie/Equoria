/**
 * MyRidersDashboard — four-state doctrine + silent-mutation boundary tests
 * (Equoria-5urmo, the rider mirror of Equoria-mljz9;
 * FRONTEND_ASYNC_STATE_DOCTRINE §1/§2/§3/§7).
 *
 * Boundary-level tests (NO vi.mock of our hooks / api-client): the dashboard
 * renders SELF-FETCHING (no ridersData/assignmentsData props), so it drives the
 * REAL useUserRiders / useRiderAssignments / useDeleteRiderAssignment /
 * useAssignRider hooks through the REAL api-client, with only the network
 * boundary stubbed by MSW (`server.use(...)`).
 *
 * The defect this locks down: MyRidersDashboard had NO error branch, so a failed
 * riders/assignments fetch fell through to the honest-looking "No Riders Hired"
 * empty state (finalRiders defaults to [] on error). Per §1 the empty state is
 * reachable ONLY through a successful, genuinely-empty fetch; a failed fetch must
 * render ERROR + retry. And per §2 the assign + unassign mutations (which were
 * onSuccess-only / silent) must surface user-visible failure feedback.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import { server } from '@/test/msw/server';
import { Toaster } from '@/components/ui/sonner';
import MyRidersDashboard from '../MyRidersDashboard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const USER_ID = 'user-5urmo';
// `:userId` wildcard — matches whatever userId the dashboard forwards.
const RIDERS_PATH = `${base}/api/v1/riders/user/:userId`;
const ASSIGNMENTS_PATH = `${base}/api/v1/riders/assignments`;

// One hired rider, used by the success + retry-recovery paths so a rider card
// renders. skillLevel 'experienced' is a real SKILL_LEVEL_VISIBILITY key;
// personality 'methodical' is a real rider personality.
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
    assignedHorseId: 1,
    bio: 'Steady in the saddle.',
    hiredDate: '2026-01-01T00:00:00Z',
  },
];

// One active assignment for rider 501 → renders a RiderAssignmentCard with the
// "Unassign rider" control the silent-mutation test drives.
const oneAssignment = [
  {
    id: 9001,
    riderId: 501,
    horseId: 1,
    horseName: 'Storm Runner',
    startDate: '2026-02-01T00:00:00Z',
    isActive: true,
  },
];

function renderDashboard() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        {/* Real sonner sink so mutation-error toasts render into the DOM. */}
        <Toaster />
        <MyRidersDashboard userId={USER_ID} onBrowseMarketplace={() => {}} />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('MyRidersDashboard — four-state doctrine (Equoria-5urmo)', () => {
  it('a failed riders fetch renders an error with retry — never the false "No Riders Hired" empty', async () => {
    // The 500 body carries a server message; it must NEVER reach the UI (§3).
    server.use(
      http.get(RIDERS_PATH, () =>
        HttpResponse.json({ success: false, message: 'Internal boom leak' }, { status: 500 })
      ),
      http.get(ASSIGNMENTS_PATH, () => HttpResponse.json([]))
    );

    renderDashboard();

    // ERROR state: retry affordance wired (canonical ErrorState renders "Try Again").
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
    // The false empty must NOT appear on a failed fetch.
    expect(screen.queryByText(/no riders hired/i)).not.toBeInTheDocument();
    // The raw server body text is not leaked into the UI.
    expect(screen.queryByText(/internal boom leak/i)).not.toBeInTheDocument();
  });

  it('a successful empty riders fetch renders the honest empty state (no error)', async () => {
    server.use(
      http.get(RIDERS_PATH, () => HttpResponse.json([])),
      http.get(ASSIGNMENTS_PATH, () => HttpResponse.json([]))
    );

    renderDashboard();

    // EMPTY is reachable only via a successful, genuinely-empty fetch.
    expect(await screen.findByText(/no riders hired/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('a successful riders fetch with rows renders the grid — never the empty or error state', async () => {
    server.use(
      http.get(RIDERS_PATH, () => HttpResponse.json(oneRider)),
      http.get(ASSIGNMENTS_PATH, () => HttpResponse.json([]))
    );

    renderDashboard();

    expect(await screen.findByTestId('rider-grid')).toBeInTheDocument();
    expect(screen.queryByText(/no riders hired/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('the error-state retry refetches — first load fails, retry recovers to the grid', async () => {
    let calls = 0;
    server.use(
      http.get(RIDERS_PATH, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ success: false, message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json(oneRider);
      }),
      http.get(ASSIGNMENTS_PATH, () => HttpResponse.json([]))
    );

    const user = userEvent.setup();
    renderDashboard();

    const retry = await screen.findByRole('button', { name: /try again/i });
    await user.click(retry);

    expect(await screen.findByTestId('rider-grid')).toBeInTheDocument();
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});

describe('MyRidersDashboard — silent-mutation feedback (Equoria-5urmo)', () => {
  it('a failed unassign surfaces a visible error toast (no raw server leak)', async () => {
    server.use(
      http.get(RIDERS_PATH, () => HttpResponse.json(oneRider)),
      http.get(ASSIGNMENTS_PATH, () => HttpResponse.json(oneAssignment)),
      http.delete(`${base}/api/v1/riders/assignments/:id`, () =>
        HttpResponse.json({ success: false, message: 'delete boom leak' }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderDashboard();

    await screen.findByTestId('rider-grid');

    // The assignment row's Trash2 control (aria-label "Unassign rider").
    await user.click(await screen.findByRole('button', { name: /unassign rider/i }));
    // Confirm in the dialog (destructive button text is "Remove Rider").
    await user.click(await screen.findByRole('button', { name: /remove rider/i }));

    // Visible failure feedback surfaces via the real sonner Toaster …
    expect(await screen.findByText(/could not unassign the rider/i)).toBeInTheDocument();
    // … and the raw server body text is not leaked.
    expect(screen.queryByText(/delete boom leak/i)).not.toBeInTheDocument();
  });

  it('a failed assign surfaces a visible error toast (no raw server leak)', async () => {
    server.use(
      http.get(RIDERS_PATH, () => HttpResponse.json(oneRider)),
      http.get(ASSIGNMENTS_PATH, () => HttpResponse.json([])),
      http.post(`${base}/api/v1/riders/assignments`, () =>
        HttpResponse.json({ success: false, message: 'assign boom leak' }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderDashboard();

    await screen.findByTestId('rider-grid');

    // Open the horse picker for rider 501, then pick a horse (default /horses
    // handler returns "Storm Runner") to fire the assign mutation.
    await user.click(await screen.findByTestId('assign-button-501'));
    await user.click(await screen.findByRole('button', { name: /storm runner/i }));

    // Visible failure feedback surfaces …
    expect(await screen.findByText(/could not assign the rider/i)).toBeInTheDocument();
    // … and the raw server body text is not leaked.
    expect(screen.queryByText(/assign boom leak/i)).not.toBeInTheDocument();
  });
});
