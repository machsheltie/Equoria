/**
 * RiderPickerModal — modal that lists the user's riders and assigns
 * one to the given horse. Story 15-5.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[var(--z-modal)]"
      onClick={onClose}
      data-testid="rider-picker-modal"
    >
      <div
        className="glass-panel-heavy rounded-xl shadow-2xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="fantasy-title text-lg text-[var(--text-primary)] mb-4">
          Assign Rider to {horseName}
        </h3>
        {isLoading && (
          <p className="text-sm text-[var(--text-secondary)] text-center py-4">Loading riders…</p>
        )}
        {!isLoading && (!riders || riders.length === 0) && (
          <div className="text-center py-4">
            <p className="text-sm text-[var(--text-secondary)] mb-3">No riders hired yet.</p>
            <Button asChild>
              <Link to="/riders" onClick={onClose}>
                Browse Rider Marketplace
              </Link>
            </Button>
          </div>
        )}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {riders?.map((rider: Rider) => (
            <button
              key={rider.id}
              type="button"
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
              disabled={assignRiderMutation.isPending}
              className="w-full text-left glass-panel hover:border-burnished-gold/40 disabled:opacity-50"
            >
              <p className="font-bold text-[var(--text-primary)] text-sm">
                {rider.firstName} {rider.lastName}
              </p>
              <p className="text-xs text-[var(--text-secondary)] capitalize">
                {rider.skillLevel} · {rider.personality}
              </p>
            </button>
          ))}
        </div>
        <Button type="button" variant="secondary" className="mt-4 w-full" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default RiderPickerModal;
