/**
 * Email Verification Page
 *
 * Handles email verification tokens from verification emails.
 * Automatically attempts verification on mount if token present.
 * Allows resending verification emails.
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, XCircle, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import FantasyButton from '../components/FantasyButton';
import { useVerifyEmail, useResendVerification, useVerificationStatus } from '../hooks/useAuth';
import { useAuth } from '../contexts/AuthContext';

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

  // Check if already verified
  useEffect(() => {
    if (isEmailVerified || verificationStatus?.verified) {
      setState('already-verified');
      setVerifiedEmail(verificationStatus?.email ?? null);
    }
  }, [isEmailVerified, verificationStatus]);

  // Auto-verify when token is present
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

  // Handle resend verification
  const handleResend = () => {
    resetResend();
    resendVerification();
  };

  // Render content based on state
  const renderContent = () => {
    // Already verified state
    if (state === 'already-verified') {
      return (
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-forest-green to-emerald-700 rounded-full border-2 border-burnished-gold flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-parchment" />
            </div>
          </div>
          <h2 className="fantasy-header text-2xl text-midnight-ink">Already Verified</h2>
          <p className="fantasy-body text-aged-bronze">
            Your email {verifiedEmail && <strong>{verifiedEmail}</strong>} is already verified.
          </p>
          <div className="pt-4 space-y-3">
            <FantasyButton variant="primary" className="w-full" onClick={() => navigate('/')}>
              Continue to Home
            </FantasyButton>
          </div>
        </div>
      );
    }

    // Verifying state
    if (state === 'verifying' || isVerifying) {
      return (
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-burnished-gold to-aged-bronze rounded-full border-2 border-aged-bronze flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-parchment animate-spin" />
            </div>
          </div>
          <h2 className="fantasy-header text-2xl text-midnight-ink">Verifying Your Email</h2>
          <p className="fantasy-body text-aged-bronze">Please wait while we verify your email...</p>
        </div>
      );
    }

    // Success state
    if (state === 'success') {
      return (
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-forest-green to-emerald-700 rounded-full border-2 border-burnished-gold flex items-center justify-center magical-glow">
              <CheckCircle className="w-10 h-10 text-parchment" />
            </div>
          </div>
          <h2 className="fantasy-header text-2xl text-midnight-ink">Email Verified!</h2>
          <p className="fantasy-body text-aged-bronze">
            Your email {verifiedEmail && <strong>{verifiedEmail}</strong>} has been successfully
            verified.
          </p>
          <p className="fantasy-body text-sm text-forest-green">
            You now have full access to Equoria!
          </p>
          <div className="pt-4 space-y-3">
            <FantasyButton variant="primary" className="w-full" onClick={() => navigate('/')}>
              Enter the Realm
            </FantasyButton>
          </div>
        </div>
      );
    }

    // Error state
    if (state === 'error' || verifyError) {
      return (
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-700 rounded-full border-2 border-red-300 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-parchment" />
            </div>
          </div>
          <h2 className="fantasy-header text-2xl text-midnight-ink">Verification Failed</h2>
          <p className="fantasy-body text-aged-bronze">
            {verifyError?.message || 'The verification link is invalid or has expired.'}
          </p>

          {isAuthenticated ? (
            <div className="pt-4 space-y-3">
              <p className="fantasy-body text-sm text-aged-bronze">
                Would you like us to send a new verification email?
              </p>
              <FantasyButton
                variant="primary"
                className="w-full"
                onClick={handleResend}
                disabled={isResending}
              >
                {isResending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 inline animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2 inline" />
                    Resend Verification Email
                  </>
                )}
              </FantasyButton>

              {resendSuccess && (
                <p className="text-forest-green text-sm">
                  A new verification email has been sent. Check your inbox!
                </p>
              )}

              {resendError && (
                <p className="text-red-600 text-sm">
                  {resendError.message || 'Failed to send verification email. Try again later.'}
                </p>
              )}
            </div>
          ) : (
            <div className="pt-4 space-y-3">
              <p className="fantasy-body text-sm text-aged-bronze">
                Please log in to request a new verification email.
              </p>
              <FantasyButton
                variant="primary"
                className="w-full"
                onClick={() => navigate('/login')}
              >
                Go to Login
              </FantasyButton>
            </div>
          )}
        </div>
      );
    }

    // Idle state (no token, not verified)
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-gradient-to-br from-burnished-gold to-aged-bronze rounded-full border-2 border-aged-bronze flex items-center justify-center">
            <Mail className="w-10 h-10 text-parchment" />
          </div>
        </div>
        <h2 className="fantasy-header text-2xl text-midnight-ink">Verify Your Email</h2>

        {isAuthenticated ? (
          <>
            <p className="fantasy-body text-aged-bronze">
              Please check your inbox for a verification email. Click the link to verify your
              account.
            </p>
            <div className="pt-4 space-y-3">
              <FantasyButton
                variant="primary"
                className="w-full"
                onClick={handleResend}
                disabled={isResending}
              >
                {isResending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 inline animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2 inline" />
                    Resend Verification Email
                  </>
                )}
              </FantasyButton>

              {resendSuccess && (
                <p className="text-forest-green text-sm">
                  A new verification email has been sent. Check your inbox!
                </p>
              )}

              {resendError && (
                <p className="text-red-600 text-sm">
                  {resendError.message || 'Failed to send verification email. Try again later.'}
                </p>
              )}

              <FantasyButton variant="secondary" className="w-full" onClick={() => navigate('/')}>
                Continue to Home
              </FantasyButton>
            </div>
          </>
        ) : (
          <>
            <p className="fantasy-body text-aged-bronze">
              Please log in to verify your email or access your account.
            </p>
            <div className="pt-4 space-y-3">
              <FantasyButton
                variant="primary"
                className="w-full"
                onClick={() => navigate('/login')}
              >
                Go to Login
              </FantasyButton>
              <FantasyButton
                variant="secondary"
                className="w-full"
                onClick={() => navigate('/register')}
              >
                Create Account
              </FantasyButton>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-parchment parchment-texture border-b-2 border-aged-bronze shadow-lg relative">
        <div className="flex items-center justify-center p-4">
          <Link
            to="/"
            className="fantasy-title text-3xl text-midnight-ink hover:text-burnished-gold transition-colors"
          >
            Equoria
          </Link>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-aged-bronze via-burnished-gold to-aged-bronze" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-parchment parchment-texture rounded-lg border-2 border-aged-bronze shadow-xl p-6 space-y-6">
            {/* Decorative header */}
            <div className="flex justify-center">
              <Sparkles className="w-6 h-6 text-burnished-gold" />
            </div>

            {renderContent()}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-parchment border-t border-aged-bronze p-4 text-center">
        <p className="fantasy-body text-xs text-aged-bronze">
          &copy; 2025 Equoria. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default VerifyEmailPage;
