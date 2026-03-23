/**
 * HorseCard — Rich horse card matching direction-4-hybrid.html mockup (Section 09)
 *
 * Displays: portrait, name, breed/gender/level, lineage, stat mini-bars,
 * trait chips, care status strip, narrative chip, cooldown display.
 * Used in hub grid and stable page.
 */

import { Link } from 'react-router-dom';
import { cn, getBreedName } from '@/lib/utils';
import { getHorseImage } from '@/lib/breed-images';
import { Badge } from '@/components/ui/badge';
import { NarrativeChip, deriveHorseChip } from '@/components/hub/NarrativeChip';

/* ─── Types ──────────────────────────────────────────────────────────────── */
export interface HorseCardData {
  id: number;
  name: string;
  breed?: string;
  sex?: string;
  age?: number;
  level?: number;
  generation?: number;
  lineageName?: string;
  portraitUrl?: string;
  /** Top stats to display (max 3 shown) */
  stats?: { label: string; value: number }[];
  /** Discovered traits */
  traits?: { name: string; rarity: 'common' | 'uncommon' | 'rare' | 'ultra-rare' | 'legendary' }[];
  /** Care status indicators */
  careStatus?: {
    fed?: 'good' | 'warn' | 'bad';
    shod?: 'good' | 'warn' | 'bad';
    trained?: 'good' | 'warn' | 'bad';
  };
  /** For narrative chip derivation */
  trainingCooldownEndsAt?: string | null;
  breedingCooldownEndsAt?: string | null;
  isEligibleForCompetition?: boolean;
  healthStatus?: 'healthy' | 'injured' | 'recovering';
  /** Featured card gets gold accent border */
  featured?: boolean;
}

/* ─── Stat Mini-Bar ──────────────────────────────────────────────────────── */
function StatMiniBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.65rem] text-[var(--text-muted)] w-12 text-right uppercase tracking-wider">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(value, 100)}%`,
            background: 'var(--gradient-stat-bar)',
          }}
        />
      </div>
      <span className="text-xs font-semibold text-[var(--text-primary)] w-6 tabular-nums">
        {value}
      </span>
    </div>
  );
}

/* ─── Care Chip ──────────────────────────────────────────────────────────── */
const CARE_STYLES = {
  good: 'text-[var(--status-success)]',
  warn: 'text-[var(--status-warning)]',
  bad: 'text-[var(--status-danger)]',
};
const CARE_ICONS = { good: '✓', warn: '⏰', bad: '✗' };

function CareChip({ label, status }: { label: string; status: 'good' | 'warn' | 'bad' }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-[0.6rem] px-2 py-0.5 rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.03)]',
        CARE_STYLES[status]
      )}
    >
      {CARE_ICONS[status]} {label}
    </span>
  );
}

/* ─── Main HorseCard ─────────────────────────────────────────────────────── */
export function HorseCard({ horse }: { horse: HorseCardData }) {
  const chipData = deriveHorseChip({
    trainingCooldownEndsAt: horse.trainingCooldownEndsAt,
    breedingCooldownEndsAt: horse.breedingCooldownEndsAt,
    isEligibleForCompetition: horse.isEligibleForCompetition,
    healthStatus: horse.healthStatus,
  });

  const visibleTraits = horse.traits?.slice(0, 3) ?? [];
  const overflowCount = (horse.traits?.length ?? 0) - 3;

  return (
    <Link
      to={`/horses/${horse.id}`}
      className={cn(
        'block bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]',
        'border rounded-[var(--radius-lg)] overflow-hidden',
        'transition-all duration-200 cursor-pointer',
        'hover:border-[var(--glass-hover)] hover:shadow-[var(--glow-gold)] hover:-translate-y-0.5',
        horse.featured
          ? 'border-[rgba(200,168,78,0.3)] shadow-[0_0_15px_rgba(200,168,78,0.1)]'
          : 'border-[var(--glass-border)]'
      )}
      aria-label={`View ${horse.name}`}
    >
      {/* Top: portrait + identity */}
      <div className="flex gap-4 p-4 pb-0">
        {/* Portrait */}
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full flex-shrink-0 ring-2 ring-[var(--gold-primary)] bg-gradient-to-br from-[var(--bg-midnight)] to-[var(--bg-twilight)] flex items-center justify-center text-2xl md:text-3xl relative">
          <img
            src={getHorseImage(horse.portraitUrl, horse.breed)}
            alt={horse.name}
            className="w-full h-full rounded-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/horse-placeholder.png';
            }}
          />
          {horse.level != null && (
            <span className="absolute -bottom-1 -right-1 bg-[rgba(200,168,78,0.25)] border border-[var(--gold-dim)] rounded-[var(--radius-sm)] px-1.5 text-[0.6rem] font-bold text-[var(--gold-light)]">
              {horse.level}
            </span>
          )}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0 py-1">
          <h3
            className="text-base font-semibold text-[var(--text-primary)] truncate"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {horse.name}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] truncate">
            {getBreedName(horse.breed)}
            {horse.sex ? ` · ${horse.sex}` : ''}
            {horse.age != null ? ` · ${horse.age} yrs` : ''}
          </p>
          {(horse.generation != null || horse.lineageName) && (
            <p className="text-[0.65rem] text-[var(--gold-dim)] italic mt-0.5 truncate">
              {horse.generation != null && `Gen. ${horse.generation}`}
              {horse.generation != null && horse.lineageName && ' — '}
              {horse.lineageName && `${horse.lineageName} Line`}
            </p>
          )}
        </div>
      </div>

      {/* Stat mini-bars */}
      {horse.stats && horse.stats.length > 0 && (
        <div className="px-4 pt-3 space-y-1.5">
          {horse.stats.slice(0, 3).map((stat) => (
            <StatMiniBar key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      )}

      {/* Trait chips */}
      {visibleTraits.length > 0 && (
        <div className="px-4 pt-2 flex flex-wrap gap-1">
          {visibleTraits.map((trait) => (
            <Badge key={trait.name} variant={trait.rarity} className="text-[0.6rem] px-2 py-0">
              {trait.name}
            </Badge>
          ))}
          {overflowCount > 0 && (
            <span className="text-[0.6rem] text-[var(--text-muted)] self-center">
              +{overflowCount} more
            </span>
          )}
        </div>
      )}

      {/* Narrative chip */}
      {chipData && (
        <div className="px-4 pt-2">
          <NarrativeChip text={chipData.text} variant={chipData.variant} />
        </div>
      )}

      {/* Care status strip */}
      {horse.careStatus && (
        <div className="flex gap-1.5 px-4 py-3 mt-2 border-t border-[rgba(148,163,184,0.08)]">
          {horse.careStatus.fed && <CareChip label="Fed" status={horse.careStatus.fed} />}
          {horse.careStatus.shod && <CareChip label="Shod" status={horse.careStatus.shod} />}
          {horse.careStatus.trained && (
            <CareChip label="Trained" status={horse.careStatus.trained} />
          )}
        </div>
      )}
    </Link>
  );
}
