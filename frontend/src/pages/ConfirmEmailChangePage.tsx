/**
 * ConfirmEmailChangePage — the new address answers (Finding 9, Equoria-6p398.11).
 *
 * The Finding 5 backend stages a replacement recovery address and mails a
 * one-time link to it, built from `EMAIL_CHANGE_URL_BASE` (default
 * `http://localhost:3000/confirm-email-change`). That route did not exist, so
 * every player who started the flow was sent to a dead URL.
 *
 * Concept: this is the *other end of the letter*. It is not a settings screen and
 * it is not a form — the player already made her decision; she is opening a
 * letter to see that it arrived. So the page is a single quiet arrival inside the
 * existing `AuthLayout` card (the same lantern-lit panel the other mailed links
 * land in), with one sentence, the address itself, and one way onward.
 *
 * Consumption on arrival mirrors `GET /auth/verify-email` and `VerifyEmailPage`
 * deliberately. Task 5 recorded that a mail scanner can spend a one-time GET link
 * before the player clicks it, and ruled that the fix belongs to `/verify-email`
 * and this route together rather than diverging one of them. Diverging here would
 * make that decision unilaterally; the limitation is carried forward instead.
 *
 * Every failure is mapped by status code through `confirmRecoveryAddressMessage`.
 * The backend deliberately answers every unusable link with one generic 400 so a
 * holder cannot probe other people's pending changes, and the copy respects that:
 * it names the remedy, never the cause.
 */

import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, MailCheck, MailX } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { useConfirmEmailChange } from '@/hooks/useAuth';
import { useAuth } from '@/contexts/AuthContext';
import { confirmRecoveryAddressMessage } from '@/lib/http/authErrorMessages';

const ConfirmEmailChangePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { isAuthenticated } = useAuth();
  // The token IS the request. The hook fetches it exactly once and disables
  // every refetch trigger, because the link is single-use: a second consumption
  // would answer 400 and tell the player her own successful change had failed.
  const { data, isPending, isError, error } = useConfirmEmailChange(token);

  const onward = isAuthenticated ? (
    <Button asChild size="default" className="w-full">
      <Link to="/">Back to the Stable</Link>
    </Button>
  ) : (
    <Button asChild size="default" className="w-full">
      <Link to="/login">Sign In</Link>
    </Button>
  );

  // ── No token in the link ────────────────────────────────────────────────
  if (!token) {
    return (
      <AuthLayout
        title="Something Is Missing"
        subtitle="This confirmation link did not bring its key."
        icon={<Mail className="w-8 h-8 text-role-inverse" aria-hidden="true" />}
      >
        <p role="alert" className="text-sm text-role-primary text-center">
          The link is incomplete. Open the confirmation message again and follow the whole link, or
          ask for a fresh one from your settings.
        </p>
        {onward}
      </AuthLayout>
    );
  }

  // ── Confirming ──────────────────────────────────────────────────────────
  if (isPending) {
    return (
      <AuthLayout
        title="Opening the Letter"
        subtitle="One moment while we check it."
        icon={<Mail className="w-8 h-8 text-role-inverse" aria-hidden="true" />}
      >
        <p role="status" aria-busy="true" className="text-sm text-role-secondary text-center">
          Confirming your new address…
        </p>
      </AuthLayout>
    );
  }

  // ── Refused ─────────────────────────────────────────────────────────────
  if (isError || !data) {
    return (
      <AuthLayout
        title="This Link Is Spent"
        subtitle="Your account has not changed."
        icon={<MailX className="w-8 h-8 text-role-inverse" aria-hidden="true" />}
      >
        <p role="alert" className="text-sm text-role-primary text-center">
          {confirmRecoveryAddressMessage(error) ??
            'This link could not be used. Ask for a fresh one from your settings.'}
        </p>
        {onward}
      </AuthLayout>
    );
  }

  // ── Confirmed ───────────────────────────────────────────────────────────
  return (
    <AuthLayout
      title="Your Way Back In"
      subtitle="Equoria will write to your new address from now on."
      icon={<MailCheck className="w-8 h-8 text-role-inverse" aria-hidden="true" />}
    >
      <div className="text-center space-y-2">
        <p className="text-sm text-role-primary break-words font-medium">{data.email}</p>
        <p className="text-xs text-role-secondary">
          This is the address that finds you if you are ever locked out. Your old address no longer
          works for password recovery.
        </p>
      </div>
      {onward}
    </AuthLayout>
  );
};

export default ConfirmEmailChangePage;
