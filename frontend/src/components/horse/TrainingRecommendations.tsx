/**
 * TrainingRecommendations Component
 *
 * Analyzes horse stats vs genetic potential to provide training recommendations:
 * - Calculates stat gaps (potential - current)
 * - Prioritizes recommendations (high/medium/low based on gap size)
 * - Suggests specific training types for each stat
 * - Considers age and training window effectiveness
 * - Provides discipline-specific guidance
 *
 * Story 3-4: XP & Progression Display - Task 5
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Target, AlertCircle } from 'lucide-react';
import { useHorseStats } from '@/hooks/api/useHorseStats';

interface TrainingRecommendationsProps {
  horseId: number;
}

interface StatRecommendation {
  stat: string;
  currentValue: number;
  potentialValue: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
  suggestions: string[];
}

const TrainingRecommendations = ({ horseId }: TrainingRecommendationsProps) => {
  const { data: statsData, isLoading, error, isError, refetch } = useHorseStats(horseId);
  const [showDetails, setShowDetails] = useState(false);

  // Training suggestions by stat type
  const getTrainingSuggestions = (stat: string, discipline?: string): string[] => {
    const suggestions: Record<string, string[]> = {
      speed: ['Sprint Practice', 'Racing', 'Speed Drills'],
      stamina: ['Endurance Rides', 'Long Distance', 'Cardio'],
      agility: ['Obstacle Courses', 'Barrel Racing', 'Flexibility'],
      strength: ['Weight Pulling', 'Hill Climbing', 'Resistance Training'],
      intelligence: ['Problem Solving Exercises', 'Pattern Training', 'Command Practice'],
      temperament: ['Desensitization Work', 'Trust Building', 'Calm Exposure'],
    };

    let baseSuggestions = suggestions[stat.toLowerCase()] || [];

    // Add discipline-specific suggestions
    if (discipline) {
      if (discipline.toLowerCase() === 'racing' && stat.toLowerCase() === 'speed') {
        baseSuggestions = ['Track Work', ...baseSuggestions];
      } else if (discipline.toLowerCase() === 'dressage' && stat.toLowerCase() === 'agility') {
        baseSuggestions = ['Collection Work', ...baseSuggestions];
      } else if (discipline.toLowerCase() === 'trail' && stat.toLowerCase() === 'stamina') {
        baseSuggestions = ['Trail Conditioning', ...baseSuggestions];
      }
    }

    return baseSuggestions.slice(0, 3);
  };

  // Calculate stat gaps and recommendations
  const calculateRecommendations = (): StatRecommendation[] => {
    if (!statsData) return [];

    const recommendations: StatRecommendation[] = [];
    const statNames: Array<keyof typeof statsData.currentStats> = [
      'speed',
      'stamina',
      'agility',
      'strength',
      'intelligence',
      'temperament',
    ];

    for (const stat of statNames) {
      const currentValue = statsData.currentStats[stat];
      const potentialValue = statsData.geneticPotential[stat];
      const gap = potentialValue - currentValue;

      // Only recommend if there's a gap of at least 5 points
      if (gap >= 5) {
        let priority: 'high' | 'medium' | 'low';
        if (gap >= 20) {
          priority = 'high';
        } else if (gap >= 10) {
          priority = 'medium';
        } else {
          priority = 'low';
        }

        recommendations.push({
          stat,
          currentValue,
          potentialValue,
          gap,
          priority,
          suggestions: getTrainingSuggestions(stat, statsData.discipline),
        });
      }
    }

    // Sort by priority (high > medium > low) and then by gap size (descending)
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.gap - a.gap;
    });
  };

  // Get training window message
  const getTrainingWindowMessage = (window: string): { text: string; color: string } => {
    switch (window) {
      case 'too young':
        return {
          text: 'Too young for intensive training. Wait before training starts.',
          color: 'text-amber-700',
        };
      case 'prime':
        return {
          text: 'Prime training window - best time to train for maximum gains!',
          color: 'text-emerald-700',
        };
      case 'maintenance':
        return {
          text: 'Maintenance training - maintain current level and preserve stats.',
          color: 'text-blue-700',
        };
      case 'senior':
        return {
          text: 'Senior horse - limited training capacity, gentle exercise only.',
          color: 'text-slate-700',
        };
      default:
        return { text: '', color: 'text-slate-700' };
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-center text-sm text-slate-600">Loading training recommendations...</div>
      </div>
    );
  }

  // Error state
  if (isError || !statsData) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose-900">Error Loading Recommendations</p>
            <p className="text-sm text-rose-700 mt-1">
              {error?.message || 'Failed to fetch training recommendations'}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 rounded-md bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const recommendations = calculateRecommendations();
  const trainingWindowInfo = getTrainingWindowMessage(statsData.trainingWindow);

  // No recommendations case
  if (recommendations.length === 0) {
    return (
      <div
        data-testid="training-recommendations"
        className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-slate-900">Training Recommendations</h3>
        </div>

        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4">
          <p className="text-sm text-emerald-800">
            {statsData.horseName} has reached maximum potential - fully trained! No recommendations
            needed. Continue maintenance training to preserve current abilities.
          </p>
        </div>

        {/* Training Window */}
        {trainingWindowInfo.text && (
          <div className="mt-4 rounded-md bg-slate-50 border border-slate-200 p-4">
            <p className={`text-sm font-semibold ${trainingWindowInfo.color}`}>
              Training Window: {statsData.trainingWindow}
            </p>
            <p className="text-sm text-slate-700 mt-1">{trainingWindowInfo.text}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="training-recommendations"
      className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-slate-900">Training Recommendations</h3>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            aria-label={showDetails ? 'Hide details' : 'Show more'}
            aria-expanded={showDetails}
          >
            {showDetails ? (
              <>
                Hide Details <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </>
            ) : (
              <>
                Show More <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-4 text-sm text-slate-600">
          <span className="font-semibold">{statsData.horseName}</span>
          <span>•</span>
          <span>{statsData.age.years} years, {statsData.age.months} months</span>
        </div>
      </div>

      {/* Training Window */}
      {trainingWindowInfo.text && (
        <div
          className={`mb-4 rounded-md p-4 ${
            statsData.trainingWindow === 'prime'
              ? 'bg-emerald-50 border border-emerald-200'
              : statsData.trainingWindow === 'too young'
                ? 'bg-amber-50 border border-amber-200'
                : 'bg-slate-50 border border-slate-200'
          }`}
        >
          <p className={`text-sm font-semibold ${trainingWindowInfo.color}`}>
            Training Window: {statsData.trainingWindow}
          </p>
          <p className="text-sm text-slate-700 mt-1">{trainingWindowInfo.text}</p>
        </div>
      )}

      {/* Recommendations Summary */}
      <div className="space-y-3">
        {recommendations.map((rec) => {
          const priorityStyles = {
            high: {
              bg: 'bg-rose-50',
              border: 'border-rose-200',
              text: 'text-rose-900',
              badge: 'bg-rose-600 text-white',
            },
            medium: {
              bg: 'bg-amber-50',
              border: 'border-amber-200',
              text: 'text-amber-900',
              badge: 'bg-amber-600 text-white',
            },
            low: {
              bg: 'bg-blue-50',
              border: 'border-blue-200',
              text: 'text-blue-900',
              badge: 'bg-blue-600 text-white',
            },
          };

          const styles = priorityStyles[rec.priority];

          return (
            <div
              key={rec.stat}
              className={`rounded-md border p-4 ${styles.bg} ${styles.border}`}
              data-priority={rec.priority}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold capitalize ${styles.text}`}>
                    {rec.stat}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles.badge}`}>
                    {rec.priority} priority
                  </span>
                </div>
                <span className="text-sm text-slate-600">
                  {rec.currentValue}/{rec.potentialValue} (+{rec.gap})
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-700">Suggested Training:</p>
                <ul className="space-y-1">
                  {rec.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                      <span className="text-blue-600">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Discipline-Specific Recommendations */}
      {statsData.discipline && statsData.discipline.toLowerCase() === 'racing' && (
        <div className="mt-6 rounded-md bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm font-semibold text-blue-900">Racing Focus - Ideal for Racing</p>
          <p className="text-xs text-blue-700 mt-1">
            This horse has excellent racing potential. Focus on developing acceleration and
            endurance for optimal race performance.
          </p>
        </div>
      )}

      {/* Detailed Training Plan (Expandable) */}
      {showDetails && recommendations.length > 0 && (
        <div className="mt-6 rounded-md bg-indigo-50 border border-indigo-200 p-4">
          <p className="text-sm font-semibold text-indigo-900 mb-2">Detailed Training Plan</p>
          <p className="text-xs text-indigo-700 mb-3">
            Follow this training schedule for optimal stat development:
          </p>
          <ul className="space-y-1 text-xs text-indigo-700">
            <li>• Week 1-2: Focus on {recommendations[0]?.stat} (high priority)</li>
            <li>• Week 3-4: Continue {recommendations[0]?.stat}, add {recommendations[1]?.stat} work</li>
            <li>• Week 5+: Balanced training across all weak stats</li>
            <li>• Training schedule: 4-5 sessions per week, with rest days</li>
          </ul>
        </div>
      )}

      {/* Action Footer */}
      {recommendations.length > 0 && (
        <div className="mt-6 rounded-md bg-slate-50 border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-700 mb-2">Training Tips:</p>
          <ul className="space-y-1 text-xs text-slate-600">
            <li>• Focus on high priority stats first for maximum improvement</li>
            <li>• Training effectiveness varies by age and training window</li>
            <li>• Consistent training yields better results than sporadic sessions</li>
            {statsData.discipline && (
              <li>
                • Training for {statsData.discipline} - prioritize discipline-specific stats
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TrainingRecommendations;
