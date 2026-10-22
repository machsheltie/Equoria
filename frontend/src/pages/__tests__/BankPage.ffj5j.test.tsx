/**
 * BankPage — weekly-reward claim status + balance honesty
 * (Equoria-ffj5j, Equoria-bvddn.39)
 *
 * The claim-status fetch used to be `.catch(() => {})` with the UI defaulting
 * to "claimable", so a failed read presented a live Claim button on a money
 * surface. FRONTEND_ASYNC_STATE_DOCTRINE §1/§4: a failed read is an error with
 * a retry, never a plausible positive state. The balance likewise must not
 * fall back to a believable "0" when the profile has no balance yet.
 *
 * Real BankPage + real hooks + real apiClient; MSW only at the HTTP boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import BankPage from '../BankPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const transactionsPath = `${base}/api/v1/users/transactions`;
const claimStatusPath = `${base}/api/v1/bank/claim-status`;
const userId = 42;

function stubTransactions() {
  server.use(
    http.get(transactionsPath, () =>
      HttpResponse.json({
        success: true,
        data: { transactions: [], total: 0, page: 1, pageSize: 20 },
      })
    )
  );
}

function claimStatus(canClaim: boolean) {
  return HttpResponse.json({
    success: true,
    data: { canClaim, nextClaimDate: canClaim ? null : '2026-10-25T00:00:00Z', rewardAmount: 5000 },
  });
}

describe('BankPage — weekly reward claim status (Equoria-ffj5j)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    stubTransactions();
  });

  const renderPage = (userOverrides: Record<string, unknown> = { money: 15000 }) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: userId, username: 'BankTester', ...userOverrides }}>
          <MemoryRouter initialEntries={['/bank']}>
            <BankPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

  it('does not offer Claim when the claim-status request fails; shows a retryable error', async () => {
    server.use(
      http.get(claimStatusPath, () =>
        HttpResponse.json({ status: 'error', message: 'boom internals' }, { status: 500 })
      )
    );

    renderPage();

    const section = screen.getByTestId('weekly-reward-section');
    const alert = await within(section).findByRole('alert');
    expect(alert.textContent).toBeTruthy();
    expect(within(section).getByText(/couldn.t check your weekly reward/i)).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    // The claim control must not be live on a failed read.
    expect(screen.getByTestId('claim-button')).toBeDisabled();
    // Not the "claimed" lie either.
    expect(within(section).queryByText(/claimed!/i)).not.toBeInTheDocument();
    // Raw server text never reaches the UI (doctrine §4).
    expect(screen.queryByText(/boom internals/i)).not.toBeInTheDocument();
  });

  it('retry re-checks the status and enables Claim when it is available', async () => {
    let calls = 0;
    server.use(
      http.get(claimStatusPath, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ status: 'error', message: 'boom' }, { status: 500 });
        }
        return claimStatus(true);
      })
    );

    const user = userEvent.setup();
    renderPage();

    const section = screen.getByTestId('weekly-reward-section');
    await user.click(await within(section).findByRole('button', { name: /try again/i }));

    await screen.findByText(/claim your 5,000 coin weekly reward/i);
    expect(screen.getByTestId('claim-button')).toBeEnabled();
    expect(within(section).queryByRole('alert')).not.toBeInTheDocument();
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('keeps Claim unavailable while the status is still being checked', async () => {
    server.use(
      http.get(claimStatusPath, async () => {
        await delay(200);
        return claimStatus(true);
      })
    );

    renderPage();

    expect(screen.getByTestId('claim-button')).toBeDisabled();
    await screen.findByText(/claim your 5,000 coin weekly reward/i);
    expect(screen.getByTestId('claim-button')).toBeEnabled();
  });

  it('shows the claimed state when the server says it is already claimed', async () => {
    server.use(http.get(claimStatusPath, () => claimStatus(false)));

    renderPage();

    expect(await screen.findByText(/come back next week/i)).toBeInTheDocument();
    expect(screen.getByTestId('claim-button')).toBeDisabled();
  });

  it('shows the Claim button when the server says it is claimable', async () => {
    server.use(http.get(claimStatusPath, () => claimStatus(true)));

    renderPage();

    expect(await screen.findByText(/claim your 5,000 coin weekly reward/i)).toBeInTheDocument();
    expect(screen.getByTestId('claim-button')).toBeEnabled();
  });
});

describe('BankPage — balance is not fabricated (Equoria-bvddn.39)', () => {
  it('shows an unknown marker, not 0, when the profile carries no balance', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    stubTransactions();
    server.use(http.get(claimStatusPath, () => claimStatus(true)));

    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: userId, money: undefined }}>
          <MemoryRouter initialEntries={['/bank']}>
            <BankPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

    const amount = screen.getByTestId('balance-amount');
    expect(within(amount).getByLabelText(/unknown amount/i)).toBeInTheDocument();
    expect(amount.textContent).not.toMatch(/\b0\b/);
    await screen.findByText(/claim your 5,000 coin weekly reward/i);
  });
});
