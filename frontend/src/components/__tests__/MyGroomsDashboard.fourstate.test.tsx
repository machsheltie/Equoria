/**
 * MyGroomsDashboard — four-state doctrine + silent-mutation boundary tests
 * (Equoria-mljz9, FRONTEND_ASYNC_STATE_DOCTRINE §1/§2/§3/§7).
 *
 * Boundary-level tests (NO vi.mock of our hooks / api-client): the dashboard
 * renders SELF-FETCHING (no groomsData/assignmentsData/salaryCostsData props),
 * so it drives the REAL useUserGrooms / useGroomAssignments / useGroomSalaries
 * / useDeleteAssignment hooks through the REAL api-client, with only the network
 * boundary stubbed by MSW (`server.use(...)`).
 *
 * The defect this locks down: the Manage tab had NO error branch, so a failed
 * grooms/assignments/salaries fetch fell through to the honest-looking
 * "No Grooms Hired" empty state (finalGrooms defaults to [] on error). Per §1
 * the empty state is reachable ONLY through a successful, genuinely-empty fetch;
 * a failed fetch must render ERROR + retry. And per §2 a failed unassign
 * mutation must surface user-visible feedback (it was onSuccess-only / silent).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import { server } from '@/test/msw/server';
import { Toaster } from '@/components/ui/sonner';
import MyGroomsDashboard from '../MyGroomsDashboard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const USER_ID = 1;
const GROOMS_PATH = `${base}/api/v1/grooms/user/${USER_ID}`;

// One hired groom (mirrors the default v1 grooms/user mirror), used by the
// success + retry-recovery paths so a groom card + its assignment render.
const oneGroom = [
  {
    id: 10,
    name: 'Alice Thornton',
    skillLevel: 'Expert',
    specialty: 'Dressage',
    personality: 'Calm',
    experience: 8,
    sessionRate: 150,
    isActive: true,
    availableSlots: 2,
    currentAssignments: 1,
    maxAssignments: 3,
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
        <MyGroomsDashboard userId={USER_ID} onBrowseMarketplace={() => {}} />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('MyGroomsDashboard — four-state doctrine (Equoria-mljz9)', () => {
  it('a failed grooms fetch renders an error with retry — never the false "No Grooms Hired" empty', async () => {
    // The 500 body carries a server message; it must NEVER reach the UI (§3).
    server.use(
      http.get(GROOMS_PATH, () =>
        HttpResponse.json({ success: false, message: 'Internal boom leak' }, { status: 500 })
      )
    );

    renderDashboard();

    // ERROR state: retry affordance wired (canonical ErrorState renders "Try Again").
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
    // The false empty must NOT appear on a failed fetch.
    expect(screen.queryByText(/no grooms hired/i)).not.toBeInTheDocument();
    // The raw server body text is not leaked into the UI.
    expect(screen.queryByText(/internal boom leak/i)).not.toBeInTheDocument();
  });

  it('a successful empty grooms fetch renders the honest empty state (no error)', async () => {
    server.use(http.get(GROOMS_PATH, () => HttpResponse.json({ success: true, data: [] })));

    renderDashboard();

    // EMPTY is reachable only via a successful, genuinely-empty fetch.
    expect(await screen.findByText(/no grooms hired/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('a successful grooms fetch with rows renders the grid — never the empty or error state', async () => {
    // Default handlers already return one hired groom; assert the success path.
    renderDashboard();

    expect(await screen.findByTestId('groom-grid')).toBeInTheDocument();
    expect(screen.queryByText(/no grooms hired/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('the error-state retry refetches — first load fails, retry recovers to the grid', async () => {
    let calls = 0;
    server.use(
      http.get(GROOMS_PATH, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ success: false, message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json({ success: true, data: oneGroom });
      })
    );

    const user = userEvent.setup();
    renderDashboard();

    const retry = await screen.findByRole('button', { name: /try again/i });
    await user.click(retry);

    expect(await screen.findByTestId('groom-grid')).toBeInTheDocument();
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});

describe('MyGroomsDashboard — silent-mutation feedback (Equoria-mljz9)', () => {
  it('a failed unassign surfaces a visible error toast (no raw server leak)', async () => {
    // Default handlers → one groom (id 10) with one active assignment (groomId 10).
    server.use(
      http.delete(`${base}/api/v1/groom-assignments/:id`, () =>
        HttpResponse.json({ success: false, message: 'delete boom leak' }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderDashboard();

    await screen.findByTestId('groom-grid');

    // The assignment row's Trash2 control (aria-label "Unassign Groom").
    await user.click(await screen.findByRole('button', { name: /unassign groom/i }));
    // Confirm in the dialog (button text is exactly "Unassign").
    await user.click(await screen.findByRole('button', { name: /^unassign$/i }));

    // Visible failure feedback surfaces via the real sonner Toaster …
    expect(await screen.findByText(/could not unassign the groom/i)).toBeInTheDocument();
    // … and the raw server body text is not leaked.
    expect(screen.queryByText(/delete boom leak/i)).not.toBeInTheDocument();
  });
});
