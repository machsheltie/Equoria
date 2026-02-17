/**
 * CategoryFilter Component
 *
 * Filter enrichment activities by category.
 * Displays category tabs with icons and counts.
 *
 * Story 6-3: Enrichment Activity UI
 */

import React from 'react';
import { Heart, Shield, Compass, Clock, Sparkles } from 'lucide-react';
import type { EnrichmentCategory } from '@/types/foal';

export interface CategoryFilterProps {
  selectedCategory: EnrichmentCategory | 'all';
  onCategoryChange: (_category: EnrichmentCategory | 'all') => void;
  categoryCounts?: Record<EnrichmentCategory | 'all', number>;
  showCounts?: boolean;
}

interface CategoryOption {
  value: EnrichmentCategory | 'all';
  label: string;
  icon: React.ElementType;
  color: string;
}

const categoryOptions: CategoryOption[] = [
  {
    value: 'all',
    label: 'All Activities',
    icon: Sparkles,
    color: 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100',
  },
  {
    value: 'trust',
    label: 'Trust',
    icon: Heart,
    color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100',
  },
  {
    value: 'desensitization',
    label: 'Desensitization',
    icon: Shield,
    color: 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100',
  },
  {
    value: 'exposure',
    label: 'Exposure',
    icon: Compass,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
  },
  {
    value: 'habituation',
    label: 'Habituation',
    icon: Clock,
    color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100',
  },
];

/**
 * CategoryFilter Component
 */
const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onCategoryChange,
  categoryCounts,
  showCounts = false,
}) => {
  return (
    <div className="space-y-3">
      {/* Mobile View: Dropdown */}
      <div className="block sm:hidden">
        <label htmlFor="category-select" className="sr-only">
          Select category
        </label>
        <select
          id="category-select"
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value as EnrichmentCategory | 'all')}
          className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
              {showCounts && categoryCounts?.[option.value] !== undefined
                ? ` (${categoryCounts[option.value]})`
                : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop View: Tabs */}
      <div className="hidden sm:flex sm:items-center sm:gap-2 sm:flex-wrap">
        {categoryOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedCategory === option.value;
          const count = showCounts && categoryCounts?.[option.value];

          return (
            <button
              key={option.value}
              onClick={() => onCategoryChange(option.value)}
              className={`
                inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all
                ${
                  isSelected
                    ? `${option.color} ring-2 ring-offset-2 ${option.color.split(' ')[0].replace('text-', 'ring-')}`
                    : `${option.color} border-transparent opacity-60 hover:opacity-100`
                }
              `}
              aria-pressed={isSelected}
              aria-label={`Filter by ${option.label}`}
            >
              <Icon className="h-4 w-4" />
              <span>{option.label}</span>
              {typeof count === 'number' && (
                <span
                  className={`
                    inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full
                    ${isSelected ? 'bg-white/80' : 'bg-white/60'}
                  `}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Compact Pills View (Alternative Desktop Style) */}
      {/* Uncomment to use this style instead:
      <div className="hidden sm:flex sm:items-center sm:gap-2">
        <span className="text-sm font-medium text-slate-700 mr-2">Filter:</span>
        {categoryOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedCategory === option.value;
          const count = showCounts && categoryCounts?.[option.value];

          return (
            <button
              key={option.value}
              onClick={() => onCategoryChange(option.value)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all
                ${isSelected ? option.color : 'text-slate-500 bg-slate-100 border-slate-200 hover:bg-slate-200'}
              `}
              aria-pressed={isSelected}
            >
              <Icon className="h-3 w-3" />
              <span>{option.label}</span>
              {typeof count === 'number' && (
                <span className="ml-1">({count})</span>
              )}
            </button>
          );
        })}
      </div>
      */}
    </div>
  );
};

export default CategoryFilter;
