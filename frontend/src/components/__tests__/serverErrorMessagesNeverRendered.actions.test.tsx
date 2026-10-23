/**
 * Raw server error text is never rendered on a refused action, second batch
 * (Equoria-mr1kq, FRONTEND_ASYNC_STATE_DOCTRINE §4).
 *
 * Each action below printed the thrown error's `.message` verbatim, and the
 * api-client puts the server body's `message` on that error. A refusal or fault
 * whose body carries internals (here a sentinel) therefore reached the player.
 * The REAL pages, hooks and api-client run; only the network is stubbed (MSW).
 * Every surface shows mapped copy for a 5xx and for a refusal, never the
 * sentinel.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { server } from '@/test/msw/server';
import { Toaster } from '@/components/ui/sonner';
import { userMessageFor } from '@/lib/http/userMessage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import FarrierPage from '@/pages/FarrierPage';
import HorseEquipPage from '@/pages/horses/HorseEquipPage';
import { TransferLeadershipModal } from '@/pages/clubs/TransferLeadershipModal';
import type { ClubMembership } from '@/lib/api-client';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const sentinel = 'internal detail: connection reset by 10.0.0.7:5432, relation "horses"';
const serverFaultCopy = userMessageFor({ statusCode: 500 }).message;

const refuse = (status: number) =>
  HttpResponse.json({ success: false, message: sentinel }, { status });

function renderWith(ui: React.ReactElement, entries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={entries}>
        <Toaster />
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const noSentinel = () =>
  expect(screen.queryByText(/connection reset by 10\.0\.0\.7/)).not.toBeInTheDocument();

describe('ForgotPasswordPage — refused request (Equoria-mr1kq)', () => {
  const submit = async () => {
    const user = userEvent.setup();
    renderWith(<ForgotPasswordPage />);
    await user.type(screen.getByPlaceholderText('your@email.com'), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
  };

  it('shows mapped copy for a server fault', async () => {
    server.use(http.post(`${base}/api/v1/auth/forgot-password`, () => refuse(500)));
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(serverFaultCopy);
    noSentinel();
  });

  it('shows mapped copy for a refusal', async () => {
    server.use(http.post(`${base}/api/v1/auth/forgot-password`, () => refuse(400)));
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "That email address couldn't be used. Check it and try again."
    );
    noSentinel();
  });
});

describe('FarrierPage — failed booking (Equoria-mr1kq)', () => {
  const book = async () => {
    server.use(
      http.get(`${base}/api/v1/farrier/services`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'trim',
              name: 'Hoof Trim',
              description: 'Routine hoof trimming.',
              cost: 150,
              duration: '30 min',
              icon: null,
            },
          ],
        })
      )
    );
    const user = userEvent.setup();
    renderWith(<FarrierPage />);
    await screen.findByTestId('horses-hoof-tab');
    await user.click(await screen.findByTestId('horse-card-1'));
    await user.click(await screen.findByRole('button', { name: /view services/i }));
    const servicesTab = await screen.findByTestId('farrier-services-tab');
    const trimCard = within(servicesTab).getByTestId('farrier-service-trim');
    await user.click(within(trimCard).getByRole('button', { name: /book/i }));
  };

  it('shows mapped copy for a server fault', async () => {
    server.use(http.post(`${base}/api/v1/farrier/book-service`, () => refuse(500)));
    await book();

    expect(await screen.findByRole('alert')).toHaveTextContent(serverFaultCopy);
    noSentinel();
  });

  it('shows mapped copy for a refusal', async () => {
    server.use(http.post(`${base}/api/v1/farrier/book-service`, () => refuse(400)));
    await book();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Booking failed: The farrier couldn't take that booking. Check the horse and your balance."
    );
    noSentinel();
  });
});

describe('TransferLeadershipModal — failed transfer (Equoria-mr1kq)', () => {
  const membership = {
    id: 1,
    role: 'president',
    joinedAt: '2026-01-01T00:00:00Z',
    club: {
      id: 5,
      name: 'Moonriders',
      type: 'discipline',
      category: 'Dressage',
      description: 'Night riders.',
      leader: { id: 'user-leader', username: 'Leader' },
      memberCount: 2,
      createdAt: '2026-01-01T00:00:00Z',
    },
  } as unknown as ClubMembership;

  const transfer = async () => {
    server.use(
      http.get(`${base}/api/v1/clubs/5`, () =>
        HttpResponse.json({
          success: true,
          data: {
            club: {
              ...membership.club,
              members: [
                {
                  id: 1,
                  user: { id: 'user-leader', username: 'Leader' },
                  role: 'president',
                  joinedAt: '2026-01-01T00:00:00Z',
                },
                {
                  id: 2,
                  user: { id: 'user-two', username: 'Second' },
                  role: 'member',
                  joinedAt: '2026-01-02T00:00:00Z',
                },
              ],
            },
          },
        })
      )
    );
    const user = userEvent.setup();
    renderWith(<TransferLeadershipModal membership={membership} onClose={() => undefined} />);
    const select = await screen.findByTestId('transfer-member-select');
    await waitFor(() => expect(within(select).getByText(/Second/)).toBeInTheDocument());
    await user.selectOptions(select, 'user-two');
    await user.click(screen.getByTestId('transfer-confirm-btn'));
  };

  it('shows mapped copy for a server fault', async () => {
    server.use(http.patch(`${base}/api/v1/clubs/5/transfer-leadership`, () => refuse(500)));
    await transfer();

    expect(await screen.findByText(serverFaultCopy)).toBeInTheDocument();
    noSentinel();
  });

  it('shows mapped copy for a refusal', async () => {
    server.use(http.patch(`${base}/api/v1/clubs/5/transfer-leadership`, () => refuse(403)));
    await transfer();

    expect(
      await screen.findByText("Only the club's president can transfer leadership.")
    ).toBeInTheDocument();
    noSentinel();
  });
});

describe('HorseEquipPage — failed equip (Equoria-mr1kq)', () => {
  const equipFeed = async () => {
    server.use(
      http.get(`${base}/api/v1/horses/5/equippable`, () =>
        HttpResponse.json({
          success: true,
          data: {
            tack: [],
            feed: [
              {
                feedType: 'basic',
                name: 'Basic Feed',
                quantity: 4,
                isCurrentlyEquippedToThisHorse: false,
              },
            ],
          },
        })
      ),
      http.get(`${base}/api/v1/feed-shop/catalog`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'basic',
              name: 'Basic Feed',
              description: 'Standard nutrition.',
              packPrice: 100,
              perUnit: 1,
              statRollPct: 5,
              pregnancyBonusPct: 2,
            },
          ],
        })
      )
    );
    const user = userEvent.setup();
    renderWith(
      <Routes>
        <Route path="/horses/:id/equip" element={<HorseEquipPage />} />
      </Routes>,
      ['/horses/5/equip']
    );
    await user.click(await screen.findByTestId('equip-feed-basic'));
  };

  it('shows mapped copy for a server fault', async () => {
    server.use(http.post(`${base}/api/v1/horses/5/equip-feed`, () => refuse(500)));
    await equipFeed();

    expect(await screen.findByText(serverFaultCopy)).toBeInTheDocument();
    noSentinel();
  });

  it('shows mapped copy for a refusal', async () => {
    server.use(http.post(`${base}/api/v1/horses/5/equip-feed`, () => refuse(409)));
    await equipFeed();

    expect(
      await screen.findByText('Your stable changed while that was in flight. Reload and try again.')
    ).toBeInTheDocument();
    noSentinel();
  });
});
