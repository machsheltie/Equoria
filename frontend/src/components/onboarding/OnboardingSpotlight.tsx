/**
 * OnboardingSpotlight
 *
 * App-level overlay component that guides new players through the 10-step
 * onboarding tour using a pulsing ring spotlight + anchored tooltip card.
 *
 * Architecture: Charlie's data-driven step engine + Alice's visual spotlight
 * + Dana's [data-onboarding-target] attribute bridge.
 *
 * Rules:
 *   - Only active when completedOnboarding === false AND onboardingStep >= 1
 *   - When on the correct route and target element found: renders spotlight ring + tooltip
 *   - When on wrong route or target not found: renders a floating guide card with navigation
 *   - "Next →" advances step; "Skip tutorial" calls complete-onboarding immediately
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdvanceOnboarding, useCompleteOnboarding } from '@/hooks/api/useOnboarding';

/** Step definition for the guided onboarding tour */
interface OnboardingStep {
  step: number;
  message: string;
  route: string;
  highlightTarget: string;
}

/** The 10-step onboarding tour flow */
const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    step: 1,
    message: 'Welcome! Start by claiming your weekly coins from the Bank.',
    route: '/bank',
    highlightTarget: 'bank-claim-button',
  },
  {
    step: 2,
    message: 'Explore the World Hub — this is where all game locations live.',
    route: '/world',
    highlightTarget: 'world-hub-explore',
  },
  {
    step: 3,
    message: "Book a farrier appointment to keep your horse's hooves in top shape.",
    route: '/farrier',
    highlightTarget: 'farrier-book-button',
  },
  {
    step: 4,
    message: 'Visit the Feed Shop to purchase nutrition for your horse.',
    route: '/feed-shop',
    highlightTarget: 'feed-shop-purchase-button',
  },
  {
    step: 5,
    message: 'Schedule a veterinary health check to keep your horse healthy.',
    route: '/vet',
    highlightTarget: 'vet-book-button',
  },
  {
    step: 6,
    message: 'Hire a rider to partner with your horse in competitions.',
    route: '/riders',
    highlightTarget: 'rider-hire-button',
  },
  {
    step: 7,
    message: 'Hire a groom to care for your horse day-to-day.',
    route: '/grooms',
    highlightTarget: 'groom-hire-button',
  },
  {
    step: 8,
    message: "Begin a training session to improve your horse's stats.",
    route: '/training',
    highlightTarget: 'training-start-button',
  },
  {
    step: 9,
    message: 'Enter your first competition and see how your horse performs!',
    route: '/competitions',
    highlightTarget: 'competition-enter-button',
  },
  {
    step: 10,
    message: 'Finally, equip tack to your horse to gain stat bonuses in competition.',
    route: '/inventory',
    highlightTarget: 'inventory-equip-button',
  },
];

/** Location name map for user-friendly navigation labels */
const ROUTE_LABELS: Record<string, string> = {
  '/bank': 'Bank',
  '/world': 'World Hub',
  '/farrier': 'Farrier',
  '/feed-shop': 'Feed Shop',
  '/vet': 'Veterinarian',
  '/riders': 'Riders',
  '/grooms': 'Grooms',
  '/training': 'Training Center',
  '/competitions': 'Competitions',
  '/inventory': 'Inventory',
};

