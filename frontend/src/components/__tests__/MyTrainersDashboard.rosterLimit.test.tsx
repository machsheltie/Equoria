/**
 * MyTrainersDashboard — the trainer limit comes from the server (Equoria-asmsy).
 *
 * Owner report 2026-10-28: the page said "of 4 trainer slots" while the hire path
 * refused a second trainer at stable level 1. Owner rulings q222/q245: "2 for level 1,
 * then +1 per level, up to 10", by the player's level. The page now shows GET /api/v1/trainers/roster-cap, the
 * number the hire path enforces, and never a number of its own.
 *
 * Real hooks and api-client; only the network boundary is stubbed (MSW).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import { server } from '@/test/msw/server';
import MyTrainersDashboard from '../MyTrainersDashboard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const userId = 'test-user-cap';

const oneTrainer = [
  {
    id: 10,
    firstName: 'Alice',
    lastName: 'Thornton',
    name: 'Alice Thornton',
    skillLevel: 'expert',
    starLevel: 'advanced',
    personality: 'focused',
    speciality: 'Dressage',
    sessionRate: 400,
    experience: 0,
    careerWeeks: 12,
    retired: false,
  },
];

function serve(rosterCapResponse: () => Response) {
  server.use(
    http.get(`${base}/api/v1/trainers/user/${userId}`, () =>
      HttpResponse.json({ success: true, data: oneTrainer })
    ),
    http.get(`${base}/api/v1/trainers/assignments`, () =>
      HttpResponse.json({ success: true, data: [] })
    ),
    http.get(`${base}/api/v1/trainers/roster-cap`, rosterCapResponse)
  );
}

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

describe('MyTrainersDashboard — trainer limit (q222)', () => {
  it("shows the server's limit, not a fixed four", async () => {
    serve(() =>
      HttpResponse.json({
        success: true,
        data: { rosterCap: 2, playerLevel: 1, activeTrainers: 1 },
      })
    );
    renderDashboard();

    expect(await screen.findByTestId('trainer-slot-cap')).toHaveTextContent('2');
    expect(screen.getByText(/trainer slots used/i).textContent).toMatch(/1\s+of\s+2\s+trainer/);
  });

  it('follows the player level the server reports', async () => {
    serve(() =>
      HttpResponse.json({
        success: true,
        data: { rosterCap: 10, playerLevel: 9, activeTrainers: 1 },
      })
    );
    renderDashboard();

    expect(await screen.findByTestId('trainer-slot-cap')).toHaveTextContent('10');
  });

  it('shows a dash, never a made-up number, when the limit cannot be read', async () => {
    serve(() => HttpResponse.json({ success: false, message: 'boom' }, { status: 500 }));
    renderDashboard();

    const cap = await screen.findByTestId('trainer-slot-cap');
    expect(cap).toHaveTextContent('—');
    expect(cap).not.toHaveTextContent('4');
  });
});
