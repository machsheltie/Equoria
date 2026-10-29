/**
 * StaffPage (Equoria-rdg0d, owner q69): the hired grooms, riders and trainers,
 * with each groom's and rider's real pay state and the leaving warning. Real providers and
 * the real API client against MSW handlers shaped like the backend responses.
 *
 * Owner rulings 2026-10-28 ("payday is handled by players. They click 'pay groom, pay
 * rider'.") and 2026-10-29 (q268, Equoria-hc96y): each groom and rider row carries a Pay
 * button with the fee on it; one click pays and the row updates in place. Old contract:
 * the game took pay automatically every Monday and the rows only reported paid/unpaid.
 */

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import StaffPage from '../StaffPage';
import { MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const weekEndsAt = '2031-03-09T05:00:00.000Z';

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

interface Line {
  weeklyFee: number;
  owed?: number;
  amountDue?: number;
  paidThisWeek?: boolean;
  canAfford?: boolean;
  feeUnpaid?: boolean;
}

const payLine = ({
  weeklyFee,
  owed = 0,
  amountDue,
  paidThisWeek = false,
  canAfford = true,
  feeUnpaid = false,
}: Line) => ({
  weeklyFee,
  owed,
  amountDue: amountDue ?? weeklyFee + (paidThisWeek ? 0 : owed),
  paidThisWeek,
  canAfford,
  feeUnpaid,
});

const groomPay = (groomId: number, line: Line) => ({ groomId, ...payLine(line) });
const riderPay = (riderId: number, line: Line) => ({ riderId, ...payLine(line) });

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
  groomLines = [] as unknown[],
  riders = [] as unknown[],
  riderLines = [] as unknown[],
  trainers = [] as unknown[],
} = {}) {
  server.use(
    http.get(`${base}/api/v1/grooms/user/:userId`, () =>
      HttpResponse.json({ success: true, grooms })
    ),
    http.get(`${base}/api/v1/groom-salaries/pay-status`, () =>
      HttpResponse.json({ success: true, data: { weekEndsAt, money: 1000, grooms: groomLines } })
    ),
    http.get(`${base}/api/v1/riders/pay-status`, () =>
      HttpResponse.json({ success: true, data: { weekEndsAt, money: 1000, riders: riderLines } })
    ),
    http.get(`${base}/api/v1/riders/user/:userId`, () => HttpResponse.json(riders)),
    http.get(`${base}/api/v1/trainers/user/:userId`, () => HttpResponse.json(trainers))
  );
}