const OnboardingSpotlight: React.FC = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { mutate: advanceStep, isPending: isAdvancing } = useAdvanceOnboarding();
  const { mutate: skipTutorial, isPending: isSkipping } = useCompleteOnboarding();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Only active during the guided tour (step 1–10, completedOnboarding still false)
  const isActive =
    !isLoading &&
    user !== null &&
    user.completedOnboarding === false &&
    typeof user.onboardingStep === 'number' &&
    user.onboardingStep >= 1;

  const stepIndex = isActive ? user!.onboardingStep! - 1 : 0;
  const activeStep = ONBOARDING_STEPS[stepIndex] ?? null;

  // Re-query target element whenever route or active step changes
  useEffect(() => {
    if (!isActive || !activeStep) {
      setTargetRect(null);
      return;
    }

    // Small delay to allow page content to mount after navigation
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-onboarding-target="${activeStep.highlightTarget}"]`);
      setTargetRect(el ? el.getBoundingClientRect() : null);
    }, 150);

    return () => clearTimeout(timer);
  }, [location.pathname, activeStep, isActive]);

  // Keep ring position up-to-date on scroll/resize
  useEffect(() => {
    if (!isActive || !activeStep) return;

    const refresh = () => {
      const el = document.querySelector(`[data-onboarding-target="${activeStep.highlightTarget}"]`);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      }
      setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    };

    window.addEventListener('scroll', refresh, { passive: true });
    window.addEventListener('resize', refresh, { passive: true });
    return () => {
      window.removeEventListener('scroll', refresh);
      window.removeEventListener('resize', refresh);
    };
  }, [isActive, activeStep]);

  if (!isActive || !activeStep) return null;

  // Suppress unused variable warning — windowSize triggers re-render on resize
  void windowSize;

  const isOnCorrectRoute = location.pathname === activeStep.route;
  const isPending = isAdvancing || isSkipping;
  const locationLabel = ROUTE_LABELS[activeStep.route] ?? activeStep.route;

  // ── FLOATING GUIDE CARD (wrong route or target not found) ──────────────────
  if (!isOnCorrectRoute || targetRect === null) {
    return (
      <div
        style={{ zIndex: 80 }}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm
          bg-[var(--celestial-navy-900)] border border-[var(--celestial-primary)]
          rounded-xl px-5 py-4 shadow-2xl"
      >
        <p className="text-xs text-[var(--text-muted)] mb-1 font-medium tracking-wide uppercase">
          Step {activeStep.step} of {ONBOARDING_STEPS.length}
        </p>
        <p className="text-[var(--cream)] text-sm mb-4 leading-relaxed">{activeStep.message}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(activeStep.route)}
            disabled={isPending}
            className="flex-1 px-4 py-2 rounded-lg bg-[var(--celestial-primary)] text-white text-sm
              font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Go to {locationLabel} →
          </button>
          <button
            onClick={() => skipTutorial()}
            disabled={isPending}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--cream)] transition-colors
              disabled:opacity-50"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  // ── SPOTLIGHT RING + TOOLTIP CARD (correct route, element found) ───────────
  const RING_PAD = 6;
  const ringStyle: React.CSSProperties = {
    position: 'fixed',
    top: targetRect.top - RING_PAD,
    left: targetRect.left - RING_PAD,
    width: targetRect.width + RING_PAD * 2,
    height: targetRect.height + RING_PAD * 2,
    borderRadius: 10,
    pointerEvents: 'none',
    animation: 'onboarding-ring-pulse 1.8s ease-in-out infinite',
    zIndex: 79, // just below the tooltip card
  };

  // Position tooltip above or below the target element
  const tooltipBelow = targetRect.top < 160;
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(8, Math.min(targetRect.left, window.innerWidth - 336)),
    ...(tooltipBelow
      ? { top: targetRect.bottom + RING_PAD + 8 }
      : { top: targetRect.top - RING_PAD - 8 - 120 }),
    width: 320,
    zIndex: 80,
  };

  return (
    <>
      {/* Pulsing ring around target element */}
      <div style={ringStyle} aria-hidden="true" />

      {/* Tooltip card */}
      <div
        style={tooltipStyle}
        className="bg-[var(--celestial-navy-900)] border border-[var(--celestial-primary)]
          rounded-xl px-4 py-3 shadow-2xl"
        role="dialog"
        aria-label={`Onboarding step ${activeStep.step} of ${ONBOARDING_STEPS.length}`}
      >
        <p className="text-xs text-[var(--text-muted)] mb-1 font-medium tracking-wide uppercase">
          Step {activeStep.step} / {ONBOARDING_STEPS.length}
        </p>
        <p className="text-[var(--cream)] text-sm mb-3 leading-relaxed">{activeStep.message}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => advanceStep()}
            disabled={isPending}
            className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--celestial-primary)] text-white
              text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending
              ? 'Saving…'
              : activeStep.step === ONBOARDING_STEPS.length
                ? 'Finish!'
                : 'Next →'}
          </button>
          <button
            onClick={() => skipTutorial()}
            disabled={isPending}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--cream)] transition-colors
              disabled:opacity-50"
          >
            Skip tutorial
          </button>
        </div>
      </div>
    </>
  );
};

export default OnboardingSpotlight;
