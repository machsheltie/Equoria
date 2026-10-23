/**
 * TrainerDismissControl Component (Equoria-oey96.71)
 *
 * Lets a player dismiss (retire) a hired trainer from the roster. Used within
 * MyTrainersDashboard, one control per trainer card. Mirrors RiderDismissControl
 * (Equoria-oey96.27).
 *
 * Backend contract (DELETE /api/v1/trainers/:id/dismiss, trainerController.dismissTrainer):
 * a SOFT retire. It marks the trainer retired and deactivates every active
 * assignment in one transaction; getUserTrainers filters retired:false, so a
 * dismissed trainer leaves the roster. Not reversible from the UI.
 *
 * Dismissal is permanent, so the button never removes on a single click: it opens
 * an in-app GameDialog confirmation. The destructive confirm uses the red
 * `destructive` variant, never gold (DECISIONS.md section 5).
 *
 * Feedback is surface-owned (FRONTEND_ASYNC_STATE_DOCTRINE section 3): success is
 * the card leaving the roster; a failure arrives as `errorMessage` and shows as an
 * announced InlineError at this control. There is no toast.
 */

import React, { useState } from 'react';
import { UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/state';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';

interface TrainerDismissControlProps {
  trainerId: number;
  trainerName: string;
  onDismiss: (_trainerId: number) => void;
  isDismissing?: boolean;
  /** User-safe failure copy for the last dismissal attempt on this trainer, if it failed. */
  errorMessage?: string | null;
}

const TrainerDismissControl: React.FC<TrainerDismissControlProps> = ({
  trainerId,
  trainerName,
  onDismiss,
  isDismissing = false,
  errorMessage = null,
}) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleConfirm = () => {
    setIsConfirmOpen(false);
    onDismiss(trainerId);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirmOpen(true)}
        disabled={isDismissing}
        className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-role-muted hover:text-[var(--role-danger-text)] hover:bg-[var(--role-danger-bg)] rounded-[var(--radius-sm)] transition-all disabled:opacity-50"
        aria-label="Dismiss trainer"
        data-testid={`dismiss-button-${trainerId}`}
      >
        <UserMinus className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{isDismissing ? 'Dismissing…' : 'Dismiss Trainer'}</span>
      </button>

      {errorMessage && (
        <div className="mt-1 flex justify-center">
          <InlineError message={errorMessage} />
        </div>
      )}

      <GameDialog
        open={isConfirmOpen}
        onOpenChange={(open) => {
          if (!open) setIsConfirmOpen(false);
        }}
      >
        <GameDialogContent size="sm" data-testid={`dismiss-trainer-confirm-${trainerId}`}>
          <GameDialogHeader>
            <GameDialogTitle>Dismiss Trainer</GameDialogTitle>
            <GameDialogDescription>
              Dismiss {trainerName}? They will be retired and removed from any assigned horses. This
              cannot be undone.
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
              disabled={isDismissing}
            >
              Dismiss Trainer
            </Button>
          </GameDialogFooter>
        </GameDialogContent>
      </GameDialog>
    </>
  );
};

export default TrainerDismissControl;
