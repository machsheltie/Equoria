/**
 * OnboardingPage — Celestial Night Rebuild (Epic 25-2)
 *
 * 3-step new-player wizard, fully restyled to Celestial Night.
 * StarfieldBackground visible behind the wizard panel.
 *
 * Steps:
 *   0. Welcome     — atmospheric intro
 *   1. Your Horse  — BreedSelector (breed, gender, name)
 *   2. Ready       — stable preview + CTA to start guided tour
 *
 * On completion calls POST /api/auth/advance-onboarding (step 0 → 1)
 * then navigates to /bank for the OnboardingSpotlight tour.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight, Sparkles, Loader2, Trophy, Swords, Dna } from 'lucide-react';
import { authApi } from '@/lib/api-client';
import { usePageBackground } from '@/components/layout/PageBackground';
import {
  BreedSelector,
  BreedSelectorSkeleton,
  type BreedSelectionValue,
  type Gender,
} from '@/components/onboarding/BreedSelector';
import { useBreeds } from '@/hooks/api/useBreeds';

// ── Step definitions ───────────────────────────────────────────────────────────

const STEPS = [
  { title: 'Welcome to Equoria', subtitle: 'Your horse breeding adventure begins' },
  { title: 'Choose Your Horse', subtitle: 'Pick a breed, name your companion' },
  { title: "You're Ready!", subtitle: 'Your stable awaits' },
];

// ── Step 0: Welcome ────────────────────────────────────────────────────────────

const WelcomeStep: React.FC = () => (
  <div className="text-center space-y-6">
    {/* Atmospheric icon */}
    <div className="flex items-center justify-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[rgba(201,162,39,0.15)] blur-2xl scale-150" />
        <div className="relative w-20 h-20 rounded-full flex items-center justify-center bg-[var(--celestial-navy-800)] border border-[rgba(201,162,39,0.3)] shadow-[0_0_24px_rgba(201,162,39,0.15)]">
          <span className="text-4xl">🐎</span>
        </div>
      </div>
    </div>

    <div>
      <h2
        className="text-lg font-bold text-[var(--cream)] mb-2"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        Welcome to the world of horse breeding
      </h2>
      <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-sm mx-auto font-[var(--font-body)]">
        In Equoria you breed, train, and compete horses across disciplines — from Dressage to
        Cross-Country. Every horse is unique, with traits and genetics that shape its destiny.
      </p>
    </div>

    {/* Feature pills */}
    <div className="grid grid-cols-3 gap-3">
      {[
        { icon: <Dna className="w-5 h-5" />, label: 'Breed unique genetics' },
        { icon: <Trophy className="w-5 h-5" />, label: 'Win competitions' },
        { icon: <Swords className="w-5 h-5" />, label: 'Train & master skills' },
      ].map(({ icon, label }) => (
        <div
          key={label}
          className="p-3 rounded-xl bg-[rgba(10,22,50,0.5)] border border-[rgba(100,130,165,0.2)] flex flex-col items-center gap-2"
        >
          <span className="text-[var(--gold-400)]">{icon}</span>
          <p className="text-[10px] text-[var(--text-muted)] font-[var(--font-body)] leading-tight text-center">
            {label}
          </p>
        </div>
      ))}
    </div>
  </div>
);

// ── Step 1: Choose Your Horse ──────────────────────────────────────────────────

interface HorseStepProps {
  selection: Partial<BreedSelectionValue>;
  onChange: (_v: Partial<BreedSelectionValue>) => void;
}

const HorseStep: React.FC<HorseStepProps> = ({ selection, onChange }) => {
  const { data: breeds, isLoading, isError } = useBreeds();

  if (isError) {
    return (
      <div className="text-center py-6 space-y-2">
        <p className="text-sm text-[var(--text-muted)] font-[var(--font-body)]">
          Couldn&apos;t load breeds — you can choose later in the stable.
        </p>
      </div>
    );
  }

  if (isLoading || !breeds) {
    return <BreedSelectorSkeleton />;
  }

  return <BreedSelector breeds={breeds} value={selection} onChange={onChange} />;
};

// ── Step 2: Ready ──────────────────────────────────────────────────────────────

interface ReadyStepProps {
  horseName: string;
  breedName: string;
  gender: Gender | undefined;
}

