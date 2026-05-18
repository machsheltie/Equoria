/**
 * Hub Dashboard — The player's home base in Equoria (Section 08)
 *
 * Matches direction-4-hybrid.html: "My Stable" header + NextActionsBar + horse grid.
 * AsidePanel is rendered by DashboardLayout on hub routes.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Star, Dumbbell, Trophy, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { NextActionsBar } from '@/components/hub/NextActionsBar';
import { NarrativeChip, deriveLatestChapter } from '@/components/hub/NarrativeChip';
import { useHorses } from '@/hooks/api/useHorses';
import { Button } from '@/components/ui/button';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { getHorseImage } from '@/lib/breed-images';
import { getBreedName } from '@/lib/utils';
import { CooldownTimer } from '@/components/common/CooldownTimer';
import { CareChip } from '@/components/common/CareChip';
import {
  careChipStatus,
  trainingCooldownChip,
  horseNeedsCare,
  isReadyToTrain,
} from '@/lib/utils/care-status-utils';
import type { HorseSummary } from '@/lib/api-client';

/** Resolve stat value from flat fields or nested stats object */
function getStat(horse: HorseSummary, stat: keyof HorseSummary['stats']): number {
  return (horse[stat] as number | undefined) ?? horse.stats?.[stat] ?? 0;
}

/* ─── Horse Card — matches direction-4-hybrid.html mockup ─────────────── */
function HorseCard({ horse }: { horse: HorseSummary }) {
  const breedName = getBreedName(horse.breed);
  const sex = horse.sex ?? '';
  const ageStr = horse.age != null ? `${horse.age} yrs` : '';
  const subtitle = [breedName, sex, ageStr].filter(Boolean).join(' · ');

  const stats = [
    { label: 'PRC', value: getStat(horse, 'precision') },
    { label: 'STR', value: getStat(horse, 'strength') },
    { label: 'SPD', value: getStat(horse, 'speed') },
    { label: 'AGI', value: getStat(horse, 'agility') },
    { label: 'END', value: getStat(horse, 'endurance') },
    { label: 'INT', value: getStat(horse, 'intelligence') },
    { label: 'STA', value: getStat(horse, 'stamina') },
    { label: 'BAL', value: getStat(horse, 'balance') },
    { label: 'BLD', value: getStat(horse, 'boldness') },
    { label: 'FLX', value: getStat(horse, 'flexibility') },
    { label: 'OBD', value: getStat(horse, 'obedience') },
    { label: 'FCS', value: getStat(horse, 'focus') },
  ];

  const cooldown = trainingCooldownChip(horse.trainingCooldown);

  // "Latest chapter" narrative (Equoria-pqzmf, Spec 11.3.12) — derived from
  // real per-horse HorseSummary fields, no extra requests. Stale (>7d) chips
  // fade to a quieter state per spec.
  const chapter = deriveLatestChapter({
    healthStatus: horse.healthStatus,
    inFoalSinceDate: horse.inFoalSinceDate,
    lastFedDate: horse.lastFedDate,
    lastGroomed: horse.lastGroomed,
    lastShod: horse.lastShod,
    lastVettedDate: horse.lastVettedDate,
    trainingCooldown: typeof horse.trainingCooldown === 'string' ? horse.trainingCooldown : null,
  });

  return (
    <Link
      to={`/horses/${horse.id}`}
      className="bg-[var(--glass-bg)] border border-[rgba(200,168,78,0.2)] rounded-[var(--radius-lg)] overflow-hidden transition-all duration-[250ms] hover:border-[var(--glass-hover)] hover:shadow-[var(--glow-gold)] hover:-translate-y-0.5 group [backdrop-filter:blur(10px)_saturate(1.3)_brightness(1.2)] shadow-[0_0_12px_rgba(200,168,78,0.06)]"
      aria-label={`View ${horse.name}`}
    >
      {/* Top: portrait + info */}
      <div className="flex gap-4 p-4 pb-0">
        {/* 80×80 portrait */}
        <div className="w-20 h-20 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0 relative bg-gradient-to-br from-[var(--bg-midnight)] to-[var(--bg-twilight)] overflow-hidden">
          <img
            src={getHorseImage(horse.imageUrl, breedName)}
            alt={horse.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/horse-placeholder.png';
            }}
          />
          {horse.level != null && (
            <span className="absolute -bottom-1 -right-1 bg-[rgba(200,168,78,0.25)] border border-[var(--gold-dim)] rounded-[var(--radius-sm)] px-1.5 py-px text-[0.65rem] font-bold text-[var(--gold-light)]">
              {horse.level}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-[1.1rem] font-semibold text-[var(--text-primary)] truncate mb-0.5"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {horse.name}
          </p>
          <p className="text-[0.75rem] text-[var(--text-secondary)] truncate mb-1.5">{subtitle}</p>
          {/* Latest-chapter narrative (Equoria-pqzmf, Spec 11.3.12) — stale
              chapters fade per spec; read naturally by screen readers as
              part of the card content flow. */}
          <NarrativeChip
            text={chapter.text}
            variant={chapter.variant}
            className={chapter.stale ? 'opacity-60' : undefined}
          />
        </div>
      </div>

      {/* Stats — compact numeric grid, 4 per row */}
      <div className="grid grid-cols-4 gap-x-3 gap-y-1 px-4 pt-3">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center justify-between">
            <span className="text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wider font-medium">
              {s.label}
            </span>
            <span className="text-[0.75rem] font-semibold text-[var(--text-primary)]">
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* Trait chip (if present) */}
      {horse.trait && (
        <div className="px-4 pt-2 pb-0 flex flex-wrap gap-1">
          <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[0.6rem] font-medium bg-[rgba(200,168,78,0.15)] text-[var(--gold-light)]">
            {horse.trait}
          </span>
        </div>
      )}

      {/* Inline cooldown timer (PRD Section 09: cooldown timers visible on card) */}
      <div className="px-4 pt-2">
        <CooldownTimer
          endsAt={typeof horse.trainingCooldown === 'string' ? horse.trainingCooldown : null}
          label="Training"
          compact
        />
      </div>

      {/* Care strip */}
      <div className="flex gap-1 px-3 py-3 mt-2 border-t border-slate-400/[0.08] overflow-hidden">
        <CareChip label="Fed" status={careChipStatus(horse.lastFedDate, 1, 3)} />
        <CareChip label="Shod" status={careChipStatus(horse.lastShod, 7, 14)} />
        <CareChip label="Groomed" status={careChipStatus(horse.lastGroomed, 3, 7)} />
        <CareChip label="Vetted" status={careChipStatus(horse.lastVettedDate, 7, 14)} />
        <CareChip label={cooldown.label} status={cooldown.status} />
      </div>
    </Link>
  );
}

