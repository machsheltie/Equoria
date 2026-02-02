/**
 * StatHistoryGraph Component
 *
 * Displays a line chart showing XP progression over time with time range filtering.
 *
 * Features:
 * - Chart.js line chart with cumulative XP progression
 * - Time range selector (7d, 30d, 90d, all time)
 * - Hover tooltips with XP amounts, dates, and reasons
 * - Loading and error states
 * - Responsive design
 * - WCAG 2.1 AA accessibility
 *
 * Story 3-4: XP & Progression Display - Task 2
 */

import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
} from 'chart.js';
import { useHorseXPHistory } from '@/hooks/api/useHorseXP';
import type { HorseXPEvent } from '@/lib/api-client';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface StatHistoryGraphProps {
  horseId: number;
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

const StatHistoryGraph: React.FC<StatHistoryGraphProps> = ({ horseId }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // Fetch XP history data
  const { data, isLoading, error, isError, refetch } = useHorseXPHistory(horseId, { limit: 100 });

  // Filter events by time range
  const filteredEvents = useMemo(() => {
    if (!data?.events) return [];

    const now = new Date();
    const events = [...data.events];

    // Sort chronologically (oldest first), handling invalid timestamps
    events.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      // Invalid dates (NaN) sort to the end
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;
      return dateA - dateB;
    });

    if (timeRange === 'all') {
      return events;
    }

    const daysMap: Record<Exclude<TimeRange, 'all'>, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };

    const cutoffDate = new Date(now.getTime() - daysMap[timeRange] * 24 * 60 * 60 * 1000);

    return events.filter((event) => {
      const eventDate = new Date(event.timestamp);
      // Include events with invalid timestamps in the filtered results
      if (isNaN(eventDate.getTime())) return true;
      return eventDate >= cutoffDate;
    });
  }, [data?.events, timeRange]);

  // Transform data for Chart.js
  const chartData = useMemo(() => {
    if (!filteredEvents.length) {
      return {
        labels: [],
        datasets: [
          {
            label: 'Total XP',
            data: [],
            borderColor: 'rgb(16, 185, 129)', // emerald-500
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      };
    }

    // Calculate cumulative XP
    let cumulativeXP = 0;
    const cumulativeData: number[] = [];
    const labels: string[] = [];
    const eventMetadata: HorseXPEvent[] = [];

    filteredEvents.forEach((event) => {
      cumulativeXP += event.amount;
      cumulativeData.push(cumulativeXP);

      // Handle empty or invalid timestamps gracefully
      const date = new Date(event.timestamp);
      const isValidDate = !isNaN(date.getTime()) && event.timestamp;
      const formattedDate = isValidDate
        ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Unknown';
      labels.push(formattedDate);

      eventMetadata.push(event);
    });

    return {
      labels,
      datasets: [
        {
          label: 'Total XP',
          data: cumulativeData,
          borderColor: 'rgb(16, 185, 129)', // emerald-500
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          metadata: eventMetadata, // Store for tooltip access
        },
      ],
    };
  }, [filteredEvents]);

  // Chart.js options
  const chartOptions: ChartOptions<'line'> = useMemo(() => {
    const maxXP = chartData.datasets[0]?.data?.length
      ? Math.max(...(chartData.datasets[0].data as number[]))
      : 100;

    return {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          callbacks: {
            title: (tooltipItems) => {
              const index = tooltipItems[0].dataIndex;
              const event = (chartData.datasets[0] as any).metadata?.[index];
              if (event?.timestamp) {
                const date = new Date(event.timestamp);
                return date.toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
              }
              return tooltipItems[0].label;
            },
            label: (context) => {
              return `Total XP: ${context.parsed.y}`;
            },
            afterLabel: (context) => {
              const index = context.dataIndex;
              const event = (chartData.datasets[0] as any).metadata?.[index];
              if (event?.reason) {
                return `Reason: ${event.reason}`;
              }
              return '';
            },
          },
        },
      },
      scales: {
        y: {
          min: 0,
          max: Math.ceil(maxXP * 1.1), // Add 10% padding
          ticks: {
            stepSize: Math.ceil(maxXP / 5),
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    };
  }, [chartData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
        <p className="text-center text-gray-500 mt-4">Loading XP history...</p>
      </div>
    );
  }

  // Error state
  if (isError && error) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">XP History</h3>
        <div className="bg-red-50 border border-red-200 rounded p-4 text-center">
          <p className="text-red-800 mb-3">
            Failed to fetch XP history: {error.message || 'Unknown error'}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!filteredEvents.length) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">XP History</h3>
        <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
          <p className="text-gray-600">No XP history available for this horse</p>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">XP History</h3>

        {/* Time Range Selector */}
        <div className="flex gap-2" role="group" aria-label="Time range selector">
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-3 py-1 text-sm rounded transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              timeRange === '7d'
                ? 'bg-emerald-600 text-white active'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-pressed={timeRange === '7d'}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-3 py-1 text-sm rounded transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              timeRange === '30d'
                ? 'bg-emerald-600 text-white active'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-pressed={timeRange === '30d'}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeRange('90d')}
            className={`px-3 py-1 text-sm rounded transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              timeRange === '90d'
                ? 'bg-emerald-600 text-white active'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-pressed={timeRange === '90d'}
          >
            90 Days
          </button>
          <button
            onClick={() => setTimeRange('all')}
            className={`px-3 py-1 text-sm rounded transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              timeRange === 'all'
                ? 'bg-emerald-600 text-white active'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-pressed={timeRange === 'all'}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Chart */}
      <div>
        <Line
          data={chartData}
          options={chartOptions}
          aria-label={`XP history chart showing ${filteredEvents.length} data points`}
        />
      </div>
    </div>
  );
};

export default StatHistoryGraph;
