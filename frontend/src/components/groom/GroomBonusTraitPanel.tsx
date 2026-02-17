/**
 * GroomBonusTraitPanel Component (Story 7-7: Show Handling & Rare Traits)
 *
 * Displays the groom's bonus traits for rare trait probability (FR-R1 through FR-R4):
 * - FR-R1: Up to 3 bonus traits with names
 * - FR-R2: Bonus percentage per trait (max 30%)
 * - FR-R3: Eligibility requirements (bond > 60, coverage > 75%)
 * - FR-R4: Total rare trait probability display
 *
 * Business Rules:
 * - Max 3 bonus traits, max 30% per trait
 * - Bonus traits only apply to randomized (not guaranteed) traits
 * - Requires bond > 60 and 75% assignment window coverage
 */

import React from 'react';
import { Sparkles, CheckCircle, XCircle, Plus } from 'lucide-react';
import {
  GroomBonusTraitData,
  BonusEligibility,
  BONUS_TRAIT_CONSTANTS,
  getBonusTraitEntries,
  countBonusTraits,
  getTotalBonusPercent,
  formatBonusPercent,
  meetsBondRequirement,
  meetsCoverageRequirement,
  getRemainingSlots,
  formatCoverage,
} from '../../types/groomBonusTrait';

interface GroomBonusTraitPanelProps {
  /** Groom data with bonus trait map */
  groom: GroomBonusTraitData;
  /** Optional eligibility data — if absent, eligibility section is hidden */
  eligibility?: BonusEligibility;
}

