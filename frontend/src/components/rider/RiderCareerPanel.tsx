/**
 * RiderCareerPanel Component (Epic 9C — Story 9C-4)
 *
 * Displays rider career progress:
 * - XP / level progress bar
 * - Career timeline (weeks served)
 * - Retirement status / warnings
 * - Legacy contract eligibility
 * - Career milestones (hired, first win, level caps, years)
 *
 * Mirrors GroomCareerPanel.tsx for the Rider System.
 */

import React from 'react';
import { Trophy, Clock, AlertTriangle, Star, CheckCircle, Circle } from 'lucide-react';
import {
  RiderCareerData,
  calculateRiderXPProgress,
  calculateRiderRetirementStatus,
  buildRiderCareerMilestones,
} from '@/types/riderCareer';

interface RiderCareerPanelProps {
  rider: RiderCareerData;
  assignmentCount?: number;
}

const RiderCareerPanel: React.FC<RiderCareerPanelProps> = ({ rider, assignmentCount = 0 }) => {
  const xpProgress = calculateRiderXPProgress(rider.experience);
  const retirementStatus = calculateRiderRetirementStatus(
    rider.careerWeeks,
    rider.level,
    rider.totalWins,
    rider.prestige
  );
  const milestones = buildRiderCareerMilestones(rider.level, rider.careerWeeks, rider.totalWins);

  const hasCompetitionData = rider.totalCompetitions > 0;
  const winRate = hasCompetitionData
    ? Math.round((rider.totalWins / rider.totalCompetitions) * 100)
    : null;

  return (
    <div className="space-y-5" data-testid="rider-career-panel">
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

      {/* Legacy Contract Badge */}
      {retirementStatus.legacyContractEligible && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-celestial-gold/10 border border-celestial-gold/30 text-sm text-celestial-gold"
          data-testid="legacy-contract-badge"
        >
          <Star className="w-4 h-4" />
          <span>Legacy Contract Eligible</span>
        </div>
      )}

      {/* XP / Level Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Level {xpProgress.level}
          </span>
          {xpProgress.isMaxLevel ? (
            <span className="text-xs text-celestial-gold font-semibold">MAX LEVEL</span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">
              {xpProgress.xpInLevel} / {xpProgress.xpToNextLevel} XP
            </span>
          )}
        </div>
        <div className="h-2 bg-[var(--glass-surface-subtle-bg)] rounded-full overflow-hidden">
          <div
            className="h-full bg-celestial-gold rounded-full transition-all duration-700"
            style={{ width: `${xpProgress.progressPercent}%` }}
            data-testid="xp-progress-bar"
          />
        </div>
        <p className="text-[10px] text-[var(--text-muted)] mt-1">{rider.experience} total XP</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-lg bg-[var(--glass-surface-subtle-bg)] border border-[var(--glass-border)]">
          <Trophy className="w-4 h-4 text-celestial-gold mx-auto mb-1" />
          <p className="text-lg font-bold text-[var(--text-primary)]">{rider.totalWins}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Wins</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-[var(--glass-surface-subtle-bg)] border border-[var(--glass-border)]">
          <p className="text-lg font-bold text-[var(--text-primary)]">
            {winRate === null ? '—' : `${winRate}%`}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">Win Rate</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-[var(--glass-surface-subtle-bg)] border border-[var(--glass-border)]">
          <Clock className="w-4 h-4 text-[var(--text-muted)] mx-auto mb-1" />
          <p className="text-lg font-bold text-[var(--text-primary)]">{rider.careerWeeks}w</p>
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

export default RiderCareerPanel;
