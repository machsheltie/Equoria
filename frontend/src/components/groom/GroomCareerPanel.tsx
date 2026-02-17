/**
 * GroomCareerPanel Component (Story 7-4: Career Lifecycle Dashboard)
 *
 * Displays a groom's career progression including:
 * - XP/level progress bar with level badge
 * - Career timeline (weeks active, retirement deadline)
 * - Retirement warnings (approaching mandatory or early-eligible)
 * - Performance metrics grid
 * - Career milestone tracker
 *
 * Acceptance Criteria covered:
 * - AC1: Experience, level, and retirement timeline
 * - AC2: Career milestones tracked
 * - AC3: Retirement age and benefits displayed
 * - AC4: Performance history shown
 * - AC5: Warnings for approaching retirement
 */

import React from 'react';
import { AlertTriangle, CheckCircle, Clock, Star, TrendingUp, Award, Calendar } from 'lucide-react';
import {
  GroomCareerData,
  GroomPerformanceMetrics,
  CareerMilestone,
  CAREER_CONSTANTS,
  RETIREMENT_REASON_LABELS,
  calculateXPProgress,
  calculateRetirementStatus,
  buildCareerMilestones,
} from '../../types/groomCareer';

interface GroomCareerPanelProps {
  /** Groom career data including XP, level, and career weeks */
  groom: GroomCareerData;
  /** Number of total horse assignments (for early retirement check) */
  assignmentCount?: number;
  /** Optional performance metrics from backend GroomMetrics model */
  metrics?: GroomPerformanceMetrics;
  /** When true, shows a compact version without performance metrics */
  compact?: boolean;
}

/** XP progress bar with level badge */
function LevelProgressBar({ experience }: { experience: number }) {
  const progress = calculateXPProgress(experience);

  return (
    <div data-testid="level-progress-section">
      <div className="flex items-center gap-3 mb-2">
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-800 font-bold text-lg"
          data-testid="level-badge"
          aria-label={`Level ${progress.level}`}
        >
          {progress.level}
        </span>
        <div className="flex-1">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span data-testid="level-label">
              Level {progress.level}
              {progress.isMaxLevel ? ' (Max)' : ''}
            </span>
            <span data-testid="xp-display">
              {progress.isMaxLevel
                ? 'Max XP reached'
                : `${progress.xpInLevel} / ${progress.xpToNextLevel} XP`}
            </span>
          </div>
          <div
            className="h-2 bg-gray-200 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={progress.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Level progress: ${progress.progressPercent}%`}
            data-testid="xp-progress-bar"
          >
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress.progressPercent}%` }}
              data-testid="xp-progress-fill"
            />
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400" data-testid="total-xp">
        Total XP: {experience}
      </p>
    </div>
  );
}

/** Career timeline showing weeks active and retirement deadline */
function CareerTimeline({
  careerWeeks,
  weeksRemaining,
}: {
  careerWeeks: number;
  weeksRemaining: number;
}) {
  const { MANDATORY_RETIREMENT_WEEKS } = CAREER_CONSTANTS;
  const progressPercent = Math.min(
    100,
    Math.round((careerWeeks / MANDATORY_RETIREMENT_WEEKS) * 100)
  );

  return (
    <div data-testid="career-timeline-section">
      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
        Career Timeline
      </h4>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>
          <Clock className="inline w-3 h-3 mr-1" aria-hidden="true" />
          <span data-testid="career-weeks">{careerWeeks} weeks active</span>
        </span>
        <span data-testid="weeks-remaining">
          {weeksRemaining > 0 ? `${weeksRemaining} weeks remaining` : 'Retirement due'}
        </span>
      </div>
      <div
        className="h-2 bg-gray-200 rounded-full overflow-hidden mb-1"
        role="progressbar"
        aria-valuenow={careerWeeks}
        aria-valuemin={0}
        aria-valuemax={MANDATORY_RETIREMENT_WEEKS}
        aria-label={`Career progress: ${careerWeeks} of ${MANDATORY_RETIREMENT_WEEKS} weeks`}
        data-testid="career-progress-bar"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            progressPercent >= 90
              ? 'bg-red-500'
              : progressPercent >= 75
                ? 'bg-amber-500'
                : 'bg-green-500'
          }`}
          style={{ width: `${progressPercent}%` }}
          data-testid="career-progress-fill"
        />
      </div>
      <p className="text-xs text-gray-400" data-testid="retirement-deadline">
        Mandatory retirement at {MANDATORY_RETIREMENT_WEEKS} weeks
      </p>
    </div>
  );
}

