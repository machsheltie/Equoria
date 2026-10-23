/**
 * RiderCareerPanel Component (Epic 9C — Story 9C-4)
 *
 * Displays rider career progress:
 * - Level (generated and fixed: riders earn no XP, Equoria-dea06)
 * - Career timeline (weeks served)
 * - Legacy contract eligibility
 * - Career milestones (hired, first win, level caps, years)
 *
 * Mirrors GroomCareerPanel.tsx for the Rider System.
 */

import React from 'react';
import { Trophy, Clock, Star, CheckCircle, Circle } from 'lucide-react';
import {
  RiderCareerData,
  isRiderLegacyContractEligible,
  buildRiderCareerMilestones,
} from '@/types/riderCareer';

interface RiderCareerPanelProps {
  rider: RiderCareerData;
  assignmentCount?: number;
}

const RiderCareerPanel: React.FC<RiderCareerPanelProps> = ({ rider, assignmentCount = 0 }) => {
  const legacyContractEligible = isRiderLegacyContractEligible(rider.totalWins, rider.prestige);
  const milestones = buildRiderCareerMilestones(rider.level, rider.careerWeeks, rider.totalWins);

  const hasCompetitionData = rider.totalCompetitions > 0;
  const winRate = hasCompetitionData
    ? Math.round((rider.totalWins / rider.totalCompetitions) * 100)
    : null;

  return (
    <div className="space-y-5" data-testid="rider-career-panel">
      {/* Legacy Contract Badge */}
      {legacyContractEligible && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--alpha-gold-primary-10)] border border-[var(--alpha-gold-primary-30)] text-sm text-[var(--gold-primary)]"
          data-testid="legacy-contract-badge"
        >
          <Star className="w-4 h-4" />
          <span>Legacy Contract Eligible</span>
        </div>
      )}

      {/* Level. Equoria-dea06: staff are fixed NPCs with no XP; this is the
          level the rider was generated with. */}
      <p
        className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider"
        data-testid="rider-level"
      >
        Level {rider.level}
      </p>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-lg bg-[var(--glass-surface-subtle-bg)] border border-[var(--glass-border)]">
          <Trophy className="w-4 h-4 text-[var(--gold-primary)] mx-auto mb-1" />
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
