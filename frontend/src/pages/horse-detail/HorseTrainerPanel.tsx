/**
 * HorseTrainerPanel — the trainer assigned to this horse (Equoria-r8a6h, owner
 * ruling 2026-10-23). Shows the trainer's name, personality and per-session fee,
 * or a way to assign one. The fee is charged once per weekly session; nothing
 * about trainer fit is shown (it is "Coming soon").
 */

import React from 'react';
import { Link } from 'react-router';
import { Surface } from '@/components/ui/Surface';
import Currency from '@/components/ui/Currency';
import TrainerPersonalityBadge from '@/components/trainer/TrainerPersonalityBadge';
import { useHorseTrainer } from '@/hooks/api/useTrainers';

const HorseTrainerPanel: React.FC<{ horseId: number }> = ({ horseId }) => {
  const { assignment, fee, isLoading, isError } = useHorseTrainer(horseId);

  return (
    <Surface variant="subtle" className="p-4" data-testid="horse-trainer-panel">
      <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Trainer</p>
      {isLoading ? (
        <p className="fantasy-body text-[var(--text-muted)]">Loading trainer…</p>
      ) : isError ? (
        <p className="fantasy-body text-[var(--text-muted)]">
          The trainer could not be loaded right now.
        </p>
      ) : assignment ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="fantasy-body text-[var(--text-primary)]">{assignment.trainerName}</span>
          <TrainerPersonalityBadge personality={assignment.trainerPersonality} size="sm" />
          <span className="text-sm text-[var(--text-secondary)]">
            <Currency amount={fee} /> per session
          </span>
        </div>
      ) : (
        <p className="fantasy-body text-[var(--text-secondary)]">
          No trainer assigned.{' '}
          <Link
            to={`/trainers?horseId=${horseId}`}
            className="text-[var(--gold-400)] hover:underline"
          >
            Assign Trainer
          </Link>
        </p>
      )}
    </Surface>
  );
};

export default HorseTrainerPanel;
