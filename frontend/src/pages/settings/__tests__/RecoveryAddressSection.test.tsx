/**
 * Settings → the recovery address (Finding 9, Equoria-6p398.11).
 *
 * Finding 5 closed both ordinary write paths to `User.email`: `PUT /auth/profile`
 * and `PUT /users/:id` now answer 403. Settings still rendered an editable Email
 * input wired to `useUpdateProfile`, so the only visible way to change a
 * recovery address was a control that could no longer work — and the staged
 * request/confirm flow that replaced it had no surface at all.
 *
 * Network is exercised through the REAL api-client at the fetch boundary via
 * MSW (src/test/msw/server.ts), the same boundary LoginPageMfa.test.tsx uses.
 * The api-client, the auth hooks and the section are all real here; nothing
 * Equoria owns is mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { RecoveryAddressSection } from '../RecoveryAddressSection';
import { AccountSection } from '../AccountSection';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STATUS_URL = `${base}/api/v1/auth/email-change/status`;
const REQUEST_URL = `${base}/api/v1/auth/email-change/request`;
const PROFILE_PUT_URL = `${base}/api/v1/auth/profile`;

const CONFIRMED = 'rider@example.com';
const REPLACEMENT = 'new-rider@example.com';
/** How the backend reports a staged address on a later read (never in full). */
const REPLACEMENT_MASKED = 'n***@example.com';
const RESEND_AT = '2026-09-07T12:05:00.000Z';

let requestBodies: Record<string, unknown>[] = [];
let requestCalls = 0;
let statusCalls = 0;
let profilePuts = 0;

beforeEach(() => {
  requestBodies = [];
  requestCalls = 0;
  statusCalls = 0;
  profilePuts = 0;
  // Any PUT to the profile endpoint from this surface is the old defect.
  server.use(
    http.put(PROFILE_PUT_URL, () => {
      profilePuts += 1;
      return HttpResponse.json({ success: false, message: 'forbidden' }, { status: 403 });
    })
  );
});

function stubStatus(
  overrides: Partial<{
    email: string;
    emailVerified: boolean;
    secondFactorRequired: boolean;
    pending: { maskedEmail: string; expiresAt: string; resendAvailableAt: string } | null;
  }> = {}
) {
  server.use(
    http.get(STATUS_URL, () => {
      statusCalls += 1;
      return HttpResponse.json({
        success: true,
        data: {
          email: CONFIRMED,
          emailVerified: true,
          secondFactorRequired: false,
          pending: null,
          ...overrides,
        },
      });
    })
  );
}

/**
 * Reality's sequence: nothing is pending on the first read, and the row exists
 * on every read after the change is staged. `useRequestEmailChange` invalidates
 * the status query on success, so the second read is what the surface sees
 * without any reload.
 */
function stubStatusPendingAfterFirstRead() {
  server.use(
    http.get(STATUS_URL, () => {
      statusCalls += 1;
      return HttpResponse.json({
        success: true,
        data: {
          email: CONFIRMED,
          emailVerified: true,
          secondFactorRequired: false,
          pending:
            statusCalls === 1
              ? null
              : {
                  maskedEmail: REPLACEMENT_MASKED,
                  expiresAt: '2026-09-08T12:00:00.000Z',
                  resendAvailableAt: RESEND_AT,
                },
        },
      });
    })
  );
}

function stubStatusFails() {
  server.use(
    http.get(STATUS_URL, () => {
      statusCalls += 1;
      return HttpResponse.json({ success: false, message: 'boom' }, { status: 500 });
    })
  );
}

function stubRequestAccepted(expiresAt = '2026-09-08T12:00:00.000Z') {
  server.use(
    http.post(REQUEST_URL, async ({ request }) => {
      requestCalls += 1;
      requestBodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({
        success: true,
        message: 'staged',
        data: {
          pendingEmail: REPLACEMENT,
          expiresAt,
          delivered: true,
          noticeDelivered: true,
        },
      });
    })
  );
}

