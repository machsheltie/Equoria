/**
 * Story 7-3: Task Assignment UI
 * Acceptance Criteria Tests
 *
 * FR-G3: Players assign grooms to specific tasks so their horses receive
 * appropriate care.
 *
 * AC1: Grooms are assigned and begin work (tested via GroomAssignmentCard)
 * AC2: Tasks vary by horse age (foal enrichment vs adult grooming)
 * AC3: Task duration and effects displayed
 * AC4: Can reassign grooms as needed
 * AC5: Task completion notifications
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GroomTaskPanel from '../groom/GroomTaskPanel';
import GroomAssignmentCard, { GroomAssignment } from '../groom/GroomAssignmentCard';
import {
  getTasksForAge,
  getTasksByCategory,
  getAvailableCategories,
  formatDuration,
  TASK_DATA,
  TASK_CATEGORY_INFO,
  TASK_AGE_THRESHOLDS,
} from '../../types/groomTasks';

// ──────────────────────────────────────────────────────────────────────────────
// Helper function tests (inline — must test now per testing strategy)
// ──────────────────────────────────────────────────────────────────────────────

describe('groomTasks helpers', () => {
  describe('getTasksForAge', () => {
    it('returns enrichment tasks for age 0', () => {
      const tasks = getTasksForAge(0);
      expect(tasks.length).toBeGreaterThan(0);
      tasks.forEach((t) => expect(t.category).toBe('enrichment'));
    });

    it('returns enrichment and foal_grooming for age 1', () => {
      const tasks = getTasksForAge(1);
      const categories = [...new Set(tasks.map((t) => t.category))];
      expect(categories).toContain('enrichment');
      expect(categories).toContain('foal_grooming');
      expect(categories).not.toContain('general_grooming');
    });

    it('returns enrichment and foal_grooming for age 2', () => {
      const tasks = getTasksForAge(2);
      const categories = [...new Set(tasks.map((t) => t.category))];
      expect(categories).toContain('enrichment');
      expect(categories).toContain('foal_grooming');
    });

    it('returns foal_grooming and general_grooming for age 3', () => {
      const tasks = getTasksForAge(3);
      const categories = [...new Set(tasks.map((t) => t.category))];
      expect(categories).toContain('foal_grooming');
      expect(categories).toContain('general_grooming');
      // Enrichment max age is 2, so not available at 3
      expect(categories).not.toContain('enrichment');
    });

    it('returns only general_grooming for age 5', () => {
      const tasks = getTasksForAge(5);
      const categories = [...new Set(tasks.map((t) => t.category))];
      expect(categories).toEqual(['general_grooming']);
    });

    it('each task has required fields', () => {
      TASK_DATA.forEach((task) => {
        expect(task.id).toBeTruthy();
        expect(task.name).toBeTruthy();
        expect(task.category).toMatch(/enrichment|foal_grooming|general_grooming/);
        expect(task.recommendedDurationMinutes).toBeGreaterThan(0);
        expect(task.effects.length).toBeGreaterThan(0);
        expect(task.description).toBeTruthy();
      });
    });
  });

  describe('getTasksByCategory', () => {
    it('groups tasks by category for age 1', () => {
      const grouped = getTasksByCategory(1);
      expect(grouped.enrichment.length).toBeGreaterThan(0);
      expect(grouped.foal_grooming.length).toBeGreaterThan(0);
      expect(grouped.general_grooming.length).toBe(0);
    });

    it('groups tasks by category for age 4', () => {
      const grouped = getTasksByCategory(4);
      expect(grouped.enrichment.length).toBe(0);
      expect(grouped.foal_grooming.length).toBe(0);
      expect(grouped.general_grooming.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableCategories', () => {
    it('returns only enrichment for age 0', () => {
      expect(getAvailableCategories(0)).toEqual(['enrichment']);
    });

    it('returns enrichment and foal_grooming for age 2', () => {
      const cats = getAvailableCategories(2);
      expect(cats).toContain('enrichment');
      expect(cats).toContain('foal_grooming');
    });

    it('returns only general_grooming for age 10', () => {
      expect(getAvailableCategories(10)).toEqual(['general_grooming']);
    });
  });

  describe('formatDuration', () => {
    it('formats minutes under 60 as Xm', () => {
      expect(formatDuration(30)).toBe('30m');
      expect(formatDuration(45)).toBe('45m');
    });

    it('formats exactly 60 minutes as 1h', () => {
      expect(formatDuration(60)).toBe('1h');
    });

    it('formats 90 minutes as 1h 30m', () => {
      expect(formatDuration(90)).toBe('1h 30m');
    });

    it('formats 120 minutes as 2h', () => {
      expect(formatDuration(120)).toBe('2h');
    });
  });

  describe('TASK_CATEGORY_INFO', () => {
    it('has all three categories defined', () => {
      expect(TASK_CATEGORY_INFO.enrichment).toBeTruthy();
      expect(TASK_CATEGORY_INFO.foal_grooming).toBeTruthy();
      expect(TASK_CATEGORY_INFO.general_grooming).toBeTruthy();
    });

    it('each category has required display fields', () => {
      Object.values(TASK_CATEGORY_INFO).forEach((info) => {
        expect(info.label).toBeTruthy();
        expect(info.icon).toBeTruthy();
        expect(info.description).toBeTruthy();
      });
    });
  });

  describe('TASK_AGE_THRESHOLDS', () => {
    it('has correct age boundaries matching backend config', () => {
      expect(TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MIN).toBe(0);
      expect(TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MAX).toBe(2);
      expect(TASK_AGE_THRESHOLDS.FOAL_GROOMING_MIN).toBe(1);
      expect(TASK_AGE_THRESHOLDS.FOAL_GROOMING_MAX).toBe(3);
      expect(TASK_AGE_THRESHOLDS.GENERAL_GROOMING_MIN).toBe(3);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC2: Tasks vary by horse age (foal enrichment vs adult grooming)
// ──────────────────────────────────────────────────────────────────────────────

describe('GroomTaskPanel — AC2: Tasks vary by horse age', () => {
  it('shows enrichment tasks only for a newborn foal (age 0)', () => {
    render(<GroomTaskPanel horseAge={0} />);
    expect(screen.getByTestId('category-section-enrichment')).toBeInTheDocument();
    expect(screen.queryByTestId('category-section-foal_grooming')).not.toBeInTheDocument();
    expect(screen.queryByTestId('category-section-general_grooming')).not.toBeInTheDocument();
  });

  it('shows both enrichment and foal_grooming for a 1-year-old foal', () => {
    render(<GroomTaskPanel horseAge={1} />);
    expect(screen.getByTestId('category-section-enrichment')).toBeInTheDocument();
    expect(screen.getByTestId('category-section-foal_grooming')).toBeInTheDocument();
    expect(screen.queryByTestId('category-section-general_grooming')).not.toBeInTheDocument();
  });

  it('shows foal_grooming and general_grooming for a 3-year-old horse', () => {
    render(<GroomTaskPanel horseAge={3} />);
    expect(screen.queryByTestId('category-section-enrichment')).not.toBeInTheDocument();
    expect(screen.getByTestId('category-section-foal_grooming')).toBeInTheDocument();
    expect(screen.getByTestId('category-section-general_grooming')).toBeInTheDocument();
  });

  it('shows only adult grooming for a 6-year-old horse', () => {
    render(<GroomTaskPanel horseAge={6} />);
    expect(screen.queryByTestId('category-section-enrichment')).not.toBeInTheDocument();
    expect(screen.queryByTestId('category-section-foal_grooming')).not.toBeInTheDocument();
    expect(screen.getByTestId('category-section-general_grooming')).toBeInTheDocument();
  });

  it('displays correct category labels', () => {
    render(<GroomTaskPanel horseAge={1} />);
    expect(screen.getByTestId('category-label-enrichment')).toHaveTextContent('Foal Enrichment');
    expect(screen.getByTestId('category-label-foal_grooming')).toHaveTextContent('Foal Grooming');
  });

  it('shows horse age label in header', () => {
    render(<GroomTaskPanel horseAge={2} />);
    expect(screen.getByTestId('horse-age-label')).toHaveTextContent('2 years old');
  });

  it('shows "Under 1 year" for age 0', () => {
    render(<GroomTaskPanel horseAge={0} />);
    expect(screen.getByTestId('horse-age-label')).toHaveTextContent('Under 1 year');
  });

  it('shows "1 year old" for age 1', () => {
    render(<GroomTaskPanel horseAge={1} />);
    expect(screen.getByTestId('horse-age-label')).toHaveTextContent('1 year old');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC3: Task duration and effects displayed
// ──────────────────────────────────────────────────────────────────────────────

describe('GroomTaskPanel — AC3: Task duration and effects displayed', () => {
  it('renders task cards with names', () => {
    render(<GroomTaskPanel horseAge={0} />);
    // Enrichment tasks should all be present
    expect(screen.getByTestId('task-card-desensitization')).toBeInTheDocument();
    expect(screen.getByTestId('task-name-desensitization')).toHaveTextContent('Desensitization');
  });

  it('shows duration badge on each task', () => {
    render(<GroomTaskPanel horseAge={0} />);
    // desensitization is 30 minutes
    const card = screen.getByTestId('task-card-desensitization');
    expect(card).toHaveTextContent('30m');
  });

  it('shows task effects on each task', () => {
    render(<GroomTaskPanel horseAge={0} />);
    const effects = screen.getByTestId('task-effects-desensitization');
    expect(effects).toBeInTheDocument();
    // desensitization effects include "Reduces fear response"
    expect(effects).toHaveTextContent('Reduces fear response');
  });

  it('shows task description in full mode (non-compact)', () => {
    render(<GroomTaskPanel horseAge={0} compact={false} />);
    expect(screen.getByTestId('task-description-desensitization')).toBeInTheDocument();
  });

  it('hides task descriptions in compact mode', () => {
    render(<GroomTaskPanel horseAge={0} compact={true} />);
    expect(screen.queryByTestId('task-description-desensitization')).not.toBeInTheDocument();
  });

  it('shows mutual exclusivity note in full mode', () => {
    render(<GroomTaskPanel horseAge={0} compact={false} />);
    expect(screen.getByTestId('mutual-exclusivity-note')).toBeInTheDocument();
  });

  it('hides mutual exclusivity note in compact mode', () => {
    render(<GroomTaskPanel horseAge={0} compact={true} />);
    expect(screen.queryByTestId('mutual-exclusivity-note')).not.toBeInTheDocument();
  });

  it('shows all adult grooming tasks for age 5', () => {
    render(<GroomTaskPanel horseAge={5} />);
    expect(screen.getByTestId('task-card-brushing')).toBeInTheDocument();
    expect(screen.getByTestId('task-card-bathing')).toBeInTheDocument();
    expect(screen.getByTestId('task-card-stall_care')).toBeInTheDocument();
  });

  it('shows trust_building task with correct effects', () => {
    render(<GroomTaskPanel horseAge={0} />);
    const effects = screen.getByTestId('task-effects-trust_building');
    expect(effects).toHaveTextContent('Increases bond score');
    expect(effects).toHaveTextContent('Reduces stress level');
  });

  it('shows hand-walking task with duration for adult horse', () => {
    render(<GroomTaskPanel horseAge={4} />);
    const card = screen.getByTestId('task-card-hand-walking');
    expect(card).toHaveTextContent('30m');
    expect(card).toHaveTextContent('Reduces burnout risk');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC4: Can reassign grooms as needed
// ──────────────────────────────────────────────────────────────────────────────

describe('GroomAssignmentCard — AC4: Can reassign grooms', () => {
  const mockAssignment: GroomAssignment = {
    id: 1,
    groomId: 10,
    groomName: 'Sarah',
    skillLevel: 'expert',
    personality: 'gentle',
    experience: 5,
    bondScore: 65,
    priority: 1,
    isActive: true,
  };

  it('shows assigned groom name', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={mockAssignment}
        horseName="Starlight"
        horseAge={1}
        onAssign={onAssign}
      />
    );
    expect(screen.getByTestId('assigned-groom-name')).toHaveTextContent('Sarah');
  });

  it('shows Change Groom button when groom is assigned', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={mockAssignment}
        horseName="Starlight"
        horseAge={1}
        onAssign={onAssign}
      />
    );
    expect(screen.getByTestId('change-groom-button')).toBeInTheDocument();
  });

  it('calls onAssign when Change Groom is clicked', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={mockAssignment}
        horseName="Starlight"
        horseAge={1}
        onAssign={onAssign}
      />
    );
    fireEvent.click(screen.getByTestId('change-groom-button'));
    expect(onAssign).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no assignment', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={null}
        horseName="Starlight"
        horseAge={1}
        onAssign={onAssign}
      />
    );
    expect(screen.getByTestId('no-assignment-card')).toBeInTheDocument();
    expect(screen.queryByTestId('assignment-card')).not.toBeInTheDocument();
  });

  it('shows Assign Groom button in empty state', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={null}
        horseName="Starlight"
        horseAge={1}
        onAssign={onAssign}
      />
    );
    expect(screen.getByTestId('assign-groom-button')).toBeInTheDocument();
  });

  it('calls onAssign when Assign Groom button clicked in empty state', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={null}
        horseName="Starlight"
        horseAge={1}
        onAssign={onAssign}
      />
    );
    fireEvent.click(screen.getByTestId('assign-groom-button'));
    expect(onAssign).toHaveBeenCalledTimes(1);
  });

  it('shows Primary badge for priority-1 assignment', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={mockAssignment}
        horseName="Starlight"
        horseAge={1}
        onAssign={onAssign}
      />
    );
    expect(screen.getByTestId('primary-badge')).toBeInTheDocument();
  });

  it('does not show Primary badge for non-primary assignment', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={{ ...mockAssignment, priority: 2 }}
        horseName="Starlight"
        horseAge={1}
        onAssign={onAssign}
      />
    );
    expect(screen.queryByTestId('primary-badge')).not.toBeInTheDocument();
  });

  it('shows groom skill level and experience', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={mockAssignment}
        horseName="Starlight"
        horseAge={1}
        onAssign={onAssign}
      />
    );
    expect(screen.getByTestId('groom-skill-level')).toHaveTextContent('Expert');
    expect(screen.getByTestId('groom-experience')).toHaveTextContent('5 yrs exp.');
  });

  it('shows bond score with progress bar', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={mockAssignment}
        horseName="Starlight"
        horseAge={1}
        onAssign={onAssign}
      />
    );
    expect(screen.getByTestId('bond-score-section')).toBeInTheDocument();
    expect(screen.getByTestId('bond-score-value')).toHaveTextContent('65/100');
  });

  it('shows personality badge for assigned groom', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={mockAssignment}
        horseName="Starlight"
        horseAge={1}
        onAssign={onAssign}
      />
    );
    expect(screen.getByTestId('personality-badge')).toBeInTheDocument();
  });

  it('includes task panel showing age-appropriate tasks', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={mockAssignment}
        horseName="Starlight"
        horseAge={1}
        onAssign={onAssign}
      />
    );
    // At age 1, enrichment and foal_grooming tasks should be visible
    expect(screen.getByTestId('groom-task-panel')).toBeInTheDocument();
    expect(screen.getByTestId('category-section-enrichment')).toBeInTheDocument();
    expect(screen.getByTestId('category-section-foal_grooming')).toBeInTheDocument();
  });

  it('shows assignment notes when present', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={{ ...mockAssignment, notes: 'Focus on bonding activities' }}
        horseName="Starlight"
        horseAge={1}
        onAssign={onAssign}
      />
    );
    expect(screen.getByTestId('assignment-notes')).toHaveTextContent('Focus on bonding activities');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC5: Task completion notifications
// ──────────────────────────────────────────────────────────────────────────────

describe('GroomAssignmentCard — AC5: Task completion notifications', () => {
  const mockAssignment: GroomAssignment = {
    id: 1,
    groomId: 10,
    groomName: 'Sarah',
    skillLevel: 'expert',
    personality: 'gentle',
    experience: 5,
    bondScore: 65,
    priority: 1,
    isActive: true,
  };

  it('shows task completion notice when lastTaskCompletedAt is set', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={{
          ...mockAssignment,
          lastTaskCompletedAt: '2026-02-17T10:00:00Z',
        }}
        horseName="Starlight"
        horseAge={2}
        onAssign={onAssign}
      />
    );
    expect(screen.getByTestId('task-completion-notice')).toBeInTheDocument();
    expect(screen.getByTestId('task-completion-notice')).toHaveTextContent('Last task completed');
  });

  it('does not show completion notice when no task has been completed', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={mockAssignment}
        horseName="Starlight"
        horseAge={2}
        onAssign={onAssign}
      />
    );
    expect(screen.queryByTestId('task-completion-notice')).not.toBeInTheDocument();
  });

  it('completion notice has accessible role="status"', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={{
          ...mockAssignment,
          lastTaskCompletedAt: '2026-02-17T10:00:00Z',
        }}
        horseName="Starlight"
        horseAge={2}
        onAssign={onAssign}
      />
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Accessibility tests
// ──────────────────────────────────────────────────────────────────────────────

describe('GroomTaskPanel — Accessibility', () => {
  it('has aria-label on the panel', () => {
    render(<GroomTaskPanel horseAge={2} />);
    const panel = screen.getByTestId('groom-task-panel');
    expect(panel).toHaveAttribute('aria-label', 'Available groom tasks for horse aged 2 years old');
  });

  it('bond score bar has correct ARIA attributes', () => {
    const onAssign = vi.fn();
    render(
      <GroomAssignmentCard
        assignment={{
          id: 1,
          groomId: 10,
          groomName: 'Bob',
          skillLevel: 'novice',
          personality: 'patient',
          experience: 2,
          bondScore: 40,
          priority: 1,
          isActive: true,
        }}
        horseName="Misty"
        horseAge={4}
        onAssign={onAssign}
      />
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });
});
