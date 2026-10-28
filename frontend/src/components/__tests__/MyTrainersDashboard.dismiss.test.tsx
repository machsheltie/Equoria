/**
 * MyTrainersDashboard — dismissing a trainer (Equoria-oey96.71).
 *
 * The backend DELETE /api/v1/trainers/:id/dismiss, trainersApi.dismissTrainer and
 * useDismissTrainer all existed with no control wired to them, so a player could
 * not retire a trainer. Real dashboard, real hooks, real api-client; only the
 * network boundary is stubbed (MSW), like MyTrainersDashboard.fourstate.test.tsx.
 *
 * Backend behaviour (trainerController.dismissTrainer): a soft retire. The trainer
 * is marked retired and every active assignment is deactivated, and the roster
 * (retired:false) no longer lists them.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import { server } from '@/test/msw/server';
import MyTrainersDashboard from '../MyTrainersDashboard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const userId = 'test-user-1';
const trainersPath = `${base}/api/v1/trainers/user/${userId}`;
const assignmentsPath = `${base}/api/v1/trainers/assignments`;
const dismissPath = `${base}/api/v1/trainers/10/dismiss`;

const trainer = (id: number, firstName: string) => ({
  id,
  firstName,
  lastName: 'Thornton',
  name: `${firstName} Thornton`,
  skillLevel: 'expert',
  personality: 'focused',
  speciality: 'Dressage',
  sessionRate: 150,
  experience: 8,
  starLevel: 'advanced',
  careerWeeks: 12,
  retired: false,
});

function renderDashboard() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <MyTrainersDashboard userId={userId} />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('MyTrainersDashboard — dismiss a trainer (Equoria-oey96.71)', () => {
  it('dismisses through the confirm dialog: DELETE once, and the trainer leaves the roster', async () => {
    const user = userEvent.setup();
    let dismissed = false;
    const deletes: string[] = [];
    server.use(
      http.get(trainersPath, () =>
        HttpResponse.json({
          success: true,
          data: dismissed ? [trainer(11, 'Bram')] : [trainer(10, 'Alice'), trainer(11, 'Bram')],
        })
      ),
      http.get(assignmentsPath, () => HttpResponse.json({ success: true, data: [] })),
      http.delete(dismissPath, ({ request }) => {
        deletes.push(new URL(request.url).pathname);
        dismissed = true;
        return HttpResponse.json({ success: true, data: null });
      })
    );

    renderDashboard();
    const card = await screen.findByTestId('trainer-card-10');
    await user.click(within(card).getByRole('button', { name: /dismiss trainer/i }));
    const dialog = await screen.findByTestId('dismiss-trainer-confirm-10');
    await user.click(within(dialog).getByRole('button', { name: /dismiss trainer/i }));

    await waitFor(() => expect(screen.queryByTestId('trainer-card-10')).not.toBeInTheDocument());
    expect(deletes).toEqual(['/api/v1/trainers/10/dismiss']);
    // The other trainer is untouched.
    expect(screen.getByTestId('trainer-card-11')).toBeInTheDocument();
  });

  it('Cancel sends nothing', async () => {
    const user = userEvent.setup();
    let deletes = 0;
    server.use(
      http.get(trainersPath, () =>
        HttpResponse.json({ success: true, data: [trainer(10, 'Alice')] })
      ),
      http.get(assignmentsPath, () => HttpResponse.json({ success: true, data: [] })),
      http.delete(dismissPath, () => {
        deletes += 1;
        return HttpResponse.json({ success: true, data: null });
      })
    );

    renderDashboard();
    const card = await screen.findByTestId('trainer-card-10');
    await user.click(within(card).getByRole('button', { name: /dismiss trainer/i }));
    await screen.findByTestId('dismiss-trainer-confirm-10');
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(deletes).toBe(0);
    expect(screen.getByTestId('trainer-card-10')).toBeInTheDocument();
  });

  it('a failed dismissal keeps the trainer and says so at the card, without the raw server text', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(trainersPath, () =>
        HttpResponse.json({ success: true, data: [trainer(10, 'Alice'), trainer(11, 'Bram')] })
      ),
      http.get(assignmentsPath, () => HttpResponse.json({ success: true, data: [] })),
      http.delete(dismissPath, () =>
        HttpResponse.json({ success: false, message: 'RAW-SERVER-DETAIL' }, { status: 500 })
      )
    );

    renderDashboard();
    const card = await screen.findByTestId('trainer-card-10');
    await user.click(within(card).getByRole('button', { name: /dismiss trainer/i }));
    const dialog = await screen.findByTestId('dismiss-trainer-confirm-10');
    await user.click(within(dialog).getByRole('button', { name: /dismiss trainer/i }));

    const alert = await within(screen.getByTestId('trainer-card-10')).findByRole('alert');
    expect(alert).toHaveTextContent(/something went wrong on our end/i);
    expect(screen.queryByText(/RAW-SERVER-DETAIL/)).not.toBeInTheDocument();
    expect(screen.getByTestId('trainer-card-10')).toBeInTheDocument();
    // The failure belongs to the card it happened on, not the other trainer's.
    expect(within(screen.getByTestId('trainer-card-11')).queryByRole('alert')).toBeNull();
  });
});
