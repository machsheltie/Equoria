/**
 * /confirm-email-change — the new address answers (Finding 9, Equoria-6p398.11).
 *
 * The Finding 5 backend mails a confirmation link built from
 * `EMAIL_CHANGE_URL_BASE` (default `http://localhost:3000/confirm-email-change`),
 * and that route did not exist in the SPA. Every player who started the flow was
 * sent to a dead URL, so the staged change could never be completed through a
 * browser.
 *
 * Network runs through the REAL api-client at the fetch boundary via MSW. The
 * page, the hook and the transport are all real.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/test/msw/server';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import ConfirmEmailChangePage from '../ConfirmEmailChangePage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const CONFIRM_PATH = `${base}/api/v1/auth/email-change/confirm`;

const NEW_ADDRESS = 'new-rider@example.com';

let confirmCalls = 0;
let confirmTokens: (string | null)[] = [];

beforeEach(() => {
  confirmCalls = 0;
  confirmTokens = [];
});

function stubConfirmAccepted(pause = 0) {
  server.use(
    http.get(CONFIRM_PATH, async ({ request }) => {
      confirmCalls += 1;
      confirmTokens.push(new URL(request.url).searchParams.get('token'));
      if (pause) await delay(pause);
      return HttpResponse.json({
        success: true,
        message: 'Your email address has been changed and verified.',
        data: {
          email: NEW_ADDRESS,
          emailVerified: true,
          emailVerifiedAt: '2026-09-07T10:00:00.000Z',
        },
      });
    })
  );
}

function stubConfirmRejected(status: number, message: string) {
  server.use(
    http.get(CONFIRM_PATH, ({ request }) => {
      confirmCalls += 1;
      confirmTokens.push(new URL(request.url).searchParams.get('token'));
      return HttpResponse.json({ success: false, message }, { status });
    })
  );
}

function renderPage(url: string, authenticated = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider
        value={authenticated ? { isAuthenticated: true } : { isAuthenticated: false, user: null }}
      >
        <MemoryRouter initialEntries={[url]}>
          <ConfirmEmailChangePage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('ConfirmEmailChangePage', () => {
  it('spends the link exactly once and names the address that now finds you', async () => {
    stubConfirmAccepted();
    renderPage('/confirm-email-change?token=ec1_abcdef');

    expect(await screen.findByText(NEW_ADDRESS)).toBeInTheDocument();
    // One-time token: a second consumption would answer 400 and tell the player
    // her own successful change had failed.
    await waitFor(() => expect(confirmCalls).toBe(1));
    expect(confirmTokens[0]).toBe('ec1_abcdef');
  });

  it('shows a distinct waiting state before the answer arrives', async () => {
    stubConfirmAccepted(50);
    renderPage('/confirm-email-change?token=ec1_slow');

    // Loading is not success and not empty — no address may be shown yet.
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.queryByText(NEW_ADDRESS)).not.toBeInTheDocument();

    expect(await screen.findByText(NEW_ADDRESS)).toBeInTheDocument();
  });

  it('never spends a request when the link carries no token', async () => {
    stubConfirmAccepted();
    renderPage('/confirm-email-change');

    expect(await screen.findByRole('alert')).toHaveTextContent(/link is incomplete/i);
    expect(confirmCalls).toBe(0);
  });

  it('gives the remedy for an unusable link without echoing the server', async () => {
    stubConfirmRejected(
      400,
      'This email change link is invalid, expired, or has already been used.'
    );
    renderPage('/confirm-email-change?token=ec1_dead');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/lasts 24 hours/i);
    expect(alert).toHaveTextContent(/fresh one from your settings/i);
    // FRONTEND_ASYNC_STATE_DOCTRINE §4 — never the raw server string.
    expect(alert).not.toHaveTextContent(/This email change link is invalid/);
    expect(screen.queryByText(NEW_ADDRESS)).not.toBeInTheDocument();
  });

  it('says plainly when the address now belongs to someone else', async () => {
    stubConfirmRejected(409, 'That email address is already in use');
    renderPage('/confirm-email-change?token=ec1_taken');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/belongs to another stable/i);
  });

  it('sends a signed-out player to sign in, and a signed-in player onward', async () => {
    stubConfirmAccepted();
    const { unmount } = renderPage('/confirm-email-change?token=ec1_one', false);
    await screen.findByText(NEW_ADDRESS);
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
    unmount();

    confirmCalls = 0;
    stubConfirmAccepted();
    renderPage('/confirm-email-change?token=ec1_two', true);
    await screen.findByText(NEW_ADDRESS);
    expect(screen.getByRole('link', { name: /stable/i })).toHaveAttribute('href', '/');
  });
});
