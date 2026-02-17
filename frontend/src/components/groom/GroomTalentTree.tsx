/**
 * GroomTalentTree Component (Story 7-6: Talent Tree Visualization)
 *
 * Displays the groom's talent tree with:
 * - All 3 tiers of talents for the groom's personality
 * - Available, locked, and selected state per talent
 * - Unlock requirements (level needed per tier)
 * - Prerequisite chain visualization
 * - Talent point allocation (calls onSelectTalent callback)
 *
 * Acceptance Criteria covered:
 * - AC1: All talents across 3 tiers displayed
 * - AC2: Available talents highlighted
 * - AC3: Talent effects clearly explained
 * - AC4: Unlock requirements shown
 * - AC5: Talent point allocation saved (via callback)
 */

import React from 'react';
import { Lock, CheckCircle, Star, ChevronDown } from 'lucide-react';
import {
  GroomTalentData,
  TalentTierWithState,
  TalentWithState,
  getTalentTiersWithState,
  formatTalentEffect,
  countAllocatedTalents,
} from '../../types/groomTalent';

interface GroomTalentTreeProps {
  /** The current groom's data including personality and level */
  groom: GroomTalentData;
  /** Called when player selects a talent (tierKey, talentId) */
  onSelectTalent?: (_tier: 'tier1' | 'tier2' | 'tier3', _talentId: string) => void;
  /** Whether a talent selection is being saved (disables buttons) */
  isSaving?: boolean;
}

