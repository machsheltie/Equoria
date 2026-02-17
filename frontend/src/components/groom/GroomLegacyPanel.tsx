/**
 * GroomLegacyPanel Component (Story 7-5: Legacy System UI)
 *
 * Displays the groom's legacy/mentorship relationships including:
 * - Mentor lineage (who mentored this groom and what perk was inherited)
 * - Protégé info (if this groom has created a legacy successor)
 * - Available perks this groom could pass to a protégé
 * - Mentor eligibility status
 * - Legacy bonuses received as a protégé
 *
 * Acceptance Criteria covered:
 * - AC1: Skills and traits transfer displayed
 * - AC2: Legacy trees show lineage
 * - AC3: Trait inheritance preview
 * - AC4: Mentorship period displayed
 * - AC5: Bonus effectiveness for legacy grooms
 */

import React from 'react';
import { GitBranch, Award, Star, ChevronRight, Lock, CheckCircle, Sparkles } from 'lucide-react';
import {
  GroomLegacyData,
  MentorInfo,
  ProtégéInfo,
  LegacyPerk,
  LEGACY_CONSTANTS,
  checkLegacyEligibility,
  getAvailablePerksForPersonality,
  formatPerkEffect,
} from '../../types/groomLegacy';

interface GroomLegacyPanelProps {
  /** The current groom's data */
  groom: GroomLegacyData;
  /** Mentor who trained this groom (if they were a protégé) */
  mentorInfo?: MentorInfo;
  /** Protégé created by this groom (if they mentored someone) */
  protégéInfo?: ProtégéInfo;
  /** Whether this groom has already created a protégé */
  hasCreatedProtégé?: boolean;
}

