/**
 * OverviewTab — current-status grid + trait chips.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 */

import React from 'react';
import { formatDate } from '@/lib/formatDate';
import { gameDayIndex } from '@/lib/gameTime';
import { Surface } from '@/components/ui/Surface';
import HorseTrainerPanel from './HorseTrainerPanel';
import { InlineError } from '@/components/ui/state';
import { HealthLevelBar } from '@/components/horse/HealthLevelBar';
import { useHorseCareStatus } from '@/hooks/api/useHorseCareStatus';
import { userMessageFor } from '@/lib/http/userMessage';
import type { Horse } from './HorseDetailPageTypes';

type Glow = 'ready' | 'overdue' | null;

/** One Current Status date line. The glow is colour plus a text note, never colour alone. */
const CareDateLine: React.FC<{
  label: string;
  date: string | null | undefined;
  glow: Glow;
  testId: string;
}> = ({ label, date, glow, testId }) => (
  <Surface variant="subtle" className="p-4">
    <p className="fantasy-caption text-[var(--text-secondary)] mb-1">{label}</p>
    <p
      className="fantasy-body text-[var(--text-primary)]"
      data-testid={testId}
      data-glow={glow ?? 'none'}
      style={
        glow === 'ready'
          ? { color: 'var(--health-excellent)', textShadow: 'var(--glow-text-ready)' }
          : glow === 'overdue'
            ? { color: 'var(--health-bad)', textShadow: 'var(--glow-text-danger)' }
            : undefined
      }
    >
      {formatDate(date, { month: 'long', day: 'numeric', year: 'numeric' }, 'Never')}
      {glow === 'ready' && <span className="sr-only"> (ready now)</span>}
      {glow === 'overdue' && <span className="sr-only"> (more than a week ago)</span>}
    </p>
  </Surface>
);

/** Shod more than a week ago, or never: the farrier is overdue. */
const isShoeOverdue = (lastShod: string | null | undefined): boolean =>
  !lastShod || gameDayIndex(new Date()) - gameDayIndex(lastShod) > 7;

const OverviewTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const careStatus = useHorseCareStatus(Number(horse.id));
  const care = careStatus.data;

  return (
    <div className="space-y-6" data-testid="horse-detail-overview">
      <div>
        <h3 className="type-section-heading mb-3">Current Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <HorseTrainerPanel horseId={horse.id} />
          <Surface variant="subtle" className="p-4">
            <HealthLevelBar
              title="Health Status"
              level={horse.displayedHealth}
              testId="health-status-bar"
            />
          </Surface>
          <Surface variant="subtle" className="p-4">
            <HealthLevelBar
              title="Hunger Status"
              level={horse.feedHealth}
              testId="hunger-status-bar"
            />
          </Surface>
          <Surface variant="subtle" className="p-4">
            <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Age</p>
            <p className="fantasy-body text-[var(--text-primary)]">{horse.age} years old</p>
          </Surface>
          <Surface variant="subtle" className="p-4">
            <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Date of Birth</p>
            <p className="fantasy-body text-[var(--text-primary)]">
              {formatDate(
                horse.dateOfBirth,
                { month: 'long', day: 'numeric', year: 'numeric' },
                'Not recorded'
              )}
            </p>
          </Surface>
          <Surface variant="subtle" className="p-4">
            <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Gender</p>
            <p className="fantasy-body text-[var(--text-primary)] capitalize">{horse.gender}</p>
          </Surface>
          {care && (
            <>
              <CareDateLine
                label="Last Shod"
                date={care.lastShod}
                glow={isShoeOverdue(care.lastShod) ? 'overdue' : null}
                testId="last-shod"
              />
              <CareDateLine
                label="Last Trained"
                date={care.lastTrainedAt}
                glow={care.canTrainNow ? 'ready' : null}
                testId="last-trained"
              />
              <CareDateLine
                label="Last Groomed"
                date={care.lastGroomed}
                glow={care.canGroomToday ? 'ready' : null}
                testId="last-groomed"
              />
            </>
          )}
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
      </div>

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
