/**
 * Class-mapped error copy via userMessageFor (Equoria-du71v)
 *
 * BankPage and PrizeHistoryPage rendered one hardcoded sentence for every
 * failure class (offline, server down, rate-limited, forbidden all read the
 * same), and BankPage's claim failure echoed the raw server message. They now
 * take their copy and retry policy from userMessageFor(error): a rate limit
 * says so, a 403 offers no pointless retry, and raw server text never reaches
 * the UI (doctrine §3/§4).
 *
 * Real pages + real hooks + real apiClient; MSW only at the HTTP boundary.
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import BankPage from '../BankPage';
import PrizeHistoryPage from '../PrizeHistoryPage';
import StableView from '../StableView';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const userId = 42;
const transactionsPath = `${base}/api/v1/users/transactions`;
const claimStatusPath = `${base}/api/v1/bank/claim-status`;
const claimPath = `${base}/api/v1/bank/claim`;
const prizeHistoryPath = `${base}/api/v1/users/${userId}/prize-history`;

const fail = (status: number, message = 'RAW-SERVER-DETAIL') =>
  HttpResponse.json({ status: 'error', message }, { status });

const claimable = () =>
  HttpResponse.json({
    success: true,
    data: { canClaim: true, nextClaimDate: null, rewardAmount: 5000 },
  });

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderBank() {
  return render(
    <QueryClientProvider client={newClient()}>
      <MockAuthProvider userOverrides={{ id: userId, username: 'T', money: 15000 }}>
        <MemoryRouter>
          <BankPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('BankPage error copy (Equoria-du71v)', () => {
  beforeEach(() => {
    server.use(http.get(claimStatusPath, claimable));
  });

  it('says it is rate-limited, retryable, for a 429 on the ledger', async () => {
    server.use(http.get(transactionsPath, () => fail(429)));
    renderBank();

    const section = await screen.findByTestId('transaction-history');
    const alert = await within(section).findByRole('alert');
    expect(alert).toHaveTextContent(/slow down/i);
    expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-DETAIL/)).not.toBeInTheDocument();
  });

  it('offers no retry for a 403 on the ledger (a blind retry repeats the failure)', async () => {
    server.use(http.get(transactionsPath, () => fail(403)));
    renderBank();

    const section = await screen.findByTestId('transaction-history');
    const alert = await within(section).findByRole('alert');
    expect(alert).toHaveTextContent(/don't have access/i);
    expect(within(alert).queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('a failed claim shows class-mapped copy (never the raw server text) and re-reads the status', async () => {
    server.use(
      http.get(transactionsPath, () =>
        HttpResponse.json({
          success: true,
          data: { transactions: [], total: 0, page: 1, pageSize: 20 },
        })
      )
    );
    let statusCalls = 0;
    server.use(
      http.get(claimStatusPath, () => {
        statusCalls += 1;
        return statusCalls === 1
          ? claimable()
          : HttpResponse.json({
              success: true,
              data: { canClaim: false, nextClaimDate: '2026-10-25T00:00:00Z', rewardAmount: 5000 },
            });
      }),
      http.post(claimPath, () => fail(409, 'RAW-SERVER-DETAIL already claimed'))
    );

    const user = userEvent.setup();
    renderBank();

    const button = await screen.findByTestId('claim-button');
    await screen.findByText(/claim your 5,000 coin weekly reward/i);
    await user.click(button);

    const section = screen.getByTestId('weekly-reward-section');
    expect(await within(section).findByRole('alert')).toHaveTextContent(
      /couldn't be completed|check and try again/i
    );
    expect(screen.queryByText(/RAW-SERVER-DETAIL/)).not.toBeInTheDocument();
    // The status was re-read, so the section now tells the truth.
    expect(await within(section).findByText(/come back next week/i)).toBeInTheDocument();
    expect(statusCalls).toBeGreaterThanOrEqual(2);
  });
});

describe('PrizeHistoryPage error copy (Equoria-du71v)', () => {
  const renderPrizes = () =>
    render(
      <QueryClientProvider client={newClient()}>
        <MockAuthProvider userOverrides={{ id: userId, username: 'T' }}>
          <MemoryRouter>
            <PrizeHistoryPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

  it('maps a 500 to server-fault copy with a retry, and never echoes the raw text', async () => {
    server.use(http.get(prizeHistoryPath, () => fail(500)));
    renderPrizes();

    const box = await screen.findByTestId('stats-error');
    expect(box).toHaveTextContent(/went wrong on our end/i);
    expect(within(box).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-DETAIL/)).not.toBeInTheDocument();
  });

  it('offers no retry for a 403', async () => {
    server.use(http.get(prizeHistoryPath, () => fail(403)));
    renderPrizes();

    const box = await screen.findByTestId('stats-error');
    expect(box).toHaveTextContent(/don't have access/i);
    expect(within(box).queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });
});

describe('StableView horses error copy (Equoria-du71v)', () => {
  it('does not render the raw server message', async () => {
    server.use(http.get(`${base}/api/v1/horses`, () => fail(500)));
    render(
      <QueryClientProvider client={newClient()}>
        <MemoryRouter>
          <StableView />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/went wrong on our end/i)).toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-DETAIL/)).not.toBeInTheDocument();
  });
});
