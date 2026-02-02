/**
 * Training Recommendations Component
 *
 * Displays AI-powered training suggestions based on horse readiness
 *
 * Story 4.5: Training Dashboard - Task 7
 */

import { useMemo } from 'react';
import { Lightbulb, TrendingUp, Clock, Trophy } from 'lucide-react';
import { DashboardHorse } from './DashboardHorseCard';

export interface TrainingRecommendationsProps {
  horses: DashboardHorse[];
  className?: string;
}

interface Recommendation {
  horseId: number;
  horseName: string;
  age: number;
  reason: string;
}

const TrainingRecommendations = ({ horses, className = '' }: TrainingRecommendationsProps) => {
  // Calculate priority recommendations (ready horses, oldest first, max 3)
  const recommendations = useMemo((): Recommendation[] => {
    const readyHorses = horses.filter((h) => h.trainingStatus === 'ready');

    // Sort by age (oldest first) and take top 3
    const sorted = [...readyHorses].sort((a, b) => b.age - a.age).slice(0, 3);

    return sorted.map((horse) => ({
      horseId: horse.id,
      horseName: horse.name,
      age: horse.age,
      reason:
        horse.age >= 7
          ? 'Senior horse - prioritize maintaining fitness'
          : horse.age >= 5
            ? 'Prime training age - maximize skill development'
            : 'Young horse - build strong foundation',
    }));
  }, [horses]);

  // Training tips (static for now, could be dynamic based on stable composition)
  const trainingTips = [
    {
      icon: Clock,
      text: 'Train horses regularly to maintain their skills and fitness levels',
    },
    {
      icon: TrendingUp,
      text: 'Focus on one discipline at a time for optimal skill development',
    },
    {
      icon: Trophy,
      text: 'Older horses (7+ years) benefit from consistent training schedules',
    },
  ];

  // Empty state logic
  const noHorses = horses.length === 0;
  const noReadyHorses = recommendations.length === 0 && horses.length > 0;

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`} data-testid="recommendations">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-5 w-5 text-amber-500" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-slate-900">Training Recommendations</h2>
      </div>
      <p className="text-sm text-slate-600 mb-6">
        AI-powered suggestions to optimize your training strategy
      </p>

      {/* Empty State - No Horses */}
      {noHorses && (
        <div className="py-8 text-center" data-testid="empty-recommendations">
          <Lightbulb className="mx-auto h-12 w-12 text-slate-400 mb-4" aria-hidden="true" />
          <p className="text-sm text-slate-600">
            Add horses to receive training recommendations tailored to your stable
          </p>
        </div>
      )}

      {/* Empty State - No Ready Horses */}
      {noReadyHorses && (
        <div className="py-8 text-center mb-6" data-testid="empty-recommendations">
          <Clock className="mx-auto h-12 w-12 text-slate-400 mb-4" aria-hidden="true" />
          <p className="text-sm text-slate-600">
            No training recommendations available - all horses are on cooldown or ineligible
          </p>
        </div>
      )}

      {/* Priority Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Priority Training</h3>
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div
                key={rec.horseId}
                className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg"
                data-testid="horse-recommendation"
              >
                <TrendingUp
                  className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="flex-1">
                  <div className="font-medium text-slate-900">
                    {rec.horseName}
                    <span className="ml-2 text-sm text-slate-600 font-normal">
                      {rec.age} {rec.age === 1 ? 'year' : 'years'} old
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{rec.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Training Tips */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Training Tips</h3>
        <div className="space-y-2">
          {trainingTips.map((tip, index) => {
            const Icon = tip.icon;
            return (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
                data-testid="training-tip"
              >
                <Icon className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-slate-700">{tip.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TrainingRecommendations;
