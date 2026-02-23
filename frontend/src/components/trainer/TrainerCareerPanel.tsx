/**
 * TrainerCareerPanel — Career progress display (Epic 13 — Story 13-4)
 *
 * Displays trainer career progression:
 * - XP / level progress bar
 * - Career timeline (weeks served, sessions run)
 * - Retirement status / warnings
 * - Legacy certification eligibility
 * - Career milestones (hired, first session, level caps)
 *
 * Mirrors RiderCareerPanel.tsx for the Trainer System.
 * XP formula: 100 * level * (level - 1) / 2 (same as Grooms / Riders)
 * Retirement: mandatory at 80 weeks; early at L8+
 */

import React from 'react';
import { Trophy, Clock, AlertTriangle, Star, CheckCircle, Circle } from 'lucide-react';

export interface TrainerCareerData {
  id: number;
  name: string;
  experience: number;
  level: number;
  careerWeeks: number;
  hiredDate: string;
  retired: boolean;
  totalSessions: number;
  totalHorses: number;
}

const MAX_LEVEL = 10;
const MANDATORY_RETIREMENT_WEEKS = 80;
const RETIREMENT_WARNING_WEEKS = 72; // 8 weeks notice

function calculateXPProgress(experience: number) {
  // Level from XP: 100 * L * (L-1) / 2 = XP at start of level L
  let level = 1;
  while (level < MAX_LEVEL) {
    const xpForNextLevel = Math.floor(100 * (level + 1) * level) / 2;
    if (experience < xpForNextLevel) break;
    level++;
  }
  const isMaxLevel = level >= MAX_LEVEL;
  const xpAtLevelStart = isMaxLevel ? 0 : Math.floor((100 * level * (level - 1)) / 2);
  const xpAtNextLevel = isMaxLevel ? 1 : Math.floor((100 * (level + 1) * level) / 2);
  const xpInLevel = experience - xpAtLevelStart;
  const xpToNextLevel = xpAtNextLevel - xpAtLevelStart;
  const progressPercent = isMaxLevel
    ? 100
    : Math.min(100, Math.round((xpInLevel / xpToNextLevel) * 100));
  return { level, xpInLevel, xpToNextLevel, progressPercent, isMaxLevel };
}

function calculateRetirementStatus(careerWeeks: number, level: number) {
  const mandatoryRetirement = careerWeeks >= MANDATORY_RETIREMENT_WEEKS;
  const earlyRetirement = level >= 8;
  const isApproachingRetirement = careerWeeks >= RETIREMENT_WARNING_WEEKS && !mandatoryRetirement;
  const weeksRemaining = mandatoryRetirement ? 0 : MANDATORY_RETIREMENT_WEEKS - careerWeeks;
  const legacyEligible = level >= 7;
  return {
    mandatoryRetirement,
    earlyRetirement,
    isApproachingRetirement,
    weeksRemaining,
    legacyEligible,
  };
}

function buildMilestones(level: number, careerWeeks: number, totalSessions: number) {
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
      id: 'level3',
      label: 'Level 3 Certified',
      description: 'Earned junior certification',
      reached: level >= 3,
    },
    {
      id: 'weeks_12',
      label: '12 Weeks Service',
      description: 'Three months on the payroll',
      reached: careerWeeks >= 12,
    },
    {
      id: 'level6',
      label: 'Level 6 Senior',
      description: 'Earned senior trainer status',
      reached: level >= 6,
    },
    {
      id: 'sessions_50',
      label: '50 Training Sessions',
      description: 'Seasoned veteran trainer',
      reached: totalSessions >= 50,
    },
    {
      id: 'level9',
      label: 'Level 9 Master',
      description: 'Near-legendary expertise',
      reached: level >= 9,
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
  const xpProgress = calculateXPProgress(trainer.experience);
  const retirementStatus = calculateRetirementStatus(trainer.careerWeeks, trainer.level);
  const milestones = buildMilestones(trainer.level, trainer.careerWeeks, trainer.totalSessions);

  return (
    <div className="space-y-5" data-testid="trainer-career-panel">
      {/* Retirement Warning */}
      {retirementStatus.isApproachingRetirement && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-900/30 border border-amber-500/40 text-sm text-amber-300"
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
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-celestial-gold/10 border border-celestial-gold/30 text-sm text-celestial-gold"
          data-testid="legacy-badge"
        >
          <Star className="w-4 h-4" />
          <span>Legacy Certification Eligible</span>
        </div>
      )}

      {/* XP / Level Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
            Level {xpProgress.level}
          </span>
          {xpProgress.isMaxLevel ? (
            <span className="text-xs text-celestial-gold font-semibold">MAX LEVEL</span>
          ) : (
            <span className="text-xs text-white/40">
              {xpProgress.xpInLevel} / {xpProgress.xpToNextLevel} XP
            </span>
          )}
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-celestial-gold rounded-full transition-all duration-700"
            style={{ width: `${xpProgress.progressPercent}%` }}
            data-testid="xp-progress-bar"
          />
        </div>
        <p className="text-[10px] text-white/30 mt-1">{trainer.experience} total XP</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-lg bg-white/5 border border-white/10">
          <Trophy className="w-4 h-4 text-celestial-gold mx-auto mb-1" />
          <p className="text-lg font-bold text-white/90">{trainer.totalSessions}</p>
          <p className="text-[10px] text-white/40">Sessions</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-lg font-bold text-white/90">{trainer.totalHorses}</p>
          <p className="text-[10px] text-white/40">Horses Trained</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-white/5 border border-white/10">
          <Clock className="w-4 h-4 text-white/40 mx-auto mb-1" />
          <p className="text-lg font-bold text-white/90">{trainer.careerWeeks}w</p>
          <p className="text-[10px] text-white/40">Career</p>
        </div>
      </div>

      {/* Assignment info */}
      {assignmentCount > 0 && (
        <div className="text-xs text-white/40">
          Currently assigned to {assignmentCount} horse{assignmentCount !== 1 ? 's' : ''}
        </div>
      )}

      {/* Career Milestones */}
      <div>
        <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2.5">
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
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-white/20 flex-shrink-0" />
              )}
              <div>
                <p
                  className={`text-xs font-medium ${
                    milestone.reached ? 'text-white/80' : 'text-white/30'
                  }`}
                >
                  {milestone.label}
                </p>
                <p className="text-[10px] text-white/30">{milestone.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrainerCareerPanel;
