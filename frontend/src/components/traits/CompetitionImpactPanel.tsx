/**
 * CompetitionImpactPanel Component
 *
 * Displays detailed analysis of how a trait affects competition performance
 * across all disciplines. Shows score modifiers, synergy bonuses, and best
 * discipline recommendations.
 *
 * Story 6-6: Epigenetic Trait System
 */

import React from 'react';
import { Trophy, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import type { EpigeneticTrait, Discipline } from '@/types/traits';
import {
  getImpactColor,
  formatImpactModifier,
  getBestDisciplines,
  calculateTotalImpact,
} from '@/types/traits';

export interface CompetitionImpactPanelProps {
  trait: EpigeneticTrait;
  showSynergies?: boolean;
}

/**
 * Discipline Impact Bar
 */
const ImpactBar: React.FC<{ discipline: string; modifier: number }> = ({
  discipline,
  modifier,
}) => {
  const impactColor = getImpactColor(modifier);
  const ImpactIcon = modifier > 0 ? TrendingUp : modifier < 0 ? TrendingDown : null;

  // Calculate bar width (scale -10 to +10 to 0-100%)
  const percentage = Math.abs(modifier) * 10; // Convert to percentage
  const isPositive = modifier > 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{discipline}</span>
        <div className="flex items-center gap-1">
          {ImpactIcon && <ImpactIcon className={`h-4 w-4 ${impactColor}`} />}
          <span className={`text-sm font-bold ${impactColor}`}>
            {formatImpactModifier(modifier)}
          </span>
        </div>
      </div>

      <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
        {modifier !== 0 && (
          <div
            className={`absolute h-full transition-all duration-500 ${
              isPositive
                ? 'bg-gradient-to-r from-green-400 to-green-500'
                : 'bg-gradient-to-r from-red-400 to-red-500'
            }`}
            style={{
              width: `${percentage}%`,
              left: isPositive ? '50%' : `${50 - percentage}%`,
            }}
          />
        )}
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300" />
      </div>
    </div>
  );
};

/**
 * CompetitionImpactPanel Component
 */
const CompetitionImpactPanel: React.FC<CompetitionImpactPanelProps> = ({
  trait,
  showSynergies = true,
}) => {
  const impact = trait.competitionImpact;
  const totalImpact = calculateTotalImpact(impact);
  const bestDisciplines = getBestDisciplines(impact);
  const hasSynergies =
    showSynergies &&
    trait.competitionImpact.synergyBonuses &&
    trait.competitionImpact.synergyBonuses.length > 0;

  // All disciplines
  const disciplines: Array<{ name: string; key: Discipline; modifier: number }> = [
    { name: 'Dressage', key: 'dressage', modifier: impact.dressage },
    { name: 'Show Jumping', key: 'show_jumping', modifier: impact.show_jumping },
    { name: 'Cross Country', key: 'cross_country', modifier: impact.cross_country },
    { name: 'Endurance', key: 'endurance', modifier: impact.endurance },
    { name: 'Racing', key: 'racing', modifier: impact.racing },
    { name: 'Western', key: 'western', modifier: impact.western },
  ];

  return (
    <div className="space-y-6">
      {/* Overall Impact Summary */}
      <div className="rounded-lg border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-gray-50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-lg bg-slate-200">
            <Trophy className="h-6 w-6 text-slate-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900">Competition Impact</h3>
            <p className="text-sm text-slate-600">
              How this trait affects performance across disciplines
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-600">Total Impact</p>
            <p
              className={`text-2xl font-bold ${
                totalImpact > 0
                  ? 'text-green-600'
                  : totalImpact < 0
                    ? 'text-red-600'
                    : 'text-slate-400'
              }`}
            >
              {formatImpactModifier(totalImpact)}
            </p>
          </div>
        </div>

        {/* Best Disciplines */}
        {bestDisciplines.length > 0 && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-bold text-green-900 mb-2">🏆 Best For:</p>
            <div className="flex flex-wrap gap-2">
              {bestDisciplines.map((disc, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-green-700 bg-white border border-green-200 rounded-lg"
                >
                  <span>{disc.discipline}</span>
                  <span className="text-green-600 font-bold">
                    {formatImpactModifier(disc.modifier)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Discipline-by-Discipline Breakdown */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h4 className="text-sm font-bold text-slate-900 mb-4">Discipline Impact Breakdown</h4>
        <div className="space-y-4">
          {disciplines.map((disc) => (
            <ImpactBar key={disc.key} discipline={disc.name} modifier={disc.modifier} />
          ))}
        </div>
      </div>

      {/* Synergy Bonuses */}
      {hasSynergies && (
        <div className="rounded-lg border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="h-6 w-6 text-purple-600" />
            <div className="flex-1">
              <h4 className="text-lg font-bold text-purple-900">Synergy Bonuses</h4>
              <p className="text-sm text-purple-700">
                Additional bonuses when combined with other traits
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {trait.competitionImpact.synergyBonuses!.map((synergy, index) => (
              <div key={index} className="rounded-lg border border-purple-200 bg-white p-4">
                <p className="text-sm font-semibold text-purple-900 mb-2">{synergy.description}</p>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-purple-700">Requires:</span>
                  <div className="flex flex-wrap gap-1">
                    {synergy.requiredTraitIds.map((traitId, idx) => (
                      <span
                        key={idx}
                        className="inline-block px-2 py-0.5 text-xs font-medium text-purple-700 bg-purple-100 rounded"
                      >
                        {traitId}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-purple-700">Bonus:</span>
                  <div className="flex flex-wrap gap-1">
                    {synergy.bonusDisciplines.map((disc, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-purple-700 bg-purple-100 rounded"
                      >
                        <span className="capitalize">{disc.replace('_', ' ')}</span>
                        <span className="text-purple-900 font-bold">
                          {formatImpactModifier(synergy.bonusAmount)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Impact Explanation */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">Note:</span> Impact modifiers are applied directly to
          competition scores. Positive modifiers increase performance, while negative modifiers
          decrease it. Synergy bonuses activate when the required trait combinations are present.
        </p>
      </div>
    </div>
  );
};

export default CompetitionImpactPanel;
