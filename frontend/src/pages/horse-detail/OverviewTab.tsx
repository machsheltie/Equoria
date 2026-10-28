/**
 * OverviewTab — Horse Details ledger + trait chips.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 *
 * Horse Details (Equoria-0l0tq; owner rulings q71 2026-10-26): Health and
 * Hunger bars and the Bond beside a care record of age, birth, sex and the Last
 * Shod / Last Trained / Last Groomed dates. Owner request 2026-10-28
 * (Equoria-2w4yo): the section is titled "Horse Details" and, since the line
 * under the horse's name is gone, carries Color, Breed (provisional, q206),
 * Markings and Temperament directly below Gender — the same values the line
 * showed: colour from the visible phenotype, never the hidden genotype. A ledger, not a wall of tiles
 * (PRODUCT.md structural anti-SaaS rules). Bond shows at every age; there is no
 * stress. The age reads in days while a horse is under 3 (Equoria-q4uzh).
 *
 * Care Team (owner request 2026-10-28, Equoria-a6t0u): the assigned trainer
 * that sat at the foot of Horse Details is now its own Care Team section with
 * the assigned trainer, groom and rider (CareTeamSection).
 *
 * The show record moved under the horse's name (owner ruling q225, 2026-10-28;
 * ShowRecordLine in HorseProfileCard). Breed sits above Age (q206) and the
 * Color row carries the coat's shade, "Bay — Dark" (q214).
 */

import React from 'react';
import { formatDate } from '@/lib/formatDate';
import { gameDayIndex } from '@/lib/gameTime';
import { horseAgeWords } from '@/lib/horseAgeWords';
import CareTeamSection from './CareTeamSection';
import { InlineError } from '@/components/ui/state';
import { HealthLevelBar } from '@/components/horse/HealthLevelBar';
import { useHorseCareStatus } from '@/hooks/api/useHorseCareStatus';
import { userMessageFor } from '@/lib/http/userMessage';
import { getBreedName } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import MarkingsPanel from '@/components/horse/MarkingsPanel';
import type { Horse } from './HorseDetailPageTypes';
import '@/styles/horseCare.css';

type Glow = 'ready' | 'overdue' | null;

/** One ledger row. */
const LedgerRow: React.FC<{ label: string; children: React.ReactNode; testId?: string }> = ({
  label,
  children,
  testId,
}) => (
  <div className="horse-status__row">
    <dt>{label}</dt>
    <dd data-testid={testId}>{children}</dd>
  </div>
);

/** One care-date row. The glow is colour plus a text note, never colour alone. */
const CareDateRow: React.FC<{
  label: string;
  date: string | null | undefined;
  glow: Glow;
  testId: string;
}> = ({ label, date, glow, testId }) => (
  <div className="horse-status__row">
    <dt>{label}</dt>
    <dd data-testid={testId} data-glow={glow ?? 'none'}>
      {formatDate(date, { month: 'long', day: 'numeric', year: 'numeric' }, 'Never')}
      {glow === 'ready' && <span className="sr-only"> (ready now)</span>}
      {glow === 'overdue' && <span className="sr-only"> (more than a week ago)</span>}
    </dd>
  </div>
);

/** "Bay — Dark": the visible colour and its shade (owner ruling q214). */
function colorWithShade(phenotype: Horse['phenotype']): string {
  const colorName = phenotype?.colorName;
  if (!colorName) return 'not recorded';
  const shade = typeof phenotype?.shade === 'string' ? phenotype.shade.trim() : '';
  if (!shade) return colorName;
  const shadeWords = shade.replace(/\b\w/g, (letter) => letter.toUpperCase());
  return `${colorName} — ${shadeWords}`;
}

/** Shod more than a week ago, or never: the farrier is overdue. */
const isShoeOverdue = (lastShod: string | null | undefined): boolean =>
  !lastShod || gameDayIndex(new Date()) - gameDayIndex(lastShod) > 7;

