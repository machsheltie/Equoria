/**
 * Training Dashboard Table Component
 *
 * Displays list of horses with training status
 * Supports filtering and sorting
 *
 * Story 4.5: Training Dashboard - Task 3
 */

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import DashboardHorseCard, { DashboardHorse } from './DashboardHorseCard';

export interface TrainingDashboardTableProps {
  horses: DashboardHorse[];
  onTrain: (horseId: number) => void;
  className?: string;
}

type SortOption = 'name' | 'age' | 'status';

const TrainingDashboardTable = ({
  horses,
  onTrain,
  className = '',
}: TrainingDashboardTableProps) => {
  const [sortBy, setSortBy] = useState<SortOption>('name');

  // Sort horses based on selected option
  const sortedHorses = useMemo(() => {
    const sorted = [...horses];

    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));

      case 'age':
        return sorted.sort((a, b) => b.age - a.age); // Oldest first

      case 'status': {
        const statusOrder = { ready: 0, cooldown: 1, ineligible: 2 };
        return sorted.sort((a, b) => statusOrder[a.trainingStatus] - statusOrder[b.trainingStatus]);
      }

      default:
        return sorted;
    }
  }, [horses, sortBy]);

  return (
    <div className={`bg-white rounded-lg shadow ${className}`} data-testid="dashboard-table">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Training Status</h2>
            <p className="text-sm text-slate-600">
              {horses.length} {horses.length === 1 ? 'horse' : 'horses'} total
            </p>
          </div>

          {/* Sort Controls */}
          {horses.length > 0 && (
            <div className="flex items-center gap-2" data-testid="sort-controls">
              <span className="text-sm text-slate-600">Sort by:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortBy('name')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    sortBy === 'name'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  data-testid="sort-name"
                  aria-pressed={sortBy === 'name'}
                >
                  Name
                </button>
                <button
                  onClick={() => setSortBy('age')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    sortBy === 'age'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  data-testid="sort-age"
                  aria-pressed={sortBy === 'age'}
                >
                  Age
                </button>
                <button
                  onClick={() => setSortBy('status')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    sortBy === 'status'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  data-testid="sort-status"
                  aria-pressed={sortBy === 'status'}
                >
                  Status
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Empty State */}
        {horses.length === 0 && (
          <div className="py-12 text-center" data-testid="empty-state">
            <Search className="mx-auto h-12 w-12 text-slate-400 mb-4" aria-hidden="true" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No horses found</h3>
            <p className="text-sm text-slate-600">
              Try adjusting your filters or search criteria to see more results.
            </p>
          </div>
        )}

        {/* Horses Grid */}
        {horses.length > 0 && (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            data-testid="horses-grid"
          >
            {sortedHorses.map((horse) => (
              <DashboardHorseCard key={horse.id} horse={horse} onTrain={onTrain} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingDashboardTable;
