/**
 * Story 7-4: Career Lifecycle Dashboard
 * Acceptance Criteria Tests
 *
 * FR-G4: Players can track groom career progression including experience,
 * level, retirement timeline, milestones, and performance history.
 *
 * AC1: Experience, level, and retirement timeline displayed
 * AC2: Career milestones tracked
 * AC3: Retirement age and benefits displayed
 * AC4: Performance history shown
 * AC5: Warnings for approaching retirement
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GroomCareerPanel from '../groom/GroomCareerPanel';
import {
  calculateXPProgress,
  calculateRetirementStatus,
  buildCareerMilestones,
  xpToStartLevel,
  CAREER_CONSTANTS,
  type GroomCareerData,
  type GroomPerformanceMetrics,
} from '../../types/groomCareer';

// ──────────────────────────────────────────────────────────────────────────────
// Helper function tests
// ──────────────────────────────────────────────────────────────────────────────

describe('groomCareer helpers', () => {
  describe('xpToStartLevel', () => {
    it('level 1 starts at 0 XP', () => {
      expect(xpToStartLevel(1)).toBe(0);
    });

    it('level 2 starts at 100 XP', () => {
      expect(xpToStartLevel(2)).toBe(100);
    });

    it('level 3 starts at 300 XP', () => {
      expect(xpToStartLevel(3)).toBe(300);
    });

    it('level 4 starts at 600 XP', () => {
      expect(xpToStartLevel(4)).toBe(600);
    });

    it('level 10 starts at 4500 XP', () => {
      expect(xpToStartLevel(10)).toBe(4500);
    });
  });

  describe('calculateXPProgress', () => {
    it('returns level 1 for 0 XP', () => {
      const result = calculateXPProgress(0);
      expect(result.level).toBe(1);
      expect(result.xpInLevel).toBe(0);
      expect(result.xpToNextLevel).toBe(100);
      expect(result.isMaxLevel).toBe(false);
      expect(result.progressPercent).toBe(0);
    });

    it('returns level 1 for 50 XP with 50% progress', () => {
      const result = calculateXPProgress(50);
      expect(result.level).toBe(1);
      expect(result.xpInLevel).toBe(50);
      expect(result.progressPercent).toBe(50);
    });

    it('returns level 2 for exactly 100 XP', () => {
      const result = calculateXPProgress(100);
      expect(result.level).toBe(2);
      expect(result.xpInLevel).toBe(0);
      expect(result.xpToNextLevel).toBe(200);
    });

    it('returns level 3 for exactly 300 XP', () => {
      const result = calculateXPProgress(300);
      expect(result.level).toBe(3);
      expect(result.xpInLevel).toBe(0);
    });

    it('returns level 10 (max) at 4500+ XP', () => {
      const result = calculateXPProgress(4500);
      expect(result.level).toBe(10);
      expect(result.isMaxLevel).toBe(true);
      expect(result.xpToNextLevel).toBe(0);
      expect(result.progressPercent).toBe(100);
    });

    it('still shows level 10 for XP above cap', () => {
      const result = calculateXPProgress(9999);
      expect(result.level).toBe(10);
      expect(result.isMaxLevel).toBe(true);
    });

    it('calculates progress percent correctly mid-level', () => {
      // Level 2 needs 200 XP; start at 100, so 100 XP progress at 100 XP into level = 50%
      const result = calculateXPProgress(200); // 200 - 100 = 100 / 200 XP for level 2 = 50%
      expect(result.level).toBe(2);
      expect(result.xpInLevel).toBe(100);
      expect(result.progressPercent).toBe(50);
    });
  });

  describe('calculateRetirementStatus', () => {
    it('returns safe status for new groom', () => {
      const status = calculateRetirementStatus(0, 1, 0);
      expect(status.isRetired).toBe(false);
      expect(status.isApproachingRetirement).toBe(false);
      expect(status.earlyRetirementEligible).toBe(false);
      expect(status.weeksRemaining).toBe(104);
      expect(status.warningReasons).toHaveLength(0);
    });

    it('returns weeksRemaining = 0 at mandatory retirement week', () => {
      const status = calculateRetirementStatus(104, 5, 3);
      expect(status.isRetired).toBe(true);
      expect(status.weeksRemaining).toBe(0);
      expect(status.warningReasons).toContain('approaching_mandatory');
    });

    it('flags approaching retirement at week 103 (1 week notice)', () => {
      const status = calculateRetirementStatus(103, 5, 3);
      expect(status.isApproachingRetirement).toBe(true);
      expect(status.weeksRemaining).toBe(1);
      expect(status.warningReasons).toContain('approaching_mandatory');
    });

    it('does NOT flag approaching at week 102', () => {
      const status = calculateRetirementStatus(102, 5, 3);
      expect(status.isApproachingRetirement).toBe(false);
      expect(status.weeksRemaining).toBe(2);
    });

    it('flags early retirement at level 10', () => {
      const status = calculateRetirementStatus(10, 10, 2);
      expect(status.earlyRetirementEligible).toBe(true);
      expect(status.earlyRetirementReason).toBe('level_cap');
      expect(status.warningReasons).toContain('level_cap');
    });

    it('flags early retirement at 12+ assignments', () => {
      const status = calculateRetirementStatus(10, 5, 12);
      expect(status.earlyRetirementEligible).toBe(true);
      expect(status.earlyRetirementReason).toBe('assignment_limit');
      expect(status.warningReasons).toContain('assignment_limit');
    });

    it('prioritizes level_cap over assignment_limit in earlyRetirementReason', () => {
      const status = calculateRetirementStatus(10, 10, 12);
      expect(status.earlyRetirementReason).toBe('level_cap');
      expect(status.warningReasons).toContain('level_cap');
      expect(status.warningReasons).toContain('assignment_limit');
    });

    it('clamps weeksRemaining to 0 (never negative)', () => {
      const status = calculateRetirementStatus(200, 5, 3);
      expect(status.weeksRemaining).toBe(0);
    });
  });

  describe('buildCareerMilestones', () => {
    it('always marks Career Started as reached', () => {
      const milestones = buildCareerMilestones(1, 0, 0);
      const started = milestones.find((m) => m.id === 'hired');
      expect(started?.reached).toBe(true);
    });

    it('marks First Assignment as reached when assignmentCount >= 1', () => {
      const reached = buildCareerMilestones(1, 0, 1);
      const notReached = buildCareerMilestones(1, 0, 0);
      expect(reached.find((m) => m.id === 'first_assignment')?.reached).toBe(true);
      expect(notReached.find((m) => m.id === 'first_assignment')?.reached).toBe(false);
    });

    it('marks Level 5 as reached when level >= 5', () => {
      const reached = buildCareerMilestones(5, 0, 0);
      const notReached = buildCareerMilestones(4, 0, 0);
      expect(reached.find((m) => m.id === 'level_5')?.reached).toBe(true);
      expect(notReached.find((m) => m.id === 'level_5')?.reached).toBe(false);
    });

    it('marks Master Groom (Level 10) as reached when level >= 10', () => {
      const reached = buildCareerMilestones(10, 0, 0);
      expect(reached.find((m) => m.id === 'level_10')?.reached).toBe(true);
    });

    it('marks Six Months as reached when careerWeeks >= 26', () => {
      const reached = buildCareerMilestones(1, 26, 0);
      const notReached = buildCareerMilestones(1, 25, 0);
      expect(reached.find((m) => m.id === 'six_month')?.reached).toBe(true);
      expect(notReached.find((m) => m.id === 'six_month')?.reached).toBe(false);
    });

    it('marks One Year as reached when careerWeeks >= 52', () => {
      const reached = buildCareerMilestones(1, 52, 0);
      expect(reached.find((m) => m.id === 'one_year')?.reached).toBe(true);
    });

    it('returns 6 milestones total', () => {
      const milestones = buildCareerMilestones(1, 0, 0);
      expect(milestones).toHaveLength(6);
    });
  });

  describe('CAREER_CONSTANTS', () => {
    it('mandatory retirement is 104 weeks', () => {
      expect(CAREER_CONSTANTS.MANDATORY_RETIREMENT_WEEKS).toBe(104);
    });

    it('early retirement level is 10', () => {
      expect(CAREER_CONSTANTS.EARLY_RETIREMENT_LEVEL).toBe(10);
    });

    it('early retirement assignment limit is 12', () => {
      expect(CAREER_CONSTANTS.EARLY_RETIREMENT_ASSIGNMENTS).toBe(12);
    });

    it('retirement notice period is 1 week', () => {
      expect(CAREER_CONSTANTS.RETIREMENT_NOTICE_WEEKS).toBe(1);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ──────────────────────────────────────────────────────────────────────────────

const baseGroom: GroomCareerData = {
  id: 1,
  name: 'Aria Thompson',
  experience: 250,
  level: 2,
  careerWeeks: 15,
  hiredDate: '2025-01-01T00:00:00.000Z',
  retired: false,
};

const masterGroom: GroomCareerData = {
  ...baseGroom,
  experience: 5000,
  level: 10,
  careerWeeks: 80,
};

const approachingRetirementGroom: GroomCareerData = {
  ...baseGroom,
  experience: 1000,
  level: 5,
  careerWeeks: 103,
};

const retiredGroom: GroomCareerData = {
  ...baseGroom,
  experience: 3000,
  level: 8,
  careerWeeks: 104,
  retired: true,
  retirementReason: 'mandatory_career_limit',
  retirementTimestamp: '2026-01-01T00:00:00.000Z',
};

const sampleMetrics: GroomPerformanceMetrics = {
  totalInteractions: 42,
  bondingEffectiveness: 75,
  taskCompletion: 88,
  horseWellbeing: 65,
  showPerformance: 72,
  reputationScore: 80,
};

// ──────────────────────────────────────────────────────────────────────────────
// AC1: Experience, level, and retirement timeline
// ──────────────────────────────────────────────────────────────────────────────

describe('AC1: Experience, level, and retirement timeline', () => {
  it('renders the career panel', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('groom-career-panel')).toBeInTheDocument();
    expect(screen.getByTestId('career-panel-title')).toHaveTextContent('Career Overview');
  });

  it('shows level badge with current level', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('level-badge')).toHaveTextContent('2');
  });

  it('shows level label', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('level-label')).toHaveTextContent('Level 2');
  });

  it('shows XP display with xpInLevel / xpToNextLevel', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    // 250 XP: level 2 starts at 100, so 150 XP into level 2 / 200 needed
    expect(screen.getByTestId('xp-display')).toHaveTextContent('150 / 200 XP');
  });

  it('shows XP progress bar', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('xp-progress-bar')).toBeInTheDocument();
  });

  it('shows total XP', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('total-xp')).toHaveTextContent('250');
  });

  it('shows career weeks active', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('career-weeks')).toHaveTextContent('15 weeks active');
  });

  it('shows weeks remaining until retirement', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('weeks-remaining')).toHaveTextContent('89 weeks remaining');
  });

  it('shows career progress bar', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('career-progress-bar')).toBeInTheDocument();
  });

  it('shows retirement deadline text', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('retirement-deadline')).toHaveTextContent('104 weeks');
  });

  it('has accessible aria-label on the panel', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('groom-career-panel')).toHaveAttribute(
      'aria-label',
      'Career information for Aria Thompson'
    );
  });

  it('shows Max XP reached label and 100% progress for level 10', () => {
    render(<GroomCareerPanel groom={masterGroom} />);
    expect(screen.getByTestId('xp-display')).toHaveTextContent('Max XP reached');
    expect(screen.getByTestId('level-badge')).toHaveTextContent('10');
  });

  it('shows (Max) in level label at level cap', () => {
    render(<GroomCareerPanel groom={masterGroom} />);
    expect(screen.getByTestId('level-label')).toHaveTextContent('Level 10 (Max)');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC2: Career milestones tracked
// ──────────────────────────────────────────────────────────────────────────────

describe('AC2: Career milestones tracked', () => {
  it('renders the milestones section', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('career-milestones-section')).toBeInTheDocument();
  });

  it('shows Career Started milestone as reached', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('milestone-hired')).toBeInTheDocument();
  });

  it('shows First Assignment milestone as reached when assignmentCount >= 1', () => {
    render(<GroomCareerPanel groom={baseGroom} assignmentCount={1} />);
    const milestone = screen.getByTestId('milestone-first_assignment');
    expect(milestone).toBeInTheDocument();
    // Reached milestones show CheckCircle (no descriptive text appended)
    expect(milestone).not.toHaveTextContent('Assigned to a horse');
  });

  it('shows First Assignment milestone as not yet reached when assignmentCount = 0', () => {
    render(<GroomCareerPanel groom={baseGroom} assignmentCount={0} />);
    const milestone = screen.getByTestId('milestone-first_assignment');
    expect(milestone).toHaveTextContent('Assigned to a horse for the first time');
  });

  it('shows Level 5 milestone as not reached at level 4', () => {
    render(<GroomCareerPanel groom={{ ...baseGroom, level: 4, experience: 600 }} />);
    const milestone = screen.getByTestId('milestone-level_5');
    expect(milestone).toHaveTextContent('Reached level 5');
  });

  it('shows Level 5 milestone as reached at level 5', () => {
    render(<GroomCareerPanel groom={{ ...baseGroom, level: 5, experience: 1000 }} />);
    const milestone = screen.getByTestId('milestone-level_5');
    expect(milestone).not.toHaveTextContent('Reached level 5');
  });

  it('shows Master Groom milestone as reached at level 10', () => {
    render(<GroomCareerPanel groom={masterGroom} />);
    const milestone = screen.getByTestId('milestone-level_10');
    expect(milestone).toBeInTheDocument();
  });

  it('shows Six Months milestone', () => {
    render(<GroomCareerPanel groom={{ ...baseGroom, careerWeeks: 26 }} />);
    expect(screen.getByTestId('milestone-six_month')).toBeInTheDocument();
  });

  it('shows One Year milestone', () => {
    render(<GroomCareerPanel groom={{ ...baseGroom, careerWeeks: 52 }} />);
    expect(screen.getByTestId('milestone-one_year')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC3: Retirement age and benefits displayed
// ──────────────────────────────────────────────────────────────────────────────

describe('AC3: Retirement age and benefits displayed', () => {
  it('renders retirement benefits info section by default', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('retirement-benefits-info')).toBeInTheDocument();
  });

  it('shows mandatory retirement week rule', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('rule-mandatory')).toHaveTextContent('104 weeks');
  });

  it('shows early retirement level rule', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('rule-early-level')).toHaveTextContent('Level 10');
  });

  it('shows early retirement assignment rule', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('rule-early-assignments')).toHaveTextContent('12+');
  });

  it('shows retirement notice period rule', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.getByTestId('rule-notice')).toHaveTextContent('1 week');
  });

  it('hides retirement benefits info in compact mode', () => {
    render(<GroomCareerPanel groom={baseGroom} compact />);
    expect(screen.queryByTestId('retirement-benefits-info')).not.toBeInTheDocument();
  });

  it('shows retired badge when groom is retired', () => {
    render(<GroomCareerPanel groom={retiredGroom} />);
    expect(screen.getByTestId('retired-badge')).toHaveTextContent('Retired');
  });

  it('shows retired notice with reason when groom is retired', () => {
    render(<GroomCareerPanel groom={retiredGroom} />);
    expect(screen.getByTestId('retired-notice')).toBeInTheDocument();
    expect(screen.getByTestId('retired-reason')).toHaveTextContent(
      'Mandatory retirement (2-year career limit)'
    );
  });

  it('shows retired date when retirementTimestamp provided', () => {
    render(<GroomCareerPanel groom={retiredGroom} />);
    expect(screen.getByTestId('retired-date')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC4: Performance history shown
// ──────────────────────────────────────────────────────────────────────────────

describe('AC4: Performance history shown', () => {
  it('renders performance metrics when provided', () => {
    render(<GroomCareerPanel groom={baseGroom} metrics={sampleMetrics} />);
    expect(screen.getByTestId('performance-metrics-section')).toBeInTheDocument();
  });

  it('shows bonding effectiveness score', () => {
    render(<GroomCareerPanel groom={baseGroom} metrics={sampleMetrics} />);
    expect(screen.getByTestId('metric-bonding')).toHaveTextContent('75');
  });

  it('shows task completion score', () => {
    render(<GroomCareerPanel groom={baseGroom} metrics={sampleMetrics} />);
    expect(screen.getByTestId('metric-task-completion')).toHaveTextContent('88');
  });

  it('shows horse wellbeing score', () => {
    render(<GroomCareerPanel groom={baseGroom} metrics={sampleMetrics} />);
    expect(screen.getByTestId('metric-horse-wellbeing')).toHaveTextContent('65');
  });

  it('shows show performance score', () => {
    render(<GroomCareerPanel groom={baseGroom} metrics={sampleMetrics} />);
    expect(screen.getByTestId('metric-show-performance')).toHaveTextContent('72');
  });

  it('shows reputation score', () => {
    render(<GroomCareerPanel groom={baseGroom} metrics={sampleMetrics} />);
    expect(screen.getByTestId('metric-reputation')).toHaveTextContent('80');
  });

  it('shows total interactions count', () => {
    render(<GroomCareerPanel groom={baseGroom} metrics={sampleMetrics} />);
    expect(screen.getByTestId('metric-total-interactions')).toHaveTextContent('42');
  });

  it('does NOT render performance section when metrics not provided', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.queryByTestId('performance-metrics-section')).not.toBeInTheDocument();
  });

  it('hides performance metrics in compact mode even when provided', () => {
    render(<GroomCareerPanel groom={baseGroom} metrics={sampleMetrics} compact />);
    expect(screen.queryByTestId('performance-metrics-section')).not.toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC5: Warnings for approaching retirement
// ──────────────────────────────────────────────────────────────────────────────

describe('AC5: Warnings for approaching retirement', () => {
  it('shows NO warning for a new groom', () => {
    render(<GroomCareerPanel groom={baseGroom} />);
    expect(screen.queryByTestId('retirement-warning')).not.toBeInTheDocument();
  });

  it('shows approaching retirement warning at week 103', () => {
    render(<GroomCareerPanel groom={approachingRetirementGroom} />);
    expect(screen.getByTestId('retirement-warning')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows "1 week remaining" in approaching retirement message', () => {
    render(<GroomCareerPanel groom={approachingRetirementGroom} />);
    expect(screen.getByTestId('approaching-retirement-message')).toHaveTextContent(
      '1 week remaining'
    );
  });

  it('shows early retirement warning when level 10 reached', () => {
    render(<GroomCareerPanel groom={masterGroom} />);
    expect(screen.getByTestId('retirement-warning')).toBeInTheDocument();
    expect(screen.getByTestId('early-retirement-level-message')).toBeInTheDocument();
  });

  it('shows assignment limit warning when 12+ assignments', () => {
    render(<GroomCareerPanel groom={baseGroom} assignmentCount={12} />);
    expect(screen.getByTestId('retirement-warning')).toBeInTheDocument();
    expect(screen.getByTestId('early-retirement-assignment-message')).toBeInTheDocument();
  });

  it('warning has role="alert" for accessibility', () => {
    render(<GroomCareerPanel groom={approachingRetirementGroom} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does NOT show retirement warning for retired groom (shows retired notice instead)', () => {
    render(<GroomCareerPanel groom={retiredGroom} />);
    expect(screen.queryByTestId('retirement-warning')).not.toBeInTheDocument();
    expect(screen.getByTestId('retired-notice')).toBeInTheDocument();
  });

  it('shows warning for approaching AND early retirement simultaneously', () => {
    const dualWarningGroom: GroomCareerData = {
      ...baseGroom,
      level: 10,
      experience: 5000,
      careerWeeks: 103,
    };
    render(<GroomCareerPanel groom={dualWarningGroom} />);
    expect(screen.getByTestId('retirement-warning')).toBeInTheDocument();
    expect(screen.getByTestId('approaching-retirement-message')).toBeInTheDocument();
    expect(screen.getByTestId('early-retirement-level-message')).toBeInTheDocument();
  });
});