/* ─── Getting Started card (new players) ─────────────────────────────── */
function GettingStartedCard() {
  return (
    <div className="relative bg-[var(--glass-bg)] rounded-[var(--radius-lg)] p-6 space-y-4 overflow-hidden border border-[rgba(200,168,78,0.25)] [backdrop-filter:blur(10px)_saturate(1.3)_brightness(1.2)] shadow-[0_0_12px_rgba(200,168,78,0.06)]">
      {/* Subtle gold glow accent */}
      <div
        className="absolute -top-20 -right-20 w-60 h-60 rounded-full pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(circle, rgba(200,168,78,0.1) 0%, transparent 70%)',
        }}
      />
      {/* Top-left light reflection like mockup */}
      <div
        className="absolute -top-10 -left-10 w-40 h-40 rounded-full pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(circle, rgba(148,186,216,0.08) 0%, transparent 70%)',
        }}
      />
      <div className="relative text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-[var(--gold-primary)]" />
          <h3
            className="text-lg font-bold text-[var(--gold-primary)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Your Adventure Begins
          </h3>
        </div>
        <p className="text-sm text-[var(--text-primary)] leading-relaxed max-w-md mx-auto">
          Welcome to Equoria, rider. The stables are warm, the training grounds await, and the
          competition arena calls. Meet your first horse and begin forging a legacy among the stars.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Button asChild size="default">
            <Link to="/stable">Enter the Stable</Link>
          </Button>
          <Button asChild size="default">
            <Link to="/world">Explore the World</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Day-One Getting Started (first hub visit after wizard completion) ── */
const STARTER_ACTIONS = [
  {
    icon: <Dumbbell className="w-5 h-5" />,
    title: 'Train Your Horse',
    description: 'Improve stats in a discipline of your choice',
    href: '/training',
  },
  {
    icon: <Trophy className="w-5 h-5" />,
    title: 'Enter a Competition',
    description: 'Test your horse against other riders',
    href: '/competitions',
  },
  {
    icon: <Star className="w-5 h-5" />,
    title: 'Groom Your Foal',
    description: "Care for a young horse's early development",
    href: '/grooms',
  },
] as const;

