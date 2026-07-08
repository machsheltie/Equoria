/**
 * MyTrainersDashboard — four-state doctrine + silent-mutation boundary tests
 * (Equoria-u96fm, FRONTEND_ASYNC_STATE_DOCTRINE §1/§2/§3/§7).
 *
 * Direct mirror of MyGroomsDashboard.fourstate.test.tsx (Equoria-mljz9). These
 * are boundary-level tests (NO vi.mock of our hooks / api-client): the dashboard
 * self-fetches, so it drives the REAL useUserTrainers / useTrainerAssignments /
 * useDeleteTrainerAssignment / useAssignTrainer hooks through the REAL api-client,
 * with only the network boundary stubbed by MSW (`server.use(...)`).
 *
 * The defect this locks down: the dashboard had NO error branch, so a failed
 * trainers/assignments fetch fell through to the honest-looking "No Trainers
 * Hired" empty state (finalTrainers defaults to [] on error). Per §1 the empty
 * state is reachable ONLY through a successful, genuinely-empty fetch; a failed
 * fetch must render ERROR + retry. And per §2 a failed assign / unassign mutation
 * must surface user-visible feedback (both were onSuccess-only / silent).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import { server } from '@/test/msw/server';
import { Toaster } from '@/components/ui/sonner';
import MyTrainersDashboard from '../MyTrainersDashboard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const USER_ID = 'test-user-1';
const TRAINERS_PATH = `${base}/api/v1/trainers/user/${USER_ID}`;
const ASSIGNMENTS_PATH = `${base}/api/v1/trainers/assignments`;

// One hired trainer, used by the success + retry-recovery paths so a trainer
// card renders (and, with an assignment, an unassign control).
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

const oneActiveAssignment = [
  {
    id: 5,
    trainerId: 10,
    horseId: 1,
    horseName: 'Storm Runner',
    trainerName: 'Alice Thornton',
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
        <MyTrainersDashboard userId={USER_ID} />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('MyTrainersDashboard — four-state doctrine (Equoria-u96fm)', () => {
  it('a failed trainers fetch renders an error with retry — never the false "No Trainers Hired" empty', async () => {
    // The 500 body carries a server message; it must NEVER reach the UI (§3).
    server.use(
      http.get(TRAINERS_PATH, () =>
        HttpResponse.json({ success: false, message: 'Internal boom leak' }, { status: 500 })
      ),
      http.get(ASSIGNMENTS_PATH, () => HttpResponse.json({ success: true, data: [] }))
    );

    renderDashboard();

    // ERROR state: retry affordance wired (canonical ErrorState renders "Try Again").
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
    // The false empty must NOT appear on a failed fetch.
    expect(screen.queryByText(/no trainers hired/i)).not.toBeInTheDocument();
    // The raw server body text is not leaked into the UI.
    expect(screen.queryByText(/internal boom leak/i)).not.toBeInTheDocument();
  });

  it('a successful empty trainers fetch renders the honest empty state (no error)', async () => {
    server.use(
      http.get(TRAINERS_PATH, () => HttpResponse.json({ success: true, data: [] })),
      http.get(ASSIGNMENTS_PATH, () => HttpResponse.json({ success: true, data: [] }))
    );

    renderDashboard();

    // EMPTY is reachable only via a successful, genuinely-empty fetch.
    expect(await screen.findByText(/no trainers hired/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('a successful trainers fetch with rows renders the grid — never the empty or error state', async () => {
    server.use(
      http.get(TRAINERS_PATH, () => HttpResponse.json({ success: true, data: oneTrainer })),
      http.get(ASSIGNMENTS_PATH, () => HttpResponse.json({ success: true, data: [] }))
    );

    renderDashboard();

    expect(await screen.findByTestId('trainer-grid')).toBeInTheDocument();
    expect(screen.queryByText(/no trainers hired/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('the error-state retry refetches — first load fails, retry recovers to the grid', async () => {
    let calls = 0;
    server.use(
      http.get(TRAINERS_PATH, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ success: false, message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json({ success: true, data: oneTrainer });
      }),
      http.get(ASSIGNMENTS_PATH, () => HttpResponse.json({ success: true, data: [] }))
    );

    const user = userEvent.setup();
    renderDashboard();

    const retry = await screen.findByRole('button', { name: /try again/i });
    await user.click(retry);

    expect(await screen.findByTestId('trainer-grid')).toBeInTheDocument();
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('a failed assignments fetch (trainers OK) renders error — not a fabricated "0 assigned" grid', async () => {
    // Exercises the `|| assignmentsIsError` half of the combined gate: a partial
    // render (trainers rows + failed assignments) would fabricate wrong
    // "0 assigned" counts / "N without assignments" warnings (§4). The combined
    // error avoids that fabrication.
    server.use(
      http.get(TRAINERS_PATH, () => HttpResponse.json({ success: true, data: oneTrainer })),
      http.get(ASSIGNMENTS_PATH, () =>
        HttpResponse.json({ success: false, message: 'assignments boom leak' }, { status: 500 })
      )
    );

    renderDashboard();

    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByTestId('trainer-grid')).not.toBeInTheDocument();
    expect(screen.queryByText(/assignments boom leak/i)).not.toBeInTheDocument();
  });
});

describe('MyTrainersDashboard — silent-mutation feedback (Equoria-u96fm)', () => {
  it('a failed unassign surfaces a visible error toast (no raw server leak)', async () => {
    server.use(
      http.get(TRAINERS_PATH, () => HttpResponse.json({ success: true, data: oneTrainer })),
      http.get(ASSIGNMENTS_PATH, () =>
        HttpResponse.json({ success: true, data: oneActiveAssignment })
      ),
      http.delete(`${base}/api/v1/trainers/assignments/:id`, () =>
        HttpResponse.json({ success: false, message: 'delete boom leak' }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderDashboard();

    await screen.findByTestId('trainer-grid');

    // The assignment row's Trash2 control (aria-label "Unassign trainer").
    await user.click(await screen.findByRole('button', { name: /unassign trainer/i }));
    // Confirm in the dialog (destructive button text is "Remove Trainer").
    await user.click(await screen.findByRole('button', { name: /remove trainer/i }));

    // Visible failure feedback surfaces via the real sonner Toaster …
    expect(await screen.findByText(/could not unassign the trainer/i)).toBeInTheDocument();
    // … and the raw server body text is not leaked.
    expect(screen.queryByText(/delete boom leak/i)).not.toBeInTheDocument();
  });

  it('a failed assign surfaces a visible error toast (no raw server leak)', async () => {
    server.use(
      http.get(TRAINERS_PATH, () => HttpResponse.json({ success: true, data: oneTrainer })),
      http.get(ASSIGNMENTS_PATH, () => HttpResponse.json({ success: true, data: [] })),
      // Deterministic horse list for the picker modal.
      http.get(`${base}/api/v1/horses`, () =>
        HttpResponse.json({
          success: true,
          data: [{ id: 1, name: 'Test Horse', breed: 'Thoroughbred', age: 5 }],
        })
      ),
      http.post(ASSIGNMENTS_PATH, () =>
        HttpResponse.json({ success: false, message: 'assign boom leak' }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderDashboard();

    await screen.findByTestId('trainer-grid');

    // Open the horse-picker modal for trainer 10, then pick the (only) horse.
    await user.click(await screen.findByTestId('assign-button-10'));
    await user.click(await screen.findByRole('button', { name: /test horse/i }));

    // Visible failure feedback surfaces via the real sonner Toaster …
    expect(await screen.findByText(/could not assign the trainer/i)).toBeInTheDocument();
    // … and the raw server body text is not leaked.
    expect(screen.queryByText(/assign boom leak/i)).not.toBeInTheDocument();
  });
});
