/**
 * A retired horse refused for staff says why (Equoria-70gu6).
 *
 * The staff assign endpoints refuse a retired horse (21 and over, not in foal)
 * with 400 { code: 'horseRetired' }. userMessageFor's 4xx copy ("Please check the
 * highlighted fields") is no answer to that refusal, so each assign surface names
 * the code. Real components, hooks and api-client; only the network is stubbed
 * (MSW), like the other staff-assign failure tests.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import { server } from '@/test/msw/server';
import { Toaster } from '@/components/ui/sonner';
import MyRidersDashboard from '../MyRidersDashboard';
import MyTrainersDashboard from '../MyTrainersDashboard';
import AssignGroomModal from '../AssignGroomModal';
import RiderPickerModal from '@/pages/horse-detail/RiderPickerModal';
import type { Rider } from '@/hooks/api/useRiders';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const RETIRED = /retired horses \(21 and over\) cannot be given a new groom, rider or trainer/i;
const retiredRefusal = () =>
  HttpResponse.json(
    { success: false, message: 'RAW-SERVER-TEXT', code: 'horseRetired' },
    { status: 400 }
  );

const rider = {
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
};

const trainer = {
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
};

const groom = {
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
};

const queryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

describe('a retired horse refused for staff (Equoria-70gu6)', () => {
  it('the rider dashboard names the refusal', async () => {
    server.use(
      http.get(`${base}/api/v1/riders/user/:userId`, () => HttpResponse.json([rider])),
      http.get(`${base}/api/v1/riders/assignments`, () => HttpResponse.json([])),
      http.post(`${base}/api/v1/riders/assignments`, retiredRefusal)
    );
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient()}>
        <BrowserRouter>
          <Toaster />
          <MyRidersDashboard userId="user-70gu6" onBrowseMarketplace={() => {}} />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await user.click(await screen.findByTestId('assign-button-501'));
    await user.click(await screen.findByRole('button', { name: /storm runner/i }));

    expect(await screen.findByText(RETIRED)).toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('the trainer dashboard names the refusal', async () => {
    server.use(
      http.get(`${base}/api/v1/trainers/user/user-70gu6`, () =>
        HttpResponse.json({ success: true, data: [trainer] })
      ),
      http.get(`${base}/api/v1/trainers/assignments`, () =>
        HttpResponse.json({ success: true, data: [] })
      ),
      http.get(`${base}/api/v1/horses`, () =>
        HttpResponse.json({
          success: true,
          data: [{ id: 1, name: 'Test Horse', breed: 'Thoroughbred', age: 5 }],
        })
      ),
      http.post(`${base}/api/v1/trainers/assignments`, retiredRefusal)
    );
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient()}>
        <BrowserRouter>
          <Toaster />
          <MyTrainersDashboard userId="user-70gu6" />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await user.click(await screen.findByTestId('assign-button-10'));
    await user.click(await screen.findByRole('button', { name: /test horse/i }));

    expect(await screen.findByText(RETIRED)).toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('the groom assignment dialog names the refusal', async () => {
    server.use(http.post(`${base}/api/v1/groom-assignments`, retiredRefusal));
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient()}>
        <AssignGroomModal
          isOpen
          onClose={() => {}}
          horseId={1}
          horseName="Thunder"
          userId={1}
          availableGrooms={[groom]}
        />
      </QueryClientProvider>
    );
    await user.click(screen.getByRole('radio', { name: /sarah johnson/i }));
    await user.click(screen.getByRole('button', { name: /^assign groom$/i }));

    const modal = within(screen.getByTestId('assign-groom-modal'));
    expect(await modal.findByRole('alert')).toHaveTextContent(RETIRED);
  });

  it('the horse page rider picker names the refusal', async () => {
    server.use(http.post(`${base}/api/v1/riders/assignments`, retiredRefusal));
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient()}>
        <BrowserRouter>
          <Toaster />
          <RiderPickerModal
            isOpen
            onClose={() => {}}
            horseId={1}
            horseName="Thunder"
            riders={[rider as unknown as Rider]}
            isLoading={false}
          />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await user.click(screen.getByText('Ada Vane'));

    expect(await screen.findByText(RETIRED)).toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });
});
