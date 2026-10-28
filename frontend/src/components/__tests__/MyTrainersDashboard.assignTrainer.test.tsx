/**
 * MyTrainersDashboard — Assign Trainer button, per-session fee and full trainer
 * details (Equoria-r8a6h, owner ruling 2026-10-23). Real hooks and api-client;
 * only the network boundary is stubbed with MSW.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import { server } from '@/test/msw/server';
import MyTrainersDashboard from '../MyTrainersDashboard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const userId = 'test-user-1';

const trainer = {
  id: 10,
  firstName: 'Alice',
  lastName: 'Thornton',
  name: 'Alice Thornton',
  skillLevel: 'expert',
  // Equoria-nawn5: the card shows the star level (an expert-tier trainer is Expert).
  starLevel: 'expert',
  personality: 'focused',
  speciality: 'Dressage',
  sessionRate: 250,
  experience: 8,
  careerWeeks: 12,
  retired: false,
};

describe('MyTrainersDashboard — assignment and fee (Equoria-r8a6h)', () => {
  it('the card shows the per-session fee, every stat, and an "Assign Trainer" button', async () => {
    server.use(
      http.get(`${base}/api/v1/trainers/user/${userId}`, () =>
        HttpResponse.json({ success: true, data: [trainer] })
      ),
      http.get(`${base}/api/v1/trainers/assignments`, () =>
        HttpResponse.json({ success: true, data: [] })
      )
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <BrowserRouter>
          <MyTrainersDashboard userId={userId} />
        </BrowserRouter>
      </QueryClientProvider>
    );

    const card = await screen.findByTestId('trainer-card-10');
    expect(within(card).getByRole('button', { name: 'Assign Trainer' })).toBeInTheDocument();
    expect(within(card).getByTestId('trainer-session-fee-10')).toHaveTextContent('250');
    // Personality, speciality, star level, career length. Owner ruling 2026-10-28
    // (q229) changed this contract: the old "Lv.N" number is gone; only stars show.
    expect(card).toHaveTextContent(/focused/i);
    expect(card).toHaveTextContent('Dressage');
    expect(card).toHaveTextContent(/expert/i);
    expect(card).not.toHaveTextContent(/Lv\.\s*\d/);
    expect(card).toHaveTextContent('12w');
    // Staff never gain XP and trainer fit is not shown: neither appears.
    expect(card).not.toHaveTextContent(/\bxp\b|experience/i);
    expect(card).not.toHaveTextContent(/compatib|\bfit\b/i);
  });
});
