/**
 * StaffPage — the people a player has already hired (Equoria-rdg0d, owner q69).
 *
 * Grooms, riders and trainers in one place, with the real weekly pay state.
 * Browsing and hiring stay under World (Groom Quarters, Rider Hall, Trainer
 * Academy); this page is for the staff a player already has.
 *
 * What the game actually does, read from the backend and not invented here:
 *  - A groom is paid every Monday morning. When the fee cannot be taken the groom
 *    cannot work that week, and leaves if the next payday is missed as well
 *    (groomFeeArrearsService / groomEngagementService). The weekly fee comes from
 *    GET /groom-salaries/cost, whose breakdown says which grooms are unpaid.
 *  - Riders are charged one week when hired and trainers a fee per training
 *    session. Neither has a weekly pay run, so there is no paid/unpaid state to
 *    show for them and none is made up. Only unpaid grooms can be about to leave
 *    for lack of pay, so leaving warnings appear for grooms alone, and only here.
 *
 * Composition: an open roll of names under three headings, separated by rules —
 * no cards, no stat tiles. Staff are fixed characters; no XP is shown.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertTriangle, CheckCircle2, UsersRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserGrooms, useGroomSalaries } from '@/hooks/api/useGrooms';
import { useUserRiders } from '@/hooks/api/useRiders';
import { useUserTrainers } from '@/hooks/api/useTrainers';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, SectionLoading } from '@/components/ui/state';
import { groomSpecialtyLabel } from '@/lib/groomSpecialtyLabels';
import { userMessageFor } from '@/lib/http/userMessage';

function capitalise(word: string | undefined): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function coins(amount: number): string {
  return amount.toLocaleString();
}

interface RollProps {
  heading: string;
  headingId: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

function Roll({ heading, headingId, children, footer }: RollProps) {
  return (
    <section aria-labelledby={headingId} className="mt-10 first:mt-0">
      <h2
        id={headingId}
        className="text-2xl text-[var(--gold-light)]"
        style={{ fontFamily: 'var(--font-entity)' }}
      >
        {heading}
      </h2>
      <div className="mt-1 h-px bg-gradient-to-r from-[var(--gold-primary)] via-[var(--gold-dim)]/40 to-transparent" />
      <div className="mt-2">{children}</div>
      <p className="mt-3 text-sm">{footer}</p>
    </section>
  );
}

function Row({
  name,
  line,
  side,
  note,
  testId,
}: {
  name: string;
  line: string;
  side: React.ReactNode;
  note?: React.ReactNode;
  testId: string;
}) {
  return (
    <li
      data-testid={testId}
      className="border-b border-[var(--glass-border)] py-4 last:border-b-0 sm:flex sm:items-start sm:justify-between sm:gap-6"
    >
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-[var(--text-primary)]">{name}</p>
        <p className="text-sm text-[var(--text-secondary)]">{line}</p>
      </div>
      <div className="mt-2 text-sm sm:mt-0 sm:text-right">{side}</div>
      {note && <div className="mt-2 w-full sm:basis-full">{note}</div>}
    </li>
  );
}

const StaffPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id ?? '';

  const grooms = useUserGrooms(userId);
  const salaries = useGroomSalaries();
  const riders = useUserRiders(userId);
  const trainers = useUserTrainers(userId);

  const unpaidFor = (groomId: number) =>
    salaries.data?.breakdown.find((entry) => entry.groomId === groomId);

  const leavingSoon = (grooms.data ?? []).filter((groom) => unpaidFor(groom.id)?.feeUnpaid);

  const emptyRoll = (title: string, description: string, label: string, to: string) => (
    <EmptyState
      variant="first-use"
      title={title}
      description={description}
      secondaryAction={{ label, onClick: () => navigate(to) }}
    />
  );

  return (
    <PageContainer variant="wide" padded={false} className="pb-8">
      <PageHeader
        title="Staff"
        subtitle="The grooms, riders and trainers who work for your stable"
        icon={<UsersRound className="h-6 w-6 text-[var(--gold-primary)]" aria-hidden="true" />}
      />

      {leavingSoon.length > 0 && (
        <div
          role="alert"
          data-testid="staff-leaving-warning"
          className="mt-6 flex gap-3 border-l-2 border-l-[var(--status-warning)] py-1 pl-4"
        >
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-warning)]"
            aria-hidden="true"
          />
          <p className="text-[var(--text-primary)]">
            <span className="font-semibold">
              {leavingSoon.map((groom) => groom.name).join(', ')}
            </span>{' '}
            {leavingSoon.length === 1 ? 'has' : 'have'} not been paid and cannot work this week.{' '}
            {leavingSoon.length === 1 ? 'This groom leaves' : 'They leave'} your stable if the next
            payday, Monday morning, is missed too.
          </p>
        </div>
      )}

      <div className="mt-8">
        <Roll
          heading="Grooms"
          headingId="staff-grooms"
          footer={
            <Link
              to="/grooms"
              className="text-[var(--link-gold)] underline-offset-2 hover:underline"
            >
              Open Groom Quarters to assign or hire grooms
            </Link>
          }
        >
          {grooms.isPending ? (
            <SectionLoading label="Loading your grooms" />
          ) : grooms.isError ? (
            <ErrorState
              message={userMessageFor(grooms.error).message}
              retry={{ label: 'Try Again', onClick: () => void grooms.refetch() }}
              focusOnMount={false}
            />
          ) : grooms.data.length === 0 ? (
            emptyRoll(
              'No grooms yet',
              'Hire a groom to keep your horses cared for.',
              'Visit Groom Quarters',
              '/grooms'
            )
          ) : (
            <>
              {salaries.isError && (
                <ErrorState
                  title="Pay status unavailable"
                  message={userMessageFor(salaries.error).message}
                  retry={{ label: 'Try Again', onClick: () => void salaries.refetch() }}
                  focusOnMount={false}
                />
              )}
              <ul>
                {grooms.data.map((groom) => {
                  const pay = unpaidFor(groom.id);
                  const unpaid = pay?.feeUnpaid === true;
                  return (
                    <Row
                      key={groom.id}
                      testId={`staff-groom-${groom.id}`}
                      name={groom.name}
                      line={`${capitalise(groom.skillLevel)} · ${groomSpecialtyLabel(groom.specialty)}`}
                      side={
                        pay ? (
                          <>
                            <p className="text-[var(--text-secondary)]">
                              {coins(pay.weeklyFee)} coins a week
                            </p>
                            {unpaid ? (
                              <p className="inline-flex items-center gap-1.5 font-semibold text-[var(--status-warning)]">
                                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                                Not paid — not working this week
                              </p>
                            ) : (
                              <p className="inline-flex items-center gap-1.5 text-[var(--status-success)]">
                                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                Paid this week
                              </p>
                            )}
                          </>
                        ) : salaries.isPending ? (
                          <p className="text-[var(--text-secondary)]">Checking pay…</p>
                        ) : (
                          <p className="text-[var(--text-secondary)]">Pay status unavailable</p>
                        )
                      }
                      note={
                        unpaid ? (
                          <p className="text-sm text-[var(--status-warning)]">
                            {groom.name} leaves if the next payday is missed as well.
                          </p>
                        ) : undefined
                      }
                    />
                  );
                })}
              </ul>
            </>
          )}
        </Roll>

        <Roll
          heading="Riders"
          headingId="staff-riders"
          footer={
            <Link
              to="/riders"
              className="text-[var(--link-gold)] underline-offset-2 hover:underline"
            >
              Open the Rider Hall to assign or hire riders
            </Link>
          }
        >
          {riders.isPending ? (
            <SectionLoading label="Loading your riders" />
          ) : riders.isError ? (
            <ErrorState
              message={userMessageFor(riders.error).message}
              retry={{ label: 'Try Again', onClick: () => void riders.refetch() }}
              focusOnMount={false}
            />
          ) : riders.data.length === 0 ? (
            emptyRoll(
              'No riders yet',
              'Hire a rider to put in the saddle at your shows.',
              'Visit the Rider Hall',
              '/riders'
            )
          ) : (
            <ul>
              {riders.data.map((rider) => (
                <Row
                  key={rider.id}
                  testId={`staff-rider-${rider.id}`}
                  name={rider.name || `${rider.firstName} ${rider.lastName}`}
                  line={capitalise(rider.skillLevel)}
                  side={
                    <p className="text-[var(--text-secondary)]">
                      {coins(rider.weeklyRate)} coins for a week&rsquo;s hire
                    </p>
                  }
                />
              ))}
            </ul>
          )}
        </Roll>

        <Roll
          heading="Trainers"
          headingId="staff-trainers"
          footer={
            <Link
              to="/trainers"
              className="text-[var(--link-gold)] underline-offset-2 hover:underline"
            >
              Open the Trainer Academy to assign or hire trainers
            </Link>
          }
        >
          {trainers.isPending ? (
            <SectionLoading label="Loading your trainers" />
          ) : trainers.isError ? (
            <ErrorState
              message={userMessageFor(trainers.error).message}
              retry={{ label: 'Try Again', onClick: () => void trainers.refetch() }}
              focusOnMount={false}
            />
          ) : trainers.data.length === 0 ? (
            emptyRoll(
              'No trainers yet',
              'Hire a trainer to bring your horses along.',
              'Visit the Trainer Academy',
              '/trainers'
            )
          ) : (
            <ul>
              {trainers.data.map((trainer) => (
                <Row
                  key={trainer.id}
                  testId={`staff-trainer-${trainer.id}`}
                  name={trainer.name || `${trainer.firstName} ${trainer.lastName}`}
                  line={capitalise(trainer.skillLevel)}
                  side={
                    <p className="text-[var(--text-secondary)]">
                      {coins(trainer.sessionRate)} coins a session
                    </p>
                  }
                />
              ))}
            </ul>
          )}
        </Roll>
      </div>
    </PageContainer>
  );
};

export default StaffPage;
