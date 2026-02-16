/**
 * ActivityHistoryList Component
 *
 * Displays chronological list of completed enrichment activities
 * with results, temperament changes, and traits discovered.
 *
 * Story 6-3: Enrichment Activity UI
 */

import React from 'react';
import {
  Heart,
  Shield,
  Compass,
  Clock,
  TrendingUp,
  Award,
  Sparkles,
  Calendar,
} from 'lucide-react';
import type { ActivityHistoryItem, EnrichmentCategory } from '@/types/foal';
import { getCategoryColor } from '@/types/foal';

export interface ActivityHistoryListProps {
  history: ActivityHistoryItem[];
  maxItems?: number;
}

/**
 * Get category icon component
 */
function getCategoryIconComponent(category: EnrichmentCategory) {
  switch (category) {
    case 'trust':
      return Heart;
    case 'desensitization':
      return Shield;
    case 'exposure':
      return Compass;
    case 'habituation':
      return Clock;
  }
}

/**
 * Format date for display
 */
function formatActivityDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Format temperament change for display
 */
function formatTemperamentChange(stat: string, value: number): string {
  const prefix = value > 0 ? '+' : '';
  return `${stat.charAt(0).toUpperCase() + stat.slice(1)}: ${prefix}${value}`;
}

/**
 * Get result value color
 */
function getResultColor(value: number): string {
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-slate-600';
}

/**
 * ActivityHistoryList Component
 */
const ActivityHistoryList: React.FC<ActivityHistoryListProps> = ({
  history,
  maxItems,
}) => {
  const displayedHistory = maxItems ? history.slice(0, maxItems) : history;

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
          <Clock className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-slate-600 text-sm">No activities completed yet</p>
        <p className="text-slate-500 text-xs mt-1">
          Start enrichment activities to see your foal's progress here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayedHistory.map((item) => {
        const CategoryIcon = getCategoryIconComponent(item.category);
        const categoryColors = getCategoryColor(item.category);
        const hasTemperamentChanges =
          item.results.temperamentChanges &&
          Object.keys(item.results.temperamentChanges).length > 0;
        const hasTraitsDiscovered =
          item.results.traitsDiscovered && item.results.traitsDiscovered.length > 0;

        return (
          <div
            key={item.id}
            className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 flex-1">
                {/* Category Icon */}
                <div className={`rounded-full p-2 ${categoryColors.split(' ')[1]} flex-shrink-0`}>
                  <CategoryIcon className={`h-4 w-4 ${categoryColors.split(' ')[0]}`} />
                </div>

                {/* Activity Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-900 text-sm">{item.activityName}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${categoryColors}`}
                    >
                      {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Time Info */}
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Calendar className="h-3 w-3" />
                  <span>{formatActivityDate(item.performedAt)}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                  <Clock className="h-3 w-3" />
                  <span>{item.durationMinutes}m</span>
                </div>
              </div>
            </div>

            {/* Results Summary */}
            <div className="ml-10 space-y-2">
              {/* Milestone Points */}
              {item.results.milestonePoints > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Award className="h-3 w-3 text-amber-500" />
                  <span className="text-slate-600">Milestone:</span>
                  <span className="font-semibold text-amber-600">
                    +{item.results.milestonePoints} pts
                  </span>
                </div>
              )}

              {/* Bonding Change */}
              {item.results.bondingChange !== 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Heart className="h-3 w-3 text-blue-500" />
                  <span className="text-slate-600">Bonding:</span>
                  <span className={`font-semibold ${getResultColor(item.results.bondingChange)}`}>
                    {item.results.bondingChange > 0 ? '+' : ''}
                    {item.results.bondingChange}
                  </span>
                </div>
              )}

              {/* Stress Change */}
              {item.results.stressChange !== 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span className="text-slate-600">Stress:</span>
                  <span
                    className={`font-semibold ${getResultColor(-item.results.stressChange)}`}
                  >
                    {item.results.stressChange > 0 ? '+' : ''}
                    {item.results.stressChange}
                  </span>
                </div>
              )}

              {/* Temperament Changes */}
              {hasTemperamentChanges && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Temperament Changes:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(item.results.temperamentChanges || {}).map(
                      ([stat, value]) => (
                        <span
                          key={stat}
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                            value > 0
                              ? 'bg-green-50 text-green-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {formatTemperamentChange(stat, value)}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Traits Discovered */}
              {hasTraitsDiscovered && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-medium text-emerald-700 mb-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Traits Discovered:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {item.results.traitsDiscovered?.map((trait, index) => (
                      <span
                        key={index}
                        className="inline-block px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Show More indicator */}
      {maxItems && history.length > maxItems && (
        <div className="text-center py-2">
          <p className="text-xs text-slate-500">
            Showing {maxItems} of {history.length} activities
          </p>
        </div>
      )}
    </div>
  );
};

export default ActivityHistoryList;