/** Single perk card showing perk name, description, and effects */
function PerkCard({ perk, isInherited = false }: { perk: LegacyPerk; isInherited?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        isInherited ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
      }`}
      data-testid={`perk-card-${perk.id}`}
    >
      <div className="flex items-center gap-2 mb-1">
        {isInherited && (
          <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" aria-hidden="true" />
        )}
        <span className="text-sm font-semibold text-gray-800" data-testid={`perk-name-${perk.id}`}>
          {perk.name}
        </span>
        {isInherited && (
          <span
            className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded"
            data-testid={`perk-inherited-badge-${perk.id}`}
          >
            Inherited
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-2" data-testid={`perk-description-${perk.id}`}>
        {perk.description}
      </p>
      <div className="flex flex-wrap gap-1" data-testid={`perk-effects-${perk.id}`}>
        {Object.entries(perk.effect).map(([key, value]) => (
          <span
            key={key}
            className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded"
          >
            {formatPerkEffect(key, value)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Lineage node in the legacy tree */
function LineageNode({
  name,
  level,
  role,
  testId,
  isCenter = false,
}: {
  name: string;
  level: number;
  role: string;
  testId: string;
  isCenter?: boolean;
}) {
  return (
    <div
      className={`text-center px-3 py-2 rounded-lg border ${
        isCenter
          ? 'bg-blue-50 border-blue-200 text-blue-800'
          : 'bg-white border-gray-200 text-gray-700'
      }`}
      data-testid={testId}
    >
      <p className="text-xs text-gray-500 mb-0.5">{role}</p>
      <p className="text-sm font-semibold">{name}</p>
      <p className="text-xs text-gray-400">Level {level}</p>
    </div>
  );
}

/** Legacy lineage tree showing mentor → groom → protégé */
function LegacyTree({
  groom,
  mentorInfo,
  protégéInfo,
}: {
  groom: GroomLegacyData;
  mentorInfo?: MentorInfo;
  protégéInfo?: ProtégéInfo;
}) {
  return (
    <div data-testid="legacy-tree-section">
      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-1">
        <GitBranch className="w-3 h-3" aria-hidden="true" />
        Legacy Lineage
      </h4>
      <div className="flex items-center justify-center gap-2" data-testid="legacy-tree">
        {/* Mentor (if any) */}
        {mentorInfo ? (
          <LineageNode
            name={mentorInfo.mentorName}
            level={mentorInfo.mentorLevel}
            role="Mentor"
            testId="legacy-tree-mentor"
          />
        ) : (
          <div
            className="text-center px-3 py-2 rounded-lg border border-dashed border-gray-300 text-gray-400"
            data-testid="legacy-tree-no-mentor"
          >
            <p className="text-xs mb-0.5">Mentor</p>
            <p className="text-xs">None</p>
          </div>
        )}

        <ChevronRight className="text-gray-400 flex-shrink-0" size={16} aria-hidden="true" />

        {/* Current groom (center) */}
        <LineageNode
          name={groom.name}
          level={groom.level}
          role={groom.retired ? 'Retired' : 'Active'}
          testId="legacy-tree-current"
          isCenter
        />

        <ChevronRight className="text-gray-400 flex-shrink-0" size={16} aria-hidden="true" />

        {/* Protégé (if any) */}
        {protégéInfo ? (
          <LineageNode
            name={protégéInfo.protégéName}
            level={0}
            role="Protégé"
            testId="legacy-tree-protege"
          />
        ) : (
          <div
            className="text-center px-3 py-2 rounded-lg border border-dashed border-gray-300 text-gray-400"
            data-testid="legacy-tree-no-protege"
          >
            <p className="text-xs mb-0.5">Protégé</p>
            <p className="text-xs">None yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Mentor eligibility status for a retired groom */
function MentorEligibilitySection({
  groom,
  hasCreatedProtégé,
}: {
  groom: GroomLegacyData;
  hasCreatedProtégé: boolean;
}) {
  const eligibility = checkLegacyEligibility(groom, hasCreatedProtégé);

  return (
    <div data-testid="mentor-eligibility-section">
      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1">
        <Award className="w-3 h-3" aria-hidden="true" />
        Mentor Eligibility
      </h4>
      <div
        className={`flex items-start gap-2 rounded-lg p-3 border ${
          eligibility.isEligible ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
        }`}
        data-testid="mentor-eligibility-status"
      >
        {eligibility.isEligible ? (
          <CheckCircle
            className="text-green-500 flex-shrink-0 mt-0.5"
            size={14}
            aria-hidden="true"
          />
        ) : (
          <Lock className="text-gray-400 flex-shrink-0 mt-0.5" size={14} aria-hidden="true" />
        )}
        <div>
          {eligibility.isEligible ? (
            <p className="text-sm font-medium text-green-700" data-testid="eligible-message">
              Eligible to mentor a protégé
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-600" data-testid="ineligible-message">
                Not yet eligible to mentor
              </p>
              <ul className="mt-1 space-y-0.5">
                {eligibility.reasons.map((reason) => (
                  <li
                    key={reason}
                    className="text-xs text-gray-500"
                    data-testid={`eligibility-reason`}
                  >
                    {reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-1" data-testid="mentor-level-requirement">
        Requires Level {LEGACY_CONSTANTS.MINIMUM_MENTOR_LEVEL}+ and retired status
      </p>
    </div>
  );
}

/** Displays the inherited perk from a mentor */
function InheritedPerkSection({ mentorInfo }: { mentorInfo: MentorInfo }) {
  const mentorDate = new Date(mentorInfo.mentorshipDate).toLocaleDateString();

  return (
    <div data-testid="inherited-perk-section">
      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1">
        <Star className="w-3 h-3" aria-hidden="true" />
        Inherited from {mentorInfo.mentorName}
      </h4>
      <p className="text-xs text-gray-500 mb-2" data-testid="mentorship-date">
        Mentored on {mentorDate}
      </p>
      <PerkCard perk={mentorInfo.inheritedPerk} isInherited />
    </div>
  );
}

/** Shows the legacy bonuses a protégé receives */
function LegacyBonusesSection() {
  return (
    <div
      className="bg-blue-50 border border-blue-100 rounded-lg p-3"
      data-testid="legacy-bonuses-section"
    >
      <h4 className="text-xs font-semibold text-blue-700 mb-2">Legacy Protégé Bonuses</h4>
      <ul className="space-y-1 text-xs text-blue-600">
        <li data-testid="bonus-experience">
          +{LEGACY_CONSTANTS.PROTEGE_EXPERIENCE_BONUS} bonus starting XP
        </li>
        <li data-testid="bonus-level">
          +{LEGACY_CONSTANTS.PROTEGE_LEVEL_BONUS} starting level bonus
        </li>
        <li data-testid="bonus-skill">
          +{LEGACY_CONSTANTS.PROTEGE_SKILL_BONUS_PERCENT}% skill effectiveness bonus
        </li>
        <li data-testid="bonus-perk">1 inherited perk from mentor's personality type</li>
      </ul>
    </div>
  );
}

/** Shows perks this groom could pass to a future protégé */
function TraitInheritancePreview({ groom }: { groom: GroomLegacyData }) {
  const availablePerks = getAvailablePerksForPersonality(groom.groomPersonality);

  if (availablePerks.length === 0) return null;

  return (
    <div data-testid="trait-inheritance-preview">
      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
        Transferable Perks
      </h4>
      <p className="text-xs text-gray-500 mb-3" data-testid="perk-personality-label">
        From {groom.groomPersonality} personality — one perk chosen at random
      </p>
      <div className="space-y-2">
        {availablePerks.map((perk) => (
          <PerkCard key={perk.id} perk={perk} />
        ))}
      </div>
    </div>
  );
}

/** Shows the protégé this groom created */
function ProtégéSection({ protégéInfo }: { protégéInfo: ProtégéInfo }) {
  const createdDate = new Date(protégéInfo.createdAt).toLocaleDateString();

  return (
    <div data-testid="protege-section">
      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
        Your Protégé
      </h4>
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <p className="text-sm font-semibold text-gray-800" data-testid="protege-name">
          {protégéInfo.protégéName}
        </p>
        <p className="text-xs text-gray-500 mb-2" data-testid="protege-created-date">
          Created {createdDate}
        </p>
        <p className="text-xs text-gray-600 mb-2">Inherited perk:</p>
        <PerkCard perk={protégéInfo.inheritedPerk} />
      </div>
    </div>
  );
}

/**
 * GroomLegacyPanel
 *
 * Displays the full legacy/mentorship system for a groom:
 * lineage tree, inherited perks, transferable perks, and mentor eligibility.
 */
const GroomLegacyPanel: React.FC<GroomLegacyPanelProps> = ({
  groom,
  mentorInfo,
  protégéInfo,
  hasCreatedProtégé = false,
}) => {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-5"
      data-testid="groom-legacy-panel"
      aria-label={`Legacy information for ${groom.name}`}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900" data-testid="legacy-panel-title">
          Legacy & Mentorship
        </h3>
        {mentorInfo && (
          <span
            className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded"
            data-testid="legacy-groom-badge"
          >
            Legacy Groom
          </span>
        )}
      </div>

      {/* Legacy tree showing lineage */}
      <LegacyTree groom={groom} mentorInfo={mentorInfo} protégéInfo={protégéInfo} />

      {/* Legacy bonuses section (shown if this groom is a protégé) */}
      {mentorInfo && <LegacyBonusesSection />}

      {/* Inherited perk from mentor */}
      {mentorInfo && <InheritedPerkSection mentorInfo={mentorInfo} />}

      {/* Mentor eligibility (for retired grooms who haven't mentored yet) */}
      {groom.retired && !hasCreatedProtégé && (
        <MentorEligibilitySection groom={groom} hasCreatedProtégé={hasCreatedProtégé} />
      )}

      {/* Protégé they created */}
      {protégéInfo && <ProtégéSection protégéInfo={protégéInfo} />}

      {/* Transferable perks preview (for active or retired grooms without a protégé yet) */}
      {!hasCreatedProtégé && <TraitInheritancePreview groom={groom} />}
    </div>
  );
};

export default GroomLegacyPanel;
