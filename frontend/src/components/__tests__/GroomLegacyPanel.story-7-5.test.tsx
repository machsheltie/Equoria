/**
 * Story 7-5: Legacy System UI
 * Acceptance Criteria Tests
 *
 * FR-G5: Players can manage groom legacy and protégés so experienced grooms
 * can train successors with skills and trait transfer.
 *
 * AC1: Skills and traits transfer displayed
 * AC2: Legacy trees show lineage
 * AC3: Trait inheritance preview
 * AC4: Mentorship period displayed
 * AC5: Bonus effectiveness for legacy grooms
 *
 * Equoria-gghoi (orchestrator decision under the owner's rulings, 2026-10-28): the
 * backend's LEGACY_PERKS is the only perk table; the frontend copy
 * (LEGACY_PERKS_BY_PERSONALITY, getAvailablePerksForPersonality, formatPerkEffect) is
 * deleted and the panel shows only the perks the game sends, by authored name and
 * description, never effect codes. Old contract: the panel looked perks up in its own
 * drifted table (methodical routineMastery/precisionTouch, playful/strict perks the game
 * never defines) and rendered effect keys as "+5% Bonding Bonus" chips.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GroomLegacyPanel from '../groom/GroomLegacyPanel';
import * as groomLegacyModule from '../../types/groomLegacy';
import {
  checkLegacyEligibility,
  LEGACY_CONSTANTS,
  type GroomLegacyData,
  type LegacyPerk,
  type MentorInfo,
  type ProtégéInfo,
} from '../../types/groomLegacy';

// ──────────────────────────────────────────────────────────────────────────────
// Helper function tests
// ──────────────────────────────────────────────────────────────────────────────

// Owner rulings 2026-10-28 (q229, q244; Equoria-2xxvd): grooms carry stars, not the old
// 1-10 level, the mentoring threshold is Advanced (the old 7), and the mentoring level is
// the old level 1 (staffCareerStarLevel) for every groom, so no groom is eligible for now.
// Old contract: a retired level-7+ groom was eligible; "Level N" showed in the lineage.
describe('groomLegacy helpers', () => {
  describe('checkLegacyEligibility', () => {
    const retiredLevel7Groom: GroomLegacyData = {
      id: 1,
      name: 'Senior Groom',
      starLevel: 'expert',
      retired: true,
      groomPersonality: 'calm',
      experience: 2000,
    };

    it('a retired Expert groom is not yet eligible: mentoring is not open (q244)', () => {
      const result = checkLegacyEligibility(retiredLevel7Groom, false);
      expect(result.isEligible).toBe(false);
      expect(result.reasons).toEqual(['Mentoring is not open yet']);
    });

    it('returns ineligible for active (not retired) groom', () => {
      const activeGroom = { ...retiredLevel7Groom, retired: false };
      const result = checkLegacyEligibility(activeGroom, false);
      expect(result.isEligible).toBe(false);
      expect(result.reasons).toContain('Must be retired to mentor a protégé');
    });

    it('returns ineligible for a Rookie groom, naming no level', () => {
      const lowLevelGroom = { ...retiredLevel7Groom, starLevel: 'rookie' };
      const result = checkLegacyEligibility(lowLevelGroom, false);
      expect(result.isEligible).toBe(false);
      expect(result.reasons).toContain('Mentoring is not open yet');
      expect(result.reasons.some((r) => /Level \d/.test(r))).toBe(false);
    });

    it('returns ineligible if already created a protégé', () => {
      const result = checkLegacyEligibility(retiredLevel7Groom, true);
      expect(result.isEligible).toBe(false);
      expect(result.reasons).toContain('Already mentored a protégé');
    });

    it('returns multiple reasons when multiple conditions fail', () => {
      const badGroom: GroomLegacyData = {
        ...retiredLevel7Groom,
        retired: false,
        starLevel: 'novice',
      };
      const result = checkLegacyEligibility(badGroom, false);
      expect(result.reasons.length).toBeGreaterThanOrEqual(2);
    });

    it('sets hasCreatedProtégé on the status', () => {
      const withProtege = checkLegacyEligibility(retiredLevel7Groom, true);
      expect(withProtege.hasCreatedProtégé).toBe(true);
      const withoutProtege = checkLegacyEligibility(retiredLevel7Groom, false);
      expect(withoutProtege.hasCreatedProtégé).toBe(false);
    });
  });

  describe('LEGACY_CONSTANTS', () => {
    it('minimum mentor level is Advanced (the old level 7)', () => {
      expect(LEGACY_CONSTANTS.MINIMUM_MENTOR_STAR_LEVEL).toBe('advanced');
    });

    it('has no protégé experience bonus (staff have no XP, owner 2026-10-21)', () => {
      expect(LEGACY_CONSTANTS).not.toHaveProperty('PROTEGE_EXPERIENCE_BONUS');
    });

    it('has no protégé level bonus (it went with the old level)', () => {
      expect(LEGACY_CONSTANTS).not.toHaveProperty('PROTEGE_LEVEL_BONUS');
    });

    it('skill bonus percent is 10', () => {
      expect(LEGACY_CONSTANTS.PROTEGE_SKILL_BONUS_PERCENT).toBe(10);
    });
  });

  describe('no frontend perk table (Equoria-gghoi)', () => {
    it('keeps no copy of the perks and no effect-code formatter', () => {
      expect(groomLegacyModule).not.toHaveProperty('LEGACY_PERKS_BY_PERSONALITY');
      expect(groomLegacyModule).not.toHaveProperty('getAvailablePerksForPersonality');
      expect(groomLegacyModule).not.toHaveProperty('formatPerkEffect');
    });
  });
});

// The perks exactly as the backend sends them (GET /api/v1/grooms/:id/legacy/eligibility
// availablePerks, from LEGACY_PERKS in groomLegacyService.mjs).
const backendCalmPerks: LegacyPerk[] = [
  { id: 'gentleHands', name: 'Gentle Hands', description: 'Inherited gentle touch technique' },
  {
    id: 'empathicSync',
    name: 'Empathic Sync',
    description: 'Natural ability to read horse emotions',
  },
  {
    id: 'patienceMastery',
    name: 'Patience Mastery',
    description: 'Exceptional patience with difficult horses',
  },
];

const backendMethodicalPerks: LegacyPerk[] = [
  {
    id: 'dataDriven',
    name: 'Data Driven',
    description: 'Systematic approach to trait development',
  },
  {
    id: 'memoryBuilder',
    name: 'Memory Builder',
    description: 'Exceptional at building horse-groom synergy',
  },
  {
    id: 'precisionTraining',
    name: 'Precision Training',
    description: 'Meticulous attention to training details',
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ──────────────────────────────────────────────────────────────────────────────

const activeGroom: GroomLegacyData = {
  id: 1,
  name: 'Aria Thompson',
  starLevel: 'intermediate',
  retired: false,
  groomPersonality: 'calm',
  experience: 1500,
};

const retiredSeniorGroom: GroomLegacyData = {
  id: 2,
  name: 'Marcus Reid',
  starLevel: 'expert',
  retired: true,
  groomPersonality: 'methodical',
  experience: 4000,
};

const sampleMentorInfo: MentorInfo = {
  mentorId: 10,
  mentorName: 'Eleanor Walsh',
  mentorStarLevel: 'advanced',
  mentorPersonality: 'calm',
  inheritedPerk: {
    id: 'gentleHands',
    name: 'Gentle Hands',
    description: 'Inherited gentle touch technique',
  },
  mentorshipDate: '2025-06-15T00:00:00.000Z',
};

const sampleProtégéInfo: ProtégéInfo = {
  protégéId: 20,
  protégéName: 'Jamie Chen',
  inheritedPerk: {
    id: 'precisionTraining',
    name: 'Precision Training',
    description: 'Meticulous attention to training details',
  },
  createdAt: '2026-01-10T00:00:00.000Z',
};

// ──────────────────────────────────────────────────────────────────────────────
// AC1: Skills and traits transfer displayed
// ──────────────────────────────────────────────────────────────────────────────

describe('AC1: Skills and traits transfer displayed', () => {
  it('renders the legacy panel', () => {
    render(<GroomLegacyPanel groom={activeGroom} />);
    expect(screen.getByTestId('groom-legacy-panel')).toBeInTheDocument();
    expect(screen.getByTestId('legacy-panel-title')).toHaveTextContent('Legacy & Mentorship');
  });

  it('shows inherited perk section when mentorInfo is provided', () => {
    render(<GroomLegacyPanel groom={activeGroom} mentorInfo={sampleMentorInfo} />);
    expect(screen.getByTestId('inherited-perk-section')).toBeInTheDocument();
  });

  it('shows inherited perk name', () => {
    render(<GroomLegacyPanel groom={activeGroom} mentorInfo={sampleMentorInfo} />);
    // Use within() because gentleHands also appears in trait-inheritance-preview
    const inheritedSection = screen.getByTestId('inherited-perk-section');
    expect(within(inheritedSection).getByTestId('perk-name-gentleHands')).toHaveTextContent(
      'Gentle Hands'
    );
  });

  it('shows perk description', () => {
    render(<GroomLegacyPanel groom={activeGroom} mentorInfo={sampleMentorInfo} />);
    const inheritedSection = screen.getByTestId('inherited-perk-section');
    expect(within(inheritedSection).getByTestId('perk-description-gentleHands')).toHaveTextContent(
      'Inherited gentle touch technique'
    );
  });

  it('shows no effect codes on a perk, only its authored name and description', () => {
    render(<GroomLegacyPanel groom={activeGroom} mentorInfo={sampleMentorInfo} />);
    const inheritedSection = screen.getByTestId('inherited-perk-section');
    expect(within(inheritedSection).queryByTestId('perk-effects-gentleHands')).toBeNull();
    expect(inheritedSection).not.toHaveTextContent(/Bonding Bonus|bondingBonus|%/);
  });

  it('shows inherited badge on the perk card', () => {
    render(<GroomLegacyPanel groom={activeGroom} mentorInfo={sampleMentorInfo} />);
    expect(screen.getByTestId('perk-inherited-badge-gentleHands')).toHaveTextContent('Inherited');
  });

  it('does NOT show inherited perk section without mentorInfo', () => {
    render(<GroomLegacyPanel groom={activeGroom} />);
    expect(screen.queryByTestId('inherited-perk-section')).not.toBeInTheDocument();
  });

  it('has accessible aria-label on the panel', () => {
    render(<GroomLegacyPanel groom={activeGroom} />);
    expect(screen.getByTestId('groom-legacy-panel')).toHaveAttribute(
      'aria-label',
      'Legacy information for Aria Thompson'
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC2: Legacy trees show lineage
// ──────────────────────────────────────────────────────────────────────────────

describe('AC2: Legacy trees show lineage', () => {
  it('renders the legacy tree section', () => {
    render(<GroomLegacyPanel groom={activeGroom} />);
    expect(screen.getByTestId('legacy-tree-section')).toBeInTheDocument();
    expect(screen.getByTestId('legacy-tree')).toBeInTheDocument();
  });

  it('shows current groom in the center of the tree', () => {
    render(<GroomLegacyPanel groom={activeGroom} />);
    expect(screen.getByTestId('legacy-tree-current')).toHaveTextContent('Aria Thompson');
  });

  it('shows "None" when no mentor exists', () => {
    render(<GroomLegacyPanel groom={activeGroom} />);
    expect(screen.getByTestId('legacy-tree-no-mentor')).toBeInTheDocument();
  });

  it('shows "None yet" when no protégé exists', () => {
    render(<GroomLegacyPanel groom={activeGroom} />);
    expect(screen.getByTestId('legacy-tree-no-protege')).toBeInTheDocument();
  });

  it('shows mentor in the tree when mentorInfo provided', () => {
    render(<GroomLegacyPanel groom={activeGroom} mentorInfo={sampleMentorInfo} />);
    expect(screen.getByTestId('legacy-tree-mentor')).toHaveTextContent('Eleanor Walsh');
  });

  it("shows the mentor's stars in the tree, never an old level", () => {
    render(<GroomLegacyPanel groom={activeGroom} mentorInfo={sampleMentorInfo} />);
    expect(screen.getByTestId('legacy-tree-mentor')).toHaveTextContent('Advanced');
    expect(screen.getByTestId('legacy-tree-mentor')).toHaveTextContent('★★★★');
    expect(screen.getByTestId('legacy-tree-current')).toHaveTextContent('Intermediate');
    expect(screen.queryByText(/Level \d/)).not.toBeInTheDocument();
  });

  it('shows protégé in the tree when protégéInfo provided', () => {
    render(
      <GroomLegacyPanel
        groom={retiredSeniorGroom}
        protégéInfo={sampleProtégéInfo}
        hasCreatedProtégé
      />
    );
    expect(screen.getByTestId('legacy-tree-protege')).toHaveTextContent('Jamie Chen');
  });

  it('shows full three-node tree: mentor → groom → protégé', () => {
    render(
      <GroomLegacyPanel
        groom={activeGroom}
        mentorInfo={sampleMentorInfo}
        protégéInfo={sampleProtégéInfo}
        hasCreatedProtégé
      />
    );
    expect(screen.getByTestId('legacy-tree-mentor')).toBeInTheDocument();
    expect(screen.getByTestId('legacy-tree-current')).toBeInTheDocument();
    expect(screen.getByTestId('legacy-tree-protege')).toBeInTheDocument();
  });

  it('shows Legacy Groom badge when groom has a mentor', () => {
    render(<GroomLegacyPanel groom={activeGroom} mentorInfo={sampleMentorInfo} />);
    expect(screen.getByTestId('legacy-groom-badge')).toHaveTextContent('Legacy Groom');
  });

  it('does NOT show Legacy Groom badge when groom has no mentor', () => {
    render(<GroomLegacyPanel groom={activeGroom} />);
    expect(screen.queryByTestId('legacy-groom-badge')).not.toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC3: Trait inheritance preview
// ──────────────────────────────────────────────────────────────────────────────

describe('AC3: Trait inheritance preview', () => {
  it('renders the transferable perks section', () => {
    render(<GroomLegacyPanel groom={activeGroom} availablePerks={backendCalmPerks} />);
    expect(screen.getByTestId('trait-inheritance-preview')).toBeInTheDocument();
  });

  it('shows no transferable perks when the game sent none (never a frontend copy)', () => {
    render(<GroomLegacyPanel groom={activeGroom} />);
    expect(screen.queryByTestId('trait-inheritance-preview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('perk-card-gentleHands')).not.toBeInTheDocument();
  });

  it('shows all 3 calm personality perks in preview', () => {
    render(<GroomLegacyPanel groom={activeGroom} availablePerks={backendCalmPerks} />);
    expect(screen.getByTestId('perk-card-gentleHands')).toBeInTheDocument();
    expect(screen.getByTestId('perk-card-empathicSync')).toBeInTheDocument();
    expect(screen.getByTestId('perk-card-patienceMastery')).toBeInTheDocument();
  });

  it('shows personality label in inheritance preview', () => {
    render(<GroomLegacyPanel groom={activeGroom} availablePerks={backendCalmPerks} />);
    expect(screen.getByTestId('perk-personality-label')).toHaveTextContent('calm personality');
  });

  it('shows exactly the methodical perks the game grants (Equoria-gghoi)', () => {
    render(<GroomLegacyPanel groom={retiredSeniorGroom} availablePerks={backendMethodicalPerks} />);
    expect(screen.getByTestId('perk-card-dataDriven')).toBeInTheDocument();
    expect(screen.getByTestId('perk-card-memoryBuilder')).toBeInTheDocument();
    expect(screen.getByTestId('perk-card-precisionTraining')).toBeInTheDocument();
    // The drifted frontend copy's perks, which the game never grants.
    expect(screen.queryByTestId('perk-card-routineMastery')).not.toBeInTheDocument();
    expect(screen.queryByTestId('perk-card-precisionTouch')).not.toBeInTheDocument();
  });

  it('hides transferable perks when groom has already created a protégé', () => {
    render(
      <GroomLegacyPanel
        groom={retiredSeniorGroom}
        availablePerks={backendMethodicalPerks}
        hasCreatedProtégé
      />
    );
    expect(screen.queryByTestId('trait-inheritance-preview')).not.toBeInTheDocument();
  });

  it('perks in preview are NOT marked as inherited', () => {
    render(<GroomLegacyPanel groom={activeGroom} availablePerks={backendCalmPerks} />);
    // gentleHands perk in preview should not have inherited badge
    expect(screen.queryByTestId('perk-inherited-badge-gentleHands')).not.toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC4: Mentorship period displayed
// ──────────────────────────────────────────────────────────────────────────────

describe('AC4: Mentorship period displayed', () => {
  it('shows mentorship date when mentorInfo provided', () => {
    render(<GroomLegacyPanel groom={activeGroom} mentorInfo={sampleMentorInfo} />);
    expect(screen.getByTestId('mentorship-date')).toBeInTheDocument();
  });

  it('mentorship date is human-readable', () => {
    render(<GroomLegacyPanel groom={activeGroom} mentorInfo={sampleMentorInfo} />);
    // Should be formatted as a date string, not raw ISO
    const dateEl = screen.getByTestId('mentorship-date');
    expect(dateEl.textContent).not.toContain('T00:00:00');
  });

  it('shows protégé section when protégéInfo provided', () => {
    render(
      <GroomLegacyPanel
        groom={retiredSeniorGroom}
        protégéInfo={sampleProtégéInfo}
        hasCreatedProtégé
      />
    );
    expect(screen.getByTestId('protege-section')).toBeInTheDocument();
  });

  it('shows protégé name in protégé section', () => {
    render(
      <GroomLegacyPanel
        groom={retiredSeniorGroom}
        protégéInfo={sampleProtégéInfo}
        hasCreatedProtégé
      />
    );
    expect(screen.getByTestId('protege-name')).toHaveTextContent('Jamie Chen');
  });

  it('shows protégé creation date', () => {
    render(
      <GroomLegacyPanel
        groom={retiredSeniorGroom}
        protégéInfo={sampleProtégéInfo}
        hasCreatedProtégé
      />
    );
    expect(screen.getByTestId('protege-created-date')).toBeInTheDocument();
  });

  it('shows inherited perk in protégé section', () => {
    render(
      <GroomLegacyPanel
        groom={retiredSeniorGroom}
        protégéInfo={sampleProtégéInfo}
        hasCreatedProtégé
      />
    );
    expect(screen.getByTestId('perk-card-precisionTraining')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC5: Bonus effectiveness for legacy grooms
// ──────────────────────────────────────────────────────────────────────────────

describe('AC5: Bonus effectiveness for legacy grooms', () => {
  it('shows legacy bonuses section for a protégé (has mentor)', () => {
    render(<GroomLegacyPanel groom={activeGroom} mentorInfo={sampleMentorInfo} />);
    expect(screen.getByTestId('legacy-bonuses-section')).toBeInTheDocument();
  });

  it('shows no starting-XP bonus (staff have no XP, owner 2026-10-21)', () => {
    render(<GroomLegacyPanel groom={activeGroom} mentorInfo={sampleMentorInfo} />);
    expect(screen.queryByTestId('bonus-experience')).not.toBeInTheDocument();
    expect(screen.getByTestId('legacy-bonuses-section')).not.toHaveTextContent(/XP/);
  });

  it('shows no level bonus (it went with the old level)', () => {
    render(<GroomLegacyPanel groom={activeGroom} mentorInfo={sampleMentorInfo} />);
    expect(screen.queryByTestId('bonus-level')).not.toBeInTheDocument();
  });

  it('shows skill bonus percent', () => {
    render(<GroomLegacyPanel groom={activeGroom} mentorInfo={sampleMentorInfo} />);
    expect(screen.getByTestId('bonus-skill')).toHaveTextContent('+10% skill effectiveness');
  });

  it('shows inherited perk bonus text', () => {
    render(<GroomLegacyPanel groom={activeGroom} mentorInfo={sampleMentorInfo} />);
    expect(screen.getByTestId('bonus-perk')).toHaveTextContent('1 inherited perk');
  });

  it('does NOT show legacy bonuses for non-protégé groom', () => {
    render(<GroomLegacyPanel groom={activeGroom} />);
    expect(screen.queryByTestId('legacy-bonuses-section')).not.toBeInTheDocument();
  });

  it('shows mentor eligibility section for retired grooms without protégé', () => {
    render(<GroomLegacyPanel groom={retiredSeniorGroom} />);
    expect(screen.getByTestId('mentor-eligibility-section')).toBeInTheDocument();
  });

  it('a retired Expert groom shows not yet eligible: mentoring is not open (q244)', () => {
    render(<GroomLegacyPanel groom={retiredSeniorGroom} />);
    expect(screen.getByTestId('ineligible-message')).toBeInTheDocument();
    expect(screen.queryByTestId('eligible-message')).not.toBeInTheDocument();
  });

  it('shows ineligible message for active (not retired) groom', () => {
    render(
      <GroomLegacyPanel groom={{ ...retiredSeniorGroom, retired: true, starLevel: 'novice' }} />
    );
    expect(screen.getByTestId('ineligible-message')).toBeInTheDocument();
  });

  it('shows the requirement text in mentor eligibility, naming no level', () => {
    render(<GroomLegacyPanel groom={retiredSeniorGroom} />);
    expect(screen.getByTestId('mentor-level-requirement')).toHaveTextContent(
      'Requires retired status'
    );
    expect(screen.getByTestId('mentor-level-requirement')).not.toHaveTextContent(/Level \d/);
  });

  it('does NOT show mentor eligibility section for active groom', () => {
    render(<GroomLegacyPanel groom={activeGroom} />);
    expect(screen.queryByTestId('mentor-eligibility-section')).not.toBeInTheDocument();
  });
});