/** Warning banner for approaching retirement or early retirement eligibility */
function RetirementWarning({
  isApproachingRetirement,
  earlyRetirementEligible,
  earlyRetirementReason,
  weeksRemaining,
}: {
  isApproachingRetirement: boolean;
  earlyRetirementEligible: boolean;
  earlyRetirementReason?: string;
  weeksRemaining: number;
}) {
  if (!isApproachingRetirement && !earlyRetirementEligible) return null;

  return (
    <div
      className={`flex items-start gap-2 rounded-lg p-3 border ${
        isApproachingRetirement
          ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-amber-50 border-amber-200 text-amber-800'
      }`}
      role="alert"
      data-testid="retirement-warning"
    >
      <AlertTriangle className="flex-shrink-0 mt-0.5" size={16} aria-hidden="true" />
      <div>
        {isApproachingRetirement && (
          <p className="text-sm font-medium" data-testid="approaching-retirement-message">
            Retirement approaching — {weeksRemaining} week{weeksRemaining !== 1 ? 's' : ''}{' '}
            remaining
          </p>
        )}
        {earlyRetirementEligible && earlyRetirementReason === 'level_cap' && (
          <p className="text-sm font-medium" data-testid="early-retirement-level-message">
            Master level achieved — eligible for early retirement
          </p>
        )}
        {earlyRetirementEligible && earlyRetirementReason === 'assignment_limit' && (
          <p className="text-sm font-medium" data-testid="early-retirement-assignment-message">
            Assignment limit reached ({CAREER_CONSTANTS.EARLY_RETIREMENT_ASSIGNMENTS}+) — eligible
            for early retirement
          </p>
        )}
      </div>
    </div>
  );
}

/** Retired groom notice */
function RetiredNotice({
  reason,
  retirementTimestamp,
}: {
  reason?: string;
  retirementTimestamp?: string;
}) {
  const retiredDate = retirementTimestamp
    ? new Date(retirementTimestamp).toLocaleDateString()
    : null;
  const reasonLabel = reason ? (RETIREMENT_REASON_LABELS[reason] ?? reason) : 'Retired';

  return (
    <div
      className="flex items-start gap-2 bg-gray-100 border border-gray-300 rounded-lg p-3"
      role="status"
      data-testid="retired-notice"
    >
      <Award className="flex-shrink-0 text-gray-500 mt-0.5" size={16} aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-gray-700" data-testid="retired-reason">
          {reasonLabel}
        </p>
        {retiredDate && (
          <p className="text-xs text-gray-500" data-testid="retired-date">
            Retired on {retiredDate}
          </p>
        )}
      </div>
    </div>
  );
}

