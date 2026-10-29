/**
 * TrainerPage — each trainer has its own page (Equoria-r8a6h, owner ruling q82
 * 2026-10-26). It shows the trainer's skill level, personality, speciality and
 * per-session fee, "Coming soon" for trainer fit, no XP, and the "Assign Trainer"
 * action: one-step hire and assign for a candidate on offer, plain assignment for
 * a trainer already hired. Real providers, router and hooks; only the network is stubbed.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import TrainerPage from '../TrainerPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MARKETPLACE = `${base}/api/v1/trainers/marketplace`;
const HIRE = `${base}/api/v1/trainers/marketplace/hire`;
const ASSIGN = `${base}/api/v1/trainers/assignments`;
const HIRED = `${base}/api/v1/trainers/user/1`;
const HORSES = `${base}/api/v1/horses`;

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

const hiredTrainer = {
  id: 10,
  firstName: 'Bram',
  lastName: 'Holt',
  name: 'Bram Holt',
  skillLevel: 'developing',
  personality: 'encouraging',
  speciality: 'Show Jumping',
  sessionRate: 175,
  experience: 40,
  starLevel: 'novice',
  careerWeeks: 12,
  retired: false,
  bio: 'Builds confidence.',
};

const horses = [
  { id: 7, name: 'Thunder', breed: { id: 1, name: 'Thoroughbred' }, age: 5 },
  { id: 9, name: 'Comet', breed: { id: 1, name: 'Thoroughbred' }, age: 6 },
];

function stubReads() {
  server.use(
    http.get(MARKETPLACE, () =>
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
    http.get(HIRED, () => HttpResponse.json({ success: true, data: [hiredTrainer] })),
    http.get(HORSES, () => HttpResponse.json({ success: true, data: horses }))
  );
}

function renderAt(url: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/trainers/:trainerId" element={<TrainerPage />} />
            <Route path="/trainers/offers/:marketplaceId" element={<TrainerPage />} />
          </Routes>
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('TrainerPage — a trainer on offer (Equoria-r8a6h q82)', () => {
  it('shows the trainer, personality, speciality, fee and "Coming soon" for fit, with no XP', async () => {
    stubReads();
    renderAt('/trainers/offers/mk-1');

    expect(await screen.findByRole('heading', { level: 1, name: 'Ada Vane' })).toBeInTheDocument();
    const page = screen.getByTestId('trainer-page');
    expect(page).toHaveTextContent('Focused');
    expect(screen.getByTestId('trainer-speciality')).toHaveTextContent(/dressage/i);
    expect(screen.getByTestId('trainer-fee')).toHaveTextContent(/100/);
    expect(screen.getByTestId('trainer-fit')).toHaveTextContent('Coming soon');
    expect(page).not.toHaveTextContent(/\bxp\b|experience/i);
    expect(screen.getByTestId('assign-trainer-button')).toHaveTextContent('Assign Trainer');
  });

  it('Assign Trainer with a horse in view hires and assigns in one request, then confirms', async () => {
    stubReads();
    const bodies: unknown[] = [];
    server.use(
      http.post(HIRE, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(
          { success: true, data: { trainer: { id: 1 }, cost: 0, assignment: { horseId: 7 } } },
          { status: 201 }
        );
      })
    );
    const user = userEvent.setup();
    renderAt('/trainers/offers/mk-1?horseId=7');

    await user.click(await screen.findByTestId('assign-trainer-button'));
    const dialog = await screen.findByTestId('assign-trainer-dialog');
    await waitFor(() => expect(dialog).toHaveTextContent(/Thunder/));
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument();
    await user.click(within(dialog).getByTestId('confirm-assign-button'));

    await waitFor(() => expect(bodies).toEqual([{ marketplaceId: 'mk-1', horseId: 7 }]));
    expect(await screen.findByTestId('trainer-assigned')).toHaveTextContent(/Ada Vane now trains/);
  });

  it('with no horse in view it asks which horse before it will assign', async () => {
    stubReads();
    const user = userEvent.setup();
    renderAt('/trainers/offers/mk-1');

    await user.click(await screen.findByTestId('assign-trainer-button'));
    const dialog = await screen.findByTestId('assign-trainer-dialog');
    const confirm = within(dialog).getByTestId('confirm-assign-button');
    expect(confirm).toBeDisabled();
    const picker = await within(dialog).findByRole('combobox', { name: /which horse/i });
    await waitFor(() =>
      expect(within(picker).getByRole('option', { name: /Comet/ })).toBeInTheDocument()
    );
    await user.selectOptions(picker, '9');
    expect(confirm).toBeEnabled();
  });

  it('says so when the trainer is no longer on offer', async () => {
    stubReads();
    renderAt('/trainers/offers/gone');

    expect(await screen.findByText('Trainer Not Found')).toBeInTheDocument();
    expect(screen.queryByTestId('assign-trainer-button')).not.toBeInTheDocument();
  });
});

describe('TrainerPage — a hired trainer (Equoria-r8a6h q82)', () => {
  it('shows the hired trainer and assigns it to the chosen horse', async () => {
    stubReads();
    const bodies: unknown[] = [];
    server.use(
      http.post(ASSIGN, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ success: true, data: {} }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    renderAt('/trainers/10?horseId=9');

    expect(await screen.findByRole('heading', { level: 1, name: 'Bram Holt' })).toBeInTheDocument();
    expect(screen.getByTestId('trainer-fee')).toHaveTextContent(/175/);
    expect(screen.getByTestId('trainer-fit')).toHaveTextContent('Coming soon');

    await user.click(screen.getByTestId('assign-trainer-button'));
    const dialog = await screen.findByTestId('assign-trainer-dialog');
    await user.click(within(dialog).getByTestId('confirm-assign-button'));

    await waitFor(() => expect(bodies).toEqual([{ trainerId: 10, horseId: 9 }]));
    expect(await screen.findByTestId('trainer-assigned')).toBeInTheDocument();
  });
});

describe('TrainerPage — star level only (owner ruling q229, Equoria-wmjc0)', () => {
  it.each([
    ['/trainers/offers/mk-1', 'Ada Vane'],
    ['/trainers/10', 'Bram Holt'],
  ])('%s describes no old novice/developing/expert skill step', async (url, name) => {
    stubReads();
    renderAt(url);

    expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument();
    const page = screen.getByTestId('trainer-page');
    expect(page).not.toHaveTextContent(/specialties are not yet known|some specialties are known/i);
    expect(page).not.toHaveTextContent(/every specialty is known/i);
    expect(page).not.toHaveTextContent(/\bdeveloping\b/i);
    expect(screen.getByTestId('trainer-fee-note')).toHaveTextContent(
      'The fee is paid once each time this trainer trains one of your horses'
    );
  });
});
