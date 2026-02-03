/**
 * XpHistoryEntry Component
 *
 * Individual timeline entry for XP history. Displays a single XP gain event
 * with date, source type badge, source name, XP amount, level information,
 * and timeline connector elements.
 *
 * Features:
 * - Timeline connector line (vertical line between entries)
 * - Timeline dot/icon marker
 * - Entry card with date, source badge, source name, XP amount, level
 * - Level-up highlighting with gold/yellow background and trophy icon
 * - Level transition display for level-up events
 * - WCAG 2.1 AA accessible
 *
 * Story 5-4: XP History Timeline - Task 5
 */

import React, { memo } from 'react';
import { Trophy, Zap, Award, Gift, Swords } from 'lucide-react';

/**
 * XP gain data structure representing a single XP event
 */
export interface XpGain {
  xpGainId: string;
  horseId: number;
  horseName: string;
  source: 'competition' | 'training' | 'achievement' | 'bonus';
  sourceId: number;
  sourceName: string;
  xpAmount: number;
  timestamp: string;
  oldLevel: number;
  newLevel: number;
  oldXp: number;
  newXp: number;
  leveledUp: boolean;
}

/**
 * Props for the XpHistoryEntry component
 */
export interface XpHistoryEntryProps {
  /** The XP gain event data */
  entry: XpGain;
  /** Whether this entry represents a level-up event */
  isLevelUp: boolean;
  /** Whether this is the first entry in the timeline */
  isFirst?: boolean;
  /** Whether this is the last entry in the timeline */
  isLast?: boolean;
}

/**
 * Format a timestamp string for display in the timeline.
 * Returns a human-readable date/time string.
 */
function formatEntryDate(timestamp: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

/**
 * Get the CSS classes for the source type badge based on source category.
 */
function getSourceBadgeColor(source: XpGain['source']): string {
  const colors: Record<XpGain['source'], string> = {
    competition: 'bg-blue-100 text-blue-700',
    training: 'bg-green-100 text-green-700',
    achievement: 'bg-purple-100 text-purple-700',
    bonus: 'bg-orange-100 text-orange-700',
  };
  return colors[source];
}

/**
 * Get the icon component for the source type.
 */
function getSourceIcon(source: XpGain['source']): React.ReactNode {
  const iconClass = 'h-3 w-3';
  switch (source) {
    case 'competition':
      return <Swords className={iconClass} aria-hidden="true" />;
    case 'training':
      return <Zap className={iconClass} aria-hidden="true" />;
    case 'achievement':
      return <Award className={iconClass} aria-hidden="true" />;
    case 'bonus':
      return <Gift className={iconClass} aria-hidden="true" />;
    default:
      return null;
  }
}

/**
 * XpHistoryEntry - Individual timeline entry displaying a single XP gain event
 */
const XpHistoryEntry: React.FC<XpHistoryEntryProps> = memo(
  ({ entry, isLevelUp, isFirst = false, isLast = false }) => {
    const formattedDate = formatEntryDate(entry.timestamp);
    const badgeColor = getSourceBadgeColor(entry.source);
    const sourceIcon = getSourceIcon(entry.source);

    // Determine card styling based on level-up status
    const cardClasses = isLevelUp
      ? 'bg-yellow-50 border border-yellow-300 rounded-lg shadow-sm p-4'
      : 'bg-white border border-slate-200 rounded-lg shadow-sm p-4';

    // Determine timeline dot styling
    const dotClasses = isLevelUp
      ? 'w-4 h-4 rounded-full bg-yellow-400 border-2 border-yellow-500 z-10'
      : 'w-3 h-3 rounded-full bg-slate-400 border-2 border-slate-300 z-10';

    return (
      <div
        data-testid="xp-history-entry"
        className="relative flex gap-4"
        role="article"
        aria-label={`Gained ${entry.xpAmount} XP from ${entry.source}: ${entry.sourceName}`}
      >
        {/* Timeline connector column */}
        <div
          data-testid="timeline-connector"
          className="relative flex flex-col items-center"
          aria-hidden="true"
        >
          {/* Top connector line */}
          {!isFirst && (
            <div
              data-testid="timeline-connector-top"
              className={`w-0.5 flex-1 ${isLevelUp ? 'bg-yellow-300' : 'bg-slate-200'}`}
            />
          )}
          {isFirst && <div className="flex-1" />}

          {/* Timeline dot */}
          <div data-testid="timeline-dot" className={dotClasses} />

          {/* Bottom connector line */}
          {!isLast && (
            <div
              data-testid="timeline-connector-bottom"
              className={`w-0.5 flex-1 ${isLevelUp ? 'bg-yellow-300' : 'bg-slate-200'}`}
            />
          )}
          {isLast && <div className="flex-1" />}
        </div>

        {/* Entry card */}
        <div data-testid="entry-card" className={`${cardClasses} flex-1 mb-3`}>
          {/* Top row: date and source badge */}
          <div className="flex items-center justify-between mb-2">
            <span
              data-testid="entry-date"
              className="text-sm text-slate-500"
            >
              {formattedDate}
            </span>

            <span
              data-testid="source-badge"
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}
            >
              {sourceIcon}
              {entry.source.charAt(0).toUpperCase() + entry.source.slice(1)}
            </span>
          </div>

          {/* Source name */}
          <div className="text-sm font-medium text-slate-800 mb-2">
            {entry.sourceName}
          </div>

          {/* Bottom row: XP amount and level */}
          <div className="flex items-center justify-between">
            {/* XP amount */}
            <span
              data-testid="xp-amount"
              className="text-lg font-bold text-green-600"
            >
              +{entry.xpAmount}
              <span className="text-sm font-normal text-slate-500 ml-1">XP</span>
            </span>

            {/* Level display */}
            <div className="flex items-center gap-2">
              {isLevelUp ? (
                <>
                  <span data-testid="level-up-icon" aria-hidden="true">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                  </span>
                  <span
                    data-testid="level-transition"
                    className="text-sm font-semibold text-yellow-700"
                  >
                    Level {entry.oldLevel} &rarr; {entry.newLevel}
                  </span>
                </>
              ) : (
                <span
                  data-testid="level-display"
                  className="text-sm text-slate-500"
                >
                  Level {entry.newLevel}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

XpHistoryEntry.displayName = 'XpHistoryEntry';

export default XpHistoryEntry;
