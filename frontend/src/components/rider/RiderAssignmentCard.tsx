/**
 * RiderAssignmentCard Component (Epic 9C — Story 9C-2)
 *
 * Compact card showing a rider's current horse assignment.
 * Used within MyRidersDashboard to display active assignments.
 * Includes unassign action with an in-app GameDialog confirmation
 * (window.confirm replaced per Equoria-o5hub.13, DECISIONS.md §8).
 */

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/Surface';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';
import { RiderAssignment } from '@/hooks/api/useRiders';

interface RiderAssignmentCardProps {
  assignment: RiderAssignment;
  onUnassign: (_assignmentId: number) => void;
  isUnassigning?: boolean;
}

const RiderAssignmentCard: React.FC<RiderAssignmentCardProps> = ({
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
      <Surface
        variant="subtle"
        className="flex items-center justify-between p-3"
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
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--role-danger-text)] hover:bg-[var(--role-danger-bg)] rounded-[var(--radius-sm)] transition-all disabled:opacity-50"
          title="Unassign rider"
          aria-label="Unassign rider"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </Surface>

      {/* Unassign confirmation — destructive action, never gold (DECISIONS.md §5) */}
      <GameDialog
        open={isConfirmOpen}
        onOpenChange={(open) => {
          if (!open) setIsConfirmOpen(false);
        }}
      >
        <GameDialogContent size="sm" data-testid={`unassign-rider-confirm-${assignment.id}`}>
          <GameDialogHeader>
            <GameDialogTitle>Unassign Rider</GameDialogTitle>
            <GameDialogDescription>
              Remove this rider from {assignment.horseName}?
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
              Remove Rider
            </Button>
          </GameDialogFooter>
        </GameDialogContent>
      </GameDialog>
    </>
  );
};

export default RiderAssignmentCard;