/** Performance metrics grid */
function PerformanceMetricsGrid({ metrics }: { metrics: GroomPerformanceMetrics }) {
  const metricRows: { label: string; value: number; testId: string }[] = [
    { label: 'Bonding', value: metrics.bondingEffectiveness, testId: 'metric-bonding' },
    { label: 'Task Completion', value: metrics.taskCompletion, testId: 'metric-task-completion' },
    { label: 'Horse Wellbeing', value: metrics.horseWellbeing, testId: 'metric-horse-wellbeing' },
    {
      label: 'Show Performance',
      value: metrics.showPerformance,
      testId: 'metric-show-performance',
    },
    { label: 'Reputation', value: metrics.reputationScore, testId: 'metric-reputation' },
  ];

  const getScoreColor = (value: number) =>
    value >= 70 ? 'text-green-600' : value >= 40 ? 'text-amber-600' : 'text-red-500';

  return (
    <div data-testid="performance-metrics-section">
      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" aria-hidden="true" />
        Performance History
      </h4>
      <div className="grid grid-cols-2 gap-2" data-testid="metrics-grid">
        {metricRows.map((m) => (
          <div
            key={m.testId}
            className="flex items-center justify-between bg-white rounded px-3 py-2 border border-gray-100"
          >
            <span className="text-xs text-gray-500">{m.label}</span>
            <span
              className={`text-sm font-semibold ${getScoreColor(m.value)}`}
              data-testid={m.testId}
            >
              {m.value}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between bg-white rounded px-3 py-2 border border-gray-100">
          <span className="text-xs text-gray-500">Interactions</span>
          <span
            className="text-sm font-semibold text-gray-700"
            data-testid="metric-total-interactions"
          >
            {metrics.totalInteractions}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Career milestone tracker */
function MilestoneTracker({ milestones }: { milestones: CareerMilestone[] }) {
  return (
    <div data-testid="career-milestones-section">
      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-1">
        <Star className="w-3 h-3" aria-hidden="true" />
        Career Milestones
      </h4>
      <div className="space-y-2">
        {milestones.map((milestone) => (
          <div
            key={milestone.id}
            className={`flex items-center gap-2 text-xs ${milestone.reached ? 'text-gray-800' : 'text-gray-400'}`}
            data-testid={`milestone-${milestone.id}`}
          >
            {milestone.reached ? (
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" aria-hidden="true" />
            ) : (
              <div
                className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0"
                aria-hidden="true"
              />
            )}
            <div>
              <span className="font-medium">{milestone.label}</span>
              {!milestone.reached && (
                <span className="ml-1 text-gray-400">— {milestone.description}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Retirement rules info section */
function RetirementBenefitsInfo() {
  return (
    <div
      className="bg-blue-50 border border-blue-100 rounded-lg p-3"
      data-testid="retirement-benefits-info"
    >
      <h4 className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
        <Calendar className="w-3 h-3" aria-hidden="true" />
        Retirement Rules
      </h4>
      <ul className="space-y-1 text-xs text-blue-600">
        <li data-testid="rule-mandatory">
          Mandatory retirement at {CAREER_CONSTANTS.MANDATORY_RETIREMENT_WEEKS} weeks (2 years)
        </li>
        <li data-testid="rule-early-level">
          Early retirement eligible at Level {CAREER_CONSTANTS.EARLY_RETIREMENT_LEVEL} (Master)
        </li>
        <li data-testid="rule-early-assignments">
          Early retirement eligible after {CAREER_CONSTANTS.EARLY_RETIREMENT_ASSIGNMENTS}+
          assignments
        </li>
        <li data-testid="rule-notice">
          Retirement notice given {CAREER_CONSTANTS.RETIREMENT_NOTICE_WEEKS} week in advance
        </li>
      </ul>
    </div>
  );
}

/**
 * GroomCareerPanel
 *
 * Displays a groom's career lifecycle: XP/level, timeline, retirement status,
 * performance metrics, and career milestones.
 */
const GroomCareerPanel: React.FC<GroomCareerPanelProps> = ({
  groom,
  assignmentCount = 0,
  metrics,
  compact = false,
}) => {
  const retirementStatus = calculateRetirementStatus(
    groom.careerWeeks,
    groom.level,
    assignmentCount
  );
  const milestones = buildCareerMilestones(groom.level, groom.careerWeeks, assignmentCount);

  return (
    <div
      className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-5"
      data-testid="groom-career-panel"
      aria-label={`Career information for ${groom.name}`}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900" data-testid="career-panel-title">
          Career Overview
        </h3>
        {groom.retired && (
          <span
            className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded"
            data-testid="retired-badge"
          >
            Retired
          </span>
        )}
      </div>

      {/* Retired notice */}
      {groom.retired && (
        <RetiredNotice
          reason={groom.retirementReason}
          retirementTimestamp={groom.retirementTimestamp}
        />
      )}

      {/* Retirement warning (only for active grooms) */}
      {!groom.retired && (
        <RetirementWarning
          isApproachingRetirement={retirementStatus.isApproachingRetirement}
          earlyRetirementEligible={retirementStatus.earlyRetirementEligible}
          earlyRetirementReason={retirementStatus.earlyRetirementReason}
          weeksRemaining={retirementStatus.weeksRemaining}
        />
      )}

      {/* XP / Level progress */}
      <LevelProgressBar experience={groom.experience} />

      {/* Career timeline */}
      <CareerTimeline
        careerWeeks={groom.careerWeeks}
        weeksRemaining={retirementStatus.weeksRemaining}
      />

      {/* Retirement rules info */}
      {!compact && <RetirementBenefitsInfo />}

      {/* Career milestones */}
      <MilestoneTracker milestones={milestones} />

      {/* Performance metrics (only when data provided and not compact) */}
      {!compact && metrics && <PerformanceMetricsGrid metrics={metrics} />}
    </div>
  );
};

export default GroomCareerPanel;
