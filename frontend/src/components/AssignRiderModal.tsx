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
        className="bg-deep-space border border-white/10 rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200"
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
            className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
              <button
                key={rider.id}
                type="button"
                onClick={() => setSelectedRiderId(rider.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                  selectedRiderId === rider.id
                    ? 'bg-celestial-gold/10 border-celestial-gold/50 text-white/90'
                    : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'
                }`}
                data-testid={`rider-option-${rider.id}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      {rider.firstName} {rider.lastName}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-white/40 capitalize">{rider.skillLevel}</span>
                      <span className="text-white/20">·</span>
                      <span className="text-xs text-celestial-gold/70">Lv. {rider.level}</span>
                    </div>
                  </div>
                  <RiderPersonalityBadge personality={rider.personality} size="sm" />
                </div>
              </button>
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
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-white/10 rounded-lg text-white/60 font-medium hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedRiderId || assignMutation.isPending}
            className="flex-1 px-4 py-2.5 bg-celestial-gold/80 text-black font-bold rounded-lg hover:bg-celestial-gold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="confirm-assign-button"
          >
            {assignMutation.isPending ? 'Assigning...' : 'Assign Rider'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignRiderModal;
