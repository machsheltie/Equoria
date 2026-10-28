/**
 * TrainerPage — one trainer, reached by clicking the trainer wherever it is listed
 * (Equoria-r8a6h, owner ruling q82 2026-10-26).
 *
 * Two routes share it: /trainers/:trainerId for a trainer the player has hired, and
 * /trainers/offers/:marketplaceId for a candidate on the marketplace. It shows the
 * trainer's skill level, personality, speciality and per-session fee, and the
 * "Assign Trainer" action: for a candidate that hires and assigns in one step
 * (Equoria-1poxi); for a hired trainer it assigns to a horse. Trainer fit stays
 * "Coming soon", and trainers have no XP (they are fixed staff, owner ruling 2026-10-21).
 */

import React, { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { GraduationCap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHorses } from '@/hooks/api/useHorses';
import {
  useAssignTrainer,
  useHireTrainer,
  useTrainerMarketplace,
  useUserTrainers,
} from '@/hooks/api/useTrainers';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import Currency from '@/components/ui/Currency';
import EmptyState from '@/components/ui/EmptyState';
import { SectionLoading, ErrorState, InlineError } from '@/components/ui/state';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';
import TrainerPersonalityBadge, {
  getTrainerPersonalityInfo,
} from '@/components/trainer/TrainerPersonalityBadge';
import { userMessageFor } from '@/lib/http/userMessage';
import {
  actionMessageFor,
  assignStaffRefusalCodes,
  hireRefusalCodes,
  hireRefused,
} from '@/lib/http/actionMessage';
import StaffLevelStars from '@/components/common/StaffLevelStars';
import { staffLevelLabel } from '@/lib/staffLevels';
import { disciplineLabel } from '@/lib/utils/training-utils';

/** What the page shows of one trainer, whether hired or on offer. */
interface TrainerView {
  name: string;
  skillLevel: string;
  starLevel?: string;
  personality: string;
  speciality: string;
  sessionRate: number;
  bio?: string;
  /** Hired trainers only. */
  careerWeeks?: number;
  retired?: boolean;
}

const skillLevelNote: Record<string, string> = {
  novice: 'Specialities are not yet known — they could be exceptional.',
  developing: 'Some specialities are known.',
  expert: 'Every speciality is known.',
};

const TrainerPage: React.FC = () => {
  const { trainerId, marketplaceId } = useParams();
  const [searchParams] = useSearchParams();
  const horseIdParam = Number(searchParams.get('horseId'));
  const viewedHorseId =
    Number.isInteger(horseIdParam) && horseIdParam > 0 ? horseIdParam : undefined;
  const { user } = useAuth();

  const hired = useUserTrainers(marketplaceId ? '' : (user?.id ?? ''));
  const offers = useTrainerMarketplace({ enabled: Boolean(marketplaceId) });
  const { data: horses } = useHorses();
  const hireMutation = useHireTrainer();
  const assignMutation = useAssignTrainer();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pickedHorseId, setPickedHorseId] = useState('');
  const [assignedHorseId, setAssignedHorseId] = useState<number | null>(null);

  const query = marketplaceId ? offers : hired;
  const hiredTrainer = trainerId
    ? (hired.data ?? []).find((t) => String(t.id) === trainerId)
    : undefined;
  const offer = marketplaceId
    ? (offers.data?.trainers ?? []).find((t) => t.marketplaceId === marketplaceId)
    : undefined;

  const trainer: TrainerView | null = hiredTrainer
    ? {
        name: hiredTrainer.name ?? `${hiredTrainer.firstName} ${hiredTrainer.lastName}`,
        skillLevel: hiredTrainer.skillLevel,
        starLevel: hiredTrainer.starLevel,
        personality: hiredTrainer.personality,
        speciality: hiredTrainer.speciality,
        sessionRate: hiredTrainer.sessionRate,
        bio: hiredTrainer.bio,
        careerWeeks: hiredTrainer.careerWeeks,
        retired: hiredTrainer.retired,
      }
    : offer
      ? {
          name: `${offer.firstName} ${offer.lastName}`,
          skillLevel: offer.skillLevel,
          starLevel: offer.starLevel,
          personality: offer.personality,
          speciality: offer.speciality,
          sessionRate: offer.sessionRate,
          bio: offer.bio,
        }
      : null;

  const horseToAssign = viewedHorseId ?? (pickedHorseId ? Number(pickedHorseId) : null);
  const assignedHorseName = (horses ?? []).find((h) => h.id === assignedHorseId)?.name;
  const viewedHorseName = (horses ?? []).find((h) => h.id === viewedHorseId)?.name;
  const pending = hireMutation.isPending || assignMutation.isPending;
  const refusal = marketplaceId
    ? hireMutation.isError
      ? actionMessageFor(hireMutation.error, hireRefused, hireRefusalCodes('trainer'))
      : null
    : assignMutation.isError
      ? actionMessageFor(assignMutation.error, {}, assignStaffRefusalCodes)
      : null;

  const openDialog = () => {
    hireMutation.reset();
    assignMutation.reset();
    setPickedHorseId('');
    setDialogOpen(true);
  };

  const confirm = () => {
    if (horseToAssign === null) return;
    const done = () => {
      setDialogOpen(false);
      setAssignedHorseId(horseToAssign);
    };
    if (marketplaceId) {
      hireMutation.mutate({ marketplaceId, horseId: horseToAssign }, { onSuccess: done });
    } else if (hiredTrainer) {
      assignMutation.mutate(
        { trainerId: hiredTrainer.id, horseId: horseToAssign },
        { onSuccess: done }
      );
    }
  };

  const crumbs = (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2">
      <Link to="/world" className="hover:text-[var(--text-primary)] transition-colors">
        World
      </Link>
      <span aria-hidden="true">/</span>
      <Link to="/trainers" className="hover:text-[var(--text-primary)] transition-colors">
        Trainers
      </Link>
      <span aria-hidden="true">/</span>
      <span className="text-[var(--text-primary)]">{trainer?.name ?? 'Trainer'}</span>
    </nav>
  );

  // After a successful assignment the offer has left the marketplace, so the
  // confirmation stands on its own rather than falling through to "not found".
  if (assignedHorseId !== null) {
    return (
      <PageContainer variant="wide" padded={false} className="pb-8">
        <PageHeader
          title={trainer?.name ?? 'Trainer'}
          icon={<GraduationCap className="w-6 h-6 text-[var(--gold-400)]" />}
          breadcrumbs={crumbs}
        />
        <Surface variant="panel" className="mt-6" data-testid="trainer-assigned">
          <p className="fantasy-body text-[var(--text-primary)]">
            {trainer?.name ?? 'The trainer'} now trains {assignedHorseName ?? 'your horse'}.
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            <Link
              to={`/horses/${assignedHorseId}`}
              className="text-[var(--gold-400)] hover:underline"
            >
              Back to {assignedHorseName ?? 'the horse'}
            </Link>
          </p>
        </Surface>
      </PageContainer>
    );
  }

  const personality = trainer ? getTrainerPersonalityInfo(trainer.personality) : null;
  const specialityKnown =
    trainer !== null && trainer.skillLevel === 'expert' && trainer.speciality.trim().length > 0;

  return (
    <PageContainer variant="wide" padded={false} className="pb-8">
      <PageHeader
        title={trainer?.name ?? 'Trainer'}
        subtitle={trainer ? `${staffLevelLabel(trainer.starLevel)} trainer` : undefined}
        icon={<GraduationCap className="w-6 h-6 text-[var(--gold-400)]" />}
        breadcrumbs={crumbs}
      />

      <div className="mt-6 space-y-6" data-testid="trainer-page">
        {query.isLoading && <SectionLoading label="Loading trainer" minHeight="192px" />}

        {query.isError && (
          <ErrorState
            title="Failed to Load Trainer"
            message={userMessageFor(query.error).message}
            retry={{ label: 'Try Again', onClick: () => void query.refetch() }}
          />
        )}

        {!query.isLoading && !query.isError && !trainer && (
          <EmptyState
            variant="filtered"
            icon={<GraduationCap className="w-8 h-8" aria-hidden="true" />}
            title="Trainer Not Found"
            description="This trainer is no longer here. They may have been hired by someone else or retired."
          />
        )}

        {trainer && personality && (
          <>
            <Surface variant="panel" className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <TrainerPersonalityBadge personality={trainer.personality} />
                <span className="text-sm text-[var(--text-secondary)]">
                  {personality.description}
                </span>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Level</dt>
                  <dd className="text-[var(--text-primary)]" data-testid="trainer-level">
                    <StaffLevelStars level={trainer.starLevel} />
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Speciality</dt>
                  <dd className="text-[var(--text-primary)]" data-testid="trainer-speciality">
                    {specialityKnown ? disciplineLabel(trainer.speciality) : 'Not yet known'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Training fee</dt>
                  <dd
                    className="text-[var(--text-primary)] inline-flex items-center gap-1"
                    data-testid="trainer-fee"
                  >
                    <Currency amount={trainer.sessionRate} /> per session
                  </dd>
                </div>
                {trainer.careerWeeks !== undefined && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--text-muted)]">Weeks on the job</dt>
                    <dd className="text-[var(--text-primary)]">{trainer.careerWeeks}</dd>
                  </div>
                )}
              </dl>
              <p className="text-xs text-[var(--text-muted)]">
                {skillLevelNote[trainer.skillLevel] ?? skillLevelNote.novice} The fee is paid once
                each time this trainer trains one of your horses, once per horse each week.
              </p>

              {trainer.bio && (
                <p className="text-sm text-[var(--text-secondary)] italic">
                  &ldquo;{trainer.bio}&rdquo;
                </p>
              )}
            </Surface>

            <Surface variant="subtle" className="p-4" data-testid="trainer-fit">
              <p className="fantasy-caption text-[var(--text-secondary)] mb-1">
                Horse compatibility
              </p>
              <p className="text-xs text-[var(--text-muted)] italic">Coming soon</p>
            </Surface>

            {!trainer.retired && (
              <div>
                <Button type="button" onClick={openDialog} data-testid="assign-trainer-button">
                  Assign Trainer
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <GameDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        {trainer && (
          <GameDialogContent size="sm" data-testid="assign-trainer-dialog">
            <GameDialogHeader>
              <GameDialogTitle>Assign Trainer</GameDialogTitle>
            </GameDialogHeader>
            <GameDialogBody>
              <p className="text-[var(--text-secondary)] text-sm mb-5 leading-relaxed">
                Assign <strong className="text-[var(--text-primary)]">{trainer.name}</strong>
                {viewedHorseName ? (
                  <>
                    {' '}
                    to <strong className="text-[var(--text-primary)]">{viewedHorseName}</strong>
                  </>
                ) : null}
                ?{marketplaceId ? ' They will join your training staff. Hiring is free.' : ''}
              </p>
              {viewedHorseId === undefined && (
                <div className="mb-4">
                  <label htmlFor="trainer-page-horse" className="type-label block mb-1.5">
                    Which horse?
                  </label>
                  <Select
                    id="trainer-page-horse"
                    value={pickedHorseId}
                    onChange={(e) => setPickedHorseId(e.target.value)}
                    className="w-full"
                  >
                    <option value="">Choose a horse</option>
                    {(horses ?? []).map((horse) => (
                      <option key={horse.id} value={String(horse.id)}>
                        {horse.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              {refusal && <InlineError message={refusal} className="mt-4" />}
            </GameDialogBody>
            <GameDialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirm}
                disabled={pending || horseToAssign === null}
                className="flex-1"
                data-testid="confirm-assign-button"
              >
                {pending ? 'Assigning...' : 'Assign Trainer'}
              </Button>
            </GameDialogFooter>
          </GameDialogContent>
        )}
      </GameDialog>
    </PageContainer>
  );
};

export default TrainerPage;
