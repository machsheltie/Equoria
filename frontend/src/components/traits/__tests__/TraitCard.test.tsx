/**
 * Tests for TraitCard Component
 *
 * Testing Sprint - Story 6-6: Epigenetic Trait System
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - All 5 trait tiers (common, uncommon, rare, ultra-rare, exotic)
 * - Competition impact indicators (positive, negative, neutral)
 * - Epigenetic flags display (up to 2, overflow handling)
 * - Best disciplines preview
 * - Discovery status indicators (discovered, partially discovered, hidden)
 * - Positive/negative trait indicators
 * - Click interaction handler
 * - Decorative effects for high-tier traits
 * - Integration with trait helper functions
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TraitCard from '../TraitCard';
import type { EpigeneticTrait, CompetitionImpact } from '@/types/traits';

// Type for tier style object
interface TierStyle {
  borderColor: string;
  bgColor: string;
  textColor: string;
  badgeColor: string;
}

// Mock the traits type helpers
vi.mock('@/types/traits', async () => {
  const actual = await vi.importActual('@/types/traits');
  return {
    ...actual,
    getTierStyle: vi.fn((tier: string) => {
      const styles: Record<string, TierStyle> = {
        common: {
          borderColor: 'border-slate-300',
          bgColor: 'bg-slate-50',
          textColor: 'text-slate-900',
          badgeColor: 'bg-slate-200 text-slate-700',
        },
        uncommon: {
          borderColor: 'border-green-300',
          bgColor: 'bg-green-50',
          textColor: 'text-green-900',
          badgeColor: 'bg-green-200 text-green-700',
        },
        rare: {
          borderColor: 'border-blue-400',
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-900',
          badgeColor: 'bg-blue-200 text-blue-700',
        },
        'ultra-rare': {
          borderColor: 'border-yellow-400',
          bgColor: 'bg-yellow-50',
          textColor: 'text-yellow-900',
          badgeColor: 'bg-yellow-200 text-yellow-700',
        },
        exotic: {
          borderColor: 'border-purple-500',
          bgColor: 'bg-purple-50',
          textColor: 'text-purple-900',
          badgeColor: 'bg-purple-200 text-purple-700',
        },
      };
      return styles[tier];
    }),
    getTierDisplayName: vi.fn((tier: string) => {
      const names: Record<string, string> = {
        common: 'Common',
        uncommon: 'Uncommon',
        rare: 'Rare',
        'ultra-rare': 'Ultra Rare',
        exotic: 'Exotic',
      };
      return names[tier];
    }),
    calculateTotalImpact: vi.fn((impact: CompetitionImpact) => {
      return Object.values(impact).reduce((sum, val) => {
        if (typeof val === 'number') return sum + val;
        return sum;
      }, 0);
    }),
    getBestDisciplines: vi.fn((impact: CompetitionImpact) => {
      const disciplines = [
        { discipline: 'Dressage', modifier: impact.dressage },
        { discipline: 'Show Jumping', modifier: impact.show_jumping },
        { discipline: 'Cross Country', modifier: impact.cross_country },
        { discipline: 'Endurance', modifier: impact.endurance },
        { discipline: 'Racing', modifier: impact.racing },
        { discipline: 'Western', modifier: impact.western },
      ];
      return disciplines.filter((d) => d.modifier > 0).slice(0, 3);
    }),
  };
});

describe('TraitCard Component', () => {
  const baseImpact: CompetitionImpact = {
    dressage: 0,
    show_jumping: 0,
    cross_country: 0,
    endurance: 0,
    racing: 0,
    western: 0,
  };

  describe('tier-specific styling', () => {
    it('should render common tier with correct styling', () => {
      const commonTrait: EpigeneticTrait = {
        id: 'test-common',
        name: 'Common Trait',
        tier: 'common',
        category: 'Test',
        description: 'A common trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      const { container } = render(<TraitCard trait={commonTrait} />);
      expect(screen.getByText('Common Trait')).toBeInTheDocument();
      expect(screen.getByText('Common')).toBeInTheDocument();
      expect(container.querySelector('.border-slate-300')).toBeInTheDocument();
    });

    it('should render uncommon tier with correct styling', () => {
      const uncommonTrait: EpigeneticTrait = {
        id: 'test-uncommon',
        name: 'Uncommon Trait',
        tier: 'uncommon',
        category: 'Test',
        description: 'An uncommon trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      const { container } = render(<TraitCard trait={uncommonTrait} />);
      expect(screen.getByText('Uncommon')).toBeInTheDocument();
      expect(container.querySelector('.border-green-300')).toBeInTheDocument();
    });

    it('should render rare tier with correct styling', () => {
      const rareTrait: EpigeneticTrait = {
        id: 'test-rare',
        name: 'Rare Trait',
        tier: 'rare',
        category: 'Test',
        description: 'A rare trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      const { container } = render(<TraitCard trait={rareTrait} />);
      expect(screen.getByText('Rare')).toBeInTheDocument();
      expect(container.querySelector('.border-blue-400')).toBeInTheDocument();
    });

    it('should render ultra-rare tier with correct styling and decorative effect', () => {
      const ultraRareTrait: EpigeneticTrait = {
        id: 'test-ultra-rare',
        name: 'Ultra Rare Trait',
        tier: 'ultra-rare',
        category: 'Test',
        description: 'An ultra-rare trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      const { container } = render(<TraitCard trait={ultraRareTrait} />);
      expect(screen.getByText('Ultra Rare')).toBeInTheDocument();
      expect(container.querySelector('.border-yellow-400')).toBeInTheDocument();
      // Check for decorative shine effect
      expect(container.querySelector('.bg-white\\/20')).toBeInTheDocument();
    });

    it('should render exotic tier with correct styling and decorative effect', () => {
      const exoticTrait: EpigeneticTrait = {
        id: 'test-exotic',
        name: 'Exotic Trait',
        tier: 'exotic',
        category: 'Test',
        description: 'An exotic trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      const { container } = render(<TraitCard trait={exoticTrait} />);
      expect(screen.getByText('Exotic')).toBeInTheDocument();
      expect(container.querySelector('.border-purple-500')).toBeInTheDocument();
      // Check for decorative shine effect
      expect(container.querySelector('.bg-white\\/20')).toBeInTheDocument();
    });

    it('should not show decorative effect for common traits', () => {
      const commonTrait: EpigeneticTrait = {
        id: 'test-common',
        name: 'Common Trait',
        tier: 'common',
        category: 'Test',
        description: 'A common trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      const { container } = render(<TraitCard trait={commonTrait} />);
      expect(container.querySelector('.bg-white\\/20')).not.toBeInTheDocument();
    });
  });

  describe('competition impact display', () => {
    it('should show positive impact with TrendingUp icon', () => {
      const positiveTrait: EpigeneticTrait = {
        id: 'test-positive',
        name: 'Positive Trait',
        tier: 'uncommon',
        category: 'Test',
        description: 'A positive trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: { ...baseImpact, dressage: 5, racing: 3 },
        isPositive: true,
      };
      const { container } = render(<TraitCard trait={positiveTrait} />);
      expect(screen.getByText('+8')).toBeInTheDocument();
      expect(container.querySelector('.text-green-600')).toBeInTheDocument();
    });

    it('should show negative impact with TrendingDown icon', () => {
      const negativeTrait: EpigeneticTrait = {
        id: 'test-negative',
        name: 'Negative Trait',
        tier: 'common',
        category: 'Test',
        description: 'A negative trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: { ...baseImpact, dressage: -3, racing: -2 },
        isPositive: false,
      };
      const { container } = render(<TraitCard trait={negativeTrait} />);
      expect(screen.getByText('-5')).toBeInTheDocument();
      expect(container.querySelector('.text-red-600')).toBeInTheDocument();
    });

    it('should hide impact when showCompetitionImpact is false', () => {
      const positiveTrait: EpigeneticTrait = {
        id: 'test-positive',
        name: 'Positive Trait',
        tier: 'uncommon',
        category: 'Test',
        description: 'A positive trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: { ...baseImpact, dressage: 5 },
        isPositive: true,
      };
      render(<TraitCard trait={positiveTrait} showCompetitionImpact={false} />);
      expect(screen.queryByText('+5')).not.toBeInTheDocument();
    });
  });

  describe('epigenetic flags display', () => {
    it('should display single epigenetic flag', () => {
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Test Trait',
        tier: 'uncommon',
        category: 'Test',
        description: 'A test trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: ['care-influenced'],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText('❤️')).toBeInTheDocument();
      expect(screen.getByText('Care')).toBeInTheDocument();
    });

    it('should display two epigenetic flags', () => {
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Test Trait',
        tier: 'rare',
        category: 'Test',
        description: 'A test trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: ['stress-induced', 'milestone-triggered'],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('Stress')).toBeInTheDocument();
      expect(screen.getByText('🎯')).toBeInTheDocument();
      expect(screen.getByText('Milestone')).toBeInTheDocument();
    });

    it('should show overflow indicator when more than 2 flags', () => {
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Test Trait',
        tier: 'exotic',
        category: 'Test',
        description: 'A test trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [
          'stress-induced',
          'care-influenced',
          'milestone-triggered',
          'genetic-only',
        ],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('should render all flag types correctly', () => {
      const stressTrait: EpigeneticTrait = {
        id: 'stress',
        name: 'Stress Trait',
        tier: 'common',
        category: 'Test',
        description: 'Stress trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: ['stress-induced'],
        competitionImpact: baseImpact,
        isPositive: false,
      };
      const { rerender } = render(<TraitCard trait={stressTrait} />);
      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('Stress')).toBeInTheDocument();

      const careTrait: EpigeneticTrait = {
        ...stressTrait,
        epigeneticFlags: ['care-influenced'],
      };
      rerender(<TraitCard trait={careTrait} />);
      expect(screen.getByText('❤️')).toBeInTheDocument();
      expect(screen.getByText('Care')).toBeInTheDocument();

      const milestoneTrait: EpigeneticTrait = {
        ...stressTrait,
        epigeneticFlags: ['milestone-triggered'],
      };
      rerender(<TraitCard trait={milestoneTrait} />);
      expect(screen.getByText('🎯')).toBeInTheDocument();
      expect(screen.getByText('Milestone')).toBeInTheDocument();

      const geneticTrait: EpigeneticTrait = {
        ...stressTrait,
        epigeneticFlags: ['genetic-only'],
      };
      rerender(<TraitCard trait={geneticTrait} />);
      expect(screen.getByText('🧬')).toBeInTheDocument();
      expect(screen.getByText('Genetic')).toBeInTheDocument();
    });
  });

  describe('best disciplines display', () => {
    it('should show best disciplines when showCompetitionImpact is true', () => {
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Test Trait',
        tier: 'rare',
        category: 'Test',
        description: 'A test trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: { ...baseImpact, dressage: 5, racing: 3, endurance: 7 },
        isPositive: true,
      };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText('Best For:')).toBeInTheDocument();
      expect(screen.getByText('Endurance')).toBeInTheDocument();
      expect(screen.getByText('Dressage')).toBeInTheDocument();
      expect(screen.getByText('Racing')).toBeInTheDocument();
    });

    it('should hide best disciplines when showCompetitionImpact is false', () => {
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Test Trait',
        tier: 'rare',
        category: 'Test',
        description: 'A test trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: { ...baseImpact, dressage: 5 },
        isPositive: true,
      };
      render(<TraitCard trait={trait} showCompetitionImpact={false} />);
      expect(screen.queryByText('Best For:')).not.toBeInTheDocument();
    });

    it('should not show best disciplines section when no positive impacts', () => {
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Test Trait',
        tier: 'common',
        category: 'Test',
        description: 'A test trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: false,
      };
      render(<TraitCard trait={trait} />);
      expect(screen.queryByText('Best For:')).not.toBeInTheDocument();
    });
  });

  describe('discovery status indicators', () => {
    it('should not show indicator for discovered traits', () => {
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Discovered Trait',
        tier: 'uncommon',
        category: 'Test',
        description: 'A discovered trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      const { container } = render(<TraitCard trait={trait} />);
      const indicator = container.querySelector('.bg-yellow-400, .bg-slate-300');
      expect(indicator).not.toBeInTheDocument();
    });

    it('should show yellow indicator for partially discovered traits', () => {
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Partial Trait',
        tier: 'rare',
        category: 'Test',
        description: 'A partially discovered trait',
        discoveryStatus: 'partially_discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      const { container } = render(<TraitCard trait={trait} />);
      const indicator = container.querySelector('.bg-yellow-400');
      expect(indicator).toBeInTheDocument();
    });

    it('should show grey indicator for hidden traits', () => {
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Hidden Trait',
        tier: 'exotic',
        category: 'Test',
        description: 'A hidden trait',
        discoveryStatus: 'hidden',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      const { container } = render(<TraitCard trait={trait} />);
      const indicator = container.querySelector('.bg-slate-300');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('positive/negative indicators', () => {
    it('should show + for positive traits', () => {
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Positive Trait',
        tier: 'uncommon',
        category: 'Test',
        description: 'A positive trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      const { container } = render(<TraitCard trait={trait} />);
      const positiveIndicator = Array.from(container.querySelectorAll('.text-green-600')).find(
        (el) => el.textContent === '+'
      );
      expect(positiveIndicator).toBeInTheDocument();
    });

    it('should show − for negative traits', () => {
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Negative Trait',
        tier: 'common',
        category: 'Test',
        description: 'A negative trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: false,
      };
      const { container } = render(<TraitCard trait={trait} />);
      const negativeIndicator = Array.from(container.querySelectorAll('.text-red-600')).find(
        (el) => el.textContent === '−'
      );
      expect(negativeIndicator).toBeInTheDocument();
    });
  });

  describe('click interaction', () => {
    it('should call onClick handler when clicked', () => {
      const handleClick = vi.fn();
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Clickable Trait',
        tier: 'rare',
        category: 'Test',
        description: 'A clickable trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      const { container } = render(<TraitCard trait={trait} onClick={handleClick} />);
      const card = container.querySelector('.cursor-pointer');
      if (!card) throw new Error('Card not found');
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith(trait);
    });

    it('should not crash when onClick is not provided', () => {
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Non-clickable Trait',
        tier: 'common',
        category: 'Test',
        description: 'A trait without handler',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      const { container } = render(<TraitCard trait={trait} />);
      const card = container.querySelector('.cursor-pointer');
      if (!card) throw new Error('Card not found');
      expect(() => fireEvent.click(card)).not.toThrow();
    });
  });

  describe('content display', () => {
    it('should display trait name and description', () => {
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Test Trait Name',
        tier: 'uncommon',
        category: 'Test Category',
        description: 'This is a test trait description',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText('Test Trait Name')).toBeInTheDocument();
      expect(screen.getByText('This is a test trait description')).toBeInTheDocument();
    });

    it('should display trait category', () => {
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Test Trait',
        tier: 'rare',
        category: 'Behavioral',
        description: 'A behavioral trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText('Behavioral')).toBeInTheDocument();
    });

    it('should show Info icon on hover', () => {
      const trait: EpigeneticTrait = {
        id: 'test-trait',
        name: 'Test Trait',
        tier: 'uncommon',
        category: 'Test',
        description: 'A test trait',
        discoveryStatus: 'discovered',
        epigeneticFlags: [],
        competitionImpact: baseImpact,
        isPositive: true,
      };
      const { container } = render(<TraitCard trait={trait} />);
      const infoIcon = container.querySelector('.opacity-0.group-hover\\:opacity-100');
      expect(infoIcon).toBeInTheDocument();
    });
  });
});
