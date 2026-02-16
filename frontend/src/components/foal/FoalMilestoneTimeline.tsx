/**
 * FoalMilestoneTimeline Component
 *
 * Main timeline visualization component for foal development milestones.
 * Displays foal age, development progress, Recharts timeline, current milestone panel,
 * and milestone history.
 *
 * Story 6-2: Foal Milestone Timeline - Main Component
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Calendar, TrendingUp, HelpCircle } from 'lucide-react';
import MilestoneDot from './MilestoneDot';
import MilestoneTooltip from './MilestoneTooltip';
import MilestoneCard from './MilestoneCard';
import CurrentMilestonePanel from './CurrentMilestonePanel';
import type { Foal, Milestone, MilestoneTimelineData } from '@/types/foal';
import {
  calculateMilestoneProgress,
  getCurrentMilestone,
  calculateDevelopmentProgress,
  getDaysUntilMilestone,
} from '@/types/foal';

export interface FoalMilestoneTimelineProps {
  foal: Foal;
  milestones: Milestone[];
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Calculate sex display label
 */
function getSexLabel(sex: string): string {
  return sex === 'Male' ? 'Colt' : 'Filly';
}

/**
 * FoalMilestoneTimeline Component
 */
const FoalMilestoneTimeline: React.FC<FoalMilestoneTimelineProps> = ({ foal, milestones }) => {
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  // Calculate current milestone and overall progress
  const currentMilestone = useMemo(
    () => getCurrentMilestone(milestones, foal.ageInDays),
    [milestones, foal.ageInDays]
  );

  const overallProgress = useMemo(
    () => calculateDevelopmentProgress(milestones, foal.ageInDays),
    [milestones, foal.ageInDays]
  );

  const daysUntilNext = currentMilestone
    ? currentMilestone.ageWindow.max - foal.ageInDays
    : 0;

  // Prepare data for Recharts timeline
  const timelineData: MilestoneTimelineData[] = useMemo(() => {
    return milestones.map((milestone) => {
      const progress = calculateMilestoneProgress(milestone, foal.ageInDays);
      const isCompleted = milestone.status === 'completed';
      const isCurrent = currentMilestone?.type === milestone.type;

      return {
        name: milestone.name,
        ageDay: milestone.ageWindow.min,
        progress,
        status: isCompleted ? 'completed' as const : isCurrent ? 'current' as const : 'pending' as const,
        completed: isCompleted,
        current: isCurrent,
        traits: milestone.traitsConfirmed || [],
        score: milestone.score,
      };
    });
  }, [milestones, foal.ageInDays, currentMilestone]);

  // Sort milestones by age
  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => a.ageWindow.min - b.ageWindow.min),
    [milestones]
  );

  return (
    <div className="space-y-6">
      {/* Foal Header */}
      <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900">
              {foal.name || 'Unnamed Foal'}
            </h2>
            <p className="text-slate-600 mt-1">
              {getSexLabel(foal.sex)} • {foal.ageInDays} days old
            </p>
            <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
              <Calendar className="h-4 w-4" />
              <span>Born: {formatDate(foal.birthDate)}</span>
            </div>
          </div>

          {/* Help Button */}
          <button
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
            aria-label="Help"
            title="View milestone guide"
          >
            <HelpCircle className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Overall Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-semibold text-slate-700">
                Development Progress
              </span>
            </div>
            <span className="text-lg font-bold text-emerald-600">{overallProgress}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
              role="progressbar"
              aria-valuenow={overallProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Overall development progress: ${overallProgress}%`}
            />
          </div>
        </div>
      </div>

      {/* Timeline Visualization */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Timeline Visualization</h3>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={timelineData}
            margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#64748b' }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis hide />
            <Tooltip content={<MilestoneTooltip />} />

            {/* Timeline line */}
            <Line
              type="monotone"
              dataKey="progress"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={<MilestoneDot />}
              activeDot={{ r: 8 }}
              isAnimationActive={true}
              animationDuration={800}
            />

            {/* Current milestone reference line */}
            {currentMilestone && (
              <ReferenceLine
                x={currentMilestone.name}
                stroke="#3b82f6"
                strokeDasharray="3 3"
                label={{
                  value: 'Current',
                  position: 'top',
                  fill: '#3b82f6',
                  fontSize: 12,
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500 border-2 border-white"></div>
            <span className="text-slate-600">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500 border-2 border-white"></div>
            <span className="text-slate-600">Current</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-gray-400 border-2 border-white"></div>
            <span className="text-slate-600">Upcoming</span>
          </div>
        </div>
      </div>

      {/* Current Milestone Panel */}
      {currentMilestone && (
        <CurrentMilestonePanel
          milestone={currentMilestone}
          foalAge={foal.ageInDays}
          daysRemaining={daysUntilNext}
          enrichmentActivitiesCompleted={foal.enrichmentActivitiesCompleted || 0}
          totalEnrichmentActivities={foal.totalEnrichmentActivities || 5}
        />
      )}

      {/* Milestone History */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Milestone History</h3>

        <div className="space-y-3">
          {sortedMilestones.map((milestone) => {
            const isCurrent = currentMilestone?.type === milestone.type;

            return (
              <MilestoneCard
                key={milestone.type}
                milestone={milestone}
                foalAge={foal.ageInDays}
                onClick={() => setSelectedMilestone(milestone)}
                isCurrent={isCurrent}
              />
            );
          })}
        </div>

        {sortedMilestones.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <p>No milestone data available.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FoalMilestoneTimeline;
