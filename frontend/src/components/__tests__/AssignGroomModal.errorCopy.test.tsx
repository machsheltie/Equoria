/**
 * AssignGroomModal — a refused assignment shows safe copy, never the server's
 * words (Equoria-eivq9; FRONTEND_ASYNC_STATE_DOCTRINE §3/§4).
 *
 * Boundary-level: the REAL useAssignGroom hook through the REAL api-client; only
 * the network is stubbed (MSW). The modal used to print `err.message` verbatim,
 * so whatever a 5xx body carried reached the player.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import AssignGroomModal from '../AssignGroomModal';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const ASSIGN = `${base}/api/v1/groom-assignments`;

const grooms = [
  {
    id: 1,
    name: 'Sarah Johnson',
    skillLevel: 'expert',
    specialty: 'foalCare',
    personality: 'gentle',
    experience: 8,
    sessionRate: 100,
    isActive: true,
    availableSlots: 2,
    currentAssignments: 2,
    maxAssignments: 4,
  },
];

async function submitAssignment() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={qc}>
      <AssignGroomModal
        isOpen
        onClose={() => {}}
        horseId={1}
        horseName="Thunder"
        userId={1}
        availableGrooms={grooms}
      />
    </QueryClientProvider>
  );
  await user.click(screen.getByRole('radio', { name: /sarah johnson/i }));
  await user.click(screen.getByRole('button', { name: /^assign groom$/i }));
  return within(screen.getByTestId('assign-groom-modal'));
}

describe('AssignGroomModal — failure copy (Equoria-eivq9)', () => {
  it('a server fault shows the shared class copy, not the server message', async () => {
    server.use(
      http.post(ASSIGN, () =>
        HttpResponse.json(
          { success: false, message: 'RAW-SERVER-TEXT prisma P2002 leak' },
          { status: 500 }
        )
      )
    );

    const modal = await submitAssignment();

    expect(await modal.findByRole('alert')).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('a refused request (4xx) shows the shared class copy, not the server message', async () => {
    server.use(
      http.post(ASSIGN, () =>
        HttpResponse.json({ success: false, message: 'RAW-SERVER-TEXT slots' }, { status: 400 })
      )
    );

    const modal = await submitAssignment();

    expect(await modal.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });
});
