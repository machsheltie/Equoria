/**
 * StaffPage — the people a player has already hired (Equoria-rdg0d, owner q69).
 *
 * Grooms, riders and trainers in one place, with the real weekly pay state.
 * Browsing and hiring stay under World (Groom Quarters, Rider Hall, Trainer
 * Academy); this page is for the staff a player already has.
 *
 * What the game actually does, read from the backend and not invented here:
 *  - Payday is the player's job (owner rulings 2026-10-28; q268, Equoria-hc96y): each
 *    groom and rider has a Pay button with the fee on it, pressed any time during the
 *    week. One click pays; the row updates in place, with no receipt or confirm step.
 *    The week ends Sunday midnight Eastern. A groom or rider left unpaid then cannot
 *    work or ride until paid, and leaves if the next week ends unpaid as well. Missed
 *    weeks are owed and are paid with the next press (GET /groom-salaries/pay-status,
 *    GET /riders/pay-status).
 *  - Trainers are paid per training session, when the player presses Train Horse, so
 *    they have no weekly pay state and none is shown. Leaving warnings are for unpaid
 *    grooms and riders, and only here.
 *
 * Composition: an open roll of names under three headings, separated by rules —
 * no cards, no stat tiles. Staff are fixed characters; no XP is shown.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertTriangle, CheckCircle2, UsersRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserGrooms } from '@/hooks/api/useGrooms';
import { useUserRiders } from '@/hooks/api/useRiders';
import { useUserTrainers } from '@/hooks/api/useTrainers';
import { useGroomPay, usePayGroom, usePayRider, useRiderPay } from '@/hooks/api/useStaffPay';
import type { StaffPayLine } from '@/lib/api/staffPay';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { ErrorState, InlineError, SectionLoading } from '@/components/ui/state';
import { groomSpecialtyLabel } from '@/lib/groomSpecialtyLabels';
import StaffLevelStars from '@/components/common/StaffLevelStars';
import { userMessageFor } from '@/lib/http/userMessage';
import { actionMessageFor } from '@/lib/http/actionMessage';

function coins(amount: number): string {
  return amount.toLocaleString();
}

const payRefusalCopy = {
  insufficientFunds: "Your balance doesn't cover this pay.",
  alreadyPaid: 'Already paid for this week.',
};

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
  line: React.ReactNode;
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
        <div className="text-sm text-[var(--text-secondary)]">{line}</div>
      </div>
      <div className="mt-2 text-sm sm:mt-0 sm:text-right">{side}</div>
      {note && <div className="mt-2 w-full sm:basis-full">{note}</div>}
    </li>
  );
}

/**
 * One groom's or rider's weekly pay: the fee on the button, one click, no receipt.
 * Disabled once this week is paid or while the balance is short; the fee still shows.
 */
function PayAction({
  label,
  line,
  onPay,
  pending,
  error,
  testId,
  unpaidLabel,
}: {
  label: string;
  line: StaffPayLine;
  onPay: () => void;
  pending: boolean;
  error: unknown;
  testId: string;
  unpaidLabel: string;
}) {
  return (
    <>
      <p className="text-[var(--text-secondary)]">{coins(line.weeklyFee)} coins a week</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-1"
        onClick={onPay}
        disabled={line.paidThisWeek || !line.canAfford}
        pending={pending}
        data-testid={testId}
      >
        {label} · {coins(line.amountDue)} coins
      </Button>
      {line.paidThisWeek ? (
        <p className="mt-1 flex items-center gap-1.5 text-[var(--status-success)] sm:justify-end">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Paid this week
        </p>
      ) : line.feeUnpaid ? (
        <p className="mt-1 flex items-center gap-1.5 font-semibold text-[var(--status-warning)] sm:justify-end">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {unpaidLabel}
        </p>
      ) : !line.canAfford ? (
        <p className="mt-1 text-[var(--text-secondary)]">Not enough coins</p>
      ) : null}
      {!line.paidThisWeek && line.amountDue > line.weeklyFee && (
        <p className="text-xs text-[var(--text-secondary)]">
          Includes {coins(line.amountDue - line.weeklyFee)} coins owed from earlier weeks
        </p>
      )}
      {error ? (
        <div className="mt-1">
          <InlineError message={actionMessageFor(error, {}, payRefusalCopy)} />
        </div>
      ) : null}
    </>
  );
}

const StaffPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id ?? '';

  const grooms = useUserGrooms(userId);
  const groomPay = useGroomPay(Boolean(userId));
  const riders = useUserRiders(userId);
  const riderPay = useRiderPay(Boolean(userId));
  const trainers = useUserTrainers(userId);
  const payGroom = usePayGroom();
  const payRider = usePayRider();

  const groomPayFor = (groomId: number) =>
    groomPay.data?.grooms.find((entry) => entry.groomId === groomId);
  const riderPayFor = (riderId: number) =>
    riderPay.data?.riders.find((entry) => entry.riderId === riderId);

  const leavingSoon = (grooms.data ?? []).filter((groom) => groomPayFor(groom.id)?.feeUnpaid);
  const ridersLeavingSoon = (riders.data ?? []).filter((rider) => Boolean(rider.feeUnpaidSince));

  const emptyRoll = (title: string, description: string, label: string, to: string) => (
    <EmptyState
      variant="first-use"
      title={title}
      description={description}
      secondaryAction={{ label, onClick: () => navigate(to) }}
    />
  );

  const payUnavailable = (pending: boolean) => (
    <p className="text-[var(--text-secondary)]">
      {pending ? 'Checking pay…' : 'Pay status unavailable'}
    </p>
  );

  return (
    <PageContainer variant="wide" padded={false} className="pb-8">
      <PageHeader
        title="Staff"
        subtitle="The grooms, riders and trainers who work for your stable"
        icon={<UsersRound className="h-6 w-6 text-[var(--gold-primary)]" aria-hidden="true" />}
      />

      {(leavingSoon.length > 0 || ridersLeavingSoon.length > 0) && (
        <div
          role="alert"
          data-testid="staff-leaving-warning"
          className="mt-6 flex gap-3 border-l-2 border-l-[var(--status-warning)] py-1 pl-4"
        >
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-warning)]"
            aria-hidden="true"
          />
          <div className="space-y-2 text-[var(--text-primary)]">
            {leavingSoon.length > 0 && (
              <p>
                <span className="font-semibold">
                  {leavingSoon.map((groom) => groom.name).join(', ')}
                </span>{' '}
                {leavingSoon.length === 1 ? 'was' : 'were'} not paid last week and cannot work until
                paid. {leavingSoon.length === 1 ? 'This groom leaves' : 'They leave'} your stable if
                this week ends unpaid too.
              </p>
            )}
            {ridersLeavingSoon.length > 0 && (
              <p>
                <span className="font-semibold">
                  {ridersLeavingSoon
                    .map((rider) => rider.name || `${rider.firstName} ${rider.lastName}`)
                    .join(', ')}
                </span>{' '}
                {ridersLeavingSoon.length === 1 ? 'was' : 'were'} not paid last week and cannot ride
                until paid. {ridersLeavingSoon.length === 1 ? 'This rider leaves' : 'They leave'}{' '}
                your stable if this week ends unpaid too.
              </p>
            )}
          </div>
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
              {groomPay.isError && (
                <ErrorState
                  title="Pay status unavailable"
                  message={userMessageFor(groomPay.error).message}
                  retry={{ label: 'Try Again', onClick: () => void groomPay.refetch() }}
                  focusOnMount={false}
                />
              )}
              <ul>
                {grooms.data.map((groom) => {
                  const pay = groomPayFor(groom.id);
                  return (
                    <Row
                      key={groom.id}
                      testId={`staff-groom-${groom.id}`}
                      name={groom.name}
                      line={
                        <>
                          <StaffLevelStars level={groom.starLevel} /> ·{' '}
                          {groomSpecialtyLabel(groom.specialty)}
                        </>
                      }
                      side={
                        pay ? (
                          <PayAction
                            label="Pay Groom"
                            line={pay}
                            onPay={() => payGroom.mutate(groom.id)}
                            pending={payGroom.isPending && payGroom.variables === groom.id}
                            error={payGroom.variables === groom.id ? payGroom.error : null}
                            testId={`pay-groom-${groom.id}`}
                            unpaidLabel="Not paid — not working until paid"
                          />
                        ) : (
                          payUnavailable(groomPay.isPending)
                        )
                      }
                      note={
                        pay?.feeUnpaid ? (
                          <p className="text-sm text-[var(--status-warning)]">
                            {groom.name} leaves if this week ends unpaid as well.
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
            <>
              {riderPay.isError && (
                <ErrorState
                  title="Pay status unavailable"
                  message={userMessageFor(riderPay.error).message}
                  retry={{ label: 'Try Again', onClick: () => void riderPay.refetch() }}
                  focusOnMount={false}
                />
              )}
              <ul>
                {riders.data.map((rider) => {
                  const pay = riderPayFor(rider.id);
                  return (
                    <Row
                      key={rider.id}
                      testId={`staff-rider-${rider.id}`}
                      name={rider.name || `${rider.firstName} ${rider.lastName}`}
                      line={<StaffLevelStars level={rider.starLevel} />}
                      side={
                        pay ? (
                          <PayAction
                            label="Pay Rider"
                            line={pay}
                            onPay={() => payRider.mutate(rider.id)}
                            pending={payRider.isPending && payRider.variables === rider.id}
                            error={payRider.variables === rider.id ? payRider.error : null}
                            testId={`pay-rider-${rider.id}`}
                            unpaidLabel="Not paid — not riding until paid"
                          />
                        ) : (
                          payUnavailable(riderPay.isPending)
                        )
                      }
                      note={
                        rider.feeUnpaidSince ? (
                          <p className="text-sm text-[var(--status-warning)]">
                            {rider.firstName} leaves if this week ends unpaid as well.
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
                  line={<StaffLevelStars level={trainer.starLevel} />}
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