/** Single bonus trait row */
function BonusTraitRow({
  traitName,
  bonusDecimal,
  bonusPercent,
}: {
  traitName: string;
  bonusDecimal: number;
  bonusPercent: number;
}) {
  const widthPercent = Math.round(
    (bonusDecimal / BONUS_TRAIT_CONSTANTS.MAX_TRAIT_BONUS_DECIMAL) * 100
  );

  return (
    <div
      className="flex items-center gap-2 py-1.5"
      data-testid={`bonus-trait-row-${traitName.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <Sparkles
        className="w-3 h-3 text-purple-400 flex-shrink-0"
        aria-hidden="true"
        data-testid={`bonus-trait-icon-${traitName.replace(/\s+/g, '-').toLowerCase()}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-xs mb-0.5">
          <span
            className="font-medium text-gray-800 truncate"
            data-testid={`bonus-trait-name-${traitName.replace(/\s+/g, '-').toLowerCase()}`}
          >
            {traitName}
          </span>
          <span
            className="text-purple-700 font-semibold ml-2 flex-shrink-0"
            data-testid={`bonus-trait-percent-${traitName.replace(/\s+/g, '-').toLowerCase()}`}
          >
            {formatBonusPercent(bonusDecimal)}
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-purple-400"
            style={{ width: `${widthPercent}%` }}
            aria-hidden="true"
          />
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{bonusPercent}% of 30% max</p>
      </div>
    </div>
  );
}

/** Empty slot indicator */
function EmptyTraitSlot({ slotNumber }: { slotNumber: number }) {
  return (
    <div
      className="flex items-center gap-2 py-1.5 opacity-50"
      data-testid={`bonus-trait-empty-slot-${slotNumber}`}
    >
      <Plus className="w-3 h-3 text-gray-300 flex-shrink-0" aria-hidden="true" />
      <span className="text-xs text-gray-400 italic">Empty bonus trait slot</span>
    </div>
  );
}

/** Eligibility requirement row */
function EligibilityRow({
  label,
  met,
  value,
  threshold,
  testId,
}: {
  label: string;
  met: boolean;
  value: string;
  threshold: string;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between py-1" data-testid={testId}>
      <div className="flex items-center gap-1.5">
        {met ? (
          <CheckCircle
            className="w-3.5 h-3.5 text-green-500 flex-shrink-0"
            aria-hidden="true"
            data-testid={`${testId}-pass-icon`}
          />
        ) : (
          <XCircle
            className="w-3.5 h-3.5 text-red-400 flex-shrink-0"
            aria-hidden="true"
            data-testid={`${testId}-fail-icon`}
          />
        )}
        <span className="text-xs text-gray-600">{label}</span>
      </div>
      <span
        className={`text-xs font-medium ${met ? 'text-green-700' : 'text-red-600'}`}
        data-testid={`${testId}-value`}
      >
        {value} / {threshold} required
      </span>
    </div>
  );
}

/**
 * GroomBonusTraitPanel
 *
 * Displays the groom's bonus traits for rare trait probability and eligibility.
 */
const GroomBonusTraitPanel: React.FC<GroomBonusTraitPanelProps> = ({ groom, eligibility }) => {
  const entries = getBonusTraitEntries(groom.bonusTraitMap);
  const traitCount = countBonusTraits(groom.bonusTraitMap);
  const totalPercent = getTotalBonusPercent(groom.bonusTraitMap);
  const remainingSlots = getRemainingSlots(groom.bonusTraitMap);

  const bondMet = eligibility ? meetsBondRequirement(eligibility.averageBondScore) : false;
  const coverageMet = eligibility
    ? meetsCoverageRequirement(eligibility.coveragePercentage)
    : false;

  return (
    <div
      className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4"
      data-testid="groom-bonus-trait-panel"
      aria-label={`Bonus traits for ${groom.name}`}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" aria-hidden="true" />
          <h3 className="font-semibold text-gray-900" data-testid="bonus-trait-panel-title">
            Rare Trait Bonuses
          </h3>
        </div>
        <span
          className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium"
          data-testid="bonus-trait-count-badge"
        >
          {traitCount} / {BONUS_TRAIT_CONSTANTS.MAX_BONUS_TRAITS} traits
        </span>
      </div>

      {/* Total bonus probability */}
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <p className="text-xs font-medium text-gray-500 mb-1">Total Bonus Probability</p>
        <p className="text-lg font-bold text-purple-700" data-testid="total-bonus-probability">
          {totalPercent > 0 ? `+${totalPercent}%` : '0%'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Applies to randomized rare trait acquisition</p>
      </div>

      {/* Bonus traits list */}
      <div data-testid="bonus-traits-list">
        <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
          Assigned Bonus Traits
        </p>

        {entries.length === 0 && (
          <p className="text-xs text-gray-400 italic py-1" data-testid="no-bonus-traits-message">
            No bonus traits assigned
          </p>
        )}

        <div className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <BonusTraitRow
              key={entry.traitName}
              traitName={entry.traitName}
              bonusDecimal={entry.bonusDecimal}
              bonusPercent={entry.bonusPercent}
            />
          ))}
          {Array.from({ length: remainingSlots }, (_, i) => (
            <EmptyTraitSlot key={`empty-${i}`} slotNumber={traitCount + i + 1} />
          ))}
        </div>
      </div>

      {/* Eligibility section */}
      {eligibility && (
        <div data-testid="bonus-eligibility-section">
          <p className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
            Bonus Eligibility
          </p>

          {/* Overall status */}
          <div
            className={`rounded-lg border px-3 py-2 mb-2 ${
              eligibility.eligible ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}
            data-testid="eligibility-status-banner"
          >
            <div className="flex items-center gap-1.5">
              {eligibility.eligible ? (
                <CheckCircle
                  className="w-3.5 h-3.5 text-green-600 flex-shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" aria-hidden="true" />
              )}
              <p
                className={`text-xs font-medium ${
                  eligibility.eligible ? 'text-green-700' : 'text-red-600'
                }`}
                data-testid="eligibility-status-text"
              >
                {eligibility.eligible ? 'Eligible for bonus' : eligibility.reason}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 px-3 divide-y divide-gray-100">
            <EligibilityRow
              label="Bond Score"
              met={bondMet}
              value={String(Math.round(eligibility.averageBondScore))}
              threshold={String(BONUS_TRAIT_CONSTANTS.MIN_BOND_SCORE)}
              testId="eligibility-bond"
            />
            <EligibilityRow
              label="Assignment Coverage"
              met={coverageMet}
              value={formatCoverage(eligibility.coveragePercentage)}
              threshold={formatCoverage(BONUS_TRAIT_CONSTANTS.MIN_COVERAGE_PERCENTAGE)}
              testId="eligibility-coverage"
            />
          </div>
        </div>
      )}

      {/* Educational note */}
      <div
        className="bg-gray-100 rounded-lg p-2.5 border border-gray-200"
        data-testid="bonus-trait-note"
      >
        <p className="text-xs text-gray-500">
          <span className="font-medium">Note:</span> Bonus traits only increase probability for
          randomized rare traits, not guaranteed trait outcomes.
        </p>
      </div>
    </div>
  );
};

export default GroomBonusTraitPanel;