function stubRequestRejected(status: number, message: string, extra: object = {}) {
  server.use(
    http.post(REQUEST_URL, async ({ request }) => {
      requestCalls += 1;
      requestBodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ success: false, message, ...extra }, { status });
    })
  );
}

function renderSection(ui: ReactNode = <RecoveryAddressSection />) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

/** Open the disclosed change form. */
async function openTheForm(user: ReturnType<typeof userEvent.setup>) {
  const opener = await screen.findByRole('button', { name: /different address/i });
  await user.click(opener);
}

describe('RecoveryAddressSection — the way back in', () => {
  it('presents the confirmed address as the standing recovery identity', async () => {
    stubStatus();
    renderSection();

    expect(await screen.findByText(CONFIRMED)).toBeInTheDocument();
    // The promise the flow actually keeps: this address stays live until a
    // replacement is confirmed. Fails the moment the copy stops saying so.
    expect(screen.getByTestId('settings-recovery-address')).toHaveTextContent(
      /stays yours until a new one is confirmed/i
    );
    expect(screen.getByText(/^verified$/i)).toBeInTheDocument();
  });

  it('shows a section error with a working retry instead of a blank section', async () => {
    stubStatusFails();
    const user = userEvent.setup();
    renderSection();

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    // Never the raw server body.
    expect(alert).not.toHaveTextContent(/boom/i);
    // Empty is reachable only after success — no address may be invented here.
    expect(screen.queryByText(CONFIRMED)).not.toBeInTheDocument();

    const callsBefore = statusCalls;
    stubStatus();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText(CONFIRMED)).toBeInTheDocument();
    expect(statusCalls).toBeGreaterThan(callsBefore);
  });

  it('does not ask for a code when the account carries no second factor', async () => {
    stubStatus({ secondFactorRequired: false });
    const user = userEvent.setup();
    renderSection();
    await openTheForm(user);

    expect(screen.getByLabelText(/new email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/six-digit code/i)).not.toBeInTheDocument();
  });

  it('asks for the six-digit code when the account carries a second factor', async () => {
    stubStatus({ secondFactorRequired: true });
    const user = userEvent.setup();
    renderSection();
    await openTheForm(user);

    // Read from the status endpoint, never guessed and never shown to everyone.
    expect(screen.getByLabelText(/six-digit code/i)).toBeInTheDocument();
  });

  it('stages the change through the request endpoint, never through the profile endpoint', async () => {
    stubStatus();
    stubRequestAccepted();
    const user = userEvent.setup();
    renderSection();
    await openTheForm(user);

    await user.type(screen.getByLabelText(/new email address/i), REPLACEMENT);
    await user.type(screen.getByLabelText(/current password/i), 'CorrectHorse1!');
    await user.click(screen.getByRole('button', { name: /send the confirmation/i }));

    await waitFor(() => expect(requestCalls).toBe(1));
    expect(requestBodies[0]).toEqual({ email: REPLACEMENT, password: 'CorrectHorse1!' });
    expect(profilePuts).toBe(0);
  });

  it('sends the code as a string so a leading zero survives', async () => {
    stubStatus({ secondFactorRequired: true });
    stubRequestAccepted();
    const user = userEvent.setup();
    renderSection();
    await openTheForm(user);

    await user.type(screen.getByLabelText(/new email address/i), REPLACEMENT);
    await user.type(screen.getByLabelText(/current password/i), 'CorrectHorse1!');
    await user.type(screen.getByLabelText(/six-digit code/i), '012345');
    await user.click(screen.getByRole('button', { name: /send the confirmation/i }));

    await waitFor(() => expect(requestCalls).toBe(1));
    expect(requestBodies[0].totpToken).toBe('012345');
  });

  it('turns the surface itself into the waiting state, with the old address still live', async () => {
    stubStatus();
    stubRequestAccepted();
    const user = userEvent.setup();
    renderSection();
    await openTheForm(user);

    await user.type(screen.getByLabelText(/new email address/i), REPLACEMENT);
    await user.type(screen.getByLabelText(/current password/i), 'CorrectHorse1!');
    await user.click(screen.getByRole('button', { name: /send the confirmation/i }));

    // Surface-Owned success: the section changes state. No toast layer.
    const waiting = await screen.findByTestId('recovery-address-waiting');
    expect(waiting).toHaveTextContent(REPLACEMENT);
    // The confirmed identity has not moved and the copy must not imply it has.
    expect(screen.getByTestId('settings-recovery-address')).toHaveTextContent(CONFIRMED);
    expect(waiting).toHaveTextContent(/still your way back in/i);
    // The password field is gone once the moment is over.
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();
  });

  it('tells her the resend window right after staging, without waiting for a reload', async () => {
    // The staging response does not carry the cooldown; the invalidated status
    // read does. Before this was wired the sentence only appeared after a full
    // page reload, which is the one moment a player has no reason to perform.
    stubStatusPendingAfterFirstRead();
    stubRequestAccepted();
    const user = userEvent.setup();
    renderSection();
    await openTheForm(user);

    await user.type(screen.getByLabelText(/new email address/i), REPLACEMENT);
    await user.type(screen.getByLabelText(/current password/i), 'CorrectHorse1!');
    await user.click(screen.getByRole('button', { name: /send the confirmation/i }));

    const waiting = await screen.findByTestId('recovery-address-waiting');
    // The locally staged branch still shows the full address she just typed...
    expect(waiting).toHaveTextContent(REPLACEMENT);
    // ...and gains the cooldown as soon as the refetch lands. No reload.
    await waitFor(() => expect(waiting).toHaveTextContent(/need a new link\?/i));
    const expected = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(RESEND_AT));
    expect(waiting).toHaveTextContent(expected);
    expect(waiting).toHaveTextContent(/changing your password cancels this move/i);
  });

  it('reports a refused password inline, keeps what was typed, and claims nothing was sent', async () => {
    stubStatus();
    stubRequestRejected(401, 'Current password is incorrect');
    const user = userEvent.setup();
    renderSection();
    await openTheForm(user);

    await user.type(screen.getByLabelText(/new email address/i), REPLACEMENT);
    await user.type(screen.getByLabelText(/current password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /send the confirmation/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/password wasn't accepted/i);
    // FRONTEND_ASYNC_STATE_DOCTRINE §4 — the raw server string never reaches
    // the player.
    expect(alert).not.toHaveTextContent(/Current password is incorrect/);
    // Submitted state is preserved until success.
    expect(screen.getByLabelText(/new email address/i)).toHaveValue(REPLACEMENT);
    expect(screen.queryByTestId('recovery-address-waiting')).not.toBeInTheDocument();
  });

  it('names the wait when the resend cooldown refuses the request', async () => {
    stubStatus();
    stubRequestRejected(429, 'Please wait 240 seconds before requesting another email change', {
      retryAfter: 240,
    });
    const user = userEvent.setup();
    renderSection();
    await openTheForm(user);

    await user.type(screen.getByLabelText(/new email address/i), REPLACEMENT);
    await user.type(screen.getByLabelText(/current password/i), 'CorrectHorse1!');
    await user.click(screen.getByRole('button', { name: /send the confirmation/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/too many attempts/i);
    expect(alert).not.toHaveTextContent(/240 seconds/);
  });

  it('opens in the waiting state when a change was already staged before this visit', async () => {
    stubStatus({
      pending: {
        maskedEmail: REPLACEMENT_MASKED,
        expiresAt: '2026-09-08T12:00:00.000Z',
        resendAvailableAt: RESEND_AT,
      },
    });
    renderSection();

    const waiting = await screen.findByTestId('recovery-address-waiting');
    // The server read is masked, and the surface must not try to expand it.
    expect(waiting).toHaveTextContent(REPLACEMENT_MASKED);
    expect(waiting).not.toHaveTextContent(REPLACEMENT);
    expect(requestCalls).toBe(0);
  });

  it('warns that a password change cancels the pending move, before it can surprise her', async () => {
    stubStatus({
      pending: {
        maskedEmail: REPLACEMENT_MASKED,
        expiresAt: '2026-09-08T12:00:00.000Z',
        resendAvailableAt: RESEND_AT,
      },
    });
    renderSection();

    // The backend really does revoke pending changes on a password rotation
    // (revokePendingEmailChanges); saying so is the difference between a
    // warning and a surprise.
    const waiting = await screen.findByTestId('recovery-address-waiting');
    expect(waiting).toHaveTextContent(/changing your password cancels this move/i);
  });

  it('states the resend window up front from server truth, not a hardcoded five minutes', async () => {
    stubStatus({
      pending: {
        maskedEmail: REPLACEMENT_MASKED,
        expiresAt: '2026-09-08T12:00:00.000Z',
        resendAvailableAt: RESEND_AT,
      },
    });
    renderSection();

    const waiting = await screen.findByTestId('recovery-address-waiting');
    expect(waiting).toHaveTextContent(/need a new link\?/i);
    // The rendered instant comes from the backend's own cooldown arithmetic.
    const expected = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(RESEND_AT));
    expect(waiting).toHaveTextContent(expected);
  });

  it('clears a field error as soon as the player starts correcting it', async () => {
    stubStatus();
    stubRequestAccepted();
    const user = userEvent.setup();
    renderSection();
    await openTheForm(user);

    // Only the address is wrong, so exactly one field error is in play.
    await user.type(screen.getByLabelText(/current password/i), 'CorrectHorse1!');
    await user.type(screen.getByLabelText(/new email address/i), 'not-an-address');
    await user.click(screen.getByRole('button', { name: /send the confirmation/i }));

    const emailField = screen.getByLabelText(/new email address/i);
    await waitFor(() => expect(emailField).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email address/i);

    // Correcting it clears the error immediately, rather than leaving it up as
    // though the correction were being rejected too.
    await user.type(emailField, '@example.com');
    expect(emailField).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(requestCalls).toBe(0);
  });

  it('keeps the staged waiting state when the form is reopened and cancelled', async () => {
    stubStatus();
    stubRequestAccepted();
    const user = userEvent.setup();
    renderSection();
    await openTheForm(user);

    await user.type(screen.getByLabelText(/new email address/i), REPLACEMENT);
    await user.type(screen.getByLabelText(/current password/i), 'CorrectHorse1!');
    await user.click(screen.getByRole('button', { name: /send the confirmation/i }));
    await screen.findByTestId('recovery-address-waiting');

    // Reopening and backing out must not make the surface forget that a letter
    // is already on its way.
    await user.click(screen.getByRole('button', { name: /different address/i }));
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByTestId('recovery-address-waiting')).toHaveTextContent(REPLACEMENT);
  });

  it('spends exactly one request per submit while one is in flight', async () => {
    stubStatus();
    let resolveRequest: (() => void) | null = null;
    server.use(
      http.post(REQUEST_URL, async ({ request }) => {
        requestCalls += 1;
        requestBodies.push((await request.json()) as Record<string, unknown>);
        await new Promise<void>((resolve) => {
          resolveRequest = resolve;
        });
        return HttpResponse.json({
          success: true,
          data: {
            pendingEmail: REPLACEMENT,
            expiresAt: '2026-09-08T12:00:00.000Z',
            delivered: true,
            noticeDelivered: true,
          },
        });
      })
    );
    const user = userEvent.setup();
    renderSection();
    await openTheForm(user);

    await user.type(screen.getByLabelText(/new email address/i), REPLACEMENT);
    await user.type(screen.getByLabelText(/current password/i), 'CorrectHorse1!');
    const submit = screen.getByRole('button', { name: /send the confirmation/i });
    await user.click(submit);
    await waitFor(() => expect(requestCalls).toBe(1));
    await user.click(submit);
    await user.click(submit);

    expect(requestCalls).toBe(1);
    resolveRequest?.();
    await screen.findByTestId('recovery-address-waiting');
  });

  it('says so honestly when the heads-up to the current address could not be sent', async () => {
    stubStatus();
    server.use(
      http.post(REQUEST_URL, () => {
        requestCalls += 1;
        return HttpResponse.json({
          success: true,
          data: {
            pendingEmail: REPLACEMENT,
            expiresAt: '2026-09-08T12:00:00.000Z',
            delivered: true,
            noticeDelivered: false,
          },
        });
      })
    );
    const user = userEvent.setup();
    renderSection();
    await openTheForm(user);

    await user.type(screen.getByLabelText(/new email address/i), REPLACEMENT);
    await user.type(screen.getByLabelText(/current password/i), 'CorrectHorse1!');
    await user.click(screen.getByRole('button', { name: /send the confirmation/i }));

    const waiting = await screen.findByTestId('recovery-address-waiting');
    expect(waiting).toHaveTextContent(/couldn.t send the heads-up/i);
  });

  it('refuses an address that is not an address before spending a request', async () => {
    stubStatus();
    stubRequestAccepted();
    const user = userEvent.setup();
    renderSection();
    await openTheForm(user);

    await user.type(screen.getByLabelText(/new email address/i), 'not-an-address');
    await user.type(screen.getByLabelText(/current password/i), 'CorrectHorse1!');
    await user.click(screen.getByRole('button', { name: /send the confirmation/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(requestCalls).toBe(0);
  });
});

describe('AccountSection — the email field that could no longer work', () => {
  const accountProps = {
    username: 'moonflower',
    onUsernameChange: vi.fn(),
    onSaveAccount: vi.fn(),
    isSavingAccount: false,
    showPasswordForm: false,
    onShowPasswordForm: vi.fn(),
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    onOldPasswordChange: vi.fn(),
    onNewPasswordChange: vi.fn(),
    onConfirmPasswordChange: vi.fn(),
    onChangePassword: vi.fn(),
    onResetPasswordForm: vi.fn(),
    isChangingPassword: false,
    onOpenDeleteModal: vi.fn(),
  };

  it('no longer offers an editable Email input beside Save Changes', async () => {
    stubStatus();
    renderSection(<AccountSection {...accountProps} />);

    await screen.findByText(CONFIRMED);
    const panel = screen.getByTestId('settings-account');
    // The old control submitted `email` through PUT /auth/profile, which the
    // backend now answers 403 — a field that can never succeed.
    expect(within(panel).queryByRole('textbox', { name: /^email$/i })).not.toBeInTheDocument();
    expect(within(panel).getByTestId('settings-recovery-address')).toBeInTheDocument();
  });

  it('keeps exactly one gold primary on the account panel', async () => {
    stubStatus();
    const user = userEvent.setup();
    renderSection(<AccountSection {...accountProps} />);
    await screen.findByText(CONFIRMED);
    await openTheForm(user);

    // DESIGN.md — The One Gold Action Rule. "Save Changes" owns the panel's
    // gold; the recovery-address submit is a supporting action.
    const golds = screen
      .getAllByRole('button')
      // The gold-primary FILL, not any token mention: PasswordInput's reveal
      // toggle carries a `focus-visible:ring-[var(--gold-primary)]` and is not
      // a gold action.
      .filter((button) => button.className.includes('from-[var(--gold-primary)]'));
    expect(golds).toHaveLength(1);
    expect(golds[0]).toHaveAttribute('data-testid', 'settings-save-account');
  });
});
