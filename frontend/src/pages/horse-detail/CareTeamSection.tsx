/**
 * CareTeamSection: the horse's Care Team on the horse page (owner request
 * 2026-10-28, Equoria-a6t0u). The section that showed the assigned trainer is
 * now "Care Team", a ledger of three lines: Assigned Trainer, Assigned Groom
 * and Assigned Rider, shown at every age (owner, 2026-10-28; visitor view is
 * separate and unchanged, q205).
 *
 * Each line reads data the game already serves elsewhere: the trainer from the
 * trainer assignments (the same read the train button uses), the groom from the
 * horse's daily care status (the same read as the Care area), and the rider
 * from the rider assignments. Each line keeps its own loading and error state,
 * so one failed read never blanks the others. With nobody assigned, a line
 * offers the same assign step the action bar does.
 *
 * Owner ruling 2026-10-28 (Equoria-67yn9, supersedes q217): Last Trained sits
 * on the Assigned Trainer line and Last Groomed on the Assigned Groom line;
 * they left Horse Details, so each date shows in one place only. The date
 * glows when the server says the horse can be trained / groomed now, with a
 * text note, never color alone.
 */

import React from 'react';
import { Link } from 'react-router';
import Currency from '@/components/ui/Currency';
import { InlineError } from '@/components/ui/state';
import TrainerPersonalityBadge from '@/components/trainer/TrainerPersonalityBadge';
import StaffLevelStars from '@/components/common/StaffLevelStars';
import { isStaffLevel } from '@/lib/staffLevels';
import { useHorseTrainer } from '@/hooks/api/useTrainers';
import { useCareStatus } from '@/hooks/api/useGroomCare';
import { useRiderAssignments } from '@/hooks/api/useRiders';
import { userMessageFor } from '@/lib/http/userMessage';
import { formatDate } from '@/lib/formatDate';
import type { HorseCareStatus } from '@/lib/api/horseCareStatus';
import '@/styles/horseCare.css';

/** "Last Trained: May 3, 2026" under a staff line; glows when ready now. */
const CareDate: React.FC<{
  label: string;
  date: string | null;
  ready: boolean | null;
  testId: string;
}> = ({ label, date, ready, testId }) => (
  <span
    className="horse-status__care-date"
    data-testid={testId}
    data-glow={ready === true ? 'ready' : 'none'}
  >
    {label}: {formatDate(date, { month: 'long', day: 'numeric', year: 'numeric' }, 'Never')}
    {ready === true && <span className="sr-only"> (ready now)</span>}
  </span>
);

/** One Care Team line: loading, then error with Try Again, then the content. */
const StaffRow: React.FC<{
  label: string;
  testId: string;
  isPending: boolean;
  error: unknown;
  loadingText: string;
  onRetry: () => void;
  children: React.ReactNode;
  /** Shown whatever this line's own read is doing (the care date). */
  after?: React.ReactNode;
}> = ({ label, testId, isPending, error, loadingText, onRetry, children, after }) => (
  <div className="horse-status__row">
    <dt>{label}</dt>
    <dd data-testid={testId}>
      {isPending ? (
        <span className="text-[var(--text-muted)]" role="status">
          {loadingText}
        </span>
      ) : error ? (
        <span className="inline-flex flex-wrap items-center justify-end gap-3">
          <InlineError message={userMessageFor(error).message} />
          <button
            type="button"
            className="fantasy-caption underline text-[var(--text-secondary)]"
            onClick={onRetry}
          >
            Try Again
          </button>
        </span>
      ) : (
        children
      )}
      {after}
    </dd>
  </div>
);

const assignLinkClass = 'text-[var(--gold-400)] hover:underline';

type VisitCareTeam = Record<
  'trainer' | 'groom' | 'rider',
  { name: string; starLevel: string } | null
>;

const visitorRoles = [
  { key: 'trainer', label: 'Assigned Trainer', none: 'No trainer assigned.' },
  { key: 'groom', label: 'Assigned Groom', none: 'No groom assigned.' },
  { key: 'rider', label: 'Assigned Rider', none: 'No rider assigned.' },
] as const;

/**
 * The Care Team on a visitor's page (q205): the same three lines, read from
 * the visit, with no assign links.
 */
