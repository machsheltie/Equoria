/**
 * Tests for UltraRareTraitPanel Component
 *
 * Testing Sprint - Story 6-5: Breeding Predictions
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Empty state when no traits
 * - Trait cards rendering
 * - Tier styling (exotic Crown vs ultra-rare Sparkles)
 * - Probability display and color coding
 * - Description display
 * - Probability bar visualization with gradients
 * - Requirements list
 * - Achievability status (CheckCircle/AlertCircle, text variations)
 * - Groom influence section (conditional)
 * - Decorative shine effect
 * - Multiple traits rendering
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UltraRareTraitPanel from '../UltraRareTraitPanel';
import type { UltraRareTraitPotential } from '@/types/breeding';

// Mock breeding helpers
vi.mock('@/types/breeding', async () => {
  const actual = await vi.importActual('@/types/breeding');
  return {
    ...actual,
    formatProbability: (prob: number) => `${prob}%`,
    getProbabilityColor: (prob: number) => {
      if (prob >= 60) return 'bg-[var(--role-success-bg)] text-[var(--role-success-text)]';
      if (prob >= 40) return 'bg-[var(--role-info-bg)] text-[var(--role-info-text)]';
      if (prob >= 20) return 'bg-[var(--role-warning-bg)] text-[var(--role-warning-text)]';
      return 'bg-[var(--badge-gold-bg)] text-[var(--gold-primary)]';
    },
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Crown: () => <svg data-testid="crown-icon" />,
  Sparkles: () => <svg data-testid="sparkles-icon" />,
  CheckCircle: () => <svg data-testid="check-circle-icon" />,
  AlertCircle: () => <svg data-testid="alert-circle-icon" />,
  User: () => <svg data-testid="user-icon" />,
}));

describe('UltraRareTraitPanel Component', () => {
  const mockExoticTrait: UltraRareTraitPotential = {
    traitId: 'phoenix-heart',
    traitName: 'Phoenix Heart',
    tier: 'exotic',
    description: 'Legendary resilience and endurance beyond normal limits',
    baseProbability: 45,
    requirements: [
      'Both parents must have Champion lineage',
      'Combined parent level >= 40',
      'Perfect genetic diversity score',
    ],
    isAchievable: true,
    groomInfluence: {
      groomType: 'Elite',
      bonusPercentage: 15,
    },
  };

  const mockUltraRareTrait: UltraRareTraitPotential = {
    traitId: 'diamond-hooves',
    traitName: 'Diamond Hooves',
    tier: 'ultra-rare',
    description: 'Exceptional durability and ground contact precision',
    baseProbability: 25,
    requirements: ['Sire must have Strong Legs trait', 'Dam must have Steady Gait trait'],
    isAchievable: false,
  };

  describe('empty state', () => {
    it('should display empty state when no traits provided', () => {
      render(<UltraRareTraitPanel traits={[]} />);
      expect(screen.getByText('No ultra-rare trait potential detected')).toBeInTheDocument();
    });

    it('should display Sparkles icon in empty state', () => {
      render(<UltraRareTraitPanel traits={[]} />);
      expect(screen.getByTestId('sparkles-icon')).toBeInTheDocument();
    });

    it('should display explanatory message in empty state', () => {
      render(<UltraRareTraitPanel traits={[]} />);
      expect(
        screen.getByText(/Ultra-rare traits require specific parent combinations/)
      ).toBeInTheDocument();
    });

    it('should not display empty state when traits are provided', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(screen.queryByText('No ultra-rare trait potential detected')).not.toBeInTheDocument();
    });
  });

  describe('exotic tier traits', () => {
    it('should display Crown icon for exotic tier', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(screen.getByTestId('crown-icon')).toBeInTheDocument();
    });

    it('should display trait name', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(screen.getByText('Phoenix Heart')).toBeInTheDocument();
    });

    it('should display "Exotic" badge', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(screen.getByText('👑 Exotic')).toBeInTheDocument();
    });

    it('should apply purple border for exotic tier', () => {
      const { container } = render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      // Migrated to purple-500/40 alpha border
      const card = container.querySelector('.border-\\[var\\(--badge-rare-bg\\)\\]');
      expect(card).toBeInTheDocument();
    });

    it('should apply purple/pink gradient background for exotic tier', () => {
      const { container } = render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      // Migrated to badge-rare-bg token (design-system sweep)
      const card = container.querySelector('.bg-\\[var\\(--badge-rare-bg\\)\\]');
      expect(card).toBeInTheDocument();
    });

    it('should apply purple text color for exotic tier', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      const tierText = screen.getByText('Phoenix Heart');
      // Dark theme: purple-700 -> purple-400
      expect(tierText).toHaveClass('text-[var(--status-rare)]');
    });
  });

  describe('ultra-rare tier traits', () => {
    it('should display Sparkles icon for ultra-rare tier', () => {
      render(<UltraRareTraitPanel traits={[mockUltraRareTrait]} />);
      // Note: Sparkles appears in empty state too, so verify it's in the card context
      const sparklesIcons = screen.getAllByTestId('sparkles-icon');
      expect(sparklesIcons.length).toBeGreaterThan(0);
    });

    it('should display "Ultra-Rare" badge', () => {
      render(<UltraRareTraitPanel traits={[mockUltraRareTrait]} />);
      expect(screen.getByText('✨ Ultra-Rare')).toBeInTheDocument();
    });

    it('should apply amber border for ultra-rare tier', () => {
      const { container } = render(<UltraRareTraitPanel traits={[mockUltraRareTrait]} />);
      // Migrated to amber-500/40 alpha border
      const card = container.querySelector('.border-\\[var\\(--role-warning-border\\)\\]');
      expect(card).toBeInTheDocument();
    });

    it('should apply amber/yellow gradient background for ultra-rare tier', () => {
      const { container } = render(<UltraRareTraitPanel traits={[mockUltraRareTrait]} />);
      // Migrated to role-warning-bg token (design-system sweep)
      const card = container.querySelector('.bg-\\[var\\(--role-warning-bg\\)\\]');
      expect(card).toBeInTheDocument();
    });

    it('should apply amber text color for ultra-rare tier', () => {
      render(<UltraRareTraitPanel traits={[mockUltraRareTrait]} />);
      const tierText = screen.getByText('Diamond Hooves');
      // Dark theme: amber-700 -> amber-400
      expect(tierText).toHaveClass('text-[var(--role-warning-text)]');
    });
  });

  describe('probability display', () => {
    it('should display "Potential" label', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(screen.getByText('Potential')).toBeInTheDocument();
    });

    it('should display formatted probability percentage', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(screen.getByText('45%')).toBeInTheDocument();
    });

    it('should apply green color for probability >= 60%', () => {
      const highProbTrait = { ...mockExoticTrait, baseProbability: 65 };
      render(<UltraRareTraitPanel traits={[highProbTrait]} />);
      const probContainer = screen.getByText('65%').parentElement;
      expect(probContainer).toHaveClass('bg-[var(--role-success-bg)]');
      expect(probContainer).toHaveClass('text-[var(--role-success-text)]');
    });

    it('should apply blue color for probability 40-59%', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      const probContainer = screen.getByText('45%').parentElement;
      expect(probContainer).toHaveClass('bg-[var(--role-info-bg)]');
      expect(probContainer).toHaveClass('text-[var(--role-info-text)]');
    });

    it('should apply yellow color for probability 20-39%', () => {
      render(<UltraRareTraitPanel traits={[mockUltraRareTrait]} />);
      const probContainer = screen.getByText('25%').parentElement;
      expect(probContainer).toHaveClass('bg-[var(--role-warning-bg)]');
      expect(probContainer).toHaveClass('text-[var(--role-warning-text)]');
    });

    it('should apply amber color for probability < 20%', () => {
      const lowProbTrait = { ...mockExoticTrait, baseProbability: 15 };
      render(<UltraRareTraitPanel traits={[lowProbTrait]} />);
      const probContainer = screen.getByText('15%').parentElement;
      expect(probContainer).toHaveClass('bg-[var(--badge-gold-bg)]');
      expect(probContainer).toHaveClass('text-[var(--gold-primary)]');
    });
  });

  describe('description', () => {
    it('should display trait description', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(
        screen.getByText('Legendary resilience and endurance beyond normal limits')
      ).toBeInTheDocument();
    });

    it('should handle long descriptions', () => {
      const longDescTrait = {
        ...mockExoticTrait,
        description:
          'This is a very long description that describes the trait in great detail and should wrap properly without breaking the layout or causing any visual issues in the component rendering',
      };

      render(<UltraRareTraitPanel traits={[longDescTrait]} />);
      expect(screen.getByText(/This is a very long description/)).toBeInTheDocument();
    });
  });

  describe('probability bar', () => {
    it('should render probability bar', () => {
      const { container } = render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      const progressBar = container.querySelector('.h-full.transition-all');
      expect(progressBar).toBeInTheDocument();
    });

    it('should set bar width to probability percentage', () => {
      const { container } = render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      const progressBar = container.querySelector('.h-full.transition-all') as HTMLElement;
      expect(progressBar.style.width).toBe('45%');
    });

    it('should use green gradient for probability >= 60%', () => {
      const highProbTrait = { ...mockExoticTrait, baseProbability: 65 };
      const { container } = render(<UltraRareTraitPanel traits={[highProbTrait]} />);
      const progressBar = container.querySelector('.bg-\\[var\\(--status-success\\)\\]');
      expect(progressBar).toBeInTheDocument();
    });

    it('should use blue gradient for probability 40-59%', () => {
      const { container } = render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      const progressBar = container.querySelector('.bg-\\[var\\(--status-info\\)\\]');
      expect(progressBar).toBeInTheDocument();
    });

    it('should use yellow gradient for probability 20-39%', () => {
      const { container } = render(<UltraRareTraitPanel traits={[mockUltraRareTrait]} />);
      const progressBar = container.querySelector('.bg-\\[var\\(--status-warning\\)\\]');
      expect(progressBar).toBeInTheDocument();
    });

    it('should use amber gradient for probability < 20%', () => {
      const lowProbTrait = { ...mockExoticTrait, baseProbability: 15 };
      const { container } = render(<UltraRareTraitPanel traits={[lowProbTrait]} />);
      const progressBar = container.querySelector('.bg-\\[var\\(--gold-dim\\)\\]');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('requirements', () => {
    it('should display "Requirements:" header', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(screen.getByText('Requirements:')).toBeInTheDocument();
    });

    it('should display all requirement items', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(screen.getByText('Both parents must have Champion lineage')).toBeInTheDocument();
      expect(screen.getByText('Combined parent level >= 40')).toBeInTheDocument();
      expect(screen.getByText('Perfect genetic diversity score')).toBeInTheDocument();
    });

    it('should handle single requirement', () => {
      const singleReqTrait = {
        ...mockExoticTrait,
        requirements: ['Single requirement only'],
      };

      render(<UltraRareTraitPanel traits={[singleReqTrait]} />);
      expect(screen.getByText('Single requirement only')).toBeInTheDocument();
    });

    it('should handle many requirements', () => {
      const manyReqTrait = {
        ...mockExoticTrait,
        requirements: ['Req 1', 'Req 2', 'Req 3', 'Req 4', 'Req 5'],
      };

      render(<UltraRareTraitPanel traits={[manyReqTrait]} />);
      expect(screen.getByText('Req 1')).toBeInTheDocument();
      expect(screen.getByText('Req 5')).toBeInTheDocument();
    });
  });

  describe('achievability status', () => {
    it('should display CheckCircle icon when achievable', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    });

    it('should display AlertCircle icon when not achievable', () => {
      render(<UltraRareTraitPanel traits={[mockUltraRareTrait]} />);
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
    });

    it('should display "Status:" label', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(screen.getByText('Status:')).toBeInTheDocument();
    });

    it('should display "Achievable with perfect care" when isAchievable is true', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(screen.getByText('✅ Achievable with perfect care')).toBeInTheDocument();
    });

    it('should display "Requires specific care pattern" when isAchievable is false', () => {
      render(<UltraRareTraitPanel traits={[mockUltraRareTrait]} />);
      expect(screen.getByText('⚠️ Requires specific care pattern')).toBeInTheDocument();
    });

    it('should apply green border/bg when achievable', () => {
      const { container } = render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      // Migrated to emerald-500/30 border
      const statusSection = container.querySelector('.border-\\[var\\(--role-success-border\\)\\]');
      expect(statusSection).toBeInTheDocument();
    });

    it('should apply amber border/bg when not achievable', () => {
      const { container } = render(<UltraRareTraitPanel traits={[mockUltraRareTrait]} />);
      // Migrated to amber-500/30 border
      const statusSection = container.querySelector('.border-\\[var\\(--role-warning-border\\)\\]');
      expect(statusSection).toBeInTheDocument();
    });
  });

  describe('groom influence', () => {
    it('should display User icon when groom influence present', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(screen.getByTestId('user-icon')).toBeInTheDocument();
    });

    it('should display "Groom Bonus:" label', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(screen.getByText('Groom Bonus:')).toBeInTheDocument();
    });

    it('should display groom type', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(screen.getByText(/Elite/)).toBeInTheDocument();
    });

    it('should display bonus percentage', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      expect(screen.getByText(/\+15%/)).toBeInTheDocument();
    });

    it('should not display groom section when groomInfluence is undefined', () => {
      render(<UltraRareTraitPanel traits={[mockUltraRareTrait]} />);
      expect(screen.queryByText('Groom Bonus:')).not.toBeInTheDocument();
    });

    it('should apply blue border/bg to groom section', () => {
      const { container } = render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      // Migrated to blue-500/30 border
      const groomSection = container.querySelector('.border-\\[var\\(--role-info-border\\)\\]');
      expect(groomSection).toBeInTheDocument();
    });
  });

  describe('decorative effects', () => {
    it('should render shine effect', () => {
      const { container } = render(<UltraRareTraitPanel traits={[mockExoticTrait]} />);
      // Migrated bg-white/20 -> bg-white/10 (lower opacity for dark theme)
      const shineEffect = container.querySelector('.bg-white\\/10.rounded-full.blur-3xl');
      expect(shineEffect).toBeInTheDocument();
    });
  });

  describe('multiple traits', () => {
    it('should render multiple trait cards', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait, mockUltraRareTrait]} />);
      expect(screen.getByText('Phoenix Heart')).toBeInTheDocument();
      expect(screen.getByText('Diamond Hooves')).toBeInTheDocument();
    });

    it('should display both exotic and ultra-rare badges', () => {
      render(<UltraRareTraitPanel traits={[mockExoticTrait, mockUltraRareTrait]} />);
      expect(screen.getByText('👑 Exotic')).toBeInTheDocument();
      expect(screen.getByText('✨ Ultra-Rare')).toBeInTheDocument();
    });

    it('should apply different tier styles to each card', () => {
      const { container } = render(
        <UltraRareTraitPanel traits={[mockExoticTrait, mockUltraRareTrait]} />
      );
      // Migrated to alpha-channel borders
      expect(container.querySelector('.border-\\[var\\(--badge-rare-bg\\)\\]')).toBeInTheDocument();
      // Migrated to amber-500/40 for ultra-rare cards
      expect(
        container.querySelector('.border-\\[var\\(--role-warning-border\\)\\]')
      ).toBeInTheDocument();
    });

    it('should render 3+ traits correctly', () => {
      const trait3: UltraRareTraitPotential = {
        traitId: 'third-trait',
        traitName: 'Third Trait',
        tier: 'exotic',
        description: 'Third trait description',
        baseProbability: 30,
        requirements: ['Requirement'],
        isAchievable: true,
      };

      render(<UltraRareTraitPanel traits={[mockExoticTrait, mockUltraRareTrait, trait3]} />);

      expect(screen.getByText('Phoenix Heart')).toBeInTheDocument();
      expect(screen.getByText('Diamond Hooves')).toBeInTheDocument();
      expect(screen.getByText('Third Trait')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle probability of 0%', () => {
      const zeroProbTrait = { ...mockExoticTrait, baseProbability: 0 };
      render(<UltraRareTraitPanel traits={[zeroProbTrait]} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle probability of 100%', () => {
      const fullProbTrait = { ...mockExoticTrait, baseProbability: 100 };
      render(<UltraRareTraitPanel traits={[fullProbTrait]} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should handle empty requirements array', () => {
      const noReqsTrait = { ...mockExoticTrait, requirements: [] };
      render(<UltraRareTraitPanel traits={[noReqsTrait]} />);
      expect(screen.getByText('Requirements:')).toBeInTheDocument();
      // Should still render the section header even with no items
    });

    it('should handle very long trait names', () => {
      const longNameTrait = {
        ...mockExoticTrait,
        traitName: 'This Is A Very Long Trait Name That Should Still Display Correctly',
      };

      render(<UltraRareTraitPanel traits={[longNameTrait]} />);
      expect(
        screen.getByText('This Is A Very Long Trait Name That Should Still Display Correctly')
      ).toBeInTheDocument();
    });

    it('should handle groom bonus of 0%', () => {
      const zeroGroomTrait = {
        ...mockExoticTrait,
        groomInfluence: {
          groomType: 'Basic',
          bonusPercentage: 0,
        },
      };

      render(<UltraRareTraitPanel traits={[zeroGroomTrait]} />);
      expect(screen.getByText(/\+0%/)).toBeInTheDocument();
    });
  });
});
