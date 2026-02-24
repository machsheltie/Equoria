/**
 * Dashboard Filters Component
 *
 * Filtering controls for training dashboard
 *
 * Story 4.5: Training Dashboard - Task 4
 */

import { Search, Filter } from 'lucide-react';

export type StatusFilter = 'all' | 'ready' | 'cooldown' | 'ineligible';

export interface DashboardFiltersProps {
  statusFilter: StatusFilter;
  searchQuery: string;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onSearchChange: (query: string) => void;
  className?: string;
}

const DashboardFilters = ({
  statusFilter,
  searchQuery,
  onStatusFilterChange,
  onSearchChange,
  className = '',
}: DashboardFiltersProps) => {
  const filters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'ready', label: 'Ready' },
    { value: 'cooldown', label: 'Cooldown' },
    { value: 'ineligible', label: 'Ineligible' },
  ];

  return (
    <div className={`glass-panel rounded-lg p-4 ${className}`} data-testid="dashboard-filters">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[rgb(148,163,184)]" aria-hidden="true" />
          <div className="flex gap-2">
            {filters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => onStatusFilterChange(filter.value)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-[rgba(15,35,70,0.5)] text-[rgb(220,235,255)] hover:bg-[rgba(37,99,235,0.1)]'
                }`}
                data-testid={`filter-${filter.value}`}
                aria-pressed={statusFilter === filter.value}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="flex-1">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[rgb(148,163,184)]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search horses..."
              className="celestial-input w-full pl-10 pr-4 py-2"
              data-testid="search-input"
              aria-label="Search horses by name"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardFilters;
