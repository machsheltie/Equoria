/**
 * StatProgressionChart Component
 *
 * Displays horse XP progression over time with:
 * - Line chart showing XP changes
 * - Time range selector (7/30/90 days, all time)
 * - Hover tooltips with XP values
 * - Responsive design
 *
 * Story 3-4: XP & Progression Display - Task 2
 */

import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useHorseXPHistory } from '@/hooks/api/useHorseXP';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface StatProgressionChartProps {
  horseId: number;
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
  all: 'All Time',
};

const TIME_RANGE_LIMITS: Record<TimeRange, number> = {
  '7d': 50,
  '30d': 100,
  '90d': 200,
  all: 500,
};

const StatProgressionChart = ({ horseId }: StatProgressionChartProps) => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('30d');

  const {
    data: historyData,
    isLoading,
    error,
    isError,
    refetch,
  } = useHorseXPHistory(horseId, {
    limit: TIME_RANGE_LIMITS[selectedRange],
  });

  // Handle time range change
  const handleRangeChange = async (range: TimeRange) => {
    setSelectedRange(range);
    await refetch();
  };

  // Transform data for Chart.js
  const chartData = useMemo(() => {
    if (!historyData || !historyData.events || historyData.events.length === 0) {
      return null;
    }

    const labels = historyData.events.map((entry) => {
      const date = new Date(entry.timestamp);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const data = historyData.events.map((entry) => entry.amount);

    return {
      labels,
      datasets: [
        {
          label: 'XP',
          data,
          borderColor: 'rgb(16, 185, 129)', // emerald-500
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3, // Smooth curves
        },
      ],
    };
  }, [historyData]);

  // Chart.js options
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            const dataIndex = context.dataIndex;
            const historyEntry = historyData?.events[dataIndex];

            if (historyEntry) {
              return [
                `XP: ${value}`,
                `Reason: ${historyEntry.reason}`,
                `Gained: +${historyEntry.amount}`,
              ];
            }

            return `XP: ${value}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 45,
          minRotation: 0,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          callback: (value) => `${value} XP`,
        },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-6 shadow-sm">
        <div className="text-center text-sm text-[rgb(148,163,184)]">Loading XP progression...</div>
      </div>
    );
  }

  // Error state
  if (isError || !historyData) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-[rgba(239,68,68,0.1)] p-6 shadow-sm">
        <div className="text-sm text-rose-400">
          {error?.message || 'Failed to fetch XP history'}
        </div>
        <button
          onClick={() => refetch()}
          className="mt-3 rounded-md bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty data state
  if (!chartData || historyData.events.length === 0) {
    return (
      <div className="rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-6 shadow-sm">
        <div className="text-center text-sm text-[rgb(148,163,184)]">
          No XP history data available for this time range.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-6 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[rgb(220,235,255)]">XP Progression</h3>

        {/* Time Range Selector */}
        <div className="flex gap-2">
          {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => handleRangeChange(range)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedRange === range
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[rgba(15,35,70,0.5)] text-[rgb(148,163,184)] hover:bg-[rgba(15,35,70,0.3)]'
              }`}
              aria-label={TIME_RANGE_LABELS[range]}
            >
              {TIME_RANGE_LABELS[range]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div
        data-testid="chart-container"
        className="relative w-full"
        style={{ position: 'relative' }}
      >
        <Line key={selectedRange} data={chartData} options={chartOptions} />
      </div>

      {/* Summary Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-[rgba(37,99,235,0.3)] pt-4">
        <div className="text-center">
          <p className="text-xs text-[rgb(148,163,184)]">Total XP Gained</p>
          <p className="text-lg font-semibold text-emerald-400">
            +{historyData.events.reduce((sum, event) => sum + event.amount, 0)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[rgb(148,163,184)]">Data Points</p>
          <p className="text-lg font-semibold text-[rgb(220,235,255)]">
            {historyData.events.length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[rgb(148,163,184)]">Current XP</p>
          <p className="text-lg font-semibold text-[rgb(220,235,255)]">
            {historyData.events[historyData.events.length - 1]?.amount || 0}
          </p>
        </div>
      </div>
    </div>
  );
};

export default StatProgressionChart;
