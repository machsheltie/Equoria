/**
 * HorseCard — canonical horse card for grid views.
 *
 * One implementation reused by StableView, the equip horse picker, and the
 * "My Horses" tabs in Vet, Farrier, and TackShop. Replaces the local
 * StableHorseCard that lived in StableView and the duplicated inline horse
 * cards in the service pages.
 *
 * Text scale matches ItemCard so item and horse grids feel like one system:
 *   name     → text-base font-semibold truncate    (was text-[1.1rem] — too wide for a 260px column)
 *   subtitle → text-xs text-secondary truncate
 *   stat lbl → text-[0.6rem] uppercase tracking-wider
 *   stat val → text-[0.75rem] font-semibold
 *   chips    → text-[0.6rem]
 */

import { cn, getBreedName } from '@/lib/utils';
import { getHorseImage } from '@/lib/breed-images';
import { careChipStatus, trainingCooldownChip } from '@/lib/utils/care-status-utils';
import { CareChip } from '@/components/common/CareChip';
import type { HorseSummary } from '@/lib/api-client';

const STAT_KEYS: { label: string; key: keyof HorseSummary['stats'] }[] = [
  { label: 'PRC', key: 'precision' },
  { label: 'STR', key: 'strength' },
  { label: 'SPD', key: 'speed' },
  { label: 'AGI', key: 'agility' },
  { label: 'END', key: 'endurance' },
  { label: 'INT', key: 'intelligence' },
  { label: 'STA', key: 'stamina' },
  { label: 'BAL', key: 'balance' },
  { label: 'BLD', key: 'boldness' },
  { label: 'FLX', key: 'flexibility' },
  { label: 'OBD', key: 'obedience' },
  { label: 'FCS', key: 'focus' },
];

function getStat(horse: HorseSummary, stat: keyof HorseSummary['stats']): number {
  return (horse[stat] as number | undefined) ?? horse.stats?.[stat] ?? 0;
}

interface HorseCardProps {
  horse: HorseSummary;
  onClick?: () => void;
  /** Hide the bottom care strip (e.g., when used in a horse picker modal). */
  hideCareStrip?: boolean;
  /** Hide the 12-stat grid (compact picker variant). */
  hideStats?: boolean;
  /** Selected/active state — gold accent border. */
  selected?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function HorseCard({
  horse,
  onClick,
  hideCareStrip = false,
  hideStats = false,
  selected = false,
  className,
  'data-testid': dataTestId = 'horse-card',
}: HorseCardProps) {
  const age = horse.ageYears ?? horse.age ?? 0;
  const sex = horse.sex ?? horse.gender ?? '';
  const isLegendary = !!(horse as unknown as Record<string, unknown>).isLegendary;
  const traits = horse.traits ?? (horse.trait ? [horse.trait] : []);
  const cooldown = trainingCooldownChip(horse.trainingCooldown);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={`View ${horse.name}`}
      data-testid={dataTestId}
      className={cn(
        'w-full text-left bg-[var(--glass-bg)] border rounded-[var(--radius-lg)] overflow-hidden',
        'transition-all duration-[250ms]',
        '[backdrop-filter:var(--glass-bg-filter)] shadow-[var(--shadow-card)]',
        onClick && [
          'hover:border-[var(--gold-primary)] hover:shadow-[var(--glow-gold-strong)] hover:-translate-y-1 hover:bg-[var(--glass-glow)]',
          'active:translate-y-0 active:shadow-[var(--glow-gold)] active:border-[var(--gold-primary)]',
          'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)]',
        ],
        selected
          ? 'border-[var(--gold-primary)] shadow-[var(--glow-gold)]'
          : isLegendary
            ? 'border-[var(--gold-dim)]'
            : 'border-[var(--glass-border)]',
        className
      )}
    >
      {/* Top: portrait + identity */}
      <div className="flex gap-3 p-3 pb-0">
        <div className="w-16 h-16 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0 relative bg-gradient-to-br from-[var(--bg-midnight)] to-[var(--bg-twilight)] overflow-hidden">
          <img
            src={getHorseImage(horse.imageUrl, horse.breed)}
            alt={horse.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/horse-placeholder.png';
            }}
          />
          {horse.level != null && (
            <span className="absolute -bottom-1 -right-1 bg-[var(--glass-glow)] border border-[var(--gold-dim)] rounded-[var(--radius-sm)] px-1.5 py-px text-[0.6rem] font-bold text-[var(--gold-light)]">
              {horse.level}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-base font-semibold text-[var(--text-primary)] truncate mb-0.5"
            style={{ fontFamily: 'var(--font-heading)' }}
            title={horse.name}
          >
            {horse.name}
          </p>
          <p className="text-xs text-[var(--text-secondary)] truncate">
            {getBreedName(horse.breed)}
          </p>
          <p className="text-[0.7rem] text-[var(--text-muted)] truncate">
            {[sex, age ? `${age} yrs` : null].filter(Boolean).join(' · ')}
          </p>
          {/* Equoria-92ss — phenotype coat color chip. Falls back to
              finalDisplayColor (legacy serializer field) and finally hides
              the chip entirely for legacy horses with no color recorded. */}
          {(() => {
            const colorName = horse.phenotype?.colorName ?? horse.finalDisplayColor ?? null;
            if (!colorName) return null;
            return (
              <span
                className="mt-1 inline-block px-2 py-0.5 rounded-[var(--radius-sm)] text-[0.6rem] font-medium bg-[var(--glass-glow)] text-[var(--gold-light)] truncate max-w-full"
                title={colorName}
                data-testid="horse-card-color-chip"
              >
                {colorName}
              </span>
            );
          })()}
        </div>
      </div>

      {/* Stats — compact 4×3 grid */}
      {!hideStats && (
        <div className="grid grid-cols-4 gap-x-3 gap-y-1 px-3 pt-3">
          {STAT_KEYS.map(({ label, key }) => (
            <div key={label} className="flex items-center justify-between min-w-0">
              <span className="text-[0.6rem] text-[var(--text-secondary)] uppercase tracking-wider font-medium">
                {label}
              </span>
              <span className="text-[0.75rem] font-semibold text-[var(--cream)] tabular-nums">
                {getStat(horse, key)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Trait chips */}
      {traits.length > 0 && (
        <div className="px-3 pt-2 pb-0 flex flex-wrap gap-1">
          {traits.map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[0.6rem] font-medium bg-[var(--glass-glow)] text-[var(--gold-light)]"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Care strip */}
      {!hideCareStrip && (
        <div className="flex gap-1 px-3 py-3 mt-2 border-t border-[var(--glass-border)] overflow-hidden">
          <CareChip label="Fed" status={careChipStatus(horse.lastFedDate, 1, 3)} />
          <CareChip label="Shod" status={careChipStatus(horse.lastShod, 7, 14)} />
          <CareChip label="Groomed" status={careChipStatus(horse.lastGroomed, 3, 7)} />
          <CareChip label="Vetted" status={careChipStatus(horse.lastVettedDate, 7, 14)} />
          <CareChip label={cooldown.label} status={cooldown.status} />
        </div>
      )}
    </button>
  );
}

export default HorseCard;
