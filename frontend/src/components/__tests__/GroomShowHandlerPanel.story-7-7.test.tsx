/**
 * Story 7-7: Show Handling & Rare Traits
 *
 * Tests for:
 * - groomShowHandler.ts types/helpers (FR-G7)
 * - groomBonusTrait.ts types/helpers (FR-R1 through FR-R4)
 * - GroomShowHandlerPanel component (FR-G7)
 * - GroomBonusTraitPanel component (FR-R1 through FR-R4)
 *
 * AC1: Show handler scoring weights displayed
 * AC2: Discipline synergy shown
 * AC3: Bonus traits displayed (FR-R1/R2)
 * AC4: Eligibility requirements shown (FR-R3)
 * AC5: Total rare trait probability shown (FR-R4)
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import React from 'react';

// --- Type helpers ---
import {
  HANDLER_SKILL_BONUSES,
  PERSONALITY_DISCIPLINE_SYNERGY,
  SPECIALTY_DISCIPLINE_BONUSES,
  CONFORMATION_SHOW_WEIGHTS,
  getHandlerBonusRange,
  getPersonalitySynergyDisciplines,
  formatHandlerBonus,
  getSkillLevelLabel,
  getSpecialtyLabel,
  getSpecialtyBonusPercent,
  isShowHandlingSpecialty,
} from '../../types/groomShowHandler';

import {
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

// --- Components ---
import GroomShowHandlerPanel from '../groom/GroomShowHandlerPanel';
import GroomBonusTraitPanel from '../groom/GroomBonusTraitPanel';

// ─── Helper fixtures ─────────────────────────────────────────────────────────

const noviceGroom = {
  id: 1,
  name: 'Anna Stablehand',
  skillLevel: 'novice' as const,
  speciality: 'showHandling' as const,
  personality: 'calm' as const,
  experience: 10,
};

const masterGroom = {
  id: 2,
  name: 'Victor Champion',
  skillLevel: 'master' as const,
  speciality: 'racing' as const,
  personality: 'energetic' as const,
  experience: 500,
};

const generalGroom = {
  id: 3,
  name: 'Pat General',
  skillLevel: 'intermediate' as const,
  speciality: 'general' as const,
  personality: 'patient' as const,
  experience: 50,
};

const groomWithTraits = {
  id: 10,
  name: 'Martha Trait',
  bonusTraitMap: {
    'Rare Spirit': 0.25,
    'Iron Will': 0.15,
  },
};

const groomNoTraits = {
  id: 11,
  name: 'Empty Groom',
  bonusTraitMap: null,
};

const groomMaxTraits = {
  id: 12,
  name: 'Full Groom',
  bonusTraitMap: {
    'Rare Spirit': 0.3,
    'Iron Will': 0.2,
    'Storm Runner': 0.1,
  },
};

const eligibleEligibility = {
  eligible: true,
  averageBondScore: 75,
  coveragePercentage: 0.9,
  reason: 'Eligible for bonus',
};

const ineligibleEligibility = {
  eligible: false,
  averageBondScore: 45,
  coveragePercentage: 0.6,
  reason: 'Bond score too low',
};

// ─── groomShowHandler.ts helper tests ────────────────────────────────────────

describe('groomShowHandler types & helpers', () => {
  describe('HANDLER_SKILL_BONUSES constants', () => {
    it('has novice base 5% and max 10%', () => {
      expect(HANDLER_SKILL_BONUSES.novice.baseBonus).toBe(0.05);
      expect(HANDLER_SKILL_BONUSES.novice.maxBonus).toBe(0.1);
    });

    it('has intermediate base 8% and max 15%', () => {
      expect(HANDLER_SKILL_BONUSES.intermediate.baseBonus).toBe(0.08);
      expect(HANDLER_SKILL_BONUSES.intermediate.maxBonus).toBe(0.15);
    });

    it('has expert base 12% and max 20%', () => {
      expect(HANDLER_SKILL_BONUSES.expert.baseBonus).toBe(0.12);
      expect(HANDLER_SKILL_BONUSES.expert.maxBonus).toBe(0.2);
    });

    it('has master base 15% and max 25%', () => {
      expect(HANDLER_SKILL_BONUSES.master.baseBonus).toBe(0.15);
      expect(HANDLER_SKILL_BONUSES.master.maxBonus).toBe(0.25);
    });
  });

  describe('CONFORMATION_SHOW_WEIGHTS', () => {
    it('has conformation at 65%', () => {
      expect(CONFORMATION_SHOW_WEIGHTS.conformationWeight).toBe(0.65);
    });

    it('has handler weight at 20%', () => {
      expect(CONFORMATION_SHOW_WEIGHTS.handlerWeight).toBe(0.2);
    });

    it('has bond weight at 8%', () => {
      expect(CONFORMATION_SHOW_WEIGHTS.bondWeight).toBe(0.08);
    });

    it('has temperament weight at 7%', () => {
      expect(CONFORMATION_SHOW_WEIGHTS.temperamentWeight).toBe(0.07);
    });

    it('weights sum to 1.0', () => {
      const total =
        CONFORMATION_SHOW_WEIGHTS.conformationWeight +
        CONFORMATION_SHOW_WEIGHTS.handlerWeight +
        CONFORMATION_SHOW_WEIGHTS.bondWeight +
        CONFORMATION_SHOW_WEIGHTS.temperamentWeight;
      expect(total).toBeCloseTo(1.0);
    });
  });

  describe('PERSONALITY_DISCIPLINE_SYNERGY', () => {
    it('gentle synergizes with Dressage', () => {
      expect(PERSONALITY_DISCIPLINE_SYNERGY.gentle.beneficial).toContain('Dressage');
    });

    it('energetic synergizes with Racing', () => {
      expect(PERSONALITY_DISCIPLINE_SYNERGY.energetic.beneficial).toContain('Racing');
    });

    it('calm synergizes with Dressage', () => {
      expect(PERSONALITY_DISCIPLINE_SYNERGY.calm.beneficial).toContain('Dressage');
    });

    it('strict has highest synergy bonus (4.5%)', () => {
      expect(PERSONALITY_DISCIPLINE_SYNERGY.strict.bonus).toBe(0.045);
    });
  });

  describe('SPECIALTY_DISCIPLINE_BONUSES', () => {
    it('showHandling gives 6% bonus', () => {
      expect(SPECIALTY_DISCIPLINE_BONUSES.showHandling.bonus).toBe(0.06);
    });

    it('racing gives 7% bonus', () => {
      expect(SPECIALTY_DISCIPLINE_BONUSES.racing.bonus).toBe(0.07);
    });

    it('general gives 1% bonus', () => {
      expect(SPECIALTY_DISCIPLINE_BONUSES.general.bonus).toBe(0.01);
    });

    it('showHandling includes Dressage', () => {
      expect(SPECIALTY_DISCIPLINE_BONUSES.showHandling.disciplines).toContain('Dressage');
    });
  });

  describe('getHandlerBonusRange()', () => {
    it('returns "5% – 10%" for novice', () => {
      expect(getHandlerBonusRange('novice')).toBe('5% – 10%');
    });

    it('returns "8% – 15%" for intermediate', () => {
      expect(getHandlerBonusRange('intermediate')).toBe('8% – 15%');
    });

    it('returns "12% – 20%" for expert', () => {
      expect(getHandlerBonusRange('expert')).toBe('12% – 20%');
    });

    it('returns "15% – 25%" for master', () => {
      expect(getHandlerBonusRange('master')).toBe('15% – 25%');
    });
  });

  describe('getPersonalitySynergyDisciplines()', () => {
    it('returns Dressage for calm', () => {
      const disciplines = getPersonalitySynergyDisciplines('calm');
      expect(disciplines).toContain('Dressage');
    });

    it('returns Racing for energetic', () => {
      const disciplines = getPersonalitySynergyDisciplines('energetic');
      expect(disciplines).toContain('Racing');
    });

    it('returns non-empty array for patient', () => {
      expect(getPersonalitySynergyDisciplines('patient').length).toBeGreaterThan(0);
    });
  });

  describe('formatHandlerBonus()', () => {
    it('formats 0.06 as "+6%"', () => {
      expect(formatHandlerBonus(0.06)).toBe('+6%');
    });

    it('formats 0.03 as "+3%"', () => {
      expect(formatHandlerBonus(0.03)).toBe('+3%');
    });

    it('formats 0 as "+0%"', () => {
      expect(formatHandlerBonus(0)).toBe('+0%');
    });
  });

  describe('getSkillLevelLabel()', () => {
    it('returns "Novice" for novice', () => {
      expect(getSkillLevelLabel('novice')).toBe('Novice');
    });

    it('returns "Master" for master', () => {
      expect(getSkillLevelLabel('master')).toBe('Master');
    });
  });

  describe('getSpecialtyLabel()', () => {
    it('returns "Show Handling" for showHandling', () => {
      expect(getSpecialtyLabel('showHandling')).toBe('Show Handling');
    });

    it('returns "General" for general', () => {
      expect(getSpecialtyLabel('general')).toBe('General');
    });
  });

  describe('getSpecialtyBonusPercent()', () => {
    it('returns 6 for showHandling', () => {
      expect(getSpecialtyBonusPercent('showHandling')).toBe(6);
    });

    it('returns 1 for general', () => {
      expect(getSpecialtyBonusPercent('general')).toBe(1);
    });
  });

  describe('isShowHandlingSpecialty()', () => {
    it('returns true for showHandling', () => {
      expect(isShowHandlingSpecialty('showHandling')).toBe(true);
    });

    it('returns false for racing', () => {
      expect(isShowHandlingSpecialty('racing')).toBe(false);
    });

    it('returns false for general', () => {
      expect(isShowHandlingSpecialty('general')).toBe(false);
    });
  });
});

// ─── groomBonusTrait.ts helper tests ─────────────────────────────────────────

describe('groomBonusTrait types & helpers', () => {
  describe('BONUS_TRAIT_CONSTANTS', () => {
    it('max 3 bonus traits', () => {
      expect(BONUS_TRAIT_CONSTANTS.MAX_BONUS_TRAITS).toBe(3);
    });

    it('max 30% per trait', () => {
      expect(BONUS_TRAIT_CONSTANTS.MAX_TRAIT_BONUS_DECIMAL).toBe(0.3);
    });

    it('minimum bond score 60', () => {
      expect(BONUS_TRAIT_CONSTANTS.MIN_BOND_SCORE).toBe(60);
    });

    it('minimum coverage 75%', () => {
      expect(BONUS_TRAIT_CONSTANTS.MIN_COVERAGE_PERCENTAGE).toBe(0.75);
    });
  });

  describe('getBonusTraitEntries()', () => {
    it('returns entries for a trait map', () => {
      const entries = getBonusTraitEntries({ 'Rare Spirit': 0.25 });
      expect(entries).toHaveLength(1);
      expect(entries[0].traitName).toBe('Rare Spirit');
      expect(entries[0].bonusDecimal).toBe(0.25);
      expect(entries[0].bonusPercent).toBe(25);
    });

    it('returns empty array for null', () => {
      expect(getBonusTraitEntries(null)).toEqual([]);
    });

    it('returns all entries when multiple traits', () => {
      const entries = getBonusTraitEntries({ A: 0.1, B: 0.2 });
      expect(entries).toHaveLength(2);
    });
  });

  describe('countBonusTraits()', () => {
    it('counts 2 traits correctly', () => {
      expect(countBonusTraits({ A: 0.1, B: 0.2 })).toBe(2);
    });

    it('returns 0 for null', () => {
      expect(countBonusTraits(null)).toBe(0);
    });

    it('counts 3 traits correctly', () => {
      expect(countBonusTraits({ A: 0.1, B: 0.2, C: 0.3 })).toBe(3);
    });
  });

  describe('getTotalBonusPercent()', () => {
    it('returns 40 for 0.25 + 0.15', () => {
      expect(getTotalBonusPercent({ A: 0.25, B: 0.15 })).toBe(40);
    });

    it('returns 0 for null', () => {
      expect(getTotalBonusPercent(null)).toBe(0);
    });

    it('returns 60 for max 3 × 20%', () => {
      expect(getTotalBonusPercent({ A: 0.2, B: 0.2, C: 0.2 })).toBe(60);
    });
  });

  describe('formatBonusPercent()', () => {
    it('formats 0.25 as "+25%"', () => {
      expect(formatBonusPercent(0.25)).toBe('+25%');
    });

    it('formats 0.3 as "+30%"', () => {
      expect(formatBonusPercent(0.3)).toBe('+30%');
    });
  });

  describe('meetsBondRequirement()', () => {
    it('returns true for score 75', () => {
      expect(meetsBondRequirement(75)).toBe(true);
    });

    it('returns true for score exactly 60', () => {
      expect(meetsBondRequirement(60)).toBe(true);
    });

    it('returns false for score 59', () => {
      expect(meetsBondRequirement(59)).toBe(false);
    });
  });

  describe('meetsCoverageRequirement()', () => {
    it('returns true for 0.9 coverage', () => {
      expect(meetsCoverageRequirement(0.9)).toBe(true);
    });

    it('returns true for exactly 0.75', () => {
      expect(meetsCoverageRequirement(0.75)).toBe(true);
    });

    it('returns false for 0.74', () => {
      expect(meetsCoverageRequirement(0.74)).toBe(false);
    });
  });

  describe('getRemainingSlots()', () => {
    it('returns 3 for null map', () => {
      expect(getRemainingSlots(null)).toBe(3);
    });

    it('returns 1 for 2 traits assigned', () => {
      expect(getRemainingSlots({ A: 0.1, B: 0.2 })).toBe(1);
    });

    it('returns 0 for full map (3 traits)', () => {
      expect(getRemainingSlots({ A: 0.1, B: 0.2, C: 0.3 })).toBe(0);
    });
  });

  describe('formatCoverage()', () => {
    it('formats 0.85 as "85%"', () => {
      expect(formatCoverage(0.85)).toBe('85%');
    });

    it('formats 0.75 as "75%"', () => {
      expect(formatCoverage(0.75)).toBe('75%');
    });
  });
});

// ─── GroomShowHandlerPanel component tests ────────────────────────────────────

describe('GroomShowHandlerPanel — AC1: Scoring weights', () => {
  it('renders the panel', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    expect(screen.getByTestId('groom-show-handler-panel')).toBeInTheDocument();
  });

  it('shows "Show Handler" title', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    expect(screen.getByTestId('handler-panel-title')).toHaveTextContent('Show Handler');
  });

  it('shows skill level badge', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    expect(screen.getByTestId('handler-skill-badge')).toHaveTextContent('Novice');
  });

  it('shows "Master" badge for master groom', () => {
    render(<GroomShowHandlerPanel groom={masterGroom} />);
    expect(screen.getByTestId('handler-skill-badge')).toHaveTextContent('Master');
  });

  it('shows handler bonus range for novice (5%–10%)', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    expect(screen.getByTestId('handler-bonus-range')).toHaveTextContent('5% – 10%');
  });

  it('shows handler bonus range for master (15%–25%)', () => {
    render(<GroomShowHandlerPanel groom={masterGroom} />);
    expect(screen.getByTestId('handler-bonus-range')).toHaveTextContent('15% – 25%');
  });

  it('shows scoring breakdown section', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    expect(screen.getByTestId('scoring-breakdown-section')).toBeInTheDocument();
  });

  it('shows conformation weight as 65%', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    const row = screen.getByTestId('score-weight-conformation');
    expect(row).toHaveTextContent('65%');
    expect(row).toHaveTextContent('Horse Conformation');
  });

  it('shows handler weight as 20%', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    const row = screen.getByTestId('score-weight-handler');
    expect(row).toHaveTextContent('20%');
    expect(row).toHaveTextContent('Handler Skill');
  });

  it('shows bond weight as 8%', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    const row = screen.getByTestId('score-weight-bond');
    expect(row).toHaveTextContent('8%');
    expect(row).toHaveTextContent('Bond Score');
  });

  it('shows temperament weight as 7%', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    const row = screen.getByTestId('score-weight-temperament');
    expect(row).toHaveTextContent('7%');
    expect(row).toHaveTextContent('Temperament Synergy');
  });

  it('has aria-label with groom name', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    expect(screen.getByTestId('groom-show-handler-panel')).toHaveAttribute(
      'aria-label',
      'Show handler panel for Anna Stablehand'
    );
  });
});

describe('GroomShowHandlerPanel — AC2: Discipline synergy', () => {
  it('shows personality synergy section', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    expect(screen.getByTestId('personality-synergy-section')).toBeInTheDocument();
  });

  it('shows synergy bonus for calm (+3%)', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    expect(screen.getByTestId('personality-synergy-bonus')).toHaveTextContent('+3%');
  });

  it('shows synergy bonus for energetic (+4%)', () => {
    render(<GroomShowHandlerPanel groom={masterGroom} />);
    expect(screen.getByTestId('personality-synergy-bonus')).toHaveTextContent('+4%');
  });

  it('shows synergy disciplines list for calm (includes Dressage)', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    const list = screen.getByTestId('synergy-disciplines-list');
    expect(within(list).getByText('Dressage')).toBeInTheDocument();
  });

  it('shows synergy disciplines for energetic (includes Racing)', () => {
    render(<GroomShowHandlerPanel groom={masterGroom} />);
    const list = screen.getByTestId('synergy-disciplines-list');
    expect(within(list).getByText('Racing')).toBeInTheDocument();
  });

  it('shows specialty section', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    expect(screen.getByTestId('specialty-section')).toBeInTheDocument();
  });

  it('shows specialty label for showHandling', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    expect(screen.getByTestId('specialty-label')).toHaveTextContent('Show Handling');
  });

  it('shows specialty bonus value for showHandling (+6%)', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    expect(screen.getByTestId('specialty-bonus-value')).toHaveTextContent('+6%');
  });

  it('shows "Conformation specialist" badge for showHandling specialty', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    expect(screen.getByTestId('show-handling-badge')).toBeInTheDocument();
  });

  it('does NOT show "Conformation specialist" badge for racing specialty', () => {
    render(<GroomShowHandlerPanel groom={masterGroom} />);
    expect(screen.queryByTestId('show-handling-badge')).not.toBeInTheDocument();
  });

  it('shows show specialty highlight for showHandling', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    expect(screen.getByTestId('show-specialty-highlight')).toBeInTheDocument();
  });

  it('does NOT show show specialty highlight for non-showHandling', () => {
    render(<GroomShowHandlerPanel groom={masterGroom} />);
    expect(screen.queryByTestId('show-specialty-highlight')).not.toBeInTheDocument();
  });

  it('shows specialty disciplines for showHandling', () => {
    render(<GroomShowHandlerPanel groom={noviceGroom} />);
    const list = screen.getByTestId('specialty-disciplines-list');
    expect(within(list).getByText('Dressage')).toBeInTheDocument();
  });

  it('shows "No specific discipline bonus" for general specialty', () => {
    render(<GroomShowHandlerPanel groom={generalGroom} />);
    expect(screen.getByTestId('no-specialty-disciplines')).toBeInTheDocument();
  });
});

// ─── GroomBonusTraitPanel component tests ─────────────────────────────────────

describe('GroomBonusTraitPanel — AC3: Bonus traits (FR-R1/R2)', () => {
  it('renders the panel', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    expect(screen.getByTestId('groom-bonus-trait-panel')).toBeInTheDocument();
  });

  it('shows "Rare Trait Bonuses" title', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    expect(screen.getByTestId('bonus-trait-panel-title')).toHaveTextContent('Rare Trait Bonuses');
  });

  it('shows trait count badge (2 / 3 traits)', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    expect(screen.getByTestId('bonus-trait-count-badge')).toHaveTextContent('2 / 3 traits');
  });

  it('shows 0 / 3 when no traits', () => {
    render(<GroomBonusTraitPanel groom={groomNoTraits} />);
    expect(screen.getByTestId('bonus-trait-count-badge')).toHaveTextContent('0 / 3 traits');
  });

  it('shows "3 / 3 traits" when max traits', () => {
    render(<GroomBonusTraitPanel groom={groomMaxTraits} />);
    expect(screen.getByTestId('bonus-trait-count-badge')).toHaveTextContent('3 / 3 traits');
  });

  it('shows bonus trait row for "Rare Spirit"', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    expect(screen.getByTestId('bonus-trait-row-rare-spirit')).toBeInTheDocument();
  });

  it('shows trait name "Rare Spirit"', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    expect(screen.getByTestId('bonus-trait-name-rare-spirit')).toHaveTextContent('Rare Spirit');
  });

  it('shows trait percent "+25%" for Rare Spirit (0.25)', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    expect(screen.getByTestId('bonus-trait-percent-rare-spirit')).toHaveTextContent('+25%');
  });

  it('shows trait name "Iron Will"', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    expect(screen.getByTestId('bonus-trait-name-iron-will')).toHaveTextContent('Iron Will');
  });

  it('shows trait percent "+15%" for Iron Will (0.15)', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    expect(screen.getByTestId('bonus-trait-percent-iron-will')).toHaveTextContent('+15%');
  });

  it('shows sparkle icon per bonus trait', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    expect(screen.getByTestId('bonus-trait-icon-rare-spirit')).toBeInTheDocument();
  });

  it('shows "No bonus traits assigned" when map is null', () => {
    render(<GroomBonusTraitPanel groom={groomNoTraits} />);
    expect(screen.getByTestId('no-bonus-traits-message')).toBeInTheDocument();
  });

  it('shows empty slots for remaining capacity', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    // 2 traits assigned → 1 empty slot
    expect(screen.getByTestId('bonus-trait-empty-slot-3')).toBeInTheDocument();
  });

  it('shows 3 empty slots when no traits assigned', () => {
    render(<GroomBonusTraitPanel groom={groomNoTraits} />);
    expect(screen.getByTestId('bonus-trait-empty-slot-1')).toBeInTheDocument();
    expect(screen.getByTestId('bonus-trait-empty-slot-2')).toBeInTheDocument();
    expect(screen.getByTestId('bonus-trait-empty-slot-3')).toBeInTheDocument();
  });

  it('shows no empty slots when 3 traits assigned', () => {
    render(<GroomBonusTraitPanel groom={groomMaxTraits} />);
    expect(screen.queryByTestId('bonus-trait-empty-slot-1')).not.toBeInTheDocument();
  });

  it('has aria-label with groom name', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    expect(screen.getByTestId('groom-bonus-trait-panel')).toHaveAttribute(
      'aria-label',
      'Bonus traits for Martha Trait'
    );
  });
});

describe('GroomBonusTraitPanel — AC4: Eligibility (FR-R3)', () => {
  it('does not show eligibility section when not provided', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    expect(screen.queryByTestId('bonus-eligibility-section')).not.toBeInTheDocument();
  });

  it('shows eligibility section when provided', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} eligibility={eligibleEligibility} />);
    expect(screen.getByTestId('bonus-eligibility-section')).toBeInTheDocument();
  });

  it('shows "Eligible for bonus" status when eligible', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} eligibility={eligibleEligibility} />);
    expect(screen.getByTestId('eligibility-status-text')).toHaveTextContent('Eligible for bonus');
  });

  it('shows ineligibility reason when not eligible', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} eligibility={ineligibleEligibility} />);
    expect(screen.getByTestId('eligibility-status-text')).toHaveTextContent('Bond score too low');
  });

  it('shows bond score with threshold', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} eligibility={eligibleEligibility} />);
    const row = screen.getByTestId('eligibility-bond');
    expect(row).toHaveTextContent('75');
    expect(row).toHaveTextContent('60');
  });

  it('shows coverage with threshold', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} eligibility={eligibleEligibility} />);
    const row = screen.getByTestId('eligibility-coverage');
    expect(row).toHaveTextContent('90%');
    expect(row).toHaveTextContent('75%');
  });

  it('shows pass icon when bond score meets threshold', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} eligibility={eligibleEligibility} />);
    expect(screen.getByTestId('eligibility-bond-pass-icon')).toBeInTheDocument();
  });

  it('shows fail icon when bond score is too low', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} eligibility={ineligibleEligibility} />);
    expect(screen.getByTestId('eligibility-bond-fail-icon')).toBeInTheDocument();
  });

  it('shows fail icon for coverage when below threshold', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} eligibility={ineligibleEligibility} />);
    expect(screen.getByTestId('eligibility-coverage-fail-icon')).toBeInTheDocument();
  });

  it('shows pass icon for coverage when meets threshold', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} eligibility={eligibleEligibility} />);
    expect(screen.getByTestId('eligibility-coverage-pass-icon')).toBeInTheDocument();
  });
});

describe('GroomBonusTraitPanel — AC5: Total probability (FR-R4)', () => {
  it('shows total bonus probability section', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    expect(screen.getByTestId('total-bonus-probability')).toBeInTheDocument();
  });

  it('shows "+40%" total for 25%+15% traits', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    expect(screen.getByTestId('total-bonus-probability')).toHaveTextContent('+40%');
  });

  it('shows "0%" when no traits assigned', () => {
    render(<GroomBonusTraitPanel groom={groomNoTraits} />);
    expect(screen.getByTestId('total-bonus-probability')).toHaveTextContent('0%');
  });

  it('shows "+60%" total for 3 × 20% traits', () => {
    const groom = {
      id: 99,
      name: 'Test',
      bonusTraitMap: { A: 0.2, B: 0.2, C: 0.2 },
    };
    render(<GroomBonusTraitPanel groom={groom} />);
    expect(screen.getByTestId('total-bonus-probability')).toHaveTextContent('+60%');
  });

  it('shows educational note about randomized traits', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    const note = screen.getByTestId('bonus-trait-note');
    expect(note).toHaveTextContent('randomized rare traits');
  });

  it('shows bonus traits list section', () => {
    render(<GroomBonusTraitPanel groom={groomWithTraits} />);
    expect(screen.getByTestId('bonus-traits-list')).toBeInTheDocument();
  });
});