const OverviewTab: React.FC<{
  horse: Horse;
  onOpenTemperamentReference?: () => void;
  onAssignRider?: () => void;
}> = ({ horse, onOpenTemperamentReference, onAssignRider }) => {
  const careStatus = useHorseCareStatus(Number(horse.id));
  const care = careStatus.data;

  return (
    <div className="space-y-6" data-testid="horse-detail-overview">
      <section className="horse-status" aria-labelledby="horse-status-heading">
        <h3 id="horse-status-heading" className="type-section-heading mb-3">
          Horse Details
        </h3>
        <div className="horse-status__body">
          <div className="horse-status__condition">
            <HealthLevelBar
              title="Health Status"
              level={horse.displayedHealth}
              testId="health-status-bar"
            />
            <HealthLevelBar
              title="Hunger Status"
              level={horse.feedHealth}
              testId="hunger-status-bar"
            />
            {typeof horse.bondScore === 'number' && (
              <div data-testid="horse-bond">
                <div className="horse-status__bond-head">
                  <p className="fantasy-caption text-[var(--text-secondary)]">Bond</p>
                  <p className="fantasy-body text-[var(--text-primary)] tabular-nums">
                    {horse.bondScore}
                  </p>
                </div>
                <div
                  className="horse-status__bond-track"
                  role="meter"
                  aria-label="Bond"
                  aria-valuenow={horse.bondScore}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="horse-status__bond-fill"
                    style={{
                      transform: `scaleX(${Math.min(100, Math.max(0, horse.bondScore)) / 100})`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <dl className="horse-status__record">
            <LedgerRow label="Breed" testId="horse-detail-breed">
              {getBreedName(horse.breed)}
            </LedgerRow>
            <LedgerRow label="Age" testId="horse-age">
              {horseAgeWords(horse.age, horse.dateOfBirth)}
            </LedgerRow>
            <LedgerRow label="Date of Birth">
              {formatDate(
                horse.dateOfBirth,
                { month: 'long', day: 'numeric', year: 'numeric' },
                'Not recorded'
              )}
            </LedgerRow>
            <LedgerRow label="Gender">
              <span className="capitalize">{horse.gender}</span>
            </LedgerRow>
            {/* Equoria-lsi5 + Equoria-iwy3 — phenotype.colorName is the visible
                colour. Legacy horses (phenotype: null) never read 'Unknown';
                'not recorded' is the honest fallback. */}
            <LedgerRow label="Color" testId="horse-detail-color">
              {colorWithShade(horse.phenotype)}
            </LedgerRow>
            <LedgerRow label="Markings" testId="horse-detail-markings">
              <MarkingsPanel markings={horse.markings} inline />
            </LedgerRow>
            {/* Equoria-8k7k + Equoria-876o — temperament with the reference
                trigger; Equoria-1k4n — 'not recorded' for legacy horses. */}
            <LedgerRow label="Temperament" testId="horse-temperament-line">
              <span data-testid="horse-temperament-value">
                {horse.temperament ?? 'not recorded'}
              </span>
              {onOpenTemperamentReference && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={onOpenTemperamentReference}
                  className="text-xs h-auto p-0 ml-2"
                  data-testid="temperament-reference-open"
                  aria-label="Open temperament reference"
                >
                  Learn more
                </Button>
              )}
            </LedgerRow>
            {care && (
              <>
                <CareDateRow
                  label="Last Shod"
                  date={care.lastShod}
                  glow={isShoeOverdue(care.lastShod) ? 'overdue' : null}
                  testId="last-shod"
                />
                <CareDateRow
                  label="Last Trained"
                  date={care.lastTrainedAt}
                  glow={care.canTrainNow ? 'ready' : null}
                  testId="last-trained"
                />
                <CareDateRow
                  label="Last Groomed"
                  date={care.lastGroomed}
                  glow={care.canGroomToday ? 'ready' : null}
                  testId="last-groomed"
                />
              </>
            )}
          </dl>
        </div>
        {careStatus.isPending && (
          <p className="fantasy-caption text-[var(--text-muted)] mt-3" role="status">
            Loading shoeing, training and grooming dates…
          </p>
        )}
        {careStatus.isError && (
          <div className="mt-3 flex items-center gap-3" data-testid="care-status-error">
            <InlineError message={userMessageFor(careStatus.error).message} />
            <button
              type="button"
              className="fantasy-caption underline text-[var(--text-secondary)]"
              onClick={() => careStatus.refetch()}
            >
              Try Again
            </button>
          </div>
        )}
      </section>

      <CareTeamSection horseId={Number(horse.id)} onAssignRider={onAssignRider} />

      {horse.traits && horse.traits.length > 0 && (
        <div>
          <h3 className="type-section-heading mb-3">Traits</h3>
          <div className="flex flex-wrap gap-2">
            {horse.traits.map((trait, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-[var(--alpha-gold-primary-20)] text-[var(--text-primary)] rounded-full text-sm fantasy-body border border-[var(--alpha-gold-primary-40)]"
              >
                {trait}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;
