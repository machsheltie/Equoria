/**
 * OnboardingPage — Celestial Night Rebuild (Epic 25-2)
 *
 * 3-step new-player wizard, fully restyled to Celestial Night.
 * StarfieldBackground visible behind the wizard panel.
 *
 * Steps:
 *   0. Welcome     — atmospheric intro
 *   1. Your Horse  — breed dropdown, gender, name (all required)
 *   2. Ready       — stable preview + CTA to start guided tour
 *
 * Registration creates the starter horse. On completion this page calls
 * POST /api/auth/advance-onboarding to customize that starter horse, then
 * navigates to /stable so the tester sees their persisted horse.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api-client';
import type { User } from '@/hooks/useAuth';
import { usePageBackground } from '@/components/layout/PageBackground';
import { type BreedSelectionValue, type Gender } from '@/components/onboarding/BreedSelector';
import { getHorseImage } from '@/lib/breed-images';
import { useBreeds } from '@/hooks/api/useBreeds';

// ── Step definitions ───────────────────────────────────────────────────────────

const STEPS = [
  { title: 'Welcome to Equoria', subtitle: 'Your horse breeding adventure begins' },
  {
    title: 'Choose Your Horse',
    subtitle: "Pick your first horse's name and gender, and select a breed",
  },
  { title: "You're Ready!", subtitle: 'Your stable awaits' },
];

// ── Step 0: Welcome ────────────────────────────────────────────────────────────

const WelcomeStep: React.FC = () => (
  <div className="text-center space-y-6">
    {/* Horse image — 250px desktop, scales down on mobile */}
    <div className="flex items-center justify-center">
      <img
        src="/images/horses/loadhorse.png"
        alt="Welcome horse"
        className="rounded-xl object-contain w-40 h-40 sm:w-[250px] sm:h-[250px]"
      />
    </div>

    <div>
      <h2
        className="text-sm text-[var(--cream)]/80 font-[var(--font-body)] mb-2"
        style={{ textShadow: '0 1px 6px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.9)' }}
      >
        Welcome to the world of horse breeding
      </h2>
      <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-sm mx-auto font-[var(--font-body)]">
        In Equoria you breed, train, and compete horses across disciplines — from Dressage to
        Western Pleasure to Racing and Saddleseat... and everything in between! Every horse is
        unique, with traits and genetics that shape its destiny.
      </p>
    </div>

    {/* Feature images — 100px desktop, scale down on mobile */}
    <div className="grid grid-cols-3 gap-3">
      {[
        { src: '/images/horses/genetics.png', alt: 'Breed unique genetics' },
        { src: '/images/horses/wincompetitions.png', alt: 'Win competitions' },
        { src: '/images/horses/train.png', alt: 'Train & master skills' },
      ].map(({ src, alt }) => (
        <div key={alt} className="flex items-center justify-center">
          <img
            src={src}
            alt={alt}
            className="rounded-xl object-contain w-16 h-16 sm:w-[100px] sm:h-[100px]"
          />
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

  function selectBreed(e: React.ChangeEvent<HTMLSelectElement>) {
    const breed = breeds?.find((b) => b.id === Number(e.target.value));
    if (breed) {
      onChange({ ...selection, breedId: breed.id, breedName: breed.name });
    }
  }

  function selectGender(gender: Gender) {
    onChange({ ...selection, gender });
  }

  function setHorseName(e: React.ChangeEvent<HTMLInputElement>) {
    onChange({ ...selection, horseName: e.target.value });
  }

  return (
    <div className="space-y-5">
      {/* Horse image — responsive */}
      <div className="flex items-center justify-center">
        <img
          src="/images/horses/onboardhorse.png"
          alt="Your future horse"
          className="rounded-xl object-contain w-[160px] h-[129px] sm:w-[248px] sm:h-[200px]"
        />
      </div>

      {/* Breed dropdown */}
      <div>
        <label
          htmlFor="breed-select"
          className="block text-xs text-[var(--text-muted)] font-[var(--font-body)] uppercase tracking-widest mb-2"
        >
          Select a Breed
        </label>
        {isLoading ? (
          <div className="h-11 rounded-lg bg-[var(--bg-midnight)] animate-pulse" />
        ) : isError ? (
          <p className="text-sm text-[var(--text-muted)] font-[var(--font-body)]">
            Couldn&apos;t load breeds — please try refreshing.
          </p>
        ) : (
          <select
            id="breed-select"
            value={selection.breedId ?? ''}
            onChange={selectBreed}
            className="celestial-input w-full rounded-lg h-11"
            data-testid="breed-select"
          >
            <option value="" disabled>
              — Choose a breed —
            </option>
            {breeds?.map((breed) => (
              <option key={breed.id} value={breed.id}>
                {breed.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Gender selection — gold buttons */}
      <div>
        <p className="text-xs text-[var(--text-muted)] font-[var(--font-body)] uppercase tracking-widest mb-2">
          Gender
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(['Mare', 'Stallion'] as const).map((g) => (
            <Button
              key={g}
              variant="default"
              onClick={() => selectGender(g)}
              aria-pressed={selection.gender === g}
              className="w-full"
            >
              {g === 'Mare' ? '♀' : '♂'} {g}
            </Button>
          ))}
        </div>
      </div>

      {/* Name input */}
      <div>
        <label
          htmlFor="horse-name-input"
          className="block text-xs text-[var(--text-muted)] font-[var(--font-body)] uppercase tracking-widest mb-2"
        >
          Name Your Horse
        </label>
        <input
          id="horse-name-input"
          type="text"
          value={selection.horseName ?? ''}
          onChange={setHorseName}
          placeholder="e.g. Midnight Comet"
          maxLength={40}
          required
          className="celestial-input w-full rounded-lg"
          data-testid="horse-name-input"
        />
      </div>
    </div>
  );
};

// ── Step 2: Ready ──────────────────────────────────────────────────────────────

interface ReadyStepProps {
  horseName: string;
  breedName: string;
  gender: Gender | undefined;
}

const ReadyStep: React.FC<ReadyStepProps> = ({ horseName, breedName, gender }) => (
  <div className="text-center space-y-5">
    {/* Breed-specific horse image */}
    <div className="flex items-center justify-center">
      <img
        src={getHorseImage(null, breedName)}
        alt={horseName || 'Your new horse'}
        className="rounded-xl object-contain w-[160px] h-[129px] sm:w-[248px] sm:h-[200px]"
      />
    </div>

    {/* Horse details */}
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

    <div>
      <h2
        className="text-lg font-bold text-[var(--cream)] mb-2"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        Your stable awaits
      </h2>
      <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-sm mx-auto font-[var(--font-body)]">
        Head to your Stable to view your first horse, then visit the Tack Shop to equip it. A guided
        tour will show you the way — your legend begins now.
      </p>
    </div>

    {/* Next steps */}
    <ul className="space-y-3 text-sm text-left">
      {[
        {
          img: '/images/horses/stableicon.png',
          path: '/my-stable',
          label: 'View your horse in the stable',
        },
        {
          img: '/images/horses/inventoryicon.png',
          path: '/inventory',
          label: 'Equip saddle & bridle',
        },
        {
          img: '/images/horses/showicon.png',
          path: '/competitions',
          label: 'Enter your first show',
        },
      ].map(({ img, path, label }) => (
        <li
          key={path}
          className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[rgba(10,22,50,0.5)] border border-[rgba(100,130,165,0.15)]"
        >
          <img
            src={img}
            alt={label}
            className="flex-shrink-0 object-contain w-8 h-8 sm:w-[50px] sm:h-[50px]"
          />
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

const STORAGE_KEY_STEP = 'equoria-onboarding-step';
const STORAGE_KEY_HORSE = 'equoria-onboarding-horse';

function loadSavedStep(): number {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY_STEP);
    return saved ? Math.min(Number(saved), 2) : 0;
  } catch {
    return 0;
  }
}

function loadSavedHorse(): Partial<BreedSelectionValue> {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY_HORSE);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(loadSavedStep);
  const [horseSelection, setHorseSelection] =
    useState<Partial<BreedSelectionValue>>(loadSavedHorse);

  // Persist step and horse selection to sessionStorage
  function advanceStep(nextStep: number) {
    setCurrentStep(nextStep);
    try {
      sessionStorage.setItem(STORAGE_KEY_STEP, String(nextStep));
    } catch {
      /* noop */
    }
  }

  function updateHorse(value: Partial<BreedSelectionValue>) {
    setHorseSelection(value);
    try {
      sessionStorage.setItem(STORAGE_KEY_HORSE, JSON.stringify(value));
    } catch {
      /* noop */
    }
  }

  function clearOnboardingStorage() {
    try {
      sessionStorage.removeItem(STORAGE_KEY_STEP);
      sessionStorage.removeItem(STORAGE_KEY_HORSE);
    } catch {
      /* noop */
    }
  }

  const completeMutation = useMutation({
    mutationFn: () =>
      authApi.advanceOnboarding({
        horseName: horseSelection.horseName?.trim(),
        breedId: horseSelection.breedId,
        gender: horseSelection.gender,
      }),
    onSuccess: async () => {
      // Story 21S-2/21S-3: Synchronously patch the profile query cache so
      // OnboardingGuard sees `completedOnboarding=true` BEFORE navigation.
      // Previously used fire-and-forget `invalidateQueries`, which caused a
      // race — the guard read stale user and bounced back to /onboarding.
      // Setting the data directly guarantees the next render has fresh flags.
      const existingProfile = queryClient.getQueryData<{ user: User }>(['profile']);
      if (existingProfile?.user) {
        queryClient.setQueryData(['profile'], {
          ...existingProfile,
          user: {
            ...existingProfile.user,
            completedOnboarding: true,
            onboardingStep: 10,
          },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      clearOnboardingStorage();
      toast.success('Welcome to Equoria!');
      navigate('/stable', { replace: true });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : 'We could not save your starter horse. Please try again.';
      toast.error(message);
    },
  });

  const totalSteps = STEPS.length;
  const isLastStep = currentStep === totalSteps - 1;
  const step = STEPS[currentStep];

  // Step 1 requires breed, gender, and a non-empty name
  const isStep1Complete =
    !!horseSelection.breedId && !!horseSelection.gender && !!horseSelection.horseName?.trim();

  const canProceed = currentStep !== 1 || isStep1Complete;

  function handleNext() {
    if (!canProceed) return;
    if (isLastStep) {
      completeMutation.mutate();
    } else {
      advanceStep(currentStep + 1);
    }
  }

  const bgStyle = usePageBackground({ scene: 'default' });
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
          {/* Header — matches PageHero title/subtitle styling */}
          <div className="text-center mb-5">
            <h1
              className="text-2xl sm:text-3xl font-bold text-[var(--gold-400)] tracking-wide"
              style={{
                fontFamily: 'var(--font-heading)',
                textShadow:
                  '0 1px 6px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.9), 0 0 30px rgba(201,162,39,0.3)',
              }}
            >
              {step.title}
            </h1>
            <p
              className="mt-1 text-sm text-[var(--cream)]/80 font-[var(--font-body)]"
              style={{ textShadow: '0 1px 6px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.9)' }}
            >
              {step.subtitle}
            </p>
            <p
              className="mt-2 text-sm text-[var(--cream)]/80 font-[var(--font-body)]"
              style={{ textShadow: '0 1px 6px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.9)' }}
            >
              Step {currentStep + 1} of {totalSteps}
            </p>
          </div>

          {/* Step content */}
          <div className="mb-6" role="tabpanel" aria-label={step.title}>
            {currentStep === 0 && <WelcomeStep />}
            {currentStep === 1 && <HorseStep selection={horseSelection} onChange={updateHorse} />}
            {currentStep === 2 && (
              <ReadyStep
                horseName={horseSelection.horseName ?? ''}
                breedName={horseSelection.breedName ?? ''}
                gender={horseSelection.gender}
              />
            )}
          </div>

          {/* CTA — gold Button component */}
          <Button
            onClick={handleNext}
            disabled={completeMutation.isPending || !canProceed}
            data-testid="onboarding-next"
            size="lg"
            className="w-full"
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
          </Button>

          {/* Skip intro link — skips the welcome step and goes directly to horse selection */}
          {currentStep === 0 && (
            <p className="text-center mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => advanceStep(1)}
                data-testid="onboarding-skip"
              >
                Skip intro
              </Button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