const ReadyStep: React.FC<ReadyStepProps> = ({ horseName, breedName, gender }) => (
  <div className="text-center space-y-5">
    {/* Stable preview chip */}
    {horseName && (
      <div className="inline-flex flex-col items-center gap-1 px-5 py-3 rounded-2xl bg-[rgba(201,162,39,0.1)] border border-[rgba(201,162,39,0.25)] shadow-[0_0_18px_rgba(201,162,39,0.08)]">
        <span
          className="text-base font-bold text-[var(--gold-400)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {horseName}
        </span>
        {(breedName || gender) && (
          <span className="text-xs text-[var(--text-muted)] font-[var(--font-body)]">
            {[gender, breedName].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
    )}

    {!horseName && (
      <div className="relative inline-flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[rgba(201,162,39,0.15)] blur-xl" />
        <Sparkles className="w-14 h-14 text-[var(--gold-400)] relative" aria-hidden="true" />
      </div>
    )}

    <div>
      <h2
        className="text-lg font-bold text-[var(--cream)] mb-2"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        Your stable awaits
      </h2>
      <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-sm mx-auto font-[var(--font-body)]">
        Head to the Stable to acquire your first horse, then visit the Tack Shop to equip it. A
        guided tour will show you the way — your legend begins now.
      </p>
    </div>

    {/* Next steps */}
    <ul className="space-y-2 text-sm text-left">
      {[
        { symbol: '🏠', path: '/my-stable', label: 'Visit your stable' },
        { symbol: '🎒', path: '/inventory', label: 'Equip saddle & bridle' },
        { symbol: '🏆', path: '/competitions', label: 'Enter your first show' },
      ].map(({ symbol, path, label }) => (
        <li
          key={path}
          className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[rgba(10,22,50,0.5)] border border-[rgba(100,130,165,0.15)]"
        >
          <span className="text-lg flex-shrink-0">{symbol}</span>
          <div>
            <span className="text-[var(--cream)]/80 font-[var(--font-body)]">{label}</span>
            <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">{path}</span>
          </div>
        </li>
      ))}
    </ul>
  </div>
);

// ── OnboardingPage ─────────────────────────────────────────────────────────────

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [horseSelection, setHorseSelection] = useState<Partial<BreedSelectionValue>>({});

  const completeMutation = useMutation({
    mutationFn: () => authApi.advanceOnboarding(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Welcome to Equoria! Starting your guided tour…');
      navigate('/bank', { replace: true });
    },
    onError: () => {
      toast.info('Starting your adventure…');
      navigate('/bank', { replace: true });
    },
  });

  const totalSteps = STEPS.length;
  const isLastStep = currentStep === totalSteps - 1;
  const step = STEPS[currentStep];

  function handleNext() {
    if (isLastStep) {
      completeMutation.mutate();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }

  const bgStyle = usePageBackground({ scene: 'auth' });
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative"
      style={bgStyle}
    >
      <div className="w-full max-w-md relative z-10">
        {/* Progress dots */}
        <div
          className="flex justify-center gap-2 mb-6"
          role="tablist"
          aria-label="Onboarding steps"
        >
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              role="tab"
              aria-selected={i === currentStep}
              aria-label={`Step ${i + 1}: ${s.title}`}
              className={[
                'h-1.5 rounded-full transition-all duration-300',
                i === currentStep
                  ? 'w-8 bg-[var(--gold-400)]'
                  : i < currentStep
                    ? 'w-1.5 bg-[rgba(201,162,39,0.45)]'
                    : 'w-1.5 bg-[rgba(100,130,165,0.25)]',
              ].join(' ')}
            />
          ))}
        </div>

        {/* Main card */}
        <div className="glass-panel-heavy rounded-2xl p-6 shadow-2xl border border-[rgba(201,162,39,0.18)]">
          {/* Header */}
          <div className="text-center mb-5">
            <p className="text-[10px] font-semibold text-[var(--gold-400)]/70 uppercase tracking-widest mb-1 font-[var(--font-body)]">
              Step {currentStep + 1} of {totalSteps}
            </p>
            <h1
              className="text-xl font-bold text-[var(--cream)]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {step.title}
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-1 font-[var(--font-body)]">
              {step.subtitle}
            </p>
          </div>

          {/* Step content */}
          <div className="mb-6" role="tabpanel" aria-label={step.title}>
            {currentStep === 0 && <WelcomeStep />}
            {currentStep === 1 && (
              <HorseStep selection={horseSelection} onChange={setHorseSelection} />
            )}
            {currentStep === 2 && (
              <ReadyStep
                horseName={horseSelection.horseName ?? ''}
                breedName={horseSelection.breedName ?? ''}
                gender={horseSelection.gender}
              />
            )}
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={handleNext}
            disabled={completeMutation.isPending}
            data-testid="onboarding-next"
            className="w-full py-3 px-6 rounded-full bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-500)] hover:from-[var(--gold-600)] hover:to-[var(--gold-400)] text-[var(--celestial-navy-900)] font-bold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_14px_rgba(201,162,39,0.25)] font-[var(--font-body)]"
          >
            {completeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Starting your journey…
              </>
            ) : isLastStep ? (
              <>
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                Let&apos;s Go!
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>

          {/* Skip link */}
          {currentStep === 0 && (
            <p className="text-center mt-3">
              <button
                type="button"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                data-testid="onboarding-skip"
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--cream)]/60 transition-colors focus-visible:outline-none font-[var(--font-body)]"
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
