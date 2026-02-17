/**
 * GroomShowHandlerPanel Component (Story 7-7: Show Handling & Rare Traits)
 *
 * Displays the groom's show handler capabilities for conformation shows (FR-G7):
 * - Handler skill level with bonus range
 * - Conformation show scoring breakdown (65/20/8/7%)
 * - Personality-discipline synergy matches
 * - Specialty relevance for show handling
 *
 * Acceptance Criteria covered:
 * - AC1: Show handler scoring weights displayed
 * - AC2: Discipline synergy shown
 */

import React from 'react';
import { Trophy, Star, Zap, Award } from 'lucide-react';
import {
  GroomHandlerData,
  CONFORMATION_SHOW_WEIGHTS,
  getHandlerBonusRange,
  getPersonalitySynergyDisciplines,
  formatHandlerBonus,
  getSkillLevelLabel,
  getSpecialtyLabel,
  getSpecialtyBonusPercent,
  isShowHandlingSpecialty,
  PERSONALITY_DISCIPLINE_SYNERGY,
  SPECIALTY_DISCIPLINE_BONUSES,
} from '../../types/groomShowHandler';

interface GroomShowHandlerPanelProps {
  /** The groom's data for show handling display */
  groom: GroomHandlerData;
}

/** A single score weight row in the breakdown */
function ScoreWeightRow({
  label,
  percent,
  color,
  testId,
}: {
  label: string;
  percent: number;
  color: string;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-2" data-testid={testId}>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-gray-600">{label}</span>
          <span className="font-medium text-gray-800">{percent}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${color}`}
            style={{ width: `${percent}%` }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * GroomShowHandlerPanel
 *
 * Shows the groom's show handling capabilities for conformation competitions.
 */
const GroomShowHandlerPanel: React.FC<GroomShowHandlerPanelProps> = ({ groom }) => {
  const synergyDisciplines = getPersonalitySynergyDisciplines(groom.personality);
  const synergyBonus = PERSONALITY_DISCIPLINE_SYNERGY[groom.personality]?.bonus ?? 0;
  const specialtyBonus = getSpecialtyBonusPercent(groom.speciality);
  const specialtyDisciplines = SPECIALTY_DISCIPLINE_BONUSES[groom.speciality]?.disciplines ?? [];
  const isShowSpecialty = isShowHandlingSpecialty(groom.speciality);

  return (
    <div
      className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4"
      data-testid="groom-show-handler-panel"
      aria-label={`Show handler panel for ${groom.name}`}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" aria-hidden="true" />
          <h3 className="font-semibold text-gray-900" data-testid="handler-panel-title">
            Show Handler
          </h3>
        </div>
        <span
          className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium"
          data-testid="handler-skill-badge"
        >
          {getSkillLevelLabel(groom.skillLevel)}
        </span>
      </div>

      {/* Handler skill bonus range */}
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <p className="text-xs font-medium text-gray-500 mb-1">Handler Bonus Range</p>
        <p className="text-lg font-bold text-blue-700" data-testid="handler-bonus-range">
          {getHandlerBonusRange(groom.skillLevel)}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Applies to conformation show performance</p>
      </div>

      {/* Conformation show scoring breakdown */}
      <div data-testid="scoring-breakdown-section">
        <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
          Conformation Show Scoring
        </p>
        <div className="space-y-2">
          <ScoreWeightRow
            label="Horse Conformation"
            percent={Math.round(CONFORMATION_SHOW_WEIGHTS.conformationWeight * 100)}
            color="bg-blue-400"
            testId="score-weight-conformation"
          />
          <ScoreWeightRow
            label="Handler Skill"
            percent={Math.round(CONFORMATION_SHOW_WEIGHTS.handlerWeight * 100)}
            color="bg-amber-400"
            testId="score-weight-handler"
          />
          <ScoreWeightRow
            label="Bond Score"
            percent={Math.round(CONFORMATION_SHOW_WEIGHTS.bondWeight * 100)}
            color="bg-green-400"
            testId="score-weight-bond"
          />
          <ScoreWeightRow
            label="Temperament Synergy"
            percent={Math.round(CONFORMATION_SHOW_WEIGHTS.temperamentWeight * 100)}
            color="bg-purple-400"
            testId="score-weight-temperament"
          />
        </div>
      </div>

      {/* Personality synergy */}
      <div data-testid="personality-synergy-section">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="w-3 h-3 text-amber-500" aria-hidden="true" />
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Personality Synergy
          </p>
          <span
            className="ml-auto text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
            data-testid="personality-synergy-bonus"
          >
            {formatHandlerBonus(synergyBonus)}
          </span>
        </div>
        {synergyDisciplines.length > 0 ? (
          <div className="flex flex-wrap gap-1" data-testid="synergy-disciplines-list">
            {synergyDisciplines.map((discipline) => (
              <span
                key={discipline}
                className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded"
              >
                {discipline}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400" data-testid="no-synergy-disciplines">
            No discipline synergy for this personality
          </p>
        )}
      </div>

      {/* Specialty bonus */}
      <div data-testid="specialty-section">
        <div className="flex items-center gap-1.5 mb-2">
          <Star className="w-3 h-3 text-blue-500" aria-hidden="true" />
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Specialty</p>
          {isShowSpecialty && (
            <span
              className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
              data-testid="show-handling-badge"
            >
              Conformation specialist
            </span>
          )}
          <span
            className="ml-auto text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded"
            data-testid="specialty-bonus-value"
          >
            +{specialtyBonus}%
          </span>
        </div>
        <p className="text-xs text-gray-700 mb-1.5" data-testid="specialty-label">
          {getSpecialtyLabel(groom.speciality)}
        </p>
        {specialtyDisciplines.length > 0 ? (
          <div className="flex flex-wrap gap-1" data-testid="specialty-disciplines-list">
            {specialtyDisciplines.map((discipline) => (
              <span
                key={discipline}
                className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded"
              >
                {discipline}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400" data-testid="no-specialty-disciplines">
            No specific discipline bonus
          </p>
        )}
      </div>

      {/* Show specialty highlight */}
      {isShowSpecialty && (
        <div
          className="bg-amber-50 border border-amber-200 rounded-lg p-2.5"
          data-testid="show-specialty-highlight"
        >
          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" aria-hidden="true" />
            <p className="text-xs text-amber-700 font-medium">
              This groom excels as a conformation show handler
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroomShowHandlerPanel;
