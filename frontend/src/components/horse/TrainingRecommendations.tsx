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

// Minimum stat gap required before a training recommendation is generated
const MIN_RECOMMENDATION_GAP = 5;
const HIGH_PRIORITY_GAP = 20;
const MEDIUM_PRIORITY_GAP = 10;

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

  // Training suggestions by stat type — covers all 10 game stats
  const getTrainingSuggestions = (stat: string, discipline?: string): string[] => {
    const suggestions: Record<string, string[]> = {
      speed: ['Sprint Practice', 'Racing', 'Speed Drills'],
      stamina: ['Endurance Rides', 'Long Distance', 'Cardio'],
      agility: ['Obstacle Courses', 'Barrel Racing', 'Flexibility Work'],
      strength: ['Weight Pulling', 'Hill Climbing', 'Resistance Training'],
      intelligence: ['Problem Solving Exercises', 'Pattern Training', 'Command Practice'],
      temperament: ['Desensitization Work', 'Trust Building', 'Calm Exposure'],
      balance: ['Pole Work', 'Lateral Movements', 'Collection Exercises'],
      precision: ['Gymnastic Grids', 'Transition Drills', 'Accuracy Courses'],
      boldness: ['Novel Environment Exposure', 'Trail Challenges', 'Confidence Building'],
      flexibility: ['Stretching Routines', 'Cavaletti Work', 'Suppling Exercises'],
      obedience: ['Ground Work', 'Voice Command Drills', 'Yielding Exercises'],
      focus: ['Attention Exercises', 'Complex Pattern Work', 'Distractions Training'],
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
    // Derive stat list from the API response so new stats are handled automatically
    const statNames = Object.keys(statsData.currentStats) as Array<
      keyof typeof statsData.currentStats
    >;

    for (const stat of statNames) {
      const currentValue = statsData.currentStats[stat];
      const potentialValue = statsData.geneticPotential[stat];
      const gap = potentialValue - currentValue;

      // Only recommend if there's a gap of at least 5 points
      if (gap >= MIN_RECOMMENDATION_GAP) {
        let priority: 'high' | 'medium' | 'low';
        if (gap >= HIGH_PRIORITY_GAP) {
          priority = 'high';
        } else if (gap >= MEDIUM_PRIORITY_GAP) {
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
          color: 'text-amber-400',
        };
      case 'prime':
        return {
          text: 'Prime training window - best time to train for maximum gains!',
          color: 'text-emerald-400',
        };
      case 'maintenance':
        return {
          text: 'Maintenance training - maintain current level and preserve stats.',
          color: 'text-blue-400',
        };
      case 'senior':
        return {
          text: 'Senior horse - limited training capacity, gentle exercise only.',
          color: 'text-[rgb(148,163,184)]',
        };
      default:
        return { text: '', color: 'text-[rgb(148,163,184)]' };
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-6 shadow-sm">
        <div className="text-center text-sm text-[rgb(148,163,184)]">
          Loading training recommendations...
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !statsData) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-[rgba(239,68,68,0.1)] p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-400 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose-300">Error Loading Recommendations</p>
            <p className="text-sm text-rose-400 mt-1">
              {error?.message || 'Failed to fetch training recommendations'}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 rounded-md bg-rose-600 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-rose-700"
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
        className="w-full rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-6 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-[rgb(220,235,255)]">
            Training Recommendations
          </h3>
        </div>

        <div className="rounded-md bg-[rgba(16,185,129,0.1)] border border-emerald-500/30 p-4">
          <p className="text-sm text-emerald-400">
            {statsData.horseName} has reached maximum potential - fully trained! No recommendations
            needed. Continue maintenance training to preserve current abilities.
          </p>
        </div>

        {/* Training Window */}
        {trainingWindowInfo.text && (
          <div className="mt-4 rounded-md bg-[rgba(15,35,70,0.3)] border border-[rgba(37,99,235,0.3)] p-4">
            <p className={`text-sm font-semibold ${trainingWindowInfo.color}`}>
              Training Window: {statsData.trainingWindow}
            </p>
            <p className="text-sm text-[rgb(220,235,255)] mt-1">{trainingWindowInfo.text}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="training-recommendations"
      className="w-full rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-6 shadow-sm"
    >
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-400" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-[rgb(220,235,255)]">
              Training Recommendations
            </h3>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
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
        <div className="mt-2 flex items-center gap-4 text-sm text-[rgb(148,163,184)]">
          <span className="font-semibold">{statsData.horseName}</span>
          <span>•</span>
          <span>
            {statsData.age.years} years, {statsData.age.months} months
          </span>
        </div>
      </div>

      {/* Training Window */}
      {trainingWindowInfo.text && (
        <div
          className={`mb-4 rounded-md p-4 ${
            statsData.trainingWindow === 'prime'
              ? 'bg-[rgba(16,185,129,0.1)] border border-emerald-500/30'
              : statsData.trainingWindow === 'too young'
                ? 'bg-[rgba(212,168,67,0.1)] border border-amber-500/30'
                : 'bg-[rgba(15,35,70,0.3)] border border-[rgba(37,99,235,0.3)]'
          }`}
        >
          <p className={`text-sm font-semibold ${trainingWindowInfo.color}`}>
            Training Window: {statsData.trainingWindow}
          </p>
          <p className="text-sm text-[rgb(220,235,255)] mt-1">{trainingWindowInfo.text}</p>
        </div>
      )}

      {/* Recommendations Summary */}
      <div className="space-y-3">
        {recommendations.map((rec) => {
          const priorityStyles = {
            high: {
              bg: 'bg-[rgba(239,68,68,0.1)]',
              border: 'border-red-500/30',
              text: 'text-red-300',
              badge: 'bg-rose-600 text-[var(--text-primary)]',
            },
            medium: {
              bg: 'bg-[rgba(212,168,67,0.1)]',
              border: 'border-amber-500/30',
              text: 'text-amber-300',
              badge: 'bg-amber-600 text-[var(--text-primary)]',
            },
            low: {
              bg: 'bg-[rgba(37,99,235,0.1)]',
              border: 'border-blue-500/30',
              text: 'text-blue-300',
              badge: 'bg-blue-600 text-[var(--text-primary)]',
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
                <span className="text-sm text-[rgb(148,163,184)]">
                  {rec.currentValue}/{rec.potentialValue} (+{rec.gap})
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-[rgb(148,163,184)]">Suggested Training:</p>
                <ul className="space-y-1">
                  {rec.suggestions.map((suggestion, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-[rgb(220,235,255)] flex items-start gap-2"
                    >
                      <span className="text-blue-400">•</span>
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
        <div className="mt-6 rounded-md bg-[rgba(37,99,235,0.1)] border border-blue-500/30 p-4">
          <p className="text-sm font-semibold text-blue-300">Racing Focus - Ideal for Racing</p>
          <p className="text-xs text-blue-400 mt-1">
            This horse has excellent racing potential. Focus on developing acceleration and
            endurance for optimal race performance.
          </p>
        </div>
      )}

      {/* Detailed Training Plan (Expandable) */}
      {showDetails && recommendations.length > 0 && (
        <div className="mt-6 rounded-md bg-[rgba(37,99,235,0.1)] border border-blue-500/30 p-4">
          <p className="text-sm font-semibold text-blue-300 mb-2">Detailed Training Plan</p>
          <p className="text-xs text-blue-400 mb-3">
            Follow this training schedule for optimal stat development:
          </p>
          <ul className="space-y-1 text-xs text-blue-400">
            <li>• Week 1-2: Focus on {recommendations[0]?.stat} (high priority)</li>
            <li>
              • Week 3-4: Continue {recommendations[0]?.stat}, add {recommendations[1]?.stat} work
            </li>
            <li>• Week 5+: Balanced training across all weak stats</li>
            <li>• Training schedule: 4-5 sessions per week, with rest days</li>
          </ul>
        </div>
      )}

      {/* Action Footer */}
      {recommendations.length > 0 && (
        <div className="mt-6 rounded-md bg-[rgba(15,35,70,0.3)] border border-[rgba(37,99,235,0.3)] p-4">
          <p className="text-xs font-semibold text-[rgb(148,163,184)] mb-2">Training Tips:</p>
          <ul className="space-y-1 text-xs text-[rgb(148,163,184)]">
            <li>• Focus on high priority stats first for maximum improvement</li>
            <li>• Training effectiveness varies by age and training window</li>
            <li>• Consistent training yields better results than sporadic sessions</li>
            {statsData.discipline && (
              <li>• Training for {statsData.discipline} - prioritize discipline-specific stats</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TrainingRecommendations;
