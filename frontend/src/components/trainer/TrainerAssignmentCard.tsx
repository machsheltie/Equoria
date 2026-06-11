/**
 * TrainerAssignmentCard — Compact horse assignment chip (Epic 13 — Story 13-2)
 *
 * Displays a trainer's current horse assignment.
 * Used within MyTrainersDashboard to list active assignments.
 *
 * Mirrors RiderAssignmentCard.tsx for the Trainer System.
 * Unassign action uses an in-app GameDialog confirmation
 * (window.confirm replaced per Equoria-o5hub.13, DECISIONS.md §8).
 */

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';

export interface TrainerAssignment {
  id: number;
  trainerId: number;
  horseName: string;
  startDate: string;
  isActive: boolean;
}

interface TrainerAssignmentCardProps {
  assignment: TrainerAssignment;
  onUnassign: (_assignmentId: number) => void;
  isUnassigning?: boolean;
}

const TrainerAssignmentCard: React.FC<TrainerAssignmentCardProps> = ({
  assignment,
  onUnassign,
  isUnassigning = false,
}) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleUnassign = () => {
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    setIsConfirmOpen(false);
    onUnassign(assignment.id);
  };

  return (
    <>
      <div
        className="flex items-center justify-between bg-[var(--glass-surface-subtle-bg)] border border-[var(--glass-border)] rounded-lg p-3 hover:border-[var(--glass-hover)] transition-colors"
        data-testid={`assignment-card-${assignment.id}`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full bg-[var(--glass-surface-subtle-bg)] flex items-center justify-center text-sm"
            aria-hidden="true"
          >
            🐎
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">{assignment.horseName}</p>
            <p className="text-[10px] text-[var(--text-muted)]">
              Since {new Date(assignment.startDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleUnassign}
          disabled={isUnassigning}
          title="Unassign trainer"
          aria-label="Unassign trainer"
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--role-danger-text)] hover:bg-[var(--role-danger-bg)] rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Unassign confirmation — destructive action, never gold (DECISIONS.md §5) */}
      <GameDialog
        open={isConfirmOpen}
        onOpenChange={(open) => {
          if (!open) setIsConfirmOpen(false);
        }}
      >
        <GameDialogContent size="sm" data-testid={`unassign-trainer-confirm-${assignment.id}`}>
          <GameDialogHeader>
            <GameDialogTitle>Unassign Trainer</GameDialogTitle>
            <GameDialogDescription>
              Remove trainer from {assignment.horseName}?
            </GameDialogDescription>
          </GameDialogHeader>
          <GameDialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirm}
              disabled={isUnassigning}
            >
              Remove Trainer
            </Button>
          </GameDialogFooter>
        </GameDialogContent>
      </GameDialog>
    </>
  );
};

export default TrainerAssignmentCard;
