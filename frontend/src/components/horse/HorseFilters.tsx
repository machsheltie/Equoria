/**
 * HorseFilters Component
 *
 * Comprehensive filtering interface for horse lists with:
 * - Age range inputs (min/max)
 * - Breed multi-select
 * - Discipline checkboxes
 * - Training status selection
 * - Active filter count indicator
 * - Clear all filters action
 *
 * Integrates with useHorseFilters hook for URL state persistence.
 *
 * Story 3-6: Horse Search & Filter - Task 4
 */

import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export interface HorseFiltersProps {
  /**
   * Current filter values
   */
  filters: {
    minAge?: number;
    maxAge?: number;
    breedIds: string[];
    disciplines: string[];
    trainingStatus: 'all' | 'trained' | 'untrained' | 'in_training';
  };

  /**
   * Callback to update age range
   */
  onAgeRangeChange: (minAge?: number, maxAge?: number) => void;

  /**
   * Callback to toggle breed selection
   */
  onBreedToggle: (breedId: string) => void;

  /**
   * Callback to toggle discipline selection
   */
  onDisciplineToggle: (discipline: string) => void;

  /**
   * Callback to change training status
   */
  onTrainingStatusChange: (status: 'all' | 'trained' | 'untrained' | 'in_training') => void;

  /**
   * Callback to clear all filters
   */
  onClearFilters: () => void;

  /**
   * Available breeds for filtering
   */
  breeds?: Array<{ id: string; name: string }>;

  /**
   * Whether filters are currently being applied (loading state)
   */
  isLoading?: boolean;

  /**
   * Number of active filters
   */
  activeFilterCount?: number;

  /**
   * Additional CSS classes
   */
  className?: string;
}

// Default disciplines based on game design
const DISCIPLINES = [
  'Racing',
  'Dressage',
  'ShowJumping',
  'Eventing',
  'Endurance',
  'Trail',
] as const;

// Training status options
const TRAINING_STATUSES = [
  { value: 'all', label: 'All Horses' },
  { value: 'trained', label: 'Trained' },
  { value: 'untrained', label: 'Untrained' },
  { value: 'in_training', label: 'In Training' },
] as const;

/**
 * Comprehensive horse filtering interface
 */
const HorseFilters = ({
  filters,
  onAgeRangeChange,
  onBreedToggle,
  onDisciplineToggle,
  onTrainingStatusChange,
  onClearFilters,
  breeds = [],
  isLoading = false,
  activeFilterCount = 0,
  className = '',
}: HorseFiltersProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  /**
   * Handle min age change
   */
  const handleMinAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const minAge = value === '' ? undefined : parseInt(value, 10);
    onAgeRangeChange(minAge, filters.maxAge);
  };

  /**
   * Handle max age change
   */
  const handleMaxAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const maxAge = value === '' ? undefined : parseInt(value, 10);
    onAgeRangeChange(filters.minAge, maxAge);
  };

  /**
   * Check if a breed is selected
   */
  const isBreedSelected = (breedId: string) => {
    return filters.breedIds.includes(breedId);
  };

  /**
   * Check if a discipline is selected
   */
  const isDisciplineSelected = (discipline: string) => {
    return filters.disciplines.includes(discipline);
  };

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          {hasActiveFilters && (
            <span
              className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full"
              aria-label={`${activeFilterCount} active filters`}
            >
              {activeFilterCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Clear All Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              disabled={isLoading}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Clear all filters"
            >
              Clear all
            </button>
          )}

          {/* Expand/Collapse Button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label={isExpanded ? 'Collapse filters' : 'Expand filters'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-600" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Filter Content */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Age Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Age Range</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="min-age" className="sr-only">
                  Minimum age
                </label>
                <input
                  id="min-age"
                  type="number"
                  min="0"
                  max="30"
                  placeholder="Min"
                  value={filters.minAge ?? ''}
                  onChange={handleMinAgeChange}
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  aria-label="Minimum age filter"
                />
              </div>
              <div>
                <label htmlFor="max-age" className="sr-only">
                  Maximum age
                </label>
                <input
                  id="max-age"
                  type="number"
                  min="0"
                  max="30"
                  placeholder="Max"
                  value={filters.maxAge ?? ''}
                  onChange={handleMaxAgeChange}
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  aria-label="Maximum age filter"
                />
              </div>
            </div>
          </div>

          {/* Breed Filter */}
          {breeds.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Breeds</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {breeds.map((breed) => (
                  <label
                    key={breed.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isBreedSelected(breed.id)}
                      onChange={() => onBreedToggle(breed.id)}
                      disabled={isLoading}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                      aria-label={`Filter by ${breed.name}`}
                    />
                    <span className="text-sm text-gray-700">{breed.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Discipline Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Disciplines</label>
            <div className="space-y-2">
              {DISCIPLINES.map((discipline) => (
                <label
                  key={discipline}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isDisciplineSelected(discipline)}
                    onChange={() => onDisciplineToggle(discipline)}
                    disabled={isLoading}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                    aria-label={`Filter by ${discipline}`}
                  />
                  <span className="text-sm text-gray-700">{discipline}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Training Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Training Status</label>
            <div className="space-y-2">
              {TRAINING_STATUSES.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors"
                >
                  <input
                    type="radio"
                    name="training-status"
                    value={value}
                    checked={filters.trainingStatus === value}
                    onChange={() =>
                      onTrainingStatusChange(
                        value as 'all' | 'trained' | 'untrained' | 'in_training'
                      )
                    }
                    disabled={isLoading}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 disabled:cursor-not-allowed"
                    aria-label={`Filter by ${label}`}
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center rounded-lg">
          <div className="text-sm text-gray-600" role="status" aria-live="polite">
            Applying filters...
          </div>
        </div>
      )}
    </div>
  );
};

export default HorseFilters;
