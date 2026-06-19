/**
 * Email Verification Page — Celestial Night design
 *
 * Migrated to AuthLayout shell (Equoria-o5hub.16):
 * - Background, wordmark h1, glass card, and footer owned by AuthLayout.
 * - Multi-state page: manages its own card headings as children.
 * - Raw rgb() literals replaced with CSS variable tokens.
 * - All behavior (auto-verify on mount, resend, state machine) preserved exactly.
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useVerifyEmail, useResendVerification, useVerificationStatus } from '../hooks/useAuth';
import { useAuth } from '../contexts/AuthContext';
import { AuthLayout } from '@/components/auth/AuthLayout';
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
        onError: (error) => {
          // "already been used" means the email IS verified — map to already-verified
          // rather than error. Handles both legitimate re-visits of old verify links
          // and React StrictMode's double-invocation of effects in development mode.
          if (error?.message?.includes('already been used')) {
            setState('already-verified');
          } else {
            setState('error');
          }
        },
      });
    }
  }, [token, state, isEmailVerified, verifyEmail]);

  const handleResend = () => {
    resetResend();
    resendVerification();
  };

  // ── Already verified ─────────────────────────────────────────────────
  if (state === 'already-verified') {
    return (
      <AuthLayout>
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
            <p className="text-sm text-[var(--text-primary)]">
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
      </AuthLayout>
    );
  }

  // ── Verifying ────────────────────────────────────────────────────────
  if (state === 'verifying' || isVerifying) {
    return (
      <AuthLayout>
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
            <p className="text-sm text-[var(--text-primary)]">
              Please wait while we verify your email…
            </p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <AuthLayout>
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
            <p className="text-sm text-[var(--text-primary)]">
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
      </AuthLayout>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────
  if (state === 'error' || verifyError) {
    return (
      <AuthLayout>
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
            <p className="text-sm text-[var(--text-primary)]">
              {verifyError?.message || 'The verification link is invalid or has expired.'}
            </p>
          </div>

          {isAuthenticated ? (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-[var(--text-muted)]">
                Would you like us to send a new verification email?
              </p>
              <Button
                type="button"
                className="w-full"
                onClick={handleResend}
                disabled={isResending}
              >
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
                <p className="text-[var(--role-danger-text)] text-sm">
                  {resendError.message || 'Failed to send verification email. Try again later.'}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-[var(--text-muted)]">
                Please log in to request a new verification email.
              </p>
              <Button type="button" className="w-full" onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </div>
          )}
        </div>
      </AuthLayout>
    );
  }

  // ── Idle (no token, not verified) ────────────────────────────────────
  return (
    <AuthLayout>
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
            <p className="text-sm text-[var(--text-primary)]">
              Please check your inbox for a verification email. Click the link to verify your
              account.
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
              <p className="text-[var(--role-danger-text)] text-sm">
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
            <p className="text-sm text-[var(--text-primary)]">
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
    </AuthLayout>
  );
};

export default VerifyEmailPage;