/** Individual talent card — shows state (locked/available/selected) */
function TalentCard({
  talent,
  tierKey,
  onSelect,
  isSaving,
}: {
  talent: TalentWithState;
  tierKey: 'tier1' | 'tier2' | 'tier3';
  onSelect?: (_tier: 'tier1' | 'tier2' | 'tier3', _talentId: string) => void;
  isSaving?: boolean;
}) {
  const handleSelect = () => {
    if (talent.isAvailable && !isSaving && onSelect) {
      onSelect(tierKey, talent.id);
    }
  };

  const cardClass = [
    'rounded-lg border p-3 transition-colors',
    talent.isSelected
      ? 'bg-blue-50 border-blue-300'
      : talent.isLocked
        ? 'bg-gray-50 border-gray-200 opacity-60'
        : 'bg-white border-gray-200 hover:border-blue-200 cursor-pointer',
  ].join(' ');

  return (
    <div
      className={cardClass}
      data-testid={`talent-card-${talent.id}`}
      onClick={handleSelect}
      role={talent.isAvailable ? 'button' : undefined}
      aria-pressed={talent.isSelected}
      aria-disabled={talent.isLocked || talent.isSelected}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {talent.isLocked && (
            <Lock
              className="w-3 h-3 text-gray-400 flex-shrink-0"
              aria-hidden="true"
              data-testid={`talent-locked-icon-${talent.id}`}
            />
          )}
          {talent.isSelected && (
            <CheckCircle
              className="w-3 h-3 text-blue-500 flex-shrink-0"
              aria-hidden="true"
              data-testid={`talent-selected-icon-${talent.id}`}
            />
          )}
          {talent.isAvailable && (
            <Star
              className="w-3 h-3 text-amber-400 flex-shrink-0"
              aria-hidden="true"
              data-testid={`talent-available-icon-${talent.id}`}
            />
          )}
          <span
            className="text-sm font-semibold text-gray-800 truncate"
            data-testid={`talent-name-${talent.id}`}
          >
            {talent.name}
          </span>
        </div>

        {talent.isSelected && (
          <span
            className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex-shrink-0"
            data-testid={`talent-selected-badge-${talent.id}`}
          >
            Selected
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-2" data-testid={`talent-description-${talent.id}`}>
        {talent.description}
      </p>

      <div className="flex flex-wrap gap-1" data-testid={`talent-effects-${talent.id}`}>
        {Object.entries(talent.effect).map(([key, value]) => (
          <span
            key={key}
            className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded"
          >
            {formatTalentEffect(key, value)}
          </span>
        ))}
      </div>

      {talent.isAvailable && !isSaving && (
        <button
          className="mt-2 w-full text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
          data-testid={`talent-select-btn-${talent.id}`}
          onClick={(e) => {
            e.stopPropagation();
            handleSelect();
          }}
        >
          Select Talent
        </button>
      )}

      {talent.isAvailable && isSaving && (
        <button
          className="mt-2 w-full text-xs bg-blue-300 text-white px-3 py-1.5 rounded cursor-not-allowed"
          data-testid={`talent-saving-btn-${talent.id}`}
          disabled
        >
          Saving...
        </button>
      )}
    </div>
  );
}

/** A single tier row showing its state and talent choices */
function TierRow({
  tier,
  onSelectTalent,
  isSaving,
}: {
  tier: TalentTierWithState;
  onSelectTalent?: (_tierKey: 'tier1' | 'tier2' | 'tier3', _talentId: string) => void;
  isSaving?: boolean;
}) {
  const tierLabelClass = tier.isUnlocked ? 'text-gray-800' : 'text-gray-400';

  return (
    <div data-testid={`tier-section-${tier.tierKey}`}>
      {/* Tier header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {tier.isUnlocked ? (
            <CheckCircle className="w-4 h-4 text-green-500" aria-hidden="true" />
          ) : (
            <Lock className="w-4 h-4 text-gray-400" aria-hidden="true" />
          )}
          <span
            className={`text-sm font-semibold ${tierLabelClass}`}
            data-testid={`tier-label-${tier.tierKey}`}
          >
            {tier.label}
          </span>
        </div>
        <span className="text-xs text-gray-500" data-testid={`tier-requirement-${tier.tierKey}`}>
          Level {tier.minLevel}+ required
        </span>
      </div>

      {/* Prerequisite note */}
      {!tier.prerequisiteMet && tier.isUnlocked && (
        <p
          className="text-xs text-amber-600 mb-2"
          data-testid={`tier-prerequisite-notice-${tier.tierKey}`}
        >
          Select a Tier {tier.tierKey === 'tier2' ? '1' : '2'} talent first
        </p>
      )}

      {/* Talent cards grid */}
      <div
        className={`grid gap-2 ${tier.talents.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}
        data-testid={`tier-talents-${tier.tierKey}`}
      >
        {tier.talents.map((talent) => (
          <TalentCard
            key={talent.id}
            talent={talent}
            tierKey={tier.tierKey}
            onSelect={onSelectTalent}
            isSaving={isSaving}
          />
        ))}
      </div>
    </div>
  );
}

/** Connector arrow between tiers */
function TierConnector() {
  return (
    <div className="flex justify-center py-1" aria-hidden="true">
      <ChevronDown className="w-5 h-5 text-gray-300" />
    </div>
  );
}

/**
 * GroomTalentTree
 *
 * Displays the full talent tree for a groom's personality:
 * 3 tiers with available/locked/selected talent states.
 */
const GroomTalentTree: React.FC<GroomTalentTreeProps> = ({
  groom,
  onSelectTalent,
  isSaving = false,
}) => {
  const tiers = getTalentTiersWithState(
    groom.groomPersonality,
    groom.level,
    groom.talentSelections
  );
  const allocatedCount = countAllocatedTalents(groom.talentSelections);
  const personalityLabel =
    groom.groomPersonality.charAt(0).toUpperCase() + groom.groomPersonality.slice(1);

  return (
    <div
      className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-1"
      data-testid="groom-talent-tree"
      aria-label={`Talent tree for ${groom.name}`}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900" data-testid="talent-tree-title">
            Talent Tree
          </h3>
          <p className="text-xs text-gray-500" data-testid="talent-personality-label">
            {personalityLabel} specialization
          </p>
        </div>
        <div className="text-right">
          <span
            className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded"
            data-testid="talent-allocated-count"
          >
            {allocatedCount} / 3 allocated
          </span>
        </div>
      </div>

      {/* Unknown personality fallback */}
      {tiers.length === 0 && (
        <p
          className="text-sm text-gray-500 text-center py-4"
          data-testid="talent-unknown-personality"
        >
          Talent tree not available for this personality type.
        </p>
      )}

      {/* Tier sections with connectors */}
      {tiers.map((tier, idx) => (
        <React.Fragment key={tier.tierKey}>
          {idx > 0 && <TierConnector />}
          <TierRow tier={tier} onSelectTalent={onSelectTalent} isSaving={isSaving} />
        </React.Fragment>
      ))}

      {/* All talents selected message */}
      {allocatedCount === 3 && (
        <div
          className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-center"
          data-testid="talent-tree-complete"
        >
          <p className="text-sm font-medium text-blue-700">Talent tree complete!</p>
          <p className="text-xs text-blue-500">All 3 tiers selected for this groom.</p>
        </div>
      )}
    </div>
  );
};

export default GroomTalentTree;
