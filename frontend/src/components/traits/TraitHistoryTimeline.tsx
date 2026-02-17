/**
 * TraitHistoryTimeline Component
 *
 * Visualizes trait discovery and activation history using Recharts timeline.
 * Shows when traits were discovered, what triggered them, and event sequences.
 *
 * Story 6-6: Epigenetic Trait System
 */

import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, Sparkles, Activity, Edit3 } from 'lucide-react';
import type { TraitHistory, TraitHistoryEvent } from '@/types/traits';
import { getTierStyle } from '@/types/traits';

export interface TraitHistoryTimelineProps {
  history: TraitHistory;
}

/**
 * Custom Timeline Event Dot
 */
const EventDot: React.FC<Record<string, unknown>> = (props) => {
  const { cx, cy, payload } = props;

  if (!payload || !payload.eventType) return null;

  // Color based on event type
  const colors = {
    discovery: '#10b981', // green
    activation: '#3b82f6', // blue
    modification: '#f59e0b', // amber
  };

  const color = colors[payload.eventType as keyof typeof colors] || '#64748b';

  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={color} stroke="white" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={4} fill="white" />
    </g>
  );
};

/**
 * Custom Tooltip
 */
const CustomTooltip: React.FC<Record<string, unknown>> = ({ active, payload }) => {
  if (!active || !payload || !payload[0]) return null;

  const event: TraitHistoryEvent = payload[0].payload;
  const tierStyle = getTierStyle(event.tier);

  // Icon based on event type
  let EventIcon = Sparkles;
  if (event.eventType === 'activation') EventIcon = Activity;
  if (event.eventType === 'modification') EventIcon = Edit3;

  return (
    <div className="bg-white rounded-lg shadow-xl border border-slate-200 p-4 max-w-xs">
      {/* Trait Name */}
      <div className="flex items-center gap-2 mb-2">
        <EventIcon className={`h-5 w-5 ${tierStyle.textColor}`} />
        <p className={`font-bold ${tierStyle.textColor}`}>{event.traitName}</p>
      </div>

      {/* Event Type */}
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
        {event.eventType}
      </p>

      {/* Trigger */}
      <p className="text-sm text-slate-700 mb-2">
        <span className="font-medium">Trigger:</span> {event.trigger}
      </p>

      {/* Description */}
      <p className="text-xs text-slate-600">{event.description}</p>

      {/* Timestamp */}
      <p className="text-xs text-slate-500 mt-2">
        {new Date(event.timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
    </div>
  );
};

/**
 * TraitHistoryTimeline Component
 */
const TraitHistoryTimeline: React.FC<TraitHistoryTimelineProps> = ({ history }) => {
  if (history.events.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
        <Calendar className="h-12 w-12 text-slate-400 mx-auto mb-3" />
        <p className="text-sm text-slate-600">No trait history events recorded yet</p>
        <p className="text-xs text-slate-500 mt-1">
          Events will appear here as traits are discovered and activated
        </p>
      </div>
    );
  }

  // Prepare data for chart
  const chartData = history.events
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((event, index) => ({
      ...event,
      index,
      timestamp: new Date(event.timestamp).getTime(),
      displayDate: new Date(event.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-bold text-slate-900 mb-4">Timeline Visualization</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <XAxis dataKey="displayDate" tick={{ fontSize: 12 }} stroke="#64748b" />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="index"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={<EventDot />}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Event List */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-900">Event History</h4>
        {chartData.map((event, _index) => {
          const tierStyle = getTierStyle(event.tier);

          // Icon based on event type
          let EventIcon = Sparkles;
          let eventColor = 'text-green-600 bg-green-50 border-green-200';
          if (event.eventType === 'activation') {
            EventIcon = Activity;
            eventColor = 'text-blue-600 bg-blue-50 border-blue-200';
          }
          if (event.eventType === 'modification') {
            EventIcon = Edit3;
            eventColor = 'text-amber-600 bg-amber-50 border-amber-200';
          }

          return (
            <div
              key={event.id}
              className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`p-2 rounded-lg border ${eventColor}`}>
                  <EventIcon className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`font-bold ${tierStyle.textColor}`}>{event.traitName}</p>
                    <span className="text-xs font-semibold text-slate-500 uppercase">
                      {event.eventType}
                    </span>
                  </div>

                  <p className="text-sm text-slate-700 mb-1">
                    <span className="font-medium">Trigger:</span> {event.trigger}
                  </p>

                  <p className="text-xs text-slate-600">{event.description}</p>

                  <p className="text-xs text-slate-500 mt-2">
                    {new Date(event.timestamp).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TraitHistoryTimeline;
