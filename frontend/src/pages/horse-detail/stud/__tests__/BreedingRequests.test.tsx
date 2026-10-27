/**
 * "Breeding requests" on a horse's own Stud/Sale area (Equoria-q4uem.9).
 *
 * Owner rulings q105 (button on the stallion's page, no Marketplace link),
 * q95/q107 (the mare opens read-only; then Accept or Reject), q108 (no note).
 *
 * Real BreedingRequests, real hooks and apiClient; MSW at the HTTP boundary.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import BreedingRequests, { type BreedingRequestsProps } from '../BreedingRequests';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const pending = {
  id: 41,
  status: 'PENDING',
  kind: 'PRIVATE_STUD',
  fee: 500,
  createdAt: new Date().toISOString(),
  resolvedAt: null,
  declineReason: null,
  sire: { id: 5, name: 'Thunder Orchard' },
  dam: { id: 77, name: 'Wren' },
  counterparty: { username: 'Maple Run' },
};

function renderRequests(props: Partial<BreedingRequestsProps> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BreedingRequests side="stallion" horseId={5} horseName="Thunder Orchard" {...props} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('BreedingRequests', () => {
  it("a stallion's requests: the mare opens read-only, and Accept sends the answer", async () => {
    const queries: string[] = [];
    let answered: string | null = null;
    server.use(
      http.get(`${base}/api/v1/studs/requests`, ({ request }) => {
        queries.push(new URL(request.url).search);
        return HttpResponse.json({
          success: true,
          data: {
            requests: [pending],
            pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
          },
        });
      }),
      http.post(`${base}/api/v1/studs/requests/41/approve`, () => {
        answered = 'approve';
        return HttpResponse.json({ success: true, data: { requestId: 41 } });
      })
    );
    const user = userEvent.setup();
    renderRequests();

    expect(screen.queryByRole('link', { name: /marketplace/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Breeding requests' }));

    const mare = await screen.findByRole('link', { name: 'Wren' });
    expect(mare).toHaveAttribute('href', '/horses/77?request=41');
    expect(queries[0]).toContain('role=incoming');
    expect(queries[0]).toContain('sireId=5');
    expect(screen.getByText('Waiting on you')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept Wren (500)' }));
    expect(
      await screen.findByText('Wren is in foal to Thunder Orchard. Maple Run has been told.')
    ).toBeInTheDocument();
    expect(answered).toBe('approve');
  });

  it('Reject sends no note and says the mare owner was told', async () => {
    let rejectBody: unknown = null;
    server.use(
      http.get(`${base}/api/v1/studs/requests`, () =>
        HttpResponse.json({ success: true, data: { requests: [pending] } })
      ),
      http.post(`${base}/api/v1/studs/requests/41/reject`, async ({ request }) => {
        rejectBody = await request.json();
        return HttpResponse.json({ success: true, data: { requestId: 41, status: 'DECLINED' } });
      })
    );
    const user = userEvent.setup();
    renderRequests();

    await user.click(screen.getByRole('button', { name: 'Breeding requests' }));
    await user.click(await screen.findByRole('button', { name: 'Reject' }));

    expect(
      await screen.findByText('You declined Wren. Maple Run has been told.')
    ).toBeInTheDocument();
    expect(rejectBody).toEqual({});
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it("a mare's sent requests: a waiting one can be withdrawn", async () => {
    const queries: string[] = [];
    let cancelled = false;
    server.use(
      http.get(`${base}/api/v1/studs/requests`, ({ request }) => {
        queries.push(new URL(request.url).search);
        return HttpResponse.json({
          success: true,
          data: { requests: [{ ...pending, counterparty: { username: 'Orchard Bend' } }] },
        });
      }),
      http.post(`${base}/api/v1/studs/requests/41/cancel`, () => {
        cancelled = true;
        return HttpResponse.json({ success: true, data: { requestId: 41, status: 'CANCELLED' } });
      })
    );
    const user = userEvent.setup();
    renderRequests({ side: 'mare', horseId: 77, horseName: 'Wren' });

    await user.click(screen.getByRole('button', { name: 'Breeding requests' }));
    const entry = (await screen.findByText('Wren to Thunder Orchard')).closest('li') as HTMLElement;
    expect(within(entry).getByText('Waiting for a reply')).toBeInTheDocument();
    expect(queries[0]).toContain('role=outgoing');
    expect(queries[0]).toContain('damId=77');

    await user.click(within(entry).getByRole('button', { name: 'Withdraw request' }));
    await screen.findByText('Wren to Thunder Orchard');
    expect(cancelled).toBe(true);
  });

  it('no requests yet is said plainly; a failed read offers Try again', async () => {
    let calls = 0;
    server.use(
      http.get(`${base}/api/v1/studs/requests`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ success: false, message: 'nope' }, { status: 500 })
          : HttpResponse.json({ success: true, data: { requests: [] } });
      })
    );
    const user = userEvent.setup();
    renderRequests();

    await user.click(screen.getByRole('button', { name: 'Breeding requests' }));
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText('No mares have asked for Thunder Orchard yet.')
    ).toBeInTheDocument();
  });
});
