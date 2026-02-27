/**
 * OnboardingPage — New Player Onboarding Wizard (Epic 16 — Story 16-2)
 *
 * 3-step intro wizard shown to new players on first login.
 * On completion, calls POST /api/auth/advance-onboarding (step 0 → 1)
 * and redirects to /bank where the 10-step OnboardingSpotlight tour begins.
 *
 * Steps:
 *   1. Welcome — explain Equoria
 *   2. Starter kit — confirm starting resources (1 000 gold, stable slot)
 *   3. Ready — summary + CTA to start guided tour
 *
 * Uses Celestial Night theme.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight, Star, Package, Sparkles, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api-client';
import { StarField } from '@/components/layout/StarField';

// ── Step definitions ──────────────────────────────────────────────────────────

interface Step {
  id: number;
  title: string;
  subtitle: string;
}

const STEPS: Step[] = [
  { id: 1, title: 'Welcome to Equoria', subtitle: 'Your horse breeding adventure begins' },
  { id: 2, title: 'Your Starter Kit', subtitle: 'Everything you need to get started' },
  { id: 3, title: "You're Ready!", subtitle: 'Time to build your legacy' },
];

// ── Step content components ───────────────────────────────────────────────────

const WelcomeStep: React.FC = () => (
  <div className="text-center space-y-6">
    <div className="text-6xl">🐎</div>
    <div>
      <h2 className="text-xl font-bold text-white/90 mb-2">
        Welcome to the world of horse breeding
      </h2>
      <p className="text-white/60 text-sm leading-relaxed max-w-sm mx-auto">
        In Equoria you breed, train, and compete horses across disciplines — from Dressage to
        Cross-Country. Every horse is unique, with traits and genetics that shape its destiny.
      </p>
    </div>
    <div className="grid grid-cols-3 gap-3 text-center">
      {[
        { icon: '🧬', label: 'Breed horses with unique genetics' },
        { icon: '🏆', label: 'Compete in shows and earn prizes' },
        { icon: '⭐', label: 'Level up your stable and riders' },
      ].map(({ icon, label }) => (
        <div key={label} className="p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="text-2xl mb-1">{icon}</div>
          <p className="text-xs text-white/50 leading-tight">{label}</p>
        </div>
      ))}
    </div>
  </div>
);

const StarterKitStep: React.FC = () => (
  <div className="space-y-4">
    <p className="text-white/60 text-sm text-center mb-2">
      You&apos;ve been given everything you need to start your equestrian journey.
    </p>
    <ul className="space-y-3">
      {[
        {
          icon: '💰',
          title: '1,000 Gold',
          desc: 'Starting funds for your first horses and equipment',
        },
        {
          icon: '🏠',
          title: 'Stable Slot',
          desc: 'Your first stable space — ready for a horse',
        },
        {
          icon: '🗓️',
          title: 'Free Training Session',
          desc: 'Train your first horse in any discipline at no cost',
        },
        {
          icon: '🎒',
          title: 'Basic Tack Set',
          desc: 'A standard saddle and bridle ready for use',
        },
      ].map(({ icon, title, desc }) => (
        <li
          key={title}
          className="flex items-center gap-4 p-3 rounded-lg bg-white/5 border border-white/10"
        >
          <span className="text-2xl flex-shrink-0">{icon}</span>
          <div>
            <p className="text-sm font-semibold text-white/90">{title}</p>
            <p className="text-xs text-white/50 mt-0.5">{desc}</p>
          </div>
        </li>
      ))}
    </ul>
  </div>
);

const ReadyStep: React.FC = () => (
  <div className="text-center space-y-6">
    <div className="relative inline-flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-xl" />
      <Star className="w-16 h-16 text-violet-400 relative" />
    </div>
    <div>
      <h2 className="text-xl font-bold text-white/90 mb-2">Your stable awaits</h2>
      <p className="text-white/60 text-sm leading-relaxed max-w-sm mx-auto">
        Head to the Stable to acquire your first horse, then visit the Tack Shop to equip it. When
        you&apos;re ready, enter a competition and start building your legacy.
      </p>
    </div>
    <div className="flex flex-col gap-2 text-sm text-white/50">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-400 flex-shrink-0" />
        <span>
          Visit <strong className="text-white/70">/stable</strong> → Buy your first horse
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-violet-400 flex-shrink-0" />
        <span>
          Visit <strong className="text-white/70">/tack-shop</strong> → Equip saddle &amp; bridle
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-violet-400 flex-shrink-0">🏆</span>
        <span>
          Visit <strong className="text-white/70">/competitions</strong> → Enter your first show
        </span>
      </div>
    </div>
  </div>
);

const stepComponents = [WelcomeStep, StarterKitStep, ReadyStep];

// ── OnboardingPage ─────────────────────────────────────────────────────────────

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0); // 0-indexed

  const completeMutation = useMutation({
    // Advance step 0 → 1; OnboardingSpotlight picks up the tour from /bank
    mutationFn: () => authApi.advanceOnboarding(),
    onSuccess: () => {
      // Refresh profile so OnboardingSpotlight reads onboardingStep: 1
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Welcome to Equoria! Starting your guided tour…');
      navigate('/bank', { replace: true });
    },
    onError: () => {
      // On error, navigate to bank anyway — spotlight re-syncs from profile
      toast.info('Starting your adventure…');
      navigate('/bank', { replace: true });
    },
  });

  const totalSteps = STEPS.length;
  const isLastStep = currentStep === totalSteps - 1;

  const handleNext = () => {
    if (isLastStep) {
      completeMutation.mutate();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const StepContent = stepComponents[currentStep];
  const step = STEPS[currentStep];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Background star field */}
      <div className="fixed inset-0 z-[-1]">
        <StarField density="medium" speed="slow" />
      </div>

      <div className="w-full max-w-md">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? 'w-8 bg-violet-400'
                  : i < currentStep
                    ? 'w-2 bg-violet-400/50'
                    : 'w-2 bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-[#0a1628]/90 backdrop-blur border border-white/10 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-6">
            <p className="text-xs font-medium text-violet-400/80 uppercase tracking-widest mb-1">
              Step {currentStep + 1} of {totalSteps}
            </p>
            <h1 className="text-2xl font-bold text-white/90">{step.title}</h1>
            <p className="text-sm text-white/50 mt-1">{step.subtitle}</p>
          </div>

          {/* Step content */}
          <div className="mb-8">
            <StepContent />
          </div>

          {/* Navigation */}
          <button
            type="button"
            onClick={handleNext}
            disabled={completeMutation.isPending}
            className="w-full py-3 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            data-testid="onboarding-next"
          >
            {completeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting your journey…
              </>
            ) : isLastStep ? (
              <>
                <Sparkles className="w-4 h-4" />
                Start Playing
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Skip link (for players who accidentally trigger it again) */}
          {currentStep === 0 && (
            <p className="text-center mt-3">
              <button
                type="button"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="text-xs text-white/30 hover:text-white/50 transition-colors"
                data-testid="onboarding-skip"
              >
                Skip intro
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
