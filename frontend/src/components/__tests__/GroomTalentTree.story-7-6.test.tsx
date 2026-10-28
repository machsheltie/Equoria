/**
 * GroomTalentTree Tests — Story 7-6: Talent Tree Visualization
 *
 * Tests for the talent tree UI component that shows groom talents
 * across 3 tiers with locked/available/selected states.
 *
 * Owner ruling 2026-10-28 (q229, Equoria-2xxvd): the old 1-10 level is replaced by the
 * star level; the tiers open at the equivalent stars (old 3 = Novice, 5 = Intermediate,
 * 8 = Advanced) and no "Level N" is shown. Old contract: fixtures at levels 1/3/5/8/10
 * and "Level N+ required"; the same fixtures are now Rookie/Novice/Intermediate/
 * Advanced/Expert. (Which level the page passes in is pinned by q244, see
 * GroomDetailPanel.)
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GroomTalentTree from '../groom/GroomTalentTree';
import {
  getTalentTiersWithState,
  formatTalentEffect,
  countAllocatedTalents,
  TALENT_REQUIREMENTS,
  TALENT_TREES,
  GroomTalentData,
} from '../../types/groomTalent';

// --- Sample fixtures ---

const baseGroom: GroomTalentData = {
  id: 1,
  name: 'Oliver',
  starLevel: 'rookie',
  groomPersonality: 'calm',
  talentSelections: null,
};

const level3Groom: GroomTalentData = { ...baseGroom, starLevel: 'novice' };
const level5Groom: GroomTalentData = { ...baseGroom, starLevel: 'intermediate' };
const level8Groom: GroomTalentData = { ...baseGroom, starLevel: 'advanced' };

const withTier1Selected: GroomTalentData = {
  ...level5Groom,
  talentSelections: { tier1: 'gentleHands' },
};

const withAllSelected: GroomTalentData = {
  ...level8Groom,
  talentSelections: {
    tier1: 'gentleHands',
    tier2: 'empathicSync',
    tier3: 'masterBonding',
  },
};

// ============================================================
// Helper function unit tests
// ============================================================

describe('TALENT_REQUIREMENTS constants', () => {
  it('tier1 requires Novice (old level 3)', () => {
    expect(TALENT_REQUIREMENTS.tier1.minStarLevel).toBe('novice');
  });

  it('tier2 requires Intermediate (old level 5)', () => {
    expect(TALENT_REQUIREMENTS.tier2.minStarLevel).toBe('intermediate');
  });

  it('tier3 requires Advanced (old level 8)', () => {
    expect(TALENT_REQUIREMENTS.tier3.minStarLevel).toBe('advanced');
  });

  it('tier2 prerequisite is tier1', () => {
    expect(TALENT_REQUIREMENTS.tier2.prerequisite).toBe('tier1');
  });

  it('tier3 prerequisite is tier2', () => {
    expect(TALENT_REQUIREMENTS.tier3.prerequisite).toBe('tier2');
  });
});

describe('TALENT_TREES data', () => {
  it('calm personality has 3 tiers', () => {
    expect(TALENT_TREES.calm.tier1).toBeDefined();
    expect(TALENT_TREES.calm.tier2).toBeDefined();
    expect(TALENT_TREES.calm.tier3).toBeDefined();
  });

  it('calm tier1 has 2 talents', () => {
    expect(TALENT_TREES.calm.tier1).toHaveLength(2);
  });

  it('calm tier2 has 1 talent', () => {
    expect(TALENT_TREES.calm.tier2).toHaveLength(1);
  });

  it('calm tier3 has 1 talent', () => {
    expect(TALENT_TREES.calm.tier3).toHaveLength(1);
  });

  it('energetic personality exists', () => {
    expect(TALENT_TREES.energetic).toBeDefined();
  });

  it('methodical personality exists', () => {
    expect(TALENT_TREES.methodical).toBeDefined();
  });
});

describe('formatTalentEffect', () => {
  it('formats a positive bonus', () => {
    expect(formatTalentEffect('bondingBonus', 0.05)).toBe('+5% Bonding Bonus');
  });

  it('formats a large bonus', () => {
    expect(formatTalentEffect('milestoneAccuracy', 0.2)).toBe('+20% Milestone Accuracy');
  });

  it('formats multiple-word keys', () => {
    expect(formatTalentEffect('milestoneAccuracy', 0.1)).toBe('+10% Milestone Accuracy');
  });

  it('formats reactiveHorseBonus correctly', () => {
    expect(formatTalentEffect('reactiveHorseBonus', 0.15)).toBe('+15% Reactive Horse Bonus');
  });
});

describe('countAllocatedTalents', () => {
  it('returns 0 when no selections', () => {
    expect(countAllocatedTalents(null)).toBe(0);
  });

  it('returns 1 with only tier1', () => {
    expect(countAllocatedTalents({ tier1: 'gentleHands' })).toBe(1);
  });

  it('returns 2 with tier1 and tier2', () => {
    expect(countAllocatedTalents({ tier1: 'gentleHands', tier2: 'empathicSync' })).toBe(2);
  });

  it('returns 3 with all tiers', () => {
    expect(
      countAllocatedTalents({
        tier1: 'gentleHands',
        tier2: 'empathicSync',
        tier3: 'masterBonding',
      })
    ).toBe(3);
  });

  it('returns 0 for empty object', () => {
    expect(countAllocatedTalents({})).toBe(0);
  });
});

describe('getTalentTiersWithState', () => {
  it('returns empty array for unknown personality', () => {
    const tiers = getTalentTiersWithState('unknownPersonality', 'expert', null);
    expect(tiers).toHaveLength(0);
  });

  it('returns 3 tiers for calm personality', () => {
    const tiers = getTalentTiersWithState('calm', 'expert', null);
    expect(tiers).toHaveLength(3);
  });

  it('all tiers locked below Novice', () => {
    const tiers = getTalentTiersWithState('calm', 'rookie', null);
    expect(tiers[0].isUnlocked).toBe(false);
    expect(tiers[1].isUnlocked).toBe(false);
    expect(tiers[2].isUnlocked).toBe(false);
  });

  it('tier1 unlocked at Novice', () => {
    const tiers = getTalentTiersWithState('calm', 'novice', null);
    expect(tiers[0].isUnlocked).toBe(true);
    expect(tiers[1].isUnlocked).toBe(false);
  });

  it('tier2 unlocked at Intermediate', () => {
    const tiers = getTalentTiersWithState('calm', 'intermediate', null);
    expect(tiers[1].isUnlocked).toBe(true);
  });

  it('tier3 unlocked at Advanced', () => {
    const tiers = getTalentTiersWithState('calm', 'advanced', null);
    expect(tiers[2].isUnlocked).toBe(true);
  });

  it('talents in locked tier are locked', () => {
    const tiers = getTalentTiersWithState('calm', 'rookie', null);
    tiers[0].talents.forEach((t) => expect(t.isLocked).toBe(true));
  });

  it('tier1 talents available when unlocked with no selection', () => {
    const tiers = getTalentTiersWithState('calm', 'novice', null);
    tiers[0].talents.forEach((t) => {
      expect(t.isAvailable).toBe(true);
      expect(t.isLocked).toBe(false);
    });
  });

  it('tier2 talents locked when tier1 not selected yet', () => {
    const tiers = getTalentTiersWithState('calm', 'intermediate', null);
    expect(tiers[1].prerequisiteMet).toBe(false);
    tiers[1].talents.forEach((t) => expect(t.isLocked).toBe(true));
  });

  it('tier2 available after tier1 selected', () => {
    const tiers = getTalentTiersWithState('calm', 'intermediate', { tier1: 'gentleHands' });
    expect(tiers[1].prerequisiteMet).toBe(true);
    tiers[1].talents.forEach((t) => expect(t.isLocked).toBe(false));
  });

  it('selected talent has isSelected=true', () => {
    const tiers = getTalentTiersWithState('calm', 'novice', { tier1: 'gentleHands' });
    const gentleHands = tiers[0].talents.find((t) => t.id === 'gentleHands')!;
    expect(gentleHands.isSelected).toBe(true);
  });

  it('non-selected talent in same tier has isSelected=false', () => {
    const tiers = getTalentTiersWithState('calm', 'novice', { tier1: 'gentleHands' });
    const patienceVirtue = tiers[0].talents.find((t) => t.id === 'patienceVirtue')!;
    expect(patienceVirtue.isSelected).toBe(false);
  });

  it('talents unavailable when tier already has selection', () => {
    const tiers = getTalentTiersWithState('calm', 'novice', { tier1: 'gentleHands' });
    // patienceVirtue should not be available (already selected in this tier)
    const patienceVirtue = tiers[0].talents.find((t) => t.id === 'patienceVirtue')!;
    expect(patienceVirtue.isAvailable).toBe(false);
  });

  it('selectedTalentId reflects current selection', () => {
    const tiers = getTalentTiersWithState('calm', 'intermediate', { tier1: 'gentleHands' });
    expect(tiers[0].selectedTalentId).toBe('gentleHands');
    expect(tiers[1].selectedTalentId).toBeNull();
  });
});

// ============================================================
// AC1: All 3 tiers of talents displayed
// ============================================================

describe('AC1: All tiers and talents displayed', () => {
  it('renders the talent tree panel', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('groom-talent-tree')).toBeInTheDocument();
  });

  it('shows panel title "Talent Tree"', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('talent-tree-title')).toHaveTextContent('Talent Tree');
  });

  it('renders tier1 section', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('tier-section-tier1')).toBeInTheDocument();
  });

  it('renders tier2 section', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('tier-section-tier2')).toBeInTheDocument();
  });

  it('renders tier3 section', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('tier-section-tier3')).toBeInTheDocument();
  });

  it('shows all calm tier1 talents', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('talent-card-gentleHands')).toBeInTheDocument();
    expect(screen.getByTestId('talent-card-patienceVirtue')).toBeInTheDocument();
  });

  it('shows all calm tier2 talents', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('talent-card-empathicSync')).toBeInTheDocument();
  });

  it('shows tier3 talent', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('talent-card-masterBonding')).toBeInTheDocument();
  });

  it('shows unknown personality fallback', () => {
    const unknownGroom = { ...baseGroom, groomPersonality: 'unknown' };
    render(<GroomTalentTree groom={unknownGroom} />);
    expect(screen.getByTestId('talent-unknown-personality')).toBeInTheDocument();
  });

  it('shows allocated count', () => {
    render(<GroomTalentTree groom={withTier1Selected} />);
    expect(screen.getByTestId('talent-allocated-count')).toHaveTextContent('1 / 3 allocated');
  });
});

// ============================================================
// AC2: Available talents are highlighted
// ============================================================

describe('AC2: Available talents highlighted', () => {
  it('shows available icon for accessible talent at Novice', () => {
    render(<GroomTalentTree groom={level3Groom} />);
    expect(screen.getByTestId('talent-available-icon-gentleHands')).toBeInTheDocument();
    expect(screen.getByTestId('talent-available-icon-patienceVirtue')).toBeInTheDocument();
  });

  it('does not show available icon for locked talent', () => {
    render(<GroomTalentTree groom={level3Groom} />);
    // tier2 is locked at Novice
    expect(screen.queryByTestId('talent-available-icon-empathicSync')).not.toBeInTheDocument();
  });

  it('shows selected icon for chosen talent', () => {
    render(<GroomTalentTree groom={withTier1Selected} />);
    expect(screen.getByTestId('talent-selected-icon-gentleHands')).toBeInTheDocument();
  });

  it('shows selected badge for chosen talent', () => {
    render(<GroomTalentTree groom={withTier1Selected} />);
    expect(screen.getByTestId('talent-selected-badge-gentleHands')).toHaveTextContent('Selected');
  });

  it('shows select button for available talent', () => {
    render(<GroomTalentTree groom={level3Groom} />);
    expect(screen.getByTestId('talent-select-btn-gentleHands')).toBeInTheDocument();
  });

  it('does not show select button for locked talent', () => {
    render(<GroomTalentTree groom={level3Groom} />);
    expect(screen.queryByTestId('talent-select-btn-empathicSync')).not.toBeInTheDocument();
  });

  it('shows locked icon for tier below level requirement', () => {
    render(<GroomTalentTree groom={baseGroom} />);
    // Rookie → tier1 locked
    expect(screen.getByTestId('talent-locked-icon-gentleHands')).toBeInTheDocument();
  });
});

// ============================================================
// AC3: Talent effects clearly explained
// ============================================================

describe('AC3: Talent effects clearly explained', () => {
  it('shows talent name', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('talent-name-gentleHands')).toHaveTextContent('Gentle Hands');
  });

  it('shows talent description', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('talent-description-gentleHands')).toHaveTextContent(
      '+5% bond gain from all interactions'
    );
  });

  it('shows talent effects formatted', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    const effectsContainer = screen.getByTestId('talent-effects-gentleHands');
    expect(effectsContainer).toHaveTextContent('+5% Bonding Bonus');
  });

  it('shows the consistency effect for patienceVirtue and no burnout', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    const effectsContainer = screen.getByTestId('talent-effects-patienceVirtue');
    expect(effectsContainer).toHaveTextContent('+10% Consistency Bonus');
    // Owner ruling 2026-10-22 (Equoria-0d4wa): there is no burnout, so the talent
    // no longer claims a burnout resistance (old contract: '+15% Burnout Resistance').
    expect(effectsContainer).not.toHaveTextContent(/burnout/i);
  });

  it('shows personality label in panel header', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('talent-personality-label')).toHaveTextContent('Calm specialization');
  });

  it('capitalizes personality label', () => {
    const energeticGroom = { ...level8Groom, groomPersonality: 'energetic' };
    render(<GroomTalentTree groom={energeticGroom} />);
    expect(screen.getByTestId('talent-personality-label')).toHaveTextContent(
      'Energetic specialization'
    );
  });
});

// ============================================================
// AC4: Unlock requirements shown
// ============================================================

describe('AC4: Unlock requirements shown', () => {
  it('a locked tier says it is not open yet, and names no level', () => {
    render(<GroomTalentTree groom={baseGroom} />);
    for (const tier of ['tier1', 'tier2', 'tier3']) {
      expect(screen.getByTestId(`tier-requirement-${tier}`)).toHaveTextContent('Not open yet');
    }
    expect(screen.queryByText(/Level \d/)).not.toBeInTheDocument();
  });

  it('an open tier says it is open', () => {
    render(<GroomTalentTree groom={level3Groom} />);
    expect(screen.getByTestId('tier-requirement-tier1')).toHaveTextContent('Open');
    expect(screen.getByTestId('tier-requirement-tier2')).toHaveTextContent('Not open yet');
  });

  it('shows tier label for tier1', () => {
    render(<GroomTalentTree groom={baseGroom} />);
    expect(screen.getByTestId('tier-label-tier1')).toHaveTextContent('Tier 1 — Apprentice');
  });

  it('shows tier label for tier2', () => {
    render(<GroomTalentTree groom={baseGroom} />);
    expect(screen.getByTestId('tier-label-tier2')).toHaveTextContent('Tier 2 — Journeyman');
  });

  it('shows tier label for tier3', () => {
    render(<GroomTalentTree groom={baseGroom} />);
    expect(screen.getByTestId('tier-label-tier3')).toHaveTextContent('Tier 3 — Master');
  });

  it('shows prerequisite notice for tier2 when tier1 not selected', () => {
    render(<GroomTalentTree groom={level5Groom} />);
    // tier2 is unlocked at Intermediate but tier1 not selected
    expect(screen.getByTestId('tier-prerequisite-notice-tier2')).toBeInTheDocument();
  });

  it('does not show prerequisite notice when prerequisite is met', () => {
    render(<GroomTalentTree groom={withTier1Selected} />);
    expect(screen.queryByTestId('tier-prerequisite-notice-tier2')).not.toBeInTheDocument();
  });

  it('panel has aria-label with groom name', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('groom-talent-tree')).toHaveAttribute(
      'aria-label',
      'Talent tree for Oliver'
    );
  });
});

// ============================================================
// AC5: Talent point allocation
// ============================================================

describe('AC5: Talent point allocation', () => {
  it('calls onSelectTalent when available talent select button clicked', () => {
    const mockSelect = vi.fn();
    render(<GroomTalentTree groom={level3Groom} onSelectTalent={mockSelect} />);
    fireEvent.click(screen.getByTestId('talent-select-btn-gentleHands'));
    expect(mockSelect).toHaveBeenCalledWith('tier1', 'gentleHands');
  });

  it('calls onSelectTalent for patienceVirtue', () => {
    const mockSelect = vi.fn();
    render(<GroomTalentTree groom={level3Groom} onSelectTalent={mockSelect} />);
    fireEvent.click(screen.getByTestId('talent-select-btn-patienceVirtue'));
    expect(mockSelect).toHaveBeenCalledWith('tier1', 'patienceVirtue');
  });

  it('shows saving state when isSaving=true', () => {
    render(<GroomTalentTree groom={level3Groom} isSaving />);
    expect(screen.getByTestId('talent-saving-btn-gentleHands')).toBeInTheDocument();
    expect(screen.queryByTestId('talent-select-btn-gentleHands')).not.toBeInTheDocument();
  });

  it('saving button is disabled', () => {
    render(<GroomTalentTree groom={level3Groom} isSaving />);
    expect(screen.getByTestId('talent-saving-btn-gentleHands')).toBeDisabled();
  });

  it('shows completion message when all 3 tiers selected', () => {
    render(<GroomTalentTree groom={withAllSelected} />);
    expect(screen.getByTestId('talent-tree-complete')).toBeInTheDocument();
    expect(screen.getByTestId('talent-tree-complete')).toHaveTextContent('Talent tree complete!');
  });

  it('shows 3/3 allocated when complete', () => {
    render(<GroomTalentTree groom={withAllSelected} />);
    expect(screen.getByTestId('talent-allocated-count')).toHaveTextContent('3 / 3 allocated');
  });

  it('does not show completion message when tiers are partial', () => {
    render(<GroomTalentTree groom={withTier1Selected} />);
    expect(screen.queryByTestId('talent-tree-complete')).not.toBeInTheDocument();
  });

  it('does not show select button for already-selected talent', () => {
    render(<GroomTalentTree groom={withTier1Selected} />);
    expect(screen.queryByTestId('talent-select-btn-gentleHands')).not.toBeInTheDocument();
  });

  it('works for energetic personality talent', () => {
    const energeticGroom: GroomTalentData = {
      ...level3Groom,
      groomPersonality: 'energetic',
    };
    const mockSelect = vi.fn();
    render(<GroomTalentTree groom={energeticGroom} onSelectTalent={mockSelect} />);
    fireEvent.click(screen.getByTestId('talent-select-btn-playtimePro'));
    expect(mockSelect).toHaveBeenCalledWith('tier1', 'playtimePro');
  });
});
