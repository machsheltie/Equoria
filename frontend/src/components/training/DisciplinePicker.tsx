/**
 * DisciplinePicker Component
 *
 * Grid-based interface for selecting training disciplines with:
 * - 23 disciplines organized into 4 categories (Western, English, Specialized, Racing)
 * - Current score display for each discipline
 * - Visual feedback for selection (blue background)
 * - Disabled state for cooldown disciplines
 * - Responsive grid: 1 col mobile, 2 cols tablet, 4 cols desktop
 *
 * Story 4-1: Training Session Interface - Task 3
 */

import { getDisciplinesByCategory } from '../../lib/utils/training-utils.js';

export interface DisciplinePickerProps {
  /**
   * Current discipline scores for the horse
   */
  disciplineScores: { [disciplineId: string]: number };

  /**
   * Currently selected discipline
   */
  selectedDiscipline: string | null;

  /**
   * Callback when discipline is selected
   */
  onSelectDiscipline: (disciplineId: string) => void;

  /**
   * Disabled disciplines (e.g., on cooldown)
   */
  disabledDisciplines?: string[];

  /**
   * Loading state
   */
  isLoading?: boolean;

  /**
   * Optional CSS class
   */
  className?: string;
}

interface DisciplineCategoryProps {
  title: 'Western' | 'English' | 'Specialized' | 'Racing';
  selectedDiscipline: string | null;
  disciplineScores: { [disciplineId: string]: number };
  onSelectDiscipline: (disciplineId: string) => void;
  disabledDisciplines: string[];
  isLoading: boolean;
}

/**
 * Single category section with discipline buttons
 */
const DisciplineCategory = ({
  title,
  selectedDiscipline,
  disciplineScores,
  onSelectDiscipline,
  disabledDisciplines,
  isLoading,
}: DisciplineCategoryProps) => {
  const disciplines = getDisciplinesByCategory(title);

  return (
    <div className="space-y-3">
      {/* Category Header */}
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{title}</h3>

      {/* Discipline Buttons */}
      <div className="space-y-2">
        {disciplines.map((discipline) => {
          const isSelected = selectedDiscipline === discipline.id;
          const isDisabled = disabledDisciplines.includes(discipline.id) || isLoading;
          const score = disciplineScores[discipline.id] || 0;

          return (
            <button
              key={discipline.id}
              type="button"
              onClick={() => !isDisabled && onSelectDiscipline(discipline.id)}
              disabled={isDisabled}
              aria-label={`Select ${discipline.name} discipline, current score: ${score}`}
              aria-selected={isSelected}
              aria-disabled={isDisabled}
              className={`
                w-full px-3 py-2 text-left rounded-lg border transition-all
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : isDisabled
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-900 border-gray-300 hover:border-blue-400 hover:shadow-sm cursor-pointer'
                }
              `}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{discipline.name}</span>
                <span
                  className={`text-xs font-semibold ${
                    isSelected ? 'text-blue-100' : isDisabled ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Score: {score}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Main DisciplinePicker Component
 */
const DisciplinePicker = ({
  disciplineScores,
  selectedDiscipline,
  onSelectDiscipline,
  disabledDisciplines = [],
  isLoading = false,
  className = '',
}: DisciplinePickerProps) => {
  return (
    <div className={`${className}`} data-testid="discipline-picker">
      {/* Grid Layout - Responsive */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DisciplineCategory
          title="Western"
          selectedDiscipline={selectedDiscipline}
          disciplineScores={disciplineScores}
          onSelectDiscipline={onSelectDiscipline}
          disabledDisciplines={disabledDisciplines}
          isLoading={isLoading}
        />
        <DisciplineCategory
          title="English"
          selectedDiscipline={selectedDiscipline}
          disciplineScores={disciplineScores}
          onSelectDiscipline={onSelectDiscipline}
          disabledDisciplines={disabledDisciplines}
          isLoading={isLoading}
        />
        <DisciplineCategory
          title="Specialized"
          selectedDiscipline={selectedDiscipline}
          disciplineScores={disciplineScores}
          onSelectDiscipline={onSelectDiscipline}
          disabledDisciplines={disabledDisciplines}
          isLoading={isLoading}
        />
        <DisciplineCategory
          title="Racing"
          selectedDiscipline={selectedDiscipline}
          disciplineScores={disciplineScores}
          onSelectDiscipline={onSelectDiscipline}
          disabledDisciplines={disabledDisciplines}
          isLoading={isLoading}
        />
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="mt-4 text-center text-sm text-gray-600" role="status" aria-live="polite">
          Loading disciplines...
        </div>
      )}
    </div>
  );
};

export default DisciplinePicker;
