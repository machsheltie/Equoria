/**
 * RiderDismissControl Component (Equoria-oey96.27 — FR-RIDER-4)
 *
 * Lets a player manually dismiss (retire) a hired rider from the roster.
 * Used within MyRidersDashboard, one control per rider card.
 *
 * Backend contract (DELETE /api/v1/riders/:id/dismiss, riderController.dismissRider):
 * a SOFT retire — sets rider.retired = true and deactivates every active
 * assignment for the rider. getUserRiders filters retired:false, so a dismissed
 * rider disappears from the active roster. Not reversible from the UI.
 *
 * Because permanent staff removal is a player-trust-sensitive action, the button
 * never removes on a single click — it opens an in-app GameDialog confirmation,
 * mirroring the unassign confirm UX in RiderAssignmentCard (window.confirm was
 * replaced per Equoria-o5hub.13, DECISIONS.md §8). Destructive confirm buttons
 * use the red `destructive` variant, never gold (DECISIONS.md §5).
 */

import React, { useState } from 'react';
import { UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';

interface RiderDismissControlProps {
  riderId: number;
  riderName: string;
  onDismiss: (_riderId: number) => void;
  isDismissing?: boolean;
}

const RiderDismissControl: React.FC<RiderDismissControlProps> = ({
  riderId,
  riderName,
  onDismiss,
  isDismissing = false,
}) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleConfirm = () => {
    setIsConfirmOpen(false);
    onDismiss(riderId);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirmOpen(true)}
        disabled={isDismissing}
        className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-role-muted hover:text-[var(--role-danger-text)] hover:bg-[var(--role-danger-bg)] rounded-[var(--radius-sm)] transition-all disabled:opacity-50"
        aria-label="Dismiss rider"
        data-testid={`dismiss-button-${riderId}`}
      >
        <UserMinus className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{isDismissing ? 'Dismissing…' : 'Dismiss Rider'}</span>
      </button>

      {/* Dismiss confirmation — destructive action, never gold (DECISIONS.md §5) */}
      <GameDialog
        open={isConfirmOpen}
        onOpenChange={(open) => {
          if (!open) setIsConfirmOpen(false);
        }}
      >
        <GameDialogContent size="sm" data-testid={`dismiss-rider-confirm-${riderId}`}>
          <GameDialogHeader>
            <GameDialogTitle>Dismiss Rider</GameDialogTitle>
            <GameDialogDescription>
              Dismiss {riderName}? They will be retired and removed from any assigned horses. This
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
              Dismiss Rider
            </Button>
          </GameDialogFooter>
        </GameDialogContent>
      </GameDialog>
    </>
  );
};

export default RiderDismissControl;
