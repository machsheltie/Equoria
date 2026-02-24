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
          <span className="text-[rgb(148,163,184)]">{label}</span>
          <span className="font-medium text-[rgb(220,235,255)]">{percent}%</span>
        </div>
        <div className="h-1.5 bg-[rgba(15,35,70,0.5)] rounded-full overflow-hidden">
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
      className="rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-4 space-y-4"
      data-testid="groom-show-handler-panel"
      aria-label={`Show handler panel for ${groom.name}`}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" aria-hidden="true" />
          <h3 className="font-semibold text-[rgb(220,235,255)]" data-testid="handler-panel-title">
            Show Handler
          </h3>
        </div>
        <span
          className="text-xs bg-[rgba(212,168,67,0.1)] text-amber-400 px-2 py-0.5 rounded font-medium"
          data-testid="handler-skill-badge"
        >
          {getSkillLevelLabel(groom.skillLevel)}
        </span>
      </div>

      {/* Handler skill bonus range */}
      <div className="bg-[rgba(15,35,70,0.4)] rounded-lg border border-[rgba(37,99,235,0.3)] p-3">
        <p className="text-xs font-medium text-[rgb(148,163,184)] mb-1">Handler Bonus Range</p>
        <p className="text-lg font-bold text-[rgb(220,235,255)]" data-testid="handler-bonus-range">
          {getHandlerBonusRange(groom.skillLevel)}
        </p>
        <p className="text-xs text-[rgb(148,163,184)] mt-0.5">
          Applies to conformation show performance
        </p>
      </div>

      {/* Conformation show scoring breakdown */}
      <div data-testid="scoring-breakdown-section">
        <p className="text-xs font-semibold text-[rgb(148,163,184)] mb-2 uppercase tracking-wide">
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
            color="bg-emerald-400"
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
          <Zap className="w-3 h-3 text-amber-400" aria-hidden="true" />
          <p className="text-xs font-semibold text-[rgb(148,163,184)] uppercase tracking-wide">
            Personality Synergy
          </p>
          <span
            className="ml-auto text-xs font-medium text-amber-400 bg-[rgba(212,168,67,0.1)] border border-[rgba(212,168,67,0.3)] px-1.5 py-0.5 rounded"
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
                className="text-xs bg-[rgba(212,168,67,0.1)] text-amber-400 border border-[rgba(212,168,67,0.3)] px-2 py-0.5 rounded"
              >
                {discipline}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[rgb(148,163,184)]" data-testid="no-synergy-disciplines">
            No discipline synergy for this personality
          </p>
        )}
      </div>

      {/* Specialty bonus */}
      <div data-testid="specialty-section">
        <div className="flex items-center gap-1.5 mb-2">
          <Star className="w-3 h-3 text-blue-400" aria-hidden="true" />
          <p className="text-xs font-semibold text-[rgb(148,163,184)] uppercase tracking-wide">
            Specialty
          </p>
          {isShowSpecialty && (
            <span
              className="ml-1 text-xs bg-[rgba(37,99,235,0.1)] text-[rgb(220,235,255)] px-1.5 py-0.5 rounded"
              data-testid="show-handling-badge"
            >
              Conformation specialist
            </span>
          )}
          <span
            className="ml-auto text-xs font-medium text-[rgb(220,235,255)] bg-[rgba(37,99,235,0.1)] border border-blue-500/30 px-1.5 py-0.5 rounded"
            data-testid="specialty-bonus-value"
          >
            +{specialtyBonus}%
          </span>
        </div>
        <p className="text-xs text-[rgb(220,235,255)] mb-1.5" data-testid="specialty-label">
          {getSpecialtyLabel(groom.speciality)}
        </p>
        {specialtyDisciplines.length > 0 ? (
          <div className="flex flex-wrap gap-1" data-testid="specialty-disciplines-list">
            {specialtyDisciplines.map((discipline) => (
              <span
                key={discipline}
                className="text-xs bg-[rgba(37,99,235,0.1)] text-[rgb(220,235,255)] border border-blue-500/30 px-2 py-0.5 rounded"
              >
                {discipline}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[rgb(148,163,184)]" data-testid="no-specialty-disciplines">
            No specific discipline bonus
          </p>
        )}
      </div>

      {/* Show specialty highlight */}
      {isShowSpecialty && (
        <div
          className="bg-[rgba(212,168,67,0.1)] border border-[rgba(212,168,67,0.3)] rounded-lg p-2.5"
          data-testid="show-specialty-highlight"
        >
          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" aria-hidden="true" />
            <p className="text-xs text-amber-400 font-medium">
              This groom excels as a conformation show handler
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroomShowHandlerPanel;
