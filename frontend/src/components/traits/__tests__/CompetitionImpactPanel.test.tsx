/**
 * Tests for CompetitionImpactPanel Component
 *
 * Testing Sprint - Story 6-6: Epigenetic Trait System
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Overall impact summary display
 * - Total impact calculation and display
 * - Best disciplines display
 * - Discipline-by-discipline breakdown
 * - Impact bars (positive, negative, neutral)
 * - Synergy bonuses display
 * - Synergy requirements and bonus disciplines
 * - Props handling (showSynergies)
 * - Integration with trait helper functions
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompetitionImpactPanel from '../CompetitionImpactPanel';
import type { EpigeneticTrait, CompetitionImpact, SynergyBonus } from '@/types/traits';

// Mock the traits type helpers
vi.mock('@/types/traits', async () => {
  const actual = await vi.importActual('@/types/traits');
  return {
    ...actual,
    getImpactColor: vi.fn((modifier: number) => {
      if (modifier > 0) return 'text-green-600';
      if (modifier < 0) return 'text-red-600';
      return 'text-slate-400';
    }),
    formatImpactModifier: vi.fn((modifier: number) => {
      if (modifier === 0) return '0';
      return modifier > 0 ? `+${modifier}` : `${modifier}`;
    }),
    calculateTotalImpact: vi.fn((impact: CompetitionImpact) => {
      return (
        impact.dressage +
        impact.show_jumping +
        impact.cross_country +
        impact.endurance +
        impact.racing +
        impact.western
      );
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

describe('CompetitionImpactPanel Component', () => {
  const baseImpact: CompetitionImpact = {
    dressage: 0,
    show_jumping: 0,
    cross_country: 0,
    endurance: 0,
    racing: 0,
    western: 0,
  };

  const baseTrait: EpigeneticTrait = {
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

  describe('overall impact summary', () => {
    it('should display competition impact header', () => {
      render(<CompetitionImpactPanel trait={baseTrait} />);
      expect(screen.getByText('Competition Impact')).toBeInTheDocument();
      expect(
        screen.getByText(/How this trait affects performance across disciplines/i)
      ).toBeInTheDocument();
    });

    it('should display total impact label', () => {
      render(<CompetitionImpactPanel trait={baseTrait} />);
      expect(screen.getByText('Total Impact')).toBeInTheDocument();
    });

    it('should display trophy icon', () => {
      const { container } = render(<CompetitionImpactPanel trait={baseTrait} />);
      expect(container.querySelector('.text-slate-600')).toBeInTheDocument();
    });
  });

  describe('total impact calculation', () => {
    it('should display zero total impact', () => {
      render(<CompetitionImpactPanel trait={baseTrait} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should display positive total impact', () => {
      const positiveTrait: EpigeneticTrait = {
        ...baseTrait,
        competitionImpact: {
          ...baseImpact,
          dressage: 5,
          racing: 3,
          endurance: 2,
        },
      };
      render(<CompetitionImpactPanel trait={positiveTrait} />);
      expect(screen.getByText('+10')).toBeInTheDocument();
    });

    it('should display negative total impact', () => {
      const negativeTrait: EpigeneticTrait = {
        ...baseTrait,
        competitionImpact: {
          ...baseImpact,
          dressage: -3,
          racing: -2,
        },
        isPositive: false,
      };
      render(<CompetitionImpactPanel trait={negativeTrait} />);
      expect(screen.getByText('-5')).toBeInTheDocument();
    });

    it('should display mixed impact (net positive)', () => {
      const mixedTrait: EpigeneticTrait = {
        ...baseTrait,
        competitionImpact: {
          ...baseImpact,
          dressage: 7,
          racing: -2,
        },
      };
      render(<CompetitionImpactPanel trait={mixedTrait} />);
      expect(screen.getByText('+5')).toBeInTheDocument();
    });
  });

  describe('best disciplines display', () => {
    it('should display best disciplines section when positive impacts exist', () => {
      const trait: EpigeneticTrait = {
        ...baseTrait,
        competitionImpact: {
          ...baseImpact,
          dressage: 5,
          racing: 3,
        },
      };
      render(<CompetitionImpactPanel trait={trait} />);
      expect(screen.getByText('🏆 Best For:')).toBeInTheDocument();
      expect(screen.getByText('Dressage')).toBeInTheDocument();
      expect(screen.getByText('Racing')).toBeInTheDocument();
    });

    it('should not display best disciplines when no positive impacts', () => {
      const trait: EpigeneticTrait = {
        ...baseTrait,
        competitionImpact: baseImpact,
      };
      render(<CompetitionImpactPanel trait={trait} />);
      expect(screen.queryByText('🏆 Best For:')).not.toBeInTheDocument();
    });

    it('should display top 3 disciplines only', () => {
      const trait: EpigeneticTrait = {
        ...baseTrait,
        competitionImpact: {
          dressage: 8,
          show_jumping: 6,
          cross_country: 4,
          endurance: 2,
          racing: 1,
          western: 1,
        },
      };
      render(<CompetitionImpactPanel trait={trait} />);
      // Should show top 3: Dressage, Show Jumping, Cross Country
      expect(screen.getByText('Dressage')).toBeInTheDocument();
      expect(screen.getByText('Show Jumping')).toBeInTheDocument();
      expect(screen.getByText('Cross Country')).toBeInTheDocument();
    });
  });

  describe('discipline breakdown', () => {
    it('should display all 6 disciplines', () => {
      render(<CompetitionImpactPanel trait={baseTrait} />);
      expect(screen.getByText('Dressage')).toBeInTheDocument();
      expect(screen.getByText('Show Jumping')).toBeInTheDocument();
      expect(screen.getByText('Cross Country')).toBeInTheDocument();
      expect(screen.getByText('Endurance')).toBeInTheDocument();
      expect(screen.getByText('Racing')).toBeInTheDocument();
      expect(screen.getByText('Western')).toBeInTheDocument();
    });

    it('should display discipline breakdown header', () => {
      render(<CompetitionImpactPanel trait={baseTrait} />);
      expect(screen.getByText('Discipline Impact Breakdown')).toBeInTheDocument();
    });

    it('should display positive impact modifiers', () => {
      const trait: EpigeneticTrait = {
        ...baseTrait,
        competitionImpact: {
          dressage: 5,
          show_jumping: 0,
          cross_country: 0,
          endurance: 0,
          racing: 0,
          western: 0,
        },
      };
      render(<CompetitionImpactPanel trait={trait} />);
      const positiveModifiers = screen.getAllByText('+5');
      expect(positiveModifiers.length).toBeGreaterThan(0);
    });

    it('should display negative impact modifiers', () => {
      const trait: EpigeneticTrait = {
        ...baseTrait,
        competitionImpact: {
          dressage: -3,
          show_jumping: 0,
          cross_country: 0,
          endurance: 0,
          racing: 0,
          western: 0,
        },
        isPositive: false,
      };
      render(<CompetitionImpactPanel trait={trait} />);
      const negativeModifiers = screen.getAllByText('-3');
      expect(negativeModifiers.length).toBeGreaterThan(0);
    });
  });

  describe('impact bars visualization', () => {
    it('should render impact bars for all disciplines', () => {
      const { container } = render(<CompetitionImpactPanel trait={baseTrait} />);
      // Check for progress bar containers
      const progressBars = container.querySelectorAll('.bg-slate-100.rounded-full');
      expect(progressBars.length).toBe(6); // One for each discipline
    });

    it('should show center line in impact bars', () => {
      const { container } = render(<CompetitionImpactPanel trait={baseTrait} />);
      // Check for center line
      const centerLines = container.querySelectorAll('.left-1\\/2.bg-slate-300');
      expect(centerLines.length).toBe(6);
    });

    it('should apply green gradient for positive impacts', () => {
      const trait: EpigeneticTrait = {
        ...baseTrait,
        competitionImpact: {
          ...baseImpact,
          dressage: 5,
        },
      };
      const { container } = render(<CompetitionImpactPanel trait={trait} />);
      expect(container.querySelector('.from-green-400.to-green-500')).toBeInTheDocument();
    });

    it('should apply red gradient for negative impacts', () => {
      const trait: EpigeneticTrait = {
        ...baseTrait,
        competitionImpact: {
          ...baseImpact,
          dressage: -3,
        },
        isPositive: false,
      };
      const { container } = render(<CompetitionImpactPanel trait={trait} />);
      expect(container.querySelector('.from-red-400.to-red-500')).toBeInTheDocument();
    });
  });

  describe('synergy bonuses display', () => {
    const synergyBonus: SynergyBonus = {
      requiredTraitIds: ['trait-a', 'trait-b'],
      bonusDisciplines: ['dressage', 'show_jumping'],
      bonusAmount: 3,
      description: 'Enhanced performance when combined with complementary traits',
    };

    const traitWithSynergy: EpigeneticTrait = {
      ...baseTrait,
      competitionImpact: {
        ...baseImpact,
        dressage: 5,
        synergyBonuses: [synergyBonus],
      },
    };

    it('should display synergy bonuses section when showSynergies is true', () => {
      render(<CompetitionImpactPanel trait={traitWithSynergy} showSynergies={true} />);
      expect(screen.getByText('Synergy Bonuses')).toBeInTheDocument();
      expect(
        screen.getByText(/Additional bonuses when combined with other traits/i)
      ).toBeInTheDocument();
    });

    it('should hide synergy bonuses when showSynergies is false', () => {
      render(<CompetitionImpactPanel trait={traitWithSynergy} showSynergies={false} />);
      expect(screen.queryByText('Synergy Bonuses')).not.toBeInTheDocument();
    });

    it('should not display synergy section when no synergies exist', () => {
      render(<CompetitionImpactPanel trait={baseTrait} showSynergies={true} />);
      expect(screen.queryByText('Synergy Bonuses')).not.toBeInTheDocument();
    });

    it('should display synergy description', () => {
      render(<CompetitionImpactPanel trait={traitWithSynergy} />);
      expect(screen.getByText(/Enhanced performance when combined/i)).toBeInTheDocument();
    });

    it('should display required traits', () => {
      render(<CompetitionImpactPanel trait={traitWithSynergy} />);
      expect(screen.getByText('Requires:')).toBeInTheDocument();
      expect(screen.getByText('trait-a')).toBeInTheDocument();
      expect(screen.getByText('trait-b')).toBeInTheDocument();
    });

    it('should display bonus disciplines', () => {
      render(<CompetitionImpactPanel trait={traitWithSynergy} />);
      expect(screen.getByText('Bonus:')).toBeInTheDocument();
      expect(screen.getByText('dressage')).toBeInTheDocument();
      expect(screen.getByText('show jumping')).toBeInTheDocument();
    });

    it('should display bonus amount', () => {
      render(<CompetitionImpactPanel trait={traitWithSynergy} />);
      const bonusAmounts = screen.getAllByText('+3');
      expect(bonusAmounts.length).toBeGreaterThan(0);
    });

    it('should display multiple synergies', () => {
      const multipleSynergies: EpigeneticTrait = {
        ...baseTrait,
        competitionImpact: {
          ...baseImpact,
          synergyBonuses: [
            synergyBonus,
            {
              requiredTraitIds: ['trait-c'],
              bonusDisciplines: ['racing'],
              bonusAmount: 5,
              description: 'Speed synergy bonus',
            },
          ],
        },
      };
      render(<CompetitionImpactPanel trait={multipleSynergies} />);
      expect(screen.getByText(/Enhanced performance when combined/i)).toBeInTheDocument();
      expect(screen.getByText(/Speed synergy bonus/i)).toBeInTheDocument();
    });

    it('should show Zap icon for synergies', () => {
      const { container } = render(<CompetitionImpactPanel trait={traitWithSynergy} />);
      expect(container.querySelector('.text-purple-600')).toBeInTheDocument();
    });
  });

  describe('impact explanation note', () => {
    it('should display impact explanation', () => {
      render(<CompetitionImpactPanel trait={baseTrait} />);
      expect(screen.getByText('Note:')).toBeInTheDocument();
      expect(
        screen.getByText(/Impact modifiers are applied directly to competition scores/i)
      ).toBeInTheDocument();
    });

    it('should explain positive and negative modifiers', () => {
      render(<CompetitionImpactPanel trait={baseTrait} />);
      expect(screen.getByText(/Positive modifiers increase performance/i)).toBeInTheDocument();
      expect(screen.getByText(/negative modifiers decrease it/i)).toBeInTheDocument();
    });

    it('should explain synergy activation', () => {
      render(<CompetitionImpactPanel trait={baseTrait} />);
      expect(
        screen.getByText(/Synergy bonuses activate when the required trait combinations/i)
      ).toBeInTheDocument();
    });
  });

  describe('styling and layout', () => {
    it('should apply gradient background to summary section', () => {
      const { container } = render(<CompetitionImpactPanel trait={baseTrait} />);
      expect(
        container.querySelector('.bg-gradient-to-br.from-slate-50.to-gray-50')
      ).toBeInTheDocument();
    });

    it('should apply green background to best disciplines section', () => {
      const trait: EpigeneticTrait = {
        ...baseTrait,
        competitionImpact: {
          ...baseImpact,
          dressage: 5,
        },
      };
      const { container } = render(<CompetitionImpactPanel trait={trait} />);
      expect(container.querySelector('.bg-green-50')).toBeInTheDocument();
    });

    it('should apply purple gradient to synergy section', () => {
      const traitWithSynergy: EpigeneticTrait = {
        ...baseTrait,
        competitionImpact: {
          ...baseImpact,
          synergyBonuses: [
            {
              requiredTraitIds: ['test'],
              bonusDisciplines: ['dressage'],
              bonusAmount: 3,
              description: 'Test synergy',
            },
          ],
        },
      };
      const { container } = render(<CompetitionImpactPanel trait={traitWithSynergy} />);
      expect(
        container.querySelector('.bg-gradient-to-br.from-purple-50.to-pink-50')
      ).toBeInTheDocument();
    });

    it('should apply blue background to explanation note', () => {
      const { container } = render(<CompetitionImpactPanel trait={baseTrait} />);
      expect(container.querySelector('.bg-blue-50')).toBeInTheDocument();
    });
  });

  describe('props handling', () => {
    it('should show synergies by default', () => {
      const traitWithSynergy: EpigeneticTrait = {
        ...baseTrait,
        competitionImpact: {
          ...baseImpact,
          synergyBonuses: [
            {
              requiredTraitIds: ['test'],
              bonusDisciplines: ['dressage'],
              bonusAmount: 3,
              description: 'Test synergy',
            },
          ],
        },
      };
      render(<CompetitionImpactPanel trait={traitWithSynergy} />);
      expect(screen.getByText('Synergy Bonuses')).toBeInTheDocument();
    });

    it('should respect showSynergies prop', () => {
      const traitWithSynergy: EpigeneticTrait = {
        ...baseTrait,
        competitionImpact: {
          ...baseImpact,
          synergyBonuses: [
            {
              requiredTraitIds: ['test'],
              bonusDisciplines: ['dressage'],
              bonusAmount: 3,
              description: 'Test synergy',
            },
          ],
        },
      };
      const { rerender } = render(
        <CompetitionImpactPanel trait={traitWithSynergy} showSynergies={true} />
      );
      expect(screen.getByText('Synergy Bonuses')).toBeInTheDocument();

      rerender(<CompetitionImpactPanel trait={traitWithSynergy} showSynergies={false} />);
      expect(screen.queryByText('Synergy Bonuses')).not.toBeInTheDocument();
    });
  });
});
