/**
 * TrainerCareerPanel — Career progress display (Epic 13 — Story 13-4)
 *
 * Displays trainer career progression:
 * - Career timeline (weeks served, sessions run)
 * - Retirement status / warnings
 * - Legacy certification eligibility
 * - Career milestones (hired, first session, service, sessions)
 *
 * Mirrors RiderCareerPanel.tsx for the Trainer System.
 * Retirement: mandatory at 80 weeks; early at L8+
 */

import React from 'react';
import { staffLevelStars } from '@/lib/staffLevels';
import { Trophy, Clock, AlertTriangle, Star, CheckCircle, Circle } from 'lucide-react';

export interface TrainerCareerData {
  id: number;
  name: string;
  experience: number;
  /** rookie..expert (owner ruling 2026-10-28, q229: the only level a trainer has). */
  starLevel: string;
  careerWeeks: number;
  hiredDate: string;
  retired: boolean;
  totalSessions: number;
  totalHorses: number;
}

const MANDATORY_RETIREMENT_WEEKS = 80;
const RETIREMENT_WARNING_WEEKS = 72; // 8 weeks notice

function calculateRetirementStatus(careerWeeks: number, starLevel: string) {
  const mandatoryRetirement = careerWeeks >= MANDATORY_RETIREMENT_WEEKS;
  const isApproachingRetirement = careerWeeks >= RETIREMENT_WARNING_WEEKS && !mandatoryRetirement;
  const weeksRemaining = mandatoryRetirement ? 0 : MANDATORY_RETIREMENT_WEEKS - careerWeeks;
  // The old "level 7 or above" in stars (owner ruling 2026-10-28, q229: two old
  // levels per star), i.e. Advanced or Expert.
  const legacyEligible = staffLevelStars(starLevel) * 2 >= 7;
  return {
    mandatoryRetirement,
    isApproachingRetirement,
    weeksRemaining,
    legacyEligible,
  };
}

// The "Level 3 / 6 / 9" milestones went with the old 1-10 level (owner ruling
// 2026-10-28, q229): a trainer's star level is fixed at hire, so it is no milestone.
function buildMilestones(careerWeeks: number, totalSessions: number) {
  return [
    {
      id: 'hired',
      label: 'Trainer Hired',
      description: 'Joined your stable staff',
      reached: true,
    },
    {
      id: 'first_session',
      label: 'First Training Session',
      description: 'Completed at least 1 training session',
      reached: totalSessions >= 1,
    },
    {
      id: 'weeks_12',
      label: '12 Weeks Service',
      description: 'Three months on the payroll',
      reached: careerWeeks >= 12,
    },
    {
      id: 'sessions_50',
      label: '50 Training Sessions',
      description: 'Seasoned veteran trainer',
      reached: totalSessions >= 50,
    },
  ];
}

interface TrainerCareerPanelProps {
  trainer: TrainerCareerData;
  assignmentCount?: number;
}

const TrainerCareerPanel: React.FC<TrainerCareerPanelProps> = ({
  trainer,
  assignmentCount = 0,
}) => {
  const retirementStatus = calculateRetirementStatus(trainer.careerWeeks, trainer.starLevel);
  const milestones = buildMilestones(trainer.careerWeeks, trainer.totalSessions);

  return (
    <div className="space-y-5" data-testid="trainer-career-panel">
      {/* Retirement Warning */}
      {retirementStatus.isApproachingRetirement && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--role-warning-bg)] border border-[var(--role-warning-border)] text-sm text-[var(--role-warning-text)]"
          data-testid="retirement-warning"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            ⚠️ Retiring in{' '}
            <strong>
              {retirementStatus.weeksRemaining} week
              {retirementStatus.weeksRemaining !== 1 ? 's' : ''}
            </strong>
          </span>
        </div>
      )}

      {/* Legacy Badge */}
      {retirementStatus.legacyEligible && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--alpha-gold-primary-10)] border border-[var(--alpha-gold-primary-30)] text-sm text-[var(--gold-primary)]"
          data-testid="legacy-badge"
        >
          <Star className="w-4 h-4" />
          <span>Legacy Certification Eligible</span>
        </div>
      )}

      {/* Owner ruling 2026-10-28 (q229): no old "Level N" here; the trainer's stars
          show on the card. */}
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-lg bg-[var(--glass-surface-subtle-bg)] border border-[var(--glass-border)]">
          <Trophy className="w-4 h-4 text-[var(--gold-primary)] mx-auto mb-1" />
          <p className="text-lg font-bold text-[var(--text-primary)]">{trainer.totalSessions}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Sessions</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-[var(--glass-surface-subtle-bg)] border border-[var(--glass-border)]">
          <p className="text-lg font-bold text-[var(--text-primary)]">{trainer.totalHorses}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Horses Trained</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-[var(--glass-surface-subtle-bg)] border border-[var(--glass-border)]">
          <Clock className="w-4 h-4 text-[var(--text-muted)] mx-auto mb-1" />
          <p className="text-lg font-bold text-[var(--text-primary)]">{trainer.careerWeeks}w</p>
          <p className="text-[10px] text-[var(--text-muted)]">Career</p>
        </div>
      </div>

      {/* Assignment info */}
      {assignmentCount > 0 && (
        <div className="text-xs text-[var(--text-muted)]">
          Currently assigned to {assignmentCount} horse{assignmentCount !== 1 ? 's' : ''}
        </div>
      )}

      {/* Career Milestones */}
      <div>
        <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2.5">
          Career Milestones
        </h4>
        <div className="space-y-2">
          {milestones.map((milestone) => (
            <div
              key={milestone.id}
              className="flex items-center gap-2.5"
              data-testid={`milestone-${milestone.id}`}
            >
              {milestone.reached ? (
                <CheckCircle className="w-4 h-4 text-[var(--role-success-text)] flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-role-disabled flex-shrink-0" />
              )}
              <div>
                <p
                  className={`text-xs font-medium ${
                    milestone.reached ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {milestone.label}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">{milestone.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrainerCareerPanel;