describe('StaffPage', () => {
  it('shows a paid groom as paid, with the fee still on its disabled Pay Groom button', async () => {
    serveStaff({
      grooms: [groom(1, 'Alice Thornton')],
      groomLines: [groomPay(1, { weeklyFee: 300, paidThisWeek: true })],
    });
    renderPage();

    const row = await screen.findByTestId('staff-groom-1');
    expect(within(row).getByText('Alice Thornton')).toBeInTheDocument();
    expect(within(row).getByText(/Paid this week/)).toBeInTheDocument();
    expect(within(row).getByText(/300 coins a week/)).toBeInTheDocument();
    expect(within(row).getByText(/raising foals/)).toBeInTheDocument();
    const button = within(row).getByTestId('pay-groom-1');
    expect(button).toHaveTextContent('Pay Groom · 300 coins');
    expect(button).toBeDisabled();
    expect(screen.queryByTestId('staff-leaving-warning')).not.toBeInTheDocument();
  });

  it('one click on Pay Groom pays and the row updates in place, with no receipt', async () => {
    let posted = 0;
    serveStaff({
      grooms: [groom(1, 'Alice Thornton')],
      groomLines: [groomPay(1, { weeklyFee: 300 })],
    });
    server.use(
      http.post(`${base}/api/v1/groom-salaries/grooms/:groomId/pay`, ({ params }) => {
        posted += 1;
        expect(params.groomId).toBe('1');
        return HttpResponse.json({
          success: true,
          data: {
            weekEndsAt,
            money: 700,
            grooms: [groomPay(1, { weeklyFee: 300, paidThisWeek: true })],
            paid: { groomId: 1, amount: 300 },
          },
        });
      })
    );
    renderPage();

    const button = await screen.findByTestId('pay-groom-1');
    expect(button).toHaveTextContent('Pay Groom · 300 coins');
    expect(button).toBeEnabled();
    await userEvent.click(button);

    const row = screen.getByTestId('staff-groom-1');
    expect(await within(row).findByText(/Paid this week/)).toBeInTheDocument();
    expect(within(row).getByTestId('pay-groom-1')).toBeDisabled();
    expect(posted).toBe(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/balance|receipt/i)).not.toBeInTheDocument();
  });

  it('short of coins: the button stays disabled with the fee shown', async () => {
    serveStaff({
      grooms: [groom(1, 'Alice Thornton')],
      groomLines: [groomPay(1, { weeklyFee: 300, canAfford: false })],
    });
    renderPage();

    const row = await screen.findByTestId('staff-groom-1');
    const button = within(row).getByTestId('pay-groom-1');
    expect(button).toHaveTextContent('Pay Groom · 300 coins');
    expect(button).toBeDisabled();
    expect(within(row).getByText('Not enough coins')).toBeInTheDocument();
  });

  it('a refused press names the reason in words, never the code', async () => {
    serveStaff({
      grooms: [groom(1, 'Alice Thornton')],
      groomLines: [groomPay(1, { weeklyFee: 300 })],
    });
    server.use(
      http.post(`${base}/api/v1/groom-salaries/grooms/:groomId/pay`, () =>
        HttpResponse.json(
          { success: false, code: 'insufficientFunds', message: 'x' },
          { status: 400 }
        )
      )
    );
    renderPage();

    await userEvent.click(await screen.findByTestId('pay-groom-1'));

    const row = screen.getByTestId('staff-groom-1');
    expect(
      await within(row).findByText("Your balance doesn't cover this pay.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/insufficientFunds/)).not.toBeInTheDocument();
  });

  // Old contract (2026-10-27, q133): the warnings named an automatic Monday-morning payday.
  // Owner ruling 2026-10-29 (q268): the week ends Sunday midnight; a groom left unpaid then
  // cannot work until paid, and leaves if this week ends unpaid too.
  it('warns about an unpaid groom: not working until paid, and leaves if this week ends unpaid', async () => {
    serveStaff({
      grooms: [groom(1, 'Alice Thornton'), groom(2, 'Ben Marsh')],
      groomLines: [
        groomPay(1, { weeklyFee: 300, paidThisWeek: true }),
        groomPay(2, { weeklyFee: 100, owed: 100, feeUnpaid: true }),
      ],
    });
    renderPage();

    const warning = await screen.findByTestId('staff-leaving-warning');
    expect(warning).toHaveTextContent('Ben Marsh');
    expect(warning).not.toHaveTextContent('Alice Thornton');
    expect(warning).toHaveTextContent(/cannot work until paid/i);
    expect(warning).toHaveTextContent(/this week ends unpaid too/i);
    expect(warning).not.toHaveTextContent(/Monday|payday/i);

    const unpaidRow = screen.getByTestId('staff-groom-2');
    expect(within(unpaidRow).getByText(/Not paid/)).toBeInTheDocument();
    expect(within(unpaidRow).getByTestId('pay-groom-2')).toHaveTextContent('Pay Groom · 200 coins');
    expect(within(unpaidRow).getByText(/Includes 100 coins owed/)).toBeInTheDocument();
    expect(within(unpaidRow).getByText(/leaves if this week ends unpaid/)).toBeInTheDocument();
  });

  // Old contract (Equoria-rdg0d): riders had no weekly pay. Owner ruling 2026-10-27 (q111):
  // riders are paid weekly like grooms; 2026-10-28/29: by the player's Pay Rider button.
  // Trainers are still paid per training session.
  it('lists riders with Pay Rider and trainers with their per-session charge and no pay claim', async () => {
    serveStaff({
      riders: [rider],
      riderLines: [riderPay(5, { weeklyFee: 200 })],
      trainers: [trainer],
    });
    renderPage();

    const riderRow = await screen.findByTestId('staff-rider-5');
    expect(within(riderRow).getByText('Mara Quill')).toBeInTheDocument();
    expect(within(riderRow).getByText(/200 coins a week/)).toBeInTheDocument();
    expect(within(riderRow).getByTestId('pay-rider-5')).toHaveTextContent('Pay Rider · 200 coins');
    expect(within(riderRow).getByTestId('pay-rider-5')).toBeEnabled();
    expect(screen.queryByTestId('staff-leaving-warning')).not.toBeInTheDocument();

    const trainerRow = await screen.findByTestId('staff-trainer-7');
    expect(within(trainerRow).getByText(/150 coins a session/)).toBeInTheDocument();
    expect(within(trainerRow).queryByText(/paid/i)).not.toBeInTheDocument();
    expect(within(trainerRow).queryByRole('button', { name: /pay/i })).not.toBeInTheDocument();
    // A novice trainer's speciality stays unknown (owner q100).
    expect(within(trainerRow).queryByText(/dressage/i)).not.toBeInTheDocument();
  });

  it('one click on Pay Rider pays the rider and the row updates in place', async () => {
    serveStaff({ riders: [rider], riderLines: [riderPay(5, { weeklyFee: 200 })] });
    server.use(
      http.post(`${base}/api/v1/riders/:riderId/pay`, () =>
        HttpResponse.json({
          success: true,
          data: {
            weekEndsAt,
            money: 800,
            riders: [riderPay(5, { weeklyFee: 200, paidThisWeek: true })],
            paid: { riderId: 5, amount: 200 },
          },
        })
      )
    );
    renderPage();

    await userEvent.click(await screen.findByTestId('pay-rider-5'));

    const row = screen.getByTestId('staff-rider-5');
    expect(await within(row).findByText(/Paid this week/)).toBeInTheDocument();
    expect(within(row).getByTestId('pay-rider-5')).toBeDisabled();
  });

  it('warns about an unpaid rider: not riding until paid, and leaves if this week ends unpaid', async () => {
    serveStaff({
      riders: [
        rider,
        {
          ...rider,
          id: 6,
          name: 'Joss Hale',
          firstName: 'Joss',
          lastName: 'Hale',
          feeUnpaidSince: '2031-03-02T05:00:00.000Z',
        },
      ],
      riderLines: [
        riderPay(5, { weeklyFee: 200, paidThisWeek: true }),
        riderPay(6, { weeklyFee: 200, owed: 200, feeUnpaid: true }),
      ],
    });
    renderPage();

    const warning = await screen.findByTestId('staff-leaving-warning');
    expect(warning).toHaveTextContent('Joss Hale');
    expect(warning).not.toHaveTextContent('Mara Quill');
    expect(warning).toHaveTextContent(/cannot ride until paid/i);
    expect(warning).toHaveTextContent(/this week ends unpaid too/i);
    expect(warning).not.toHaveTextContent(/Monday|payday/i);

    const unpaidRow = screen.getByTestId('staff-rider-6');
    expect(within(unpaidRow).getByText(/Not paid/)).toBeInTheDocument();
    expect(within(unpaidRow).getByTestId('pay-rider-6')).toHaveTextContent('Pay Rider · 400 coins');
    expect(within(unpaidRow).getByText(/Joss leaves if this week ends unpaid/)).toBeInTheDocument();
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
