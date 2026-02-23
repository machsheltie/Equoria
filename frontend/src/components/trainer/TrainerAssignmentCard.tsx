/**
 * TrainerAssignmentCard — Compact horse assignment chip (Epic 13 — Story 13-2)
 *
 * Displays a trainer's current horse assignment.
 * Used within MyTrainersDashboard to list active assignments.
 * Unassign action is disabled pending auth wire-up.
 *
 * Mirrors RiderAssignmentCard.tsx for the Trainer System.
 */

import React from 'react';
import { Trash2 } from 'lucide-react';

// Replace with /api/trainers/assignments response shape when 13-5 is wired
export interface TrainerAssignment {
  id: number;
  trainerId: number;
  horseName: string;
  startDate: string;
  isActive: boolean;
}

interface TrainerAssignmentCardProps {
  assignment: TrainerAssignment;
  onUnassign?: (_assignmentId: number) => void;
  isUnassigning?: boolean;
}

const TrainerAssignmentCard: React.FC<TrainerAssignmentCardProps> = ({
  assignment,
  onUnassign,
  isUnassigning = false,
}) => {
  const handleUnassign = () => {
    if (window.confirm(`Remove trainer from ${assignment.horseName}?`)) {
      onUnassign?.(assignment.id);
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
        disabled={isUnassigning || !onUnassign}
        title={onUnassign ? 'Unassign trainer' : 'Sign in to unassign'}
        aria-label="Unassign trainer"
        className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-900/20 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default TrainerAssignmentCard;
