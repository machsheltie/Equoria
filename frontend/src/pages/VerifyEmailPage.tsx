/**
 * Email Verification Page — Celestial Night design
 *
 * Handles email verification tokens from verification emails.
 * Automatically attempts verification on mount if token present.
 * Allows resending verification emails.
 * Matches the auth-page visual style: full-bleed background + glass-panel card.
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useVerifyEmail, useResendVerification, useVerificationStatus } from '../hooks/useAuth';
import { useAuth } from '../contexts/AuthContext';
import { usePageBackground, PageBackground } from '@/components/layout/PageBackground';
import { Button } from '@/components/ui/button';

type VerificationState = 'idle' | 'verifying' | 'success' | 'error' | 'already-verified';

const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const { isAuthenticated, isEmailVerified } = useAuth();
  const { mutate: verifyEmail, isPending: isVerifying, error: verifyError } = useVerifyEmail();
  const {
    mutate: resendVerification,
    isPending: isResending,
    isSuccess: resendSuccess,
    error: resendError,
    reset: resetResend,
  } = useResendVerification();
  const { data: verificationStatus } = useVerificationStatus();

  const [state, setState] = useState<VerificationState>('idle');
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (isEmailVerified || verificationStatus?.verified) {
      setState('already-verified');
      setVerifiedEmail(verificationStatus?.email ?? null);
    }
  }, [isEmailVerified, verificationStatus]);

  useEffect(() => {
    if (token && state === 'idle' && !isEmailVerified) {
      setState('verifying');
      verifyEmail(token, {
        onSuccess: (data) => {
          setState('success');
          setVerifiedEmail(data.user.email);
        },
        onError: () => {
          setState('error');
        },
      });
    }
  }, [token, state, isEmailVerified, verifyEmail]);

  const handleResend = () => {
    resetResend();
    resendVerification();
  };

  const bgStyle = usePageBackground({ scene: 'auth' });
  const pageShell = (children: React.ReactNode) => (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden py-8"
      style={bgStyle}
    >
      <PageBackground scene="auth" />
      <div className="relative z-[var(--z-raised)] w-full max-w-sm px-4 flex flex-col items-center gap-8">
        <div className="text-center select-none">
          <Link
            to="/"
            className="fantasy-title text-5xl tracking-widest hover:opacity-90 transition-opacity"
          >
            Equoria
          </Link>
        </div>
        <div className="glass-panel w-full px-6 py-7">{children}</div>
        <p className="text-xs text-[rgb(100,130,165)] select-none">
          &copy; 2025 Equoria. All rights reserved.
        </p>
      </div>
    </div>
  );

  // ── Already verified ─────────────────────────────────────────────────
  if (state === 'already-verified') {
    return pageShell(
      <div className="text-center space-y-5">
        <div className="flex justify-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center magical-glow"
            style={{
              background: 'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dim) 100%)',
            }}
          >
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>
            Already Verified
          </h2>
          <p className="text-sm text-[rgb(220,235,255)]">
            Your email
            {verifiedEmail && (
              <>
                {' '}
                <strong className="text-white">{verifiedEmail}</strong>
              </>
            )}{' '}
            is already verified.
          </p>
        </div>
        <Button type="button" className="w-full" onClick={() => navigate('/')}>
          Continue to Home
        </Button>
      </div>
    );
  }

  // ── Verifying ────────────────────────────────────────────────────────
  if (state === 'verifying' || isVerifying) {
    return pageShell(
      <div className="text-center space-y-5">
        <div className="flex justify-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dim) 100%)',
            }}
          >
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>
            Verifying Your Email
          </h2>
          <p className="text-sm text-[rgb(220,235,255)]">Please wait while we verify your email…</p>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────
  if (state === 'success') {
    return pageShell(
      <div className="text-center space-y-5">
        <div className="flex justify-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center magical-glow"
            style={{
              background: 'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dim) 100%)',
            }}
          >
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>
            Email Verified!
          </h2>
          <p className="text-sm text-[rgb(220,235,255)]">
            Your email
            {verifiedEmail && (
              <>
                {' '}
                <strong className="text-white">{verifiedEmail}</strong>
              </>
            )}{' '}
            has been successfully verified.
          </p>
          <p className="text-sm" style={{ color: 'var(--celestial-primary)' }}>
            You now have full access to Equoria!
          </p>
        </div>
        <Button type="button" className="w-full" onClick={() => navigate('/')}>
          Enter the Realm
        </Button>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────
  if (state === 'error' || verifyError) {
    return pageShell(
      <div className="text-center space-y-5">
        <div className="flex justify-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'var(--status-error)' }}
          >
            <XCircle className="w-8 h-8 text-white" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>
            Verification Failed
          </h2>
          <p className="text-sm text-[rgb(220,235,255)]">
            {verifyError?.message || 'The verification link is invalid or has expired.'}
          </p>
        </div>

        {isAuthenticated ? (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-[rgb(148,163,184)]">
              Would you like us to send a new verification email?
            </p>
            <Button type="button" className="w-full" onClick={handleResend} disabled={isResending}>
              {isResending ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sending…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Resend Verification Email
                </span>
              )}
            </Button>
            {resendSuccess && (
              <p className="text-sm" style={{ color: 'var(--celestial-primary)' }}>
                A new verification email has been sent. Check your inbox!
              </p>
            )}
            {resendError && (
              <p className="text-red-400 text-sm">
                {resendError.message || 'Failed to send verification email. Try again later.'}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-[rgb(148,163,184)]">
              Please log in to request a new verification email.
            </p>
            <Button type="button" className="w-full" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Idle (no token, not verified) ────────────────────────────────────
  return pageShell(
    <div className="text-center space-y-5">
      <div className="flex justify-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dim) 100%)',
          }}
        >
          <Mail className="w-8 h-8 text-white" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>
          Verify Your Email
        </h2>
      </div>

      {isAuthenticated ? (
        <div className="space-y-3">
          <p className="text-sm text-[rgb(220,235,255)]">
            Please check your inbox for a verification email. Click the link to verify your account.
          </p>
          <Button type="button" className="w-full" onClick={handleResend} disabled={isResending}>
            {isResending ? (
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Sending…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Resend Verification Email
              </span>
            )}
          </Button>
          {resendSuccess && (
            <p className="text-sm" style={{ color: 'var(--celestial-primary)' }}>
              A new verification email has been sent. Check your inbox!
            </p>
          )}
          {resendError && (
            <p className="text-red-400 text-sm">
              {resendError.message || 'Failed to send verification email. Try again later.'}
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => navigate('/')}
          >
            Continue to Home
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-[rgb(220,235,255)]">
            Please log in to verify your email or access your account.
          </p>
          <Button type="button" className="w-full" onClick={() => navigate('/login')}>
            Go to Login
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => navigate('/register')}
          >
            Create Account
          </Button>
        </div>
      )}
    </div>
  );
};

export default VerifyEmailPage;
