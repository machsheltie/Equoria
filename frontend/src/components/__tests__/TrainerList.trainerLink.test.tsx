/**
 * TrainerList and MyTrainersDashboard — a trainer's name opens that trainer's page
 * (Equoria-r8a6h, owner ruling q82 2026-10-26). A candidate on the marketplace links
 * to its offer page (carrying the horse in view); a hired trainer links to its own
 * page. Real providers, router and hooks; only the network is stubbed.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import TrainerList from '../TrainerList';
import MyTrainersDashboard from '../MyTrainersDashboard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const offer = {
  marketplaceId: 'mk-1',
  firstName: 'Ada',
  lastName: 'Vane',
  skillLevel: 'expert',
  personality: 'focused',
  speciality: 'Dressage',
  sessionRate: 100,
  bio: 'Patient with nervous horses.',
  availability: true,
};

const hired = {
  id: 10,
  firstName: 'Bram',
  lastName: 'Holt',
  name: 'Bram Holt',
  skillLevel: 'developing',
  personality: 'encouraging',
  speciality: 'Show Jumping',
  sessionRate: 175,
  experience: 40,
  level: 4,
  careerWeeks: 12,
  retired: false,
};

function renderWith(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MockAuthProvider>{ui}</MockAuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('trainer names link to the trainer page (Equoria-r8a6h q82)', () => {
  it('a marketplace candidate links to its offer page, keeping the horse in view', async () => {
    server.use(
      http.get(`${base}/api/v1/trainers/marketplace`, () =>
        HttpResponse.json({
          success: true,
          data: {
            trainers: [offer],
            lastRefresh: '2026-10-01T00:00:00Z',
            nextFreeRefresh: '2026-10-08T00:00:00Z',
            refreshCost: 50,
            canRefreshFree: false,
          },
        })
      ),
      http.get(`${base}/api/v1/horses`, () => HttpResponse.json({ success: true, data: [] }))
    );
    renderWith(<TrainerList userId="1" horseId={7} />);

    const link = await screen.findByTestId('trainer-link-mk-1');
    expect(link).toHaveTextContent('Ada Vane');
    expect(link).toHaveAttribute('href', '/trainers/offers/mk-1?horseId=7');
  });

  it('a hired trainer links to its own page', async () => {
    server.use(
      http.get(`${base}/api/v1/trainers/user/1`, () =>
        HttpResponse.json({ success: true, data: [hired] })
      ),
      http.get(`${base}/api/v1/trainers/assignments`, () =>
        HttpResponse.json({ success: true, data: [] })
      )
    );
    renderWith(<MyTrainersDashboard userId="1" />);

    const link = await screen.findByTestId('trainer-link-10');
    expect(link).toHaveTextContent('Bram Holt');
    expect(link).toHaveAttribute('href', '/trainers/10');
  });
});
