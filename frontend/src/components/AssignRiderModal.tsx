/**
 * AssignRiderModal Component (Epic 9C — Story 9C-2)
 *
 * Modal for assigning a rider to a horse.
 * Triggered from MyRidersDashboard or horse profile action bar.
 * Lists available (unassigned) riders with personality info.
 *
 * Mirrors AssignGroomModal.tsx for the Rider System.
 *
 * Design-system migration (Equoria-o5hub.20 / DECISIONS.md §8): the local
 * `fixed inset-0` overlay (with nested backdrop-blur) is replaced by the
 * canonical GameDialog; notes use FormField + canonical Textarea; close is
 * prevented while the assign mutation is pending (handoff §6.6).
 */

import React, { useState } from 'react';
import { useUserRiders, useAssignRider, type Rider } from '@/hooks/api/useRiders';
import { useAuth } from '@/contexts/AuthContext';
import RiderPersonalityBadge from './rider/RiderPersonalityBadge';
import { Button } from '@/components/ui/button';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
} from '@/components/ui/game';
import { FormField, Textarea } from '@/components/ui/form';

interface AssignRiderModalProps {
  isOpen: boolean;
  onClose: () => void;
  horseId: number;
  horseName: string;
  onAssignmentComplete?: () => void;
  availableRiders?: Rider[];
}

const AssignRiderModal: React.FC<AssignRiderModalProps> = ({
  isOpen,
  onClose,
  horseId,
  horseName,
  onAssignmentComplete,
  availableRiders: propRiders,
}) => {
  const { user } = useAuth();
  const [selectedRiderId, setSelectedRiderId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const userId = user?.id ?? '';
  const { data: fetchedRiders, isLoading } = useUserRiders(userId);
  const assignMutation = useAssignRider();

  const riders = propRiders ?? fetchedRiders ?? [];
  // Defensive: some test/transport shapes are non-array until hydration.
  const unassignedRiders = Array.isArray(riders)
    ? riders.filter((r) => !r.assignedHorseId && r.isActive)
    : [];

  const handleAssign = () => {
    if (!selectedRiderId) return;

    assignMutation.mutate(
      { riderId: selectedRiderId, horseId, notes: notes || undefined },
      {
        onSuccess: () => {
          onAssignmentComplete?.();
          onClose();
        },
      }
    );
  };

  // Render nothing while closed (parity with the pre-migration overlay).
  if (!isOpen) return null;

  return (
    <GameDialog
      open={isOpen}
      onOpenChange={(open) => {
        // Pending-close prevention: ignore close requests mid-assignment.
        if (!open && !assignMutation.isPending) onClose();
      }}
    >
      <GameDialogContent data-testid="assign-rider-modal">
        <GameDialogHeader>
          <GameDialogTitle className="text-lg">Assign Rider</GameDialogTitle>
          <GameDialogDescription className="flex items-center gap-1">
            <span aria-hidden="true">🐎</span>
            {horseName}
          </GameDialogDescription>
        </GameDialogHeader>

        {/* Rider List */}
        {isLoading && !propRiders ? (
          <div className="text-center py-8 text-role-muted">Loading riders...</div>
        ) : unassignedRiders.length === 0 ? (
          <div className="text-center py-8 text-role-muted">
            <p className="text-base">No available riders</p>
            <p className="text-sm mt-1">
              All hired riders are currently assigned. Hire more from the Riders marketplace.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 my-4">
            {unassignedRiders.map((rider) => (
              <Button
                key={rider.id}
                type="button"
                variant={selectedRiderId === rider.id ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setSelectedRiderId(rider.id)}
                className="w-full justify-between text-left"
                data-testid={`rider-option-${rider.id}`}
              >
                <span className="flex flex-col items-start">
                  <span className="font-medium text-sm">
                    {rider.firstName} {rider.lastName}
                  </span>
                  <span className="flex items-center gap-2 mt-1">
                    <span className="text-xs opacity-70 capitalize">{rider.skillLevel}</span>
                    <span className="opacity-40">·</span>
                    <span className="text-xs text-[var(--gold-light)]">Lv. {rider.level}</span>
                  </span>
                </span>
                <RiderPersonalityBadge personality={rider.personality} size="sm" />
              </Button>
            ))}
          </div>
        )}

        {/* Notes — FormField + canonical Textarea (D-13) */}
        {selectedRiderId && (
          <FormField label="Notes (optional)" htmlFor="rider-notes" className="mb-4">
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this assignment..."
                rows={2}
                className="resize-none"
              />
            )}
          </FormField>
        )}

        {/* Actions — one gold primary (Assign), Cancel secondary (D-08) */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            disabled={assignMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAssign}
            disabled={!selectedRiderId || assignMutation.isPending}
            className="flex-1"
            data-testid="confirm-assign-button"
          >
            {assignMutation.isPending ? 'Assigning...' : 'Assign Rider'}
          </Button>
        </div>
      </GameDialogContent>
    </GameDialog>
  );
};

export default AssignRiderModal;
