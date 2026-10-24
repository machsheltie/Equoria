/**
 * TrainerList — "Assign Trainer" hires and assigns in one step (Equoria-1poxi,
 * owner ruling q14 2026-10-23). Hiring is free. With a horse in view the button
 * assigns to that horse; with no horse in view it asks which horse first. One
 * request carries the hire and the assignment, so a failure cannot leave a
 * hired-but-unassigned trainer. Real hooks and api-client; only the network is stubbed.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import TrainerList from '../TrainerList';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MARKETPLACE = `${base}/api/v1/trainers/marketplace`;
const HIRE = `${base}/api/v1/trainers/marketplace/hire`;
const HORSES = `${base}/api/v1/horses`;

const marketplace = {
  trainers: [
    {
      marketplaceId: 'mk-1',
      firstName: 'Ada',
      lastName: 'Vane',
      skillLevel: 'expert',
      personality: 'focused',
      speciality: 'Dressage',
      sessionRate: 100,
      bio: 'Patient with nervous horses.',
      availability: true,
    },
  ],
  lastRefresh: '2026-10-01T00:00:00Z',
  nextFreeRefresh: '2026-10-08T00:00:00Z',
  refreshCost: 50,
  canRefreshFree: false,
};

const horses = [
  { id: 7, name: 'Thunder', breed: { id: 1, name: 'Thoroughbred' }, age: 5 },
  { id: 9, name: 'Comet', breed: { id: 1, name: 'Thoroughbred' }, age: 6 },
];

function stubReads() {
  server.use(
    http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace })),
    http.get(HORSES, () => HttpResponse.json({ success: true, data: horses }))
  );
}

function stubHire(onBody: (body: unknown) => void) {
  server.use(
    http.post(HIRE, async ({ request }) => {
      onBody(await request.json());
      return HttpResponse.json(
        { success: true, data: { trainer: { id: 1 }, cost: 0, assignment: { horseId: 7 } } },
        { status: 201 }
      );
    })
  );
}

function renderList(horseId?: number) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <TrainerList userId="user-1" horseId={horseId} />
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('TrainerList — Assign Trainer (Equoria-1poxi)', () => {
  it('the card button reads "Assign Trainer", never a code word or a bare "Hire"', async () => {
    stubReads();
    renderList(7);

    const card = await screen.findByTestId('trainer-card-mk-1');
    const button = within(card).getByTestId('hire-button-mk-1');
    expect(button).toHaveTextContent('Assign Trainer');
    expect(button).not.toHaveTextContent(/^Hire$/);
  });

  it('with a horse in view, one confirm sends the hire and the horse together', async () => {
    stubReads();
    const bodies: unknown[] = [];
    stubHire((b) => bodies.push(b));
    const user = userEvent.setup();
    renderList(7);

    await user.click(await screen.findByTestId('hire-button-mk-1'));
    const dialog = await screen.findByTestId('hire-modal');
    await waitFor(() => expect(dialog).toHaveTextContent(/Thunder/));
    expect(dialog).toHaveTextContent(/hiring is free/i);
    // The horse is already chosen: no picker is shown.
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument();

    await user.click(within(dialog).getByTestId('confirm-hire-button'));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ marketplaceId: 'mk-1', horseId: 7 });
    await waitFor(() => expect(screen.queryByTestId('hire-modal')).not.toBeInTheDocument());
  });

  it('with no horse in view it asks which horse before it will assign', async () => {
    stubReads();
    const bodies: unknown[] = [];
    stubHire((b) => bodies.push(b));
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByTestId('hire-button-mk-1'));
    const dialog = await screen.findByTestId('hire-modal');
    const confirm = within(dialog).getByTestId('confirm-hire-button');
    expect(confirm).toHaveTextContent('Assign Trainer');
    expect(confirm).toBeDisabled();

    const picker = await within(dialog).findByRole('combobox', { name: /which horse/i });
    await waitFor(() =>
      expect(within(picker).getByRole('option', { name: /Comet/ })).toBeInTheDocument()
    );
    await user.selectOptions(picker, '9');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ marketplaceId: 'mk-1', horseId: 9 });
  });

  it('a refused request keeps the dialog open and says so, with no server text', async () => {
    stubReads();
    server.use(
      http.post(HIRE, () =>
        HttpResponse.json({ success: false, message: 'RAW-SERVER-TEXT leak' }, { status: 404 })
      )
    );
    const user = userEvent.setup();
    renderList(7);

    await user.click(await screen.findByTestId('hire-button-mk-1'));
    await user.click(await screen.findByTestId('confirm-hire-button'));

    const alert = await within(await screen.findByTestId('hire-modal')).findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });
});
