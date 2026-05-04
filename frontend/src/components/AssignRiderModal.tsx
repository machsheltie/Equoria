/**
 * AssignRiderModal Component (Epic 9C — Story 9C-2)
 *
 * Modal for assigning a rider to a horse.
 * Triggered from MyRidersDashboard or horse profile action bar.
 * Lists available (unassigned) riders with personality info.
 *
 * Mirrors AssignGroomModal.tsx for the Rider System.
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useUserRiders, useAssignRider, type Rider } from '@/hooks/api/useRiders';
import { useAuth } from '@/contexts/AuthContext';
import RiderPersonalityBadge from './rider/RiderPersonalityBadge';
import { Button } from '@/components/ui/button';

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
  const unassignedRiders = riders.filter((r) => !r.assignedHorseId && r.isActive);

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[var(--z-modal)] animate-in fade-in duration-200"
      onClick={onClose}
      data-testid="assign-rider-modal"
    >
      <div
        className="glass-panel-heavy rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white/90">Assign Rider</h2>
            <p className="text-sm text-white/50 flex items-center gap-1 mt-0.5">
              <span aria-hidden="true">🐎</span>
              {horseName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/40 hover:text-[var(--text-primary)] hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rider List */}
        {isLoading && !propRiders ? (
          <div className="text-center py-8 text-white/40">Loading riders...</div>
        ) : unassignedRiders.length === 0 ? (
          <div className="text-center py-8 text-white/40">
            <p className="text-base">No available riders</p>
            <p className="text-sm mt-1">
              All hired riders are currently assigned. Hire more from the Riders marketplace.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 mb-4">
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

        {/* Notes */}
        {selectedRiderId && (
          <div className="mb-4">
            <label htmlFor="rider-notes" className="block text-xs text-white/40 mb-1.5">
              Notes (optional)
            </label>
            <textarea
              id="rider-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this assignment..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/20 resize-none"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
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
      </div>
    </div>
  );
};

export default AssignRiderModal;
