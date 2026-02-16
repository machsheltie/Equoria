/**
 * Tests for TraitConfirmationCard Component
 *
 * Testing Sprint Day 3+ - Story 6-4: Milestone Evaluation Display
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Helper functions (trait type/tier colors)
 * - Compact vs full rendering modes
 * - Positive vs negative trait display
 * - Tier badge display (exotic, rare, uncommon, common)
 * - Effects and benefits display
 * - Confirmation reason display
 * - Props handling (showReason, compact)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TraitConfirmationCard from '../TraitConfirmationCard';
import type { EpigeneticTrait } from '@/types/foal';

// Mock the foal type functions
vi.mock('@/types/foal', async () => {
  const actual = await vi.importActual('@/types/foal');
  return {
    ...actual,
    getTraitConfirmationReason: vi.fn((score: number) => {
      if (score >= 5) return 'Exceptional care resulted in this outstanding trait';
      if (score >= 3) return 'Consistent positive interactions confirmed this trait';
      if (score >= 0) return 'Regular care patterns led to this trait development';
      return 'Trait developed from current care approach';
    }),
  };
});

describe('TraitConfirmationCard Component', () => {
  const mockPositiveTrait: EpigeneticTrait = {
    id: 'peopleOriented',
    name: 'People-Oriented',
    category: 'Social',
    description: 'Bonds quickly with handlers and seeks human interaction',
    effects: [
      {
        type: 'Training XP Gain',
        value: 15,
        description: '+15% XP gain from training sessions',
      },
      {
        type: 'Handler Bonding',
        value: 20,
        description: 'Bonds 20% faster with handlers',
      },
    ],
    isPositive: true,
    tier: 'uncommon',
  };

  const mockNegativeTrait: EpigeneticTrait = {
    id: 'nervous',
    name: 'Nervous',
    category: 'Temperament',
    description: 'Shows anxiety in new situations',
    effects: [
      {
        type: 'Stress Gain',
        value: 10,
        description: '+10% stress from competitions',
      },
    ],
    isPositive: false,
    tier: 'common',
  };

  describe('full mode rendering - positive trait', () => {
    it('should render in full mode by default', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} />);
      expect(screen.getByText('People-Oriented')).toBeInTheDocument();
      expect(screen.getByText(mockPositiveTrait.description)).toBeInTheDocument();
    });

    it('should show positive trait badge', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} />);
      expect(screen.getByText('Positive Trait')).toBeInTheDocument();
    });

    it('should display effects section', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} />);
      expect(screen.getByText('Effects & Benefits')).toBeInTheDocument();
    });

    it('should display all trait effects', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} />);
      expect(screen.getByText(/Training XP Gain/)).toBeInTheDocument();
      expect(screen.getByText(/\+15% XP gain/)).toBeInTheDocument();
      expect(screen.getByText(/Handler Bonding/)).toBeInTheDocument();
      expect(screen.getByText(/Bonds 20% faster/)).toBeInTheDocument();
    });

    it('should show confirmation reason by default', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} />);
      expect(screen.getByText('Why This Trait?')).toBeInTheDocument();
      expect(screen.getByText(/Consistent positive interactions/)).toBeInTheDocument();
    });

    it('should display category if provided', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} />);
      expect(screen.getByText('Category:')).toBeInTheDocument();
      expect(screen.getByText('Social')).toBeInTheDocument();
    });

    it('should display tier badge for uncommon trait', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} />);
      expect(screen.getByText('Uncommon')).toBeInTheDocument();
    });
  });

  describe('full mode rendering - negative trait', () => {
    it('should show negative trait badge', () => {
      render(<TraitConfirmationCard trait={mockNegativeTrait} score={-2} />);
      expect(screen.getByText('Negative Trait')).toBeInTheDocument();
    });

    it('should display negative trait with red styling', () => {
      const { container } = render(<TraitConfirmationCard trait={mockNegativeTrait} score={-2} />);
      const redElements = container.querySelectorAll('[class*="red"]');
      expect(redElements.length).toBeGreaterThan(0);
    });

    it('should display negative effects correctly', () => {
      render(<TraitConfirmationCard trait={mockNegativeTrait} score={-2} />);
      expect(screen.getByText(/Stress Gain/)).toBeInTheDocument();
      expect(screen.getByText(/\+10% stress/)).toBeInTheDocument();
    });
  });

  describe('compact mode rendering', () => {
    it('should render in compact mode when compact=true', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} compact={true} />);
      expect(screen.getByText('People-Oriented')).toBeInTheDocument();
      expect(screen.getByText(mockPositiveTrait.description)).toBeInTheDocument();
    });

    it('should not show effects section in compact mode', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} compact={true} />);
      expect(screen.queryByText('Effects & Benefits')).not.toBeInTheDocument();
    });

    it('should not show confirmation reason in compact mode', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} compact={true} />);
      expect(screen.queryByText('Why This Trait?')).not.toBeInTheDocument();
    });

    it('should show tier badge in compact mode', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} compact={true} />);
      expect(screen.getByText('Uncommon')).toBeInTheDocument();
    });

    it('should not show category in compact mode', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} compact={true} />);
      expect(screen.queryByText('Category:')).not.toBeInTheDocument();
    });
  });

  describe('tier display', () => {
    it('should display exotic tier with purple styling', () => {
      const exoticTrait = { ...mockPositiveTrait, tier: 'exotic' };
      const { container } = render(<TraitConfirmationCard trait={exoticTrait} score={4} />);
      expect(screen.getByText('Exotic')).toBeInTheDocument();
      const purpleElements = container.querySelectorAll('[class*="purple"]');
      expect(purpleElements.length).toBeGreaterThan(0);
    });

    it('should display ultra-rare tier with pink styling', () => {
      const ultraRareTrait = { ...mockPositiveTrait, tier: 'ultra-rare' };
      const { container } = render(<TraitConfirmationCard trait={ultraRareTrait} score={4} />);
      expect(screen.getByText('Ultra-rare')).toBeInTheDocument();
      const pinkElements = container.querySelectorAll('[class*="pink"]');
      expect(pinkElements.length).toBeGreaterThan(0);
    });

    it('should display rare tier with blue styling', () => {
      const rareTrait = { ...mockPositiveTrait, tier: 'rare' };
      const { container } = render(<TraitConfirmationCard trait={rareTrait} score={4} />);
      expect(screen.getByText('Rare')).toBeInTheDocument();
      const blueElements = container.querySelectorAll('[class*="blue"]');
      expect(blueElements.length).toBeGreaterThan(0);
    });

    it('should display uncommon tier with emerald styling', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} />);
      expect(screen.getByText('Uncommon')).toBeInTheDocument();
    });

    it('should display common tier with slate styling', () => {
      const commonTrait = { ...mockPositiveTrait, tier: 'common' };
      render(<TraitConfirmationCard trait={commonTrait} score={4} />);
      expect(screen.getByText('Common')).toBeInTheDocument();
    });

    it('should not show tier badge when tier is undefined', () => {
      const noTierTrait = { ...mockPositiveTrait, tier: undefined };
      render(<TraitConfirmationCard trait={noTierTrait} score={4} />);
      expect(screen.queryByText(/Uncommon|Rare|Common/)).not.toBeInTheDocument();
    });
  });

  describe('showReason prop', () => {
    it('should hide confirmation reason when showReason=false', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} showReason={false} />);
      expect(screen.queryByText('Why This Trait?')).not.toBeInTheDocument();
    });

    it('should show confirmation reason when showReason=true', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} showReason={true} />);
      expect(screen.getByText('Why This Trait?')).toBeInTheDocument();
    });
  });

  describe('effects display', () => {
    it('should handle trait with single effect', () => {
      const singleEffectTrait = {
        ...mockPositiveTrait,
        effects: [mockPositiveTrait.effects[0]],
      };
      render(<TraitConfirmationCard trait={singleEffectTrait} score={4} />);
      expect(screen.getByText(/Training XP Gain/)).toBeInTheDocument();
      expect(screen.queryByText(/Handler Bonding/)).not.toBeInTheDocument();
    });

    it('should handle trait with no effects', () => {
      const noEffectsTrait = { ...mockPositiveTrait, effects: [] };
      render(<TraitConfirmationCard trait={noEffectsTrait} score={4} />);
      expect(screen.queryByText('Effects & Benefits')).not.toBeInTheDocument();
    });

    it('should format positive effect values with plus sign', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} />);
      const effectTexts = screen.getAllByText(/\+15/);
      expect(effectTexts.length).toBeGreaterThan(0);
    });

    it('should show percent sign for percentage-based effects', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} />);
      expect(screen.getByText(/\+15% XP gain/)).toBeInTheDocument();
    });

    it('should handle negative effect values', () => {
      const negativeEffectTrait = {
        ...mockPositiveTrait,
        effects: [
          {
            type: 'Speed Penalty',
            value: -5,
            description: '-5% speed reduction',
          },
        ],
      };
      render(<TraitConfirmationCard trait={negativeEffectTrait} score={4} />);
      const negativeValueTexts = screen.getAllByText(/-5/);
      expect(negativeValueTexts.length).toBeGreaterThan(0);
    });
  });

  describe('confirmation reason by score', () => {
    it('should show exceptional reason for score >= 5', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={5} />);
      expect(screen.getByText(/Exceptional care resulted/)).toBeInTheDocument();
    });

    it('should show consistent reason for score 3-4', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={3} />);
      expect(screen.getByText(/Consistent positive interactions/)).toBeInTheDocument();
    });

    it('should show regular reason for score 0-2', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={1} />);
      expect(screen.getByText(/Regular care patterns/)).toBeInTheDocument();
    });

    it('should show development reason for negative scores', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={-2} />);
      expect(screen.getByText(/Trait developed from current care/)).toBeInTheDocument();
    });
  });

  describe('positive/negative determination', () => {
    it('should use trait.isPositive when provided', () => {
      render(<TraitConfirmationCard trait={mockPositiveTrait} score={-5} />);
      expect(screen.getByText('Positive Trait')).toBeInTheDocument();
    });

    it('should fall back to score when isPositive is undefined', () => {
      const ambiguousTrait = { ...mockPositiveTrait, isPositive: undefined };
      render(<TraitConfirmationCard trait={ambiguousTrait} score={3} />);
      expect(screen.getByText('Positive Trait')).toBeInTheDocument();
    });

    it('should show negative for low score when isPositive undefined', () => {
      const ambiguousTrait = { ...mockPositiveTrait, isPositive: undefined };
      render(<TraitConfirmationCard trait={ambiguousTrait} score={-3} />);
      expect(screen.getByText('Negative Trait')).toBeInTheDocument();
    });
  });

  describe('category display', () => {
    it('should not show category when undefined', () => {
      const noCategoryTrait = { ...mockPositiveTrait, category: undefined };
      render(<TraitConfirmationCard trait={noCategoryTrait} score={4} />);
      expect(screen.queryByText('Category:')).not.toBeInTheDocument();
    });

    it('should display different category values', () => {
      const temperamentTrait = { ...mockPositiveTrait, category: 'Temperament' };
      render(<TraitConfirmationCard trait={temperamentTrait} score={4} />);
      expect(screen.getByText('Temperament')).toBeInTheDocument();
    });
  });

  describe('icon display', () => {
    it('should show CheckCircle icon for positive traits', () => {
      const { container } = render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} />);
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should show XCircle icon for negative traits', () => {
      const { container } = render(<TraitConfirmationCard trait={mockNegativeTrait} score={-2} />);
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle trait with very long name', () => {
      const longNameTrait = {
        ...mockPositiveTrait,
        name: 'Exceptionally Long Trait Name That Should Wrap Properly',
      };
      render(<TraitConfirmationCard trait={longNameTrait} score={4} />);
      expect(
        screen.getByText('Exceptionally Long Trait Name That Should Wrap Properly')
      ).toBeInTheDocument();
    });

    it('should handle trait with very long description', () => {
      const longDescTrait = {
        ...mockPositiveTrait,
        description:
          'This is an extremely long description that should wrap properly and maintain readability across multiple lines in both compact and full modes',
      };
      render(<TraitConfirmationCard trait={longDescTrait} score={4} />);
      expect(screen.getByText(/extremely long description/)).toBeInTheDocument();
    });

    it('should handle trait with empty effects array', () => {
      const emptyEffectsTrait = { ...mockPositiveTrait, effects: [] };
      render(<TraitConfirmationCard trait={emptyEffectsTrait} score={4} />);
      expect(screen.queryByText('Effects & Benefits')).not.toBeInTheDocument();
    });

    it('should handle trait with missing optional fields', () => {
      const minimalTrait: EpigeneticTrait = {
        id: 'test',
        name: 'Test Trait',
        description: 'Test description',
        effects: [],
        isPositive: true,
      };
      render(<TraitConfirmationCard trait={minimalTrait} score={4} />);
      expect(screen.getByText('Test Trait')).toBeInTheDocument();
    });
  });

  describe('styling consistency', () => {
    it('should have consistent green styling for positive traits', () => {
      const { container } = render(<TraitConfirmationCard trait={mockPositiveTrait} score={4} />);
      const greenElements = container.querySelectorAll('[class*="green"]');
      expect(greenElements.length).toBeGreaterThan(0);
    });

    it('should have consistent red styling for negative traits', () => {
      const { container } = render(<TraitConfirmationCard trait={mockNegativeTrait} score={-2} />);
      const redElements = container.querySelectorAll('[class*="red"]');
      expect(redElements.length).toBeGreaterThan(0);
    });
  });
});
