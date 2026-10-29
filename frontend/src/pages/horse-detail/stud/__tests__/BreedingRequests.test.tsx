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

  // Equoria-e7tgc.10: the list shows the request's true state after an answer.
  it('Accept that the server turns down: the list refreshes, says it could not go ahead, and keeps the reason', async () => {
    let answered = false;
    server.use(
      http.get(`${base}/api/v1/studs/requests`, () =>
        HttpResponse.json({
          success: true,
          data: {
            requests: [
              answered
                ? {
                    ...pending,
                    status: 'DECLINED',
                    declineReason: 'insufficientFunds',
                    resolvedAt: new Date().toISOString(),
                  }
                : pending,
            ],
          },
        })
      ),
      http.post(`${base}/api/v1/studs/requests/41/approve`, () => {
        answered = true;
        return HttpResponse.json(
          {
            success: false,
            message: "The mare's owner could not pay the 500-coin stud fee.",
          },
          { status: 409 }
        );
      })
    );
    const user = userEvent.setup();
    renderRequests();

    await user.click(screen.getByRole('button', { name: 'Breeding requests' }));
    await user.click(await screen.findByRole('button', { name: 'Accept Wren (500)' }));

    expect(await screen.findByText('Could not go ahead')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't go ahead and was declined/);
    expect(screen.queryByRole('button', { name: /Accept Wren/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    expect(screen.queryByText(/could not pay/)).not.toBeInTheDocument();
  });

  it('Accept that succeeds: the row reads Accepted and the line saying so stays', async () => {
    let answered = false;
    server.use(
      http.get(`${base}/api/v1/studs/requests`, () =>
        HttpResponse.json({
          success: true,
          data: { requests: [answered ? { ...pending, status: 'COMPLETED' } : pending] },
        })
      ),
      http.post(`${base}/api/v1/studs/requests/41/approve`, () => {
        answered = true;
        return HttpResponse.json({ success: true, data: { requestId: 41, status: 'COMPLETED' } });
      })
    );
    const user = userEvent.setup();
    renderRequests();

    await user.click(screen.getByRole('button', { name: 'Breeding requests' }));
    await user.click(await screen.findByRole('button', { name: 'Accept Wren (500)' }));

    expect(await screen.findByText('Accepted')).toBeInTheDocument();
    expect(
      screen.getByText('Wren is in foal to Thunder Orchard. Maple Run has been told.')
    ).toBeInTheDocument();
  });

  it("a mare's requests: an owner's no reads Declined; one the game ended reads Could not go ahead", async () => {
    server.use(
      http.get(`${base}/api/v1/studs/requests`, () =>
        HttpResponse.json({
          success: true,
          data: {
            requests: [
              { ...pending, id: 1, status: 'DECLINED', declineReason: 'rejected' },
              // The old server's spelling during a deploy (phase 6 removes it).
              {
                ...pending,
                id: 4,
                status: 'DECLINED',
                declineReason: 'REJECTED',
                sire: { id: 8, name: 'Old Mill' },
              },
              {
                ...pending,
                id: 2,
                status: 'DECLINED',
                declineReason: 'stallionSold',
                sire: { id: 6, name: 'Copper Gate' },
              },
              {
                ...pending,
                id: 3,
                status: 'CANCELLED',
                declineReason: 'cancelledByOwner',
                sire: { id: 7, name: 'Lark Hollow' },
              },
            ],
          },
        })
      )
    );
    const user = userEvent.setup();
    renderRequests({ side: 'mare', horseId: 77, horseName: 'Wren' });

    await user.click(screen.getByRole('button', { name: 'Breeding requests' }));
    const rejected = (await screen.findByText('Wren to Thunder Orchard')).closest('li');
    const sold = screen.getByText('Wren to Copper Gate').closest('li');
    const withdrawn = screen.getByText('Wren to Lark Hollow').closest('li');
    expect(within(rejected as HTMLElement).getByText('Declined')).toBeInTheDocument();
    expect(within(sold as HTMLElement).getByText('Could not go ahead')).toBeInTheDocument();
    const legacy = screen.getByText('Wren to Old Mill').closest('li');
    expect(within(withdrawn as HTMLElement).getByText('Withdrawn')).toBeInTheDocument();
    expect(within(legacy as HTMLElement).getByText('Declined')).toBeInTheDocument();
    expect(screen.queryByText(/stallionSold|rejected|REJECTED/)).not.toBeInTheDocument();
  });

  it('Withdraw on a request already answered: the list refreshes to its true state', async () => {
    let tried = false;
    server.use(
      http.get(`${base}/api/v1/studs/requests`, () =>
        HttpResponse.json({
          success: true,
          data: {
            requests: [
              tried
                ? { ...pending, status: 'COMPLETED', counterparty: { username: 'Orchard Bend' } }
                : { ...pending, counterparty: { username: 'Orchard Bend' } },
            ],
          },
        })
      ),
      http.post(`${base}/api/v1/studs/requests/41/cancel`, () => {
        tried = true;
        return HttpResponse.json({ success: false, message: 'already' }, { status: 409 });
      })
    );
    const user = userEvent.setup();
    renderRequests({ side: 'mare', horseId: 77, horseName: 'Wren' });

    await user.click(screen.getByRole('button', { name: 'Breeding requests' }));
    await user.click(await screen.findByRole('button', { name: 'Withdraw request' }));

    expect(await screen.findByText('Accepted, in foal')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Withdraw request' })).not.toBeInTheDocument();
  });
});