interface DayOneGettingStartedProps {
  onDismiss: () => void;
}

function DayOneGettingStarted({ onDismiss }: DayOneGettingStartedProps) {
  return (
    <section aria-label="Getting started">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] font-[var(--font-body)]">
          Getting Started
        </h2>
        <button
          onClick={onDismiss}
          className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Dismiss getting started"
        >
          <X className="w-3 h-3" />
          Dismiss
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STARTER_ACTIONS.map((action) => (
          <Link
            key={action.href}
            to={action.href}
            onClick={onDismiss}
            className="flex items-start gap-3 p-4 rounded-xl border border-[rgba(200,168,78,0.2)] bg-[var(--glass-bg)] hover:border-[var(--gold-primary)] hover:bg-[rgba(201,162,39,0.1)] transition-all duration-150 [backdrop-filter:blur(10px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--status-info)]"
          >
            <span className="rounded-lg p-2 text-[var(--gold-primary)] bg-[rgba(201,162,39,0.15)] flex-shrink-0">
              {action.icon}
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--gold-light)] leading-snug">
                {action.title}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                {action.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ─── Main Hub ───────────────────────────────────────────────────────── */
const Index = () => {
  const { user } = useAuth();
  const { data: horses, isLoading: horsesLoading, isError, error, refetch } = useHorses();
  const isNewPlayer = !user?.completedOnboarding;
  const horseList = Array.isArray(horses) ? horses : [];

  const [isDayOne, setIsDayOne] = useState(() => sessionStorage.getItem('equoria-day1') === '1');

  function dismissDayOne() {
    try {
      sessionStorage.removeItem('equoria-day1');
    } catch {
      /* noop */
    }
    setIsDayOne(false);
  }

  // Compute summary stats from horse data using shared helpers
  const readyCount = horseList.filter((h) =>
    isReadyToTrain(h as unknown as Record<string, unknown>)
  ).length;

  const needsCareCount = horseList.filter((h) =>
    horseNeedsCare(h as unknown as Record<string, unknown>)
  ).length;

  return (
    <div className="py-6 space-y-6">
      {/* Page header — matches mockup */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-[var(--text-h1)] font-semibold text-[var(--gold-primary)]"
            style={{
              fontFamily: 'var(--font-heading)',
              textShadow: '0 0 30px rgba(200,168,78,0.25)',
            }}
          >
            My Stable
          </h1>
          <p className="text-[0.85rem] text-[var(--text-secondary)] mt-1">
            <span className="text-[var(--gold-light)] font-semibold">{horseList.length}</span>
            {' horses'}
            {readyCount > 0 && (
              <>
                {' · '}
                <span className="text-[var(--gold-light)] font-semibold">{readyCount}</span>
                {' ready to train'}
              </>
            )}
            {needsCareCount > 0 && (
              <>
                {' · '}
                <span className="text-[var(--gold-light)] font-semibold">{needsCareCount}</span>
                {' need care'}
              </>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link to="/stable">View all</Link>
          </Button>
        </div>
      </header>

      {/* Next actions — pre-onboarding welcome, Day-1 guided mode, or live actions */}
      {isNewPlayer ? (
        <GettingStartedCard />
      ) : isDayOne ? (
        <DayOneGettingStarted onDismiss={dismissDayOne} />
      ) : (
        <NextActionsBar />
      )}

      {/* Horse grid — 250px min-width per card, auto-fill for responsive 3-col on laptop */}
      <section aria-label="Your horses">
        {horsesLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-64 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-lg)] animate-pulse"
              />
            ))}
          </div>
        ) : isError ? (
          <ErrorCard
            title="Unable to Load Horses"
            message={error?.message || 'Failed to fetch horses. Please check your connection.'}
            onRetry={() => refetch()}
          />
        ) : horseList.length === 0 ? (
          <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-lg)] p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[var(--bg-midnight)] to-[var(--bg-twilight)] border border-[rgba(200,168,78,0.2)]">
              <Star className="w-8 h-8 text-[var(--gold-primary)] opacity-40" />
            </div>
            <p
              className="text-sm text-[var(--text-primary)] mb-1"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Your stable is empty
            </p>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Visit the stable to meet your first horse.
            </p>
            <Button asChild>
              <Link to="/stable">Go to Stable</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-5">
            {horseList.slice(0, 12).map((horse) => (
              <HorseCard key={horse.id} horse={horse} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Index;
