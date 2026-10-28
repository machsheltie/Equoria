/**
 * MyTrainersDashboard — the trainer's speciality (Equoria-q4pb8).
 *
 * Owner rulings: players never see a stored code name (2026-10-23), and a trainer's
 * speciality is known only once the trainer is an expert (q100, as on TrainerList and
 * TrainerPage). Real providers and the real API client against MSW handlers.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import { server } from '@/test/msw/server';
import MyTrainersDashboard from '../MyTrainersDashboard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const userId = 'test-user-1';
const trainersPath = `${base}/api/v1/trainers/user/${userId}`;
const assignmentsPath = `${base}/api/v1/trainers/assignments`;

const trainer = (id: number, skillLevel: string, speciality: string) => ({
  id,
  firstName: 'Alice',
  lastName: `Thornton${id}`,
  name: `Alice Thornton${id}`,
  skillLevel,
  personality: 'focused',
  speciality,
  sessionRate: 150,
  experience: 8,
  level: 5,
  careerWeeks: 12,
  retired: false,
});

function renderWith(trainers: unknown[]) {
  server.use(
    http.get(trainersPath, () => HttpResponse.json({ success: true, data: trainers })),
    http.get(assignmentsPath, () => HttpResponse.json({ success: true, data: [] }))
  );
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

describe('MyTrainersDashboard — speciality', () => {
  it("names an expert's stored speciality id with its authored discipline name", async () => {
    renderWith([trainer(10, 'expert', 'showJumping')]);

    const grid = await screen.findByTestId('trainer-grid');
    expect(within(grid).getByText('Show Jumping')).toBeInTheDocument();
    expect(within(grid).queryByText(/showJumping/)).not.toBeInTheDocument();
  });

  it("keeps a novice's speciality unknown", async () => {
    renderWith([trainer(11, 'novice', 'dressage')]);

    const grid = await screen.findByTestId('trainer-grid');
    expect(within(grid).getByText('Not yet known')).toBeInTheDocument();
    expect(within(grid).queryByText(/dressage/i)).not.toBeInTheDocument();
  });
});
