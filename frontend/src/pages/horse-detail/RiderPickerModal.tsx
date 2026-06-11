/**
 * RiderPickerModal — dialog that lists the user's riders and assigns
 * one to the given horse. Story 15-5.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 *
 * Design-system migration (Equoria-o5hub.20 / DECISIONS.md §8): the
 * page-local `fixed inset-0` overlay (with nested backdrop-blur) is
 * replaced by the canonical GameDialog. Rider rows render through
 * Surface(interactive); close is prevented while the assign mutation
 * is pending (pending-close rule, handoff §6.6).
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/Surface';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
} from '@/components/ui/game';
import { useAssignRider, type Rider } from '@/hooks/api/useRiders';

interface RiderPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  horseId: number;
  horseName: string;
  riders: Rider[] | undefined;
  isLoading: boolean;
}

const RiderPickerModal: React.FC<RiderPickerModalProps> = ({
  isOpen,
  onClose,
  horseId,
  horseName,
  riders,
  isLoading,
}) => {
  const assignRiderMutation = useAssignRider();

  // Render nothing while closed (parity with the pre-migration overlay):
  // children of the dialog are evaluated eagerly during this component's
  // render, so the guard also avoids touching `riders` before it's needed.
  if (!isOpen) return null;

  return (
    <GameDialog
      open={isOpen}
      onOpenChange={(open) => {
        // Pending-close prevention: ignore close requests mid-assignment.
        if (!open && !assignRiderMutation.isPending) onClose();
      }}
    >
      <GameDialogContent size="sm" data-testid="rider-picker-modal">
        <GameDialogHeader>
          <GameDialogTitle className="text-lg">Assign Rider to {horseName}</GameDialogTitle>
        </GameDialogHeader>
        {isLoading && (
          <p className="text-sm text-role-secondary text-center py-4">Loading riders…</p>
        )}
        {!isLoading && (!riders || riders.length === 0) && (
          <div className="text-center py-4">
            <p className="text-sm text-role-secondary mb-3">No riders hired yet.</p>
            <Button asChild>
              <Link to="/riders" onClick={onClose}>
                Browse Rider Marketplace
              </Link>
            </Button>
          </div>
        )}
        <div className="space-y-2 max-h-60 overflow-y-auto pt-4">
          {riders?.map((rider: Rider) => (
            /* Surface(interactive) — clickable repeated item (D-05). */
            <Surface
              key={rider.id}
              variant="interactive"
              as="button"
              type="button"
              disabled={assignRiderMutation.isPending}
              onClick={() => {
                assignRiderMutation.mutate(
                  { riderId: rider.id, horseId },
                  {
                    onSuccess: () => {
                      onClose();
                      toast.success(
                        `${rider.firstName} ${rider.lastName} assigned to ${horseName}`
                      );
                    },
                    onError: () => {
                      toast.error('Failed to assign rider. Please try again.');
                    },
                  }
                );
              }}
              className="w-full text-left disabled:opacity-50"
            >
              <p className="font-bold text-role-primary text-sm">
                {rider.firstName} {rider.lastName}
              </p>
              <p className="text-xs text-role-secondary capitalize">
                {rider.skillLevel} · {rider.personality}
              </p>
            </Surface>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="mt-4 w-full"
          onClick={onClose}
          disabled={assignRiderMutation.isPending}
        >
          Cancel
        </Button>
      </GameDialogContent>
    </GameDialog>
  );
};

export default RiderPickerModal;
