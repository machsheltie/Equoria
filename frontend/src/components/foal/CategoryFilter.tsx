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
    color:
      'text-[rgb(148,163,184)] bg-[rgba(37,99,235,0.05)] border-[rgba(37,99,235,0.2)] hover:bg-[rgba(37,99,235,0.1)]',
  },
  {
    value: 'trust',
    label: 'Trust',
    icon: Heart,
    color:
      'text-blue-400 bg-[rgba(37,99,235,0.1)] border-blue-500/30 hover:bg-[rgba(37,99,235,0.2)]',
  },
  {
    value: 'desensitization',
    label: 'Desensitization',
    icon: Shield,
    color:
      'text-purple-400 bg-[rgba(147,51,234,0.1)] border-purple-500/30 hover:bg-[rgba(147,51,234,0.2)]',
  },
  {
    value: 'exposure',
    label: 'Exposure',
    icon: Compass,
    color:
      'text-emerald-400 bg-[rgba(16,185,129,0.1)] border-emerald-500/30 hover:bg-[rgba(16,185,129,0.2)]',
  },
  {
    value: 'habituation',
    label: 'Habituation',
    icon: Clock,
    color:
      'text-amber-400 bg-[rgba(212,168,67,0.1)] border-amber-500/30 hover:bg-[rgba(212,168,67,0.2)]',
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
          className="celestial-input w-full text-sm"
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
                    ? `${option.color} ring-2 ring-offset-2 ring-offset-[rgb(10,22,40)] ${option.color.split(' ')[0].replace('text-', 'ring-')}`
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
                    ${isSelected ? 'bg-[rgba(15,35,70,0.5)]' : 'bg-[rgba(15,35,70,0.4)]'}
                  `}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryFilter;