export const VisitorCareTeam: React.FC<{ careTeam: VisitCareTeam | null }> = ({ careTeam }) => (
  <section className="horse-status" aria-labelledby="care-team-heading" data-testid="care-team">
    <h3 id="care-team-heading" className="type-section-heading mb-3">
      Care Team
    </h3>
    <dl className="horse-status__record">
      {visitorRoles.map((role) => {
        const member = careTeam?.[role.key] ?? null;
        return (
          <div key={role.key} className="horse-status__row">
            <dt>{role.label}</dt>
            <dd data-testid={`care-team-${role.key}`}>
              {member ? (
                <span>
                  {member.name}{' '}
                  {isStaffLevel(member.starLevel) && <StaffLevelStars level={member.starLevel} />}
                </span>
              ) : (
                <span className="text-[var(--text-secondary)]">{role.none}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  </section>
);

const CareTeamSection: React.FC<{
  horseId: number;
  onAssignRider?: () => void;
  /** The horse's care dates (Horse Details' read); absent while loading or failed. */
  careDates?: HorseCareStatus;
}> = ({ horseId, onAssignRider, careDates }) => {
  const trainer = useHorseTrainer(horseId);
  const care = useCareStatus(horseId);
  const riderAssignments = useRiderAssignments();

  const groom = care.data?.groom ?? null;
  // The same guard useHorseTrainer applies to its assignment list: a body that
  // is not a list names no rider rather than breaking the page.
  const riderRows = Array.isArray(riderAssignments.data) ? riderAssignments.data : [];
  const riderAssignment =
    riderRows.find((a) => a.isActive && Number(a.horseId) === horseId) ?? null;

  return (
    <section className="horse-status" aria-labelledby="care-team-heading" data-testid="care-team">
      <h3 id="care-team-heading" className="type-section-heading mb-3">
        Care Team
      </h3>
      <dl className="horse-status__record">
        <StaffRow
          label="Assigned Trainer"
          testId="care-team-trainer"
          isPending={trainer.isLoading}
          error={trainer.isError ? trainer.error : null}
          loadingText="Loading trainer…"
          onRetry={() => trainer.refetch()}
          after={
            careDates && (
              <CareDate
                label="Last Trained"
                date={careDates.lastTrainedAt}
                ready={careDates.canTrainNow}
                testId="last-trained"
              />
            )
          }
        >
          {trainer.assignment ? (
            <span className="inline-flex flex-wrap items-center justify-end gap-3">
              <Link
                to={`/trainers/${trainer.assignment.trainerId}`}
                className="text-[var(--text-primary)] hover:underline"
                data-testid="care-team-trainer-link"
              >
                {trainer.assignment.trainerName}
              </Link>
              {isStaffLevel(trainer.assignment.trainerStarLevel) && (
                <StaffLevelStars level={trainer.assignment.trainerStarLevel} />
              )}
              <TrainerPersonalityBadge
                personality={trainer.assignment.trainerPersonality}
                size="sm"
              />
              <span className="text-sm text-[var(--text-secondary)]">
                <Currency amount={trainer.fee} /> per session
              </span>
            </span>
          ) : (
            <span className="text-[var(--text-secondary)]">
              No trainer assigned.{' '}
              <Link to={`/trainers?horseId=${horseId}`} className={assignLinkClass}>
                Assign Trainer
              </Link>
            </span>
          )}
        </StaffRow>

        <StaffRow
          label="Assigned Groom"
          testId="care-team-groom"
          isPending={care.isPending}
          error={care.isError ? care.error : null}
          loadingText="Loading groom…"
          onRetry={() => care.refetch()}
          after={
            careDates && (
              <CareDate
                label="Last Groomed"
                date={careDates.lastGroomed}
                ready={careDates.canGroomToday}
                testId="last-groomed"
              />
            )
          }
        >
          {groom ? (
            <span>
              {groom.name}{' '}
              {isStaffLevel(groom.starLevel) && <StaffLevelStars level={groom.starLevel} />}
            </span>
          ) : (
            <span className="text-[var(--text-secondary)]">
              No groom assigned.{' '}
              <Link to={`/grooms?horseId=${horseId}`} className={assignLinkClass}>
                Assign Groom
              </Link>
            </span>
          )}
        </StaffRow>

        <StaffRow
          label="Assigned Rider"
          testId="care-team-rider"
          isPending={riderAssignments.isPending}
          error={riderAssignments.isError ? riderAssignments.error : null}
          loadingText="Loading rider…"
          onRetry={() => riderAssignments.refetch()}
        >
          {riderAssignment ? (
            <span>
              {riderAssignment.riderName ?? '—'}{' '}
              {isStaffLevel(riderAssignment.riderStarLevel) && (
                <StaffLevelStars level={riderAssignment.riderStarLevel} />
              )}
            </span>
          ) : (
            <span className="text-[var(--text-secondary)]">
              No rider assigned.{' '}
              {onAssignRider ? (
                <button type="button" className={assignLinkClass} onClick={onAssignRider}>
                  Assign Rider
                </button>
              ) : (
                <Link to="/riders" className={assignLinkClass}>
                  Assign Rider
                </Link>
              )}
            </span>
          )}
        </StaffRow>
      </dl>
    </section>
  );
};

export default CareTeamSection;
