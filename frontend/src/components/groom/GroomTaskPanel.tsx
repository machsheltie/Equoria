/**
 * GroomTaskPanel Component (Story 7-3: Task Assignment UI)
 *
 * Displays available groom tasks for a horse based on its age.
 * Tasks are grouped by category (enrichment, foal_grooming, general_grooming)
 * and show duration and effects for each task.
 *
 * Acceptance Criteria covered:
 * - AC1: Tasks vary by horse age (foal enrichment vs adult grooming)
 * - AC2: Task duration and effects displayed
 */

import React from 'react';
import {
  TaskCategory,
  TaskInfo,
  TASK_CATEGORY_INFO,
  formatDuration,
  getAvailableCategories,
  getTasksByCategory,
} from '../../types/groomTasks';

interface GroomTaskPanelProps {
  /** Horse age in years (used to determine eligible task categories) */
  horseAge: number;
  /** When true, shows a condensed view without task descriptions */
  compact?: boolean;
}

/** Duration badge for a single task */
function DurationBadge({ minutes }: { minutes: number }) {
  return (
    <span
      className="inline-flex items-center text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
      aria-label={`Duration: ${formatDuration(minutes)}`}
    >
      ⏱ {formatDuration(minutes)}
    </span>
  );
}

/** Effect chip for a task effect */
function EffectChip({ label, type }: { label: string; type: 'positive' | 'neutral' }) {
  const colorClass =
    type === 'positive'
      ? 'bg-green-50 text-green-700 border border-green-200'
      : 'bg-gray-50 text-gray-600 border border-gray-200';
  return <span className={`inline-block text-xs px-2 py-0.5 rounded ${colorClass}`}>{label}</span>;
}

/** Single task card within a category section */
function TaskCard({ task, compact }: { task: TaskInfo; compact: boolean }) {
  return (
    <div
      className="border border-gray-200 rounded-lg p-3 bg-white"
      data-testid={`task-card-${task.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-gray-900 text-sm" data-testid={`task-name-${task.id}`}>
          {task.name}
        </span>
        <DurationBadge minutes={task.recommendedDurationMinutes} />
      </div>

      {!compact && (
        <p className="text-xs text-gray-500 mt-1 mb-2" data-testid={`task-description-${task.id}`}>
          {task.description}
        </p>
      )}

      <div
        className="flex flex-wrap gap-1 mt-2"
        data-testid={`task-effects-${task.id}`}
        aria-label={`Effects for ${task.name}`}
      >
        {task.effects.map((effect, idx) => (
          <EffectChip key={idx} label={effect.label} type={effect.type} />
        ))}
      </div>
    </div>
  );
}

/** Section header for a task category */
function CategorySection({
  category,
  tasks,
  compact,
}: {
  category: TaskCategory;
  tasks: TaskInfo[];
  compact: boolean;
}) {
  const info = TASK_CATEGORY_INFO[category];

  return (
    <div data-testid={`category-section-${category}`}>
      <div className="flex items-center gap-2 mb-3">
        <span aria-hidden="true">{info.icon}</span>
        <h4
          className={`font-semibold text-sm ${info.colorClass}`}
          data-testid={`category-label-${category}`}
        >
          {info.label}
        </h4>
        <span className={`text-xs px-2 py-0.5 rounded-full ${info.badgeClass}`}>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {!compact && (
        <p className="text-xs text-gray-500 mb-3" data-testid={`category-description-${category}`}>
          {info.description}
        </p>
      )}

      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} compact={compact} />
        ))}
      </div>
    </div>
  );
}

/**
 * GroomTaskPanel
 *
 * Renders available groom tasks for a horse based on age.
 * Groups tasks by category (enrichment / foal grooming / adult grooming).
 */
const GroomTaskPanel: React.FC<GroomTaskPanelProps> = ({ horseAge, compact = false }) => {
  const availableCategories = getAvailableCategories(horseAge);
  const tasksByCategory = getTasksByCategory(horseAge);

  const ageLabel =
    horseAge < 1 ? 'Under 1 year' : horseAge === 1 ? '1 year old' : `${horseAge} years old`;

  return (
    <div
      className="rounded-lg border border-gray-200 bg-gray-50 p-4"
      data-testid="groom-task-panel"
      aria-label={`Available groom tasks for horse aged ${ageLabel}`}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900" data-testid="task-panel-title">
          Available Tasks
        </h3>
        <span
          className="text-xs text-gray-500 bg-white px-2 py-1 rounded border"
          data-testid="horse-age-label"
        >
          Horse age: {ageLabel}
        </span>
      </div>

      {/* No tasks available */}
      {availableCategories.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4" data-testid="no-tasks-message">
          No tasks available for this horse age.
        </p>
      )}

      {/* Task category sections */}
      <div className="space-y-6">
        {availableCategories.map((category) => (
          <CategorySection
            key={category}
            category={category}
            tasks={tasksByCategory[category]}
            compact={compact}
          />
        ))}
      </div>

      {/* Mutual exclusivity note */}
      {!compact && availableCategories.length > 0 && (
        <p
          className="text-xs text-gray-400 mt-4 border-t pt-3"
          data-testid="mutual-exclusivity-note"
        >
          Note: Only one enrichment or grooming task may be performed per day.
        </p>
      )}
    </div>
  );
};

export default GroomTaskPanel;
