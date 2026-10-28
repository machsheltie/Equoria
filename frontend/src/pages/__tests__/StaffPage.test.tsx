/**
 * StaffPage (Equoria-rdg0d, owner q69): the hired grooms, riders and trainers,
 * with each groom's and rider's real pay state and the leaving warning. Real providers and
 * the real API client against MSW handlers shaped like the backend responses.
 */

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import StaffPage from '../StaffPage';
import { MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <MemoryRouter>
          <StaffPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

const groom = (id: number, name: string) => ({
  id,
  name,
  skillLevel: 'expert',
  speciality: 'foalCare',
  personality: 'gentle',
  experience: 3,
  sessionRate: 15,
  isActive: true,
});

const breakdownEntry = (groomId: number, weeklyFee: number, feeUnpaid: boolean) => ({
  groomId,
  groomName: 'x',
  skillLevel: 'expert',
  speciality: 'foalCare',
  assignedHorses: 2,
  weeklyFee,
  feeUnpaid,
});

const rider = {
  id: 5,
  name: 'Mara Quill',
  firstName: 'Mara',
  lastName: 'Quill',
  skillLevel: 'rookie',
  weeklyRate: 200,
};

const trainer = {
  id: 7,
  name: 'Tomas Reed',
  firstName: 'Tomas',
  lastName: 'Reed',
  skillLevel: 'novice',
  speciality: 'dressage',
  sessionRate: 150,
};

function serveStaff({
  grooms = [] as unknown[],
  breakdown = [] as unknown[],
  riders = [] as unknown[],
  trainers = [] as unknown[],
} = {}) {
  server.use(
    http.get(`${base}/api/v1/grooms/user/:userId`, () =>
      HttpResponse.json({ success: true, grooms })
    ),
    http.get(`${base}/api/v1/groom-salaries/cost`, () =>
      HttpResponse.json({
        success: true,
        data: {
          totalWeeklyCost: 0,
          groomCount: grooms.length,
          maxHorsesPerGroom: 20,
          breakdown,
        },
      })
    ),
    http.get(`${base}/api/v1/riders/user/:userId`, () => HttpResponse.json(riders)),
    http.get(`${base}/api/v1/trainers/user/:userId`, () => HttpResponse.json(trainers))
  );
}

describe('StaffPage', () => {
  it('shows a paid groom as paid, with the weekly fee and no warning', async () => {
    serveStaff({
      grooms: [groom(1, 'Alice Thornton')],
      breakdown: [breakdownEntry(1, 140, false)],
    });
    renderPage();

    const row = await screen.findByTestId('staff-groom-1');
    expect(within(row).getByText('Alice Thornton')).toBeInTheDocument();
    expect(within(row).getByText(/Paid this week/)).toBeInTheDocument();
    expect(within(row).getByText(/140 coins a week/)).toBeInTheDocument();
    expect(within(row).getByText(/raising foals/)).toBeInTheDocument();
    expect(screen.queryByTestId('staff-leaving-warning')).not.toBeInTheDocument();
  });

  it('warns about an unpaid groom: not working, and leaves if the next payday is missed', async () => {
    serveStaff({
      grooms: [groom(1, 'Alice Thornton'), groom(2, 'Ben Marsh')],
      breakdown: [breakdownEntry(1, 140, false), breakdownEntry(2, 70, true)],
    });
    renderPage();

    const warning = await screen.findByTestId('staff-leaving-warning');
    expect(warning).toHaveTextContent('Ben Marsh');
    expect(warning).not.toHaveTextContent('Alice Thornton');
    expect(warning).toHaveTextContent(/next payday/i);

    const unpaidRow = screen.getByTestId('staff-groom-2');
    expect(within(unpaidRow).getByText(/Not paid/)).toBeInTheDocument();
    expect(within(unpaidRow).getByText(/leaves if the next payday is missed/)).toBeInTheDocument();
    expect(
      within(screen.getByTestId('staff-groom-1')).getByText(/Paid this week/)
    ).toBeInTheDocument();
  });

  // Old contract (Equoria-rdg0d): riders had no weekly pay run, so their row made no pay
  // claim. Owner ruling 2026-10-27 (q111, Equoria-gafyt): riders have a Monday payday like
  // grooms, so a rider row now shows paid or unpaid. Trainers are still paid per training.
  it('lists hired riders as paid and trainers with their per-session charge and no pay claim', async () => {
    serveStaff({ riders: [rider], trainers: [trainer] });
    renderPage();

    const riderRow = await screen.findByTestId('staff-rider-5');
    expect(within(riderRow).getByText('Mara Quill')).toBeInTheDocument();
    expect(within(riderRow).getByText(/200 coins a week/)).toBeInTheDocument();
    expect(within(riderRow).getByText(/Paid this week/)).toBeInTheDocument();
    expect(screen.queryByTestId('staff-leaving-warning')).not.toBeInTheDocument();

    const trainerRow = await screen.findByTestId('staff-trainer-7');
    expect(within(trainerRow).getByText(/150 coins a session/)).toBeInTheDocument();
    expect(within(trainerRow).queryByText(/paid/i)).not.toBeInTheDocument();
    // A novice trainer's speciality stays unknown (owner q100).
    expect(within(trainerRow).queryByText(/dressage/i)).not.toBeInTheDocument();
  });

  it('warns about an unpaid rider: not riding, and leaves if the next payday is missed', async () => {
    serveStaff({
      riders: [
        rider,
        {
          ...rider,
          id: 6,
          name: 'Joss Hale',
          firstName: 'Joss',
          lastName: 'Hale',
          feeUnpaidSince: '2031-03-03T05:00:00.000Z',
        },
      ],
    });
    renderPage();

    const warning = await screen.findByTestId('staff-leaving-warning');
    expect(warning).toHaveTextContent('Joss Hale');
    expect(warning).not.toHaveTextContent('Mara Quill');
    expect(warning).toHaveTextContent(/cannot ride this week/i);
    expect(warning).toHaveTextContent(/next payday/i);

    const unpaidRow = screen.getByTestId('staff-rider-6');
    expect(within(unpaidRow).getByText(/Not paid/)).toBeInTheDocument();
    expect(
      within(unpaidRow).getByText(/Joss leaves if the next payday is missed/)
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('staff-rider-5')).getByText(/Paid this week/)
    ).toBeInTheDocument();
  });

  it('says so when there is no staff at all', async () => {
    serveStaff();
    renderPage();
    expect(await screen.findByText('No grooms yet')).toBeInTheDocument();
    expect(screen.getByText('No riders yet')).toBeInTheDocument();
    expect(screen.getByText('No trainers yet')).toBeInTheDocument();
  });

  it('shows an error with Try Again for a failed roster without blanking the others', async () => {
    serveStaff({ trainers: [trainer] });
    server.use(
      http.get(`${base}/api/v1/riders/user/:userId`, () =>
        HttpResponse.json({ success: false, message: 'boom' }, { status: 500 })
      )
    );
    renderPage();

    expect(await screen.findByTestId('staff-trainer-7')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
  });

  // Equoria-q4pb8: a skill level the label map has not been taught reads as an authored
  // word, never as the stored value with its first letter raised.
  it('never shows a stored skill level raw', async () => {
    serveStaff({ riders: [{ ...rider, skillLevel: 'seasonedPro' }] });
    renderPage();

    const riderRow = await screen.findByTestId('staff-rider-5');
    expect(within(riderRow).getByText('Unrated')).toBeInTheDocument();
    expect(within(riderRow).queryByText(/seasonedPro/i)).not.toBeInTheDocument();
  });
});
