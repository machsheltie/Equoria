/**
 * GroomTalentTree Tests — Story 7-6: Talent Tree Visualization
 *
 * Tests for the talent tree UI component that shows groom talents
 * across 3 tiers with locked/available/selected states.
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
  level: 1,
  groomPersonality: 'calm',
  talentSelections: null,
};

const level3Groom: GroomTalentData = { ...baseGroom, level: 3 };
const level5Groom: GroomTalentData = { ...baseGroom, level: 5 };
const level8Groom: GroomTalentData = { ...baseGroom, level: 8 };

const withTier1Selected: GroomTalentData = {
  ...level5Groom,
  talentSelections: { tier1: 'gentle_hands' },
};

const withAllSelected: GroomTalentData = {
  ...level8Groom,
  talentSelections: {
    tier1: 'gentle_hands',
    tier2: 'empathic_sync',
    tier3: 'master_bonding',
  },
};

// ============================================================
// Helper function unit tests
// ============================================================

describe('TALENT_REQUIREMENTS constants', () => {
  it('tier1 requires level 3', () => {
    expect(TALENT_REQUIREMENTS.tier1.minLevel).toBe(3);
  });

  it('tier2 requires level 5', () => {
    expect(TALENT_REQUIREMENTS.tier2.minLevel).toBe(5);
  });

  it('tier3 requires level 8', () => {
    expect(TALENT_REQUIREMENTS.tier3.minLevel).toBe(8);
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

  it('calm tier2 has 2 talents', () => {
    expect(TALENT_TREES.calm.tier2).toHaveLength(2);
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
    expect(formatTalentEffect('stressReduction', 0.2)).toBe('+20% Stress Reduction');
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
    expect(countAllocatedTalents({ tier1: 'gentle_hands' })).toBe(1);
  });

  it('returns 2 with tier1 and tier2', () => {
    expect(countAllocatedTalents({ tier1: 'gentle_hands', tier2: 'empathic_sync' })).toBe(2);
  });

  it('returns 3 with all tiers', () => {
    expect(
      countAllocatedTalents({
        tier1: 'gentle_hands',
        tier2: 'empathic_sync',
        tier3: 'master_bonding',
      })
    ).toBe(3);
  });

  it('returns 0 for empty object', () => {
    expect(countAllocatedTalents({})).toBe(0);
  });
});

describe('getTalentTiersWithState', () => {
  it('returns empty array for unknown personality', () => {
    const tiers = getTalentTiersWithState('unknown_personality', 10, null);
    expect(tiers).toHaveLength(0);
  });

  it('returns 3 tiers for calm personality', () => {
    const tiers = getTalentTiersWithState('calm', 10, null);
    expect(tiers).toHaveLength(3);
  });

  it('all tiers locked below level 3', () => {
    const tiers = getTalentTiersWithState('calm', 1, null);
    expect(tiers[0].isUnlocked).toBe(false);
    expect(tiers[1].isUnlocked).toBe(false);
    expect(tiers[2].isUnlocked).toBe(false);
  });

  it('tier1 unlocked at level 3', () => {
    const tiers = getTalentTiersWithState('calm', 3, null);
    expect(tiers[0].isUnlocked).toBe(true);
    expect(tiers[1].isUnlocked).toBe(false);
  });

  it('tier2 unlocked at level 5', () => {
    const tiers = getTalentTiersWithState('calm', 5, null);
    expect(tiers[1].isUnlocked).toBe(true);
  });

  it('tier3 unlocked at level 8', () => {
    const tiers = getTalentTiersWithState('calm', 8, null);
    expect(tiers[2].isUnlocked).toBe(true);
  });

  it('talents in locked tier are locked', () => {
    const tiers = getTalentTiersWithState('calm', 1, null);
    tiers[0].talents.forEach((t) => expect(t.isLocked).toBe(true));
  });

  it('tier1 talents available when unlocked with no selection', () => {
    const tiers = getTalentTiersWithState('calm', 3, null);
    tiers[0].talents.forEach((t) => {
      expect(t.isAvailable).toBe(true);
      expect(t.isLocked).toBe(false);
    });
  });

  it('tier2 talents locked when tier1 not selected yet', () => {
    const tiers = getTalentTiersWithState('calm', 5, null);
    expect(tiers[1].prerequisiteMet).toBe(false);
    tiers[1].talents.forEach((t) => expect(t.isLocked).toBe(true));
  });

  it('tier2 available after tier1 selected', () => {
    const tiers = getTalentTiersWithState('calm', 5, { tier1: 'gentle_hands' });
    expect(tiers[1].prerequisiteMet).toBe(true);
    tiers[1].talents.forEach((t) => expect(t.isLocked).toBe(false));
  });

  it('selected talent has isSelected=true', () => {
    const tiers = getTalentTiersWithState('calm', 3, { tier1: 'gentle_hands' });
    const gentleHands = tiers[0].talents.find((t) => t.id === 'gentle_hands')!;
    expect(gentleHands.isSelected).toBe(true);
  });

  it('non-selected talent in same tier has isSelected=false', () => {
    const tiers = getTalentTiersWithState('calm', 3, { tier1: 'gentle_hands' });
    const patienceVirtue = tiers[0].talents.find((t) => t.id === 'patience_virtue')!;
    expect(patienceVirtue.isSelected).toBe(false);
  });

  it('talents unavailable when tier already has selection', () => {
    const tiers = getTalentTiersWithState('calm', 3, { tier1: 'gentle_hands' });
    // patience_virtue should not be available (already selected in this tier)
    const patienceVirtue = tiers[0].talents.find((t) => t.id === 'patience_virtue')!;
    expect(patienceVirtue.isAvailable).toBe(false);
  });

  it('selectedTalentId reflects current selection', () => {
    const tiers = getTalentTiersWithState('calm', 5, { tier1: 'gentle_hands' });
    expect(tiers[0].selectedTalentId).toBe('gentle_hands');
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
    expect(screen.getByTestId('talent-card-gentle_hands')).toBeInTheDocument();
    expect(screen.getByTestId('talent-card-patience_virtue')).toBeInTheDocument();
  });

  it('shows all calm tier2 talents', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('talent-card-empathic_sync')).toBeInTheDocument();
    expect(screen.getByTestId('talent-card-stress_whisperer')).toBeInTheDocument();
  });

  it('shows tier3 talent', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('talent-card-master_bonding')).toBeInTheDocument();
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
  it('shows available icon for accessible talent at level 3', () => {
    render(<GroomTalentTree groom={level3Groom} />);
    expect(screen.getByTestId('talent-available-icon-gentle_hands')).toBeInTheDocument();
    expect(screen.getByTestId('talent-available-icon-patience_virtue')).toBeInTheDocument();
  });

  it('does not show available icon for locked talent', () => {
    render(<GroomTalentTree groom={level3Groom} />);
    // tier2 is locked at level 3
    expect(screen.queryByTestId('talent-available-icon-empathic_sync')).not.toBeInTheDocument();
  });

  it('shows selected icon for chosen talent', () => {
    render(<GroomTalentTree groom={withTier1Selected} />);
    expect(screen.getByTestId('talent-selected-icon-gentle_hands')).toBeInTheDocument();
  });

  it('shows selected badge for chosen talent', () => {
    render(<GroomTalentTree groom={withTier1Selected} />);
    expect(screen.getByTestId('talent-selected-badge-gentle_hands')).toHaveTextContent('Selected');
  });

  it('shows select button for available talent', () => {
    render(<GroomTalentTree groom={level3Groom} />);
    expect(screen.getByTestId('talent-select-btn-gentle_hands')).toBeInTheDocument();
  });

  it('does not show select button for locked talent', () => {
    render(<GroomTalentTree groom={level3Groom} />);
    expect(screen.queryByTestId('talent-select-btn-empathic_sync')).not.toBeInTheDocument();
  });

  it('shows locked icon for tier below level requirement', () => {
    render(<GroomTalentTree groom={baseGroom} />);
    // level 1 → tier1 locked
    expect(screen.getByTestId('talent-locked-icon-gentle_hands')).toBeInTheDocument();
  });
});

// ============================================================
// AC3: Talent effects clearly explained
// ============================================================

describe('AC3: Talent effects clearly explained', () => {
  it('shows talent name', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('talent-name-gentle_hands')).toHaveTextContent('Gentle Hands');
  });

  it('shows talent description', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    expect(screen.getByTestId('talent-description-gentle_hands')).toHaveTextContent(
      '+5% bond gain from all interactions'
    );
  });

  it('shows talent effects formatted', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    const effectsContainer = screen.getByTestId('talent-effects-gentle_hands');
    expect(effectsContainer).toHaveTextContent('+5% Bonding Bonus');
  });

  it('shows multiple effects for patience_virtue', () => {
    render(<GroomTalentTree groom={level8Groom} />);
    const effectsContainer = screen.getByTestId('talent-effects-patience_virtue');
    expect(effectsContainer).toHaveTextContent('+10% Consistency Bonus');
    expect(effectsContainer).toHaveTextContent('+15% Burnout Resistance');
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
  it('shows level requirement for tier1', () => {
    render(<GroomTalentTree groom={baseGroom} />);
    expect(screen.getByTestId('tier-requirement-tier1')).toHaveTextContent('Level 3+ required');
  });

  it('shows level requirement for tier2', () => {
    render(<GroomTalentTree groom={baseGroom} />);
    expect(screen.getByTestId('tier-requirement-tier2')).toHaveTextContent('Level 5+ required');
  });

  it('shows level requirement for tier3', () => {
    render(<GroomTalentTree groom={baseGroom} />);
    expect(screen.getByTestId('tier-requirement-tier3')).toHaveTextContent('Level 8+ required');
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
    // tier2 is unlocked at level 5 but tier1 not selected
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
    fireEvent.click(screen.getByTestId('talent-select-btn-gentle_hands'));
    expect(mockSelect).toHaveBeenCalledWith('tier1', 'gentle_hands');
  });

  it('calls onSelectTalent for patience_virtue', () => {
    const mockSelect = vi.fn();
    render(<GroomTalentTree groom={level3Groom} onSelectTalent={mockSelect} />);
    fireEvent.click(screen.getByTestId('talent-select-btn-patience_virtue'));
    expect(mockSelect).toHaveBeenCalledWith('tier1', 'patience_virtue');
  });

  it('shows saving state when isSaving=true', () => {
    render(<GroomTalentTree groom={level3Groom} isSaving />);
    expect(screen.getByTestId('talent-saving-btn-gentle_hands')).toBeInTheDocument();
    expect(screen.queryByTestId('talent-select-btn-gentle_hands')).not.toBeInTheDocument();
  });

  it('saving button is disabled', () => {
    render(<GroomTalentTree groom={level3Groom} isSaving />);
    expect(screen.getByTestId('talent-saving-btn-gentle_hands')).toBeDisabled();
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
    expect(screen.queryByTestId('talent-select-btn-gentle_hands')).not.toBeInTheDocument();
  });

  it('works for energetic personality talent', () => {
    const energeticGroom: GroomTalentData = {
      ...level3Groom,
      groomPersonality: 'energetic',
    };
    const mockSelect = vi.fn();
    render(<GroomTalentTree groom={energeticGroom} onSelectTalent={mockSelect} />);
    fireEvent.click(screen.getByTestId('talent-select-btn-playtime_pro'));
    expect(mockSelect).toHaveBeenCalledWith('tier1', 'playtime_pro');
  });
});
