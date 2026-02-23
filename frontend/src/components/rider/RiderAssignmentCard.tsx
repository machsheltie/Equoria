/**
 * RiderAssignmentCard Component (Epic 9C — Story 9C-2)
 *
 * Compact card showing a rider's current horse assignment.
 * Used within MyRidersDashboard to display active assignments.
 * Includes unassign action.
 */

import React from 'react';
import { Trash2 } from 'lucide-react';
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
  const handleUnassign = () => {
    if (window.confirm(`Remove this rider from ${assignment.horseName}?`)) {
      onUnassign(assignment.id);
    }
  };

  return (
    <div
      className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3 hover:border-white/20 transition-colors"
      data-testid={`assignment-card-${assignment.id}`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-sm"
          aria-hidden="true"
        >
          🐎
        </div>
        <div>
          <p className="text-sm font-medium text-white/90">{assignment.horseName}</p>
          <p className="text-[10px] text-white/40">
            Since {new Date(assignment.startDate).toLocaleDateString()}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleUnassign}
        disabled={isUnassigning}
        className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-900/20 rounded transition-all disabled:opacity-50"
        title="Unassign rider"
        aria-label="Unassign rider"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default RiderAssignmentCard;
