/**
 * GroomAssignmentCard Component (Story 7-3: Task Assignment UI)
 *
 * Displays the current groom assignment for a horse with:
 * - Groom details (name, skill, personality, experience)
 * - Bond score with visual progress bar
 * - Available tasks panel (via GroomTaskPanel)
 * - "Change Groom" button to trigger reassignment
 * - "No groom assigned" empty state with assign button
 * - Task completion notification badge
 *
 * Acceptance Criteria covered:
 * - AC3: Can reassign grooms as needed
 * - AC4: Task completion notifications
 */

import React from 'react';
import { User, RefreshCw, CheckCircle, Heart } from 'lucide-react';
import GroomPersonalityBadge from './GroomPersonalityBadge';
import GroomTaskPanel from './GroomTaskPanel';

export interface GroomAssignment {
  id: number;
  groomId: number;
  groomName: string;
  skillLevel: string;
  personality: string;
  experience: number;
  bondScore: number;
  priority: number;
  isActive: boolean;
  notes?: string;
  lastTaskCompletedAt?: string;
}

interface GroomAssignmentCardProps {
  /** Current assignment, or null if no groom assigned */
  assignment: GroomAssignment | null;
  /** Name of the horse */
  horseName: string;
  /** Horse age in years (used to show appropriate tasks) */
  horseAge: number;
  /** Callback when user wants to assign or change a groom */
  onAssign: () => void;
  /** When true, shows compact task list without descriptions */
  compact?: boolean;
}

/** Skill level display label */
function skillLabel(skillLevel: string): string {
  const labels: Record<string, string> = {
    novice: 'Novice',
    intermediate: 'Intermediate',
    expert: 'Expert',
    master: 'Master',
  };
  return labels[skillLevel.toLowerCase()] ?? skillLevel;
}

/** Bond score progress bar */
function BondScoreBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const colorClass =
    clamped >= 70 ? 'bg-emerald-500' : clamped >= 40 ? 'bg-amber-500' : 'bg-red-400';

  return (
    <div className="mt-2" data-testid="bond-score-section">
      <div className="flex justify-between text-xs text-[rgb(148,163,184)] mb-1">
        <span>Bond Score</span>
        <span data-testid="bond-score-value">{clamped}/100</span>
      </div>
      <div
        className="h-2 bg-[rgba(15,35,70,0.5)] rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Bond score: ${clamped} out of 100`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${clamped}%` }}
          data-testid="bond-score-bar"
        />
      </div>
    </div>
  );
}

/** Task completion notification badge */
function TaskCompletionNotice({ completedAt }: { completedAt: string }) {
  const date = new Date(completedAt);
  const timeStr = date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="flex items-center gap-2 bg-[rgba(16,185,129,0.1)] border border-emerald-500/30 rounded-lg p-3 mt-3"
      data-testid="task-completion-notice"
      role="status"
      aria-label="Task completed notification"
    >
      <CheckCircle className="text-emerald-400 flex-shrink-0" size={16} />
      <div>
        <p className="text-sm font-medium text-emerald-400">Last task completed</p>
        <p className="text-xs text-emerald-400/80">{timeStr}</p>
      </div>
    </div>
  );
}

/**
 * GroomAssignmentCard
 *
 * Shows the current groom for a horse with details and task overview.
 * Provides a button to assign a new groom or change the existing one.
 */
const GroomAssignmentCard: React.FC<GroomAssignmentCardProps> = ({
  assignment,
  horseName,
  horseAge,
  onAssign,
  compact = false,
}) => {
  // Empty state: no groom assigned
  if (!assignment) {
    return (
      <div
        className="rounded-lg border-2 border-dashed border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.4)] p-6 text-center"
        data-testid="no-assignment-card"
      >
        <User className="mx-auto text-[rgb(148,163,184)] mb-3" size={32} />
        <h3 className="font-medium text-[rgb(220,235,255)] mb-1">No Groom Assigned</h3>
        <p className="text-sm text-[rgb(148,163,184)] mb-4">
          Assign a groom to {horseName} to begin task-based care and bonding.
        </p>
        <button
          onClick={onAssign}
          className="btn-cobalt px-4 py-2 text-sm font-medium"
          data-testid="assign-groom-button"
          aria-label={`Assign a groom to ${horseName}`}
        >
          Assign Groom
        </button>
      </div>
    );
  }

  // Assigned state
  return (
    <div
      className="rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.4)] overflow-hidden"
      data-testid="assignment-card"
    >
      {/* Groom info header */}
      <div className="p-4 border-b border-[rgba(37,99,235,0.3)]">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="text-rose-400 flex-shrink-0" size={14} />
              <h3
                className="font-semibold text-[rgb(220,235,255)]"
                data-testid="assigned-groom-name"
              >
                {assignment.groomName}
              </h3>
              {assignment.priority === 1 && (
                <span
                  className="text-xs bg-[rgba(212,168,67,0.1)] text-burnished-gold px-1.5 py-0.5 rounded"
                  data-testid="primary-badge"
                >
                  Primary
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className="text-xs text-[rgb(148,163,184)] capitalize"
                data-testid="groom-skill-level"
              >
                {skillLabel(assignment.skillLevel)}
              </span>
              <span className="text-[rgba(37,99,235,0.3)]">·</span>
              <span className="text-xs text-[rgb(148,163,184)]" data-testid="groom-experience">
                {assignment.experience} yr{assignment.experience !== 1 ? 's' : ''} exp.
              </span>
            </div>

            <GroomPersonalityBadge
              personality={assignment.personality}
              showTooltip={false}
              size="sm"
            />
          </div>

          <button
            onClick={onAssign}
            className="ml-3 flex items-center gap-1 text-xs text-[rgb(148,163,184)] hover:text-[rgb(220,235,255)] border border-[rgba(37,99,235,0.3)] hover:border-[rgba(37,99,235,0.6)] rounded px-2 py-1 transition-colors"
            data-testid="change-groom-button"
            aria-label={`Change groom assigned to ${horseName}`}
          >
            <RefreshCw size={12} />
            Change
          </button>
        </div>

        {/* Bond score */}
        <BondScoreBar score={assignment.bondScore} />

        {/* Task completion notice */}
        {assignment.lastTaskCompletedAt && (
          <TaskCompletionNotice completedAt={assignment.lastTaskCompletedAt} />
        )}

        {/* Notes */}
        {assignment.notes && (
          <p
            className="text-xs text-[rgb(148,163,184)] italic mt-3 border-t border-[rgba(37,99,235,0.3)] pt-2"
            data-testid="assignment-notes"
          >
            {assignment.notes}
          </p>
        )}
      </div>

      {/* Task panel */}
      <div className="p-4">
        <GroomTaskPanel horseAge={horseAge} compact={compact} />
      </div>
    </div>
  );
};

export default GroomAssignmentCard;
