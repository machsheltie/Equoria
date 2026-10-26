/**
 * OverviewTab — Current Status ledger + trait chips.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 *
 * Current Status (Equoria-0l0tq; owner rulings q71 2026-10-26): Health and
 * Hunger bars and the Bond beside a care record of age, birth, sex and the Last
 * Shod / Last Trained / Last Groomed dates. A ledger, not a wall of tiles
 * (PRODUCT.md structural anti-SaaS rules). Bond shows at every age; there is no
 * stress. The age reads in days while a horse is under 3 (Equoria-q4uzh).
 */

import React from 'react';
import { formatDate } from '@/lib/formatDate';
import { gameDayIndex } from '@/lib/gameTime';
import { horseAgeWords } from '@/lib/horseAgeWords';
import HorseTrainerPanel from './HorseTrainerPanel';
import { InlineError } from '@/components/ui/state';
import { HealthLevelBar } from '@/components/horse/HealthLevelBar';
import { useHorseCareStatus } from '@/hooks/api/useHorseCareStatus';
import { userMessageFor } from '@/lib/http/userMessage';
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

/** Shod more than a week ago, or never: the farrier is overdue. */
const isShoeOverdue = (lastShod: string | null | undefined): boolean =>
  !lastShod || gameDayIndex(new Date()) - gameDayIndex(lastShod) > 7;

const OverviewTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const careStatus = useHorseCareStatus(Number(horse.id));
  const care = careStatus.data;

  return (
    <div className="space-y-6" data-testid="horse-detail-overview">
      <section className="horse-status" aria-labelledby="horse-status-heading">
        <h3 id="horse-status-heading" className="type-section-heading mb-3">
          Current Status
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
        <div className="horse-status__trainer">
          <HorseTrainerPanel horseId={horse.id} />
        </div>
      </section>

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
