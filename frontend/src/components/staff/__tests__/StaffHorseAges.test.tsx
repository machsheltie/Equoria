/**
 * StaffHorseAges: the Owner's two horse-age tools in the Steward's Office
 * (Equoria-a7f1p, owner ruling 2026-11-03 q341).
 *
 * The real staff hooks over the real apiClient; MSW stubs the HTTP boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StaffHorseAges from '../StaffHorseAges';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const ADMIN = `${base}/api/v1/admin`;

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('StaffHorseAges', () => {
  let setAgeBodies: unknown[];
  let ageEveryCalls: number;

  beforeEach(() => {
    setAgeBodies = [];
    ageEveryCalls = 0;
    server.use(
      http.post(`${ADMIN}/horses/42/set-age`, async ({ request }) => {
        setAgeBodies.push(await request.json());
        return HttpResponse.json({
          success: true,
          message: 'fixture',
          data: { horseId: 42, horseName: 'Moonlit Comet', newAge: 6, ageUpdated: true },
        });
      }),
      http.post(`${ADMIN}/horses/age`, () => {
        ageEveryCalls += 1;
        return HttpResponse.json({
          success: true,
          message: 'fixture',
          data: { totalProcessed: 12, birthdaysFound: 1, milestonesTriggered: 0, errors: 0 },
        });
      })
    );
  });

  it('sets one horse’s age and says what it did', async () => {
    const user = userEvent.setup();
    renderWithClient(<StaffHorseAges onCheckinRequired={() => undefined} />);

    const setButton = screen.getByRole('button', { name: 'Set age' });
    expect(setButton).toBeDisabled();

    await user.type(screen.getByLabelText('Horse number'), '42');
    await user.type(screen.getByLabelText('Age in years (0 to 30)'), '6');
    await user.click(setButton);

    expect(await screen.findByText('Moonlit Comet is now 6.')).toBeInTheDocument();
    expect(setAgeBodies).toEqual([{ gameAge: 6 }]);
  });

  it('keeps Set age off for an age above 30', async () => {
    const user = userEvent.setup();
    renderWithClient(<StaffHorseAges onCheckinRequired={() => undefined} />);

    await user.type(screen.getByLabelText('Horse number'), '42');
    await user.type(screen.getByLabelText('Age in years (0 to 30)'), '31');

    expect(screen.getByRole('button', { name: 'Set age' })).toBeDisabled();
  });

  it('ages every horse and reports the count', async () => {
    const user = userEvent.setup();
    renderWithClient(<StaffHorseAges onCheckinRequired={() => undefined} />);

    await user.click(screen.getByRole('button', { name: 'Age every horse now' }));

    expect(await screen.findByText('12 horses checked, 1 birthday.')).toBeInTheDocument();
    expect(ageEveryCalls).toBe(1);
  });

  it('shows the Owner-only refusal in words', async () => {
    server.use(
      http.post(`${ADMIN}/horses/age`, () =>
        HttpResponse.json({ success: false, message: 'Insufficient permissions' }, { status: 403 })
      )
    );
    const user = userEvent.setup();
    renderWithClient(<StaffHorseAges onCheckinRequired={() => undefined} />);

    await user.click(screen.getByRole('button', { name: 'Age every horse now' }));

    expect(await screen.findByText('Only the Owner can age every horse.')).toBeInTheDocument();
  });

  it('says no horse has that number when the server finds none (Equoria-0ro0p)', async () => {
    server.use(
      http.post(`${ADMIN}/horses/9999/set-age`, () =>
        HttpResponse.json({ success: false, message: 'No horse has that number.' }, { status: 404 })
      )
    );
    const user = userEvent.setup();
    renderWithClient(<StaffHorseAges onCheckinRequired={() => undefined} />);

    await user.type(screen.getByLabelText('Horse number'), '9999');
    await user.type(screen.getByLabelText('Age in years (0 to 30)'), '6');
    await user.click(screen.getByRole('button', { name: 'Set age' }));

    expect(await screen.findByText('No horse has that number.')).toBeInTheDocument();
  });

  it('returns to check-in when the trust ran out', async () => {
    server.use(
      http.post(`${ADMIN}/horses/age`, () =>
        HttpResponse.json(
          { success: false, code: 'staffCheckinRequired', message: 'Check in first.' },
          { status: 403 }
        )
      )
    );
    let lapsed = 0;
    const user = userEvent.setup();
    renderWithClient(<StaffHorseAges onCheckinRequired={() => (lapsed += 1)} />);

    await user.click(screen.getByRole('button', { name: 'Age every horse now' }));

    await waitFor(() => expect(lapsed).toBeGreaterThan(0));
  });
});
