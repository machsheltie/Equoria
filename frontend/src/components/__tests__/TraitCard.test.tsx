import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TraitCard, TraitCardProps } from '../TraitCard';

describe('TraitCard', () => {
  // Mock data for tests
  const mockGeneticTrait: TraitCardProps['trait'] = {
    name: 'Speed Boost',
    type: 'genetic',
    description: 'Increases base speed by 10 points',
    source: 'sire',
    rarity: 'common',
    strength: 75,
    impact: {
      stats: { speed: 10 },
      disciplines: { racing: 5 },
    },
  };

  const mockEpigeneticTrait: TraitCardProps['trait'] = {
    name: 'Endurance Master',
    type: 'epigenetic',
    description: 'Improves stamina recovery rate',
    discoveryDate: '2025-01-15',
    isActive: true,
    rarity: 'rare',
    strength: 85,
    impact: {
      stats: { stamina: 15 },
      disciplines: { endurance: 10 },
    },
  };

  const mockLegendaryTrait: TraitCardProps['trait'] = {
    name: 'Divine Grace',
    type: 'genetic',
    description: 'Legendary trait that enhances all attributes',
    source: 'mutation',
    rarity: 'legendary',
    strength: 95,
    impact: {
      stats: { speed: 20, stamina: 20, agility: 20 },
      disciplines: { racing: 15, endurance: 15, jumping: 15 },
    },
  };

  describe('Rendering', () => {
    it('should render trait name', () => {
      render(<TraitCard trait={mockGeneticTrait} />);
      expect(screen.getByText('Speed Boost')).toBeInTheDocument();
    });

    it('should render genetic type badge', () => {
      render(<TraitCard trait={mockGeneticTrait} />);
      expect(screen.getByText('Genetic')).toBeInTheDocument();
    });

    it('should render epigenetic type badge', () => {
      render(<TraitCard trait={mockEpigeneticTrait} />);
      expect(screen.getByText('Epigenetic')).toBeInTheDocument();
    });

    it('should render rarity badge', () => {
      render(<TraitCard trait={mockGeneticTrait} />);
      expect(screen.getByText('Common')).toBeInTheDocument();
    });

    it('should render strength meter with correct value', () => {
      render(<TraitCard trait={mockGeneticTrait} />);
      expect(screen.getByText(/High \(75\)/)).toBeInTheDocument();
    });

    it('should render info icon when showTooltip is true', () => {
      const { container } = render(<TraitCard trait={mockGeneticTrait} showTooltip={true} />);
      const infoIcon = container.querySelector('svg');
      expect(infoIcon).toBeInTheDocument();
    });

    it('should not render info icon when showTooltip is false', () => {
      const { container } = render(<TraitCard trait={mockGeneticTrait} showTooltip={false} />);
      const icons = container.querySelectorAll('svg');
      // Should only have TrendingUp icon for strength meter, not Info icon
      expect(icons.length).toBeLessThan(2);
    });
  });

  describe('Strength Indicators', () => {
    it('should show "Exceptional" for strength >= 76', () => {
      const trait = { ...mockGeneticTrait, strength: 90 };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText(/Exceptional \(90\)/)).toBeInTheDocument();
    });

    it('should show "High" for strength 51-75', () => {
      const trait = { ...mockGeneticTrait, strength: 65 };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText(/High \(65\)/)).toBeInTheDocument();
    });

    it('should show "Medium" for strength 26-50', () => {
      const trait = { ...mockGeneticTrait, strength: 40 };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText(/Medium \(40\)/)).toBeInTheDocument();
    });

    it('should show "Low" for strength 0-25', () => {
      const trait = { ...mockGeneticTrait, strength: 20 };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText(/Low \(20\)/)).toBeInTheDocument();
    });

    it('should render strength meter with correct width', () => {
      const { container } = render(<TraitCard trait={mockGeneticTrait} />);
      const strengthBar = container.querySelector('div[style*="width: 75%"]');
      expect(strengthBar).toBeInTheDocument();
    });
  });

  describe('Source/Inheritance', () => {
    it('should display sire source badge', () => {
      const trait = { ...mockGeneticTrait, source: 'sire' as const };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText('From Sire')).toBeInTheDocument();
      expect(screen.getByText('♂️')).toBeInTheDocument();
    });

    it('should display dam source badge', () => {
      const trait = { ...mockGeneticTrait, source: 'dam' as const };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText('From Dam')).toBeInTheDocument();
      expect(screen.getByText('♀️')).toBeInTheDocument();
    });

    it('should display mutation source badge', () => {
      const trait = { ...mockGeneticTrait, source: 'mutation' as const };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText('Mutation')).toBeInTheDocument();
      expect(screen.getByText('✨')).toBeInTheDocument();
    });

    it('should not display source badge when source is undefined', () => {
      const trait = { ...mockGeneticTrait, source: undefined };
      render(<TraitCard trait={trait} />);
      expect(screen.queryByText('From Sire')).not.toBeInTheDocument();
      expect(screen.queryByText('From Dam')).not.toBeInTheDocument();
      expect(screen.queryByText('Mutation')).not.toBeInTheDocument();
    });
  });

  describe('Epigenetic Traits', () => {
    it('should display discovery date for epigenetic traits', () => {
      render(<TraitCard trait={mockEpigeneticTrait} />);
      expect(screen.getByText(/Discovered:/)).toBeInTheDocument();
      // Equoria-2dnd2: discovery date now renders through the shared formatDate
      // util (canonical "Mon D, YYYY" format, e.g. "Jan 15, 2025"), replacing the
      // bare locale-default numeric "1/15/2025". Assert a real date appears (not
      // the literal "Invalid Date") — the original intent of this check.
      expect(screen.getByText(/Discovered: \w{3} \d{1,2}, \d{4}/)).toBeInTheDocument();
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
    });

    it('should not display discovery date for genetic traits', () => {
      render(<TraitCard trait={mockGeneticTrait} />);
      expect(screen.queryByText(/Discovered:/)).not.toBeInTheDocument();
    });

    it('should display "Active" badge for active epigenetic traits', () => {
      render(<TraitCard trait={mockEpigeneticTrait} />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should display "Dormant" badge for inactive epigenetic traits', () => {
      const trait = { ...mockEpigeneticTrait, isActive: false };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText('Dormant')).toBeInTheDocument();
    });

    it('should not display active/dormant badge when isActive is undefined', () => {
      const trait = { ...mockEpigeneticTrait, isActive: undefined };
      render(<TraitCard trait={trait} />);
      expect(screen.queryByText('Active')).not.toBeInTheDocument();
      expect(screen.queryByText('Dormant')).not.toBeInTheDocument();
    });
  });

  describe('Rarity Indicators', () => {
    it('should display common rarity badge', () => {
      render(<TraitCard trait={mockGeneticTrait} />);
      expect(screen.getByText('Common')).toBeInTheDocument();
    });

    it('should display rare rarity badge', () => {
      const trait = { ...mockGeneticTrait, rarity: 'rare' as const };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText('Rare')).toBeInTheDocument();
    });

    it('should display legendary rarity badge with sparkle icon', () => {
      render(<TraitCard trait={mockLegendaryTrait} />);
      expect(screen.getByText('Legendary')).toBeInTheDocument();
      // Check for Sparkles icon next to name
      const { container } = render(<TraitCard trait={mockLegendaryTrait} />);
      const sparklesIcons = container.querySelectorAll('svg');
      expect(sparklesIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Tooltip Interaction', () => {
    it('should show tooltip on hover', () => {
      const { container } = render(<TraitCard trait={mockGeneticTrait} showTooltip={true} />);
      const card = container.firstChild as HTMLElement;

      // Tooltip should not be visible initially
      expect(screen.queryByText(mockGeneticTrait.description)).not.toBeInTheDocument();

      // Hover over card
      fireEvent.mouseEnter(card);

      // Tooltip should now be visible
      expect(screen.getByText(mockGeneticTrait.description)).toBeInTheDocument();
    });

    it('should hide tooltip on mouse leave', () => {
      const { container } = render(<TraitCard trait={mockGeneticTrait} showTooltip={true} />);
      const card = container.firstChild as HTMLElement;

      // Hover to show tooltip
      fireEvent.mouseEnter(card);
      expect(screen.getByText(mockGeneticTrait.description)).toBeInTheDocument();

      // Leave hover
      fireEvent.mouseLeave(card);

      // Tooltip should be hidden
      expect(screen.queryByText(mockGeneticTrait.description)).not.toBeInTheDocument();
    });

    it('should display stat impact in tooltip', () => {
      const { container } = render(<TraitCard trait={mockGeneticTrait} showTooltip={true} />);
      const card = container.firstChild as HTMLElement;

      fireEvent.mouseEnter(card);

      expect(screen.getByText('Stat Impact:')).toBeInTheDocument();
      expect(screen.getByText('speed:')).toBeInTheDocument();
      expect(screen.getByText('+10')).toBeInTheDocument();
    });

    it('should display discipline impact in tooltip', () => {
      const { container } = render(<TraitCard trait={mockGeneticTrait} showTooltip={true} />);
      const card = container.firstChild as HTMLElement;

      fireEvent.mouseEnter(card);

      expect(screen.getByText('Discipline Impact:')).toBeInTheDocument();
      expect(screen.getByText('racing:')).toBeInTheDocument();
      expect(screen.getByText('+5')).toBeInTheDocument();
    });

    it('should display legendary rarity info in tooltip', () => {
      const { container } = render(<TraitCard trait={mockLegendaryTrait} showTooltip={true} />);
      const card = container.firstChild as HTMLElement;

      fireEvent.mouseEnter(card);

      expect(screen.getByText(/Legendary Trait - Extremely Rare/)).toBeInTheDocument();
    });

    it('should not display tooltip when showTooltip is false', () => {
      const { container } = render(<TraitCard trait={mockGeneticTrait} showTooltip={false} />);
      const card = container.firstChild as HTMLElement;

      fireEvent.mouseEnter(card);

      // Tooltip should not appear
      expect(screen.queryByText(mockGeneticTrait.description)).not.toBeInTheDocument();
    });
  });

  describe('Color Coding', () => {
    it('should apply blue colors for genetic traits', () => {
      const { container } = render(<TraitCard trait={mockGeneticTrait} />);
      const card = container.firstChild as HTMLElement;

      expect(card.className).toContain('border-blue-500');
      // bg uses translucent rgba via Tailwind arbitrary value
      expect(card.className).toContain('bg-[rgba(37,99,235');
    });

    it('should apply purple colors for epigenetic traits', () => {
      // Use a common rarity epigenetic trait so colors aren't overridden by rare status
      const commonEpigeneticTrait = { ...mockEpigeneticTrait, rarity: 'common' as const };
      const { container } = render(<TraitCard trait={commonEpigeneticTrait} />);
      const card = container.firstChild as HTMLElement;

      expect(card.className).toContain('border-purple-500');
      // bg uses translucent rgba via Tailwind arbitrary value
      expect(card.className).toContain('bg-[rgba(147,51,234');
    });

    it('should apply gold colors for rare traits', () => {
      const trait = { ...mockGeneticTrait, rarity: 'rare' as const };
      const { container } = render(<TraitCard trait={trait} />);
      const card = container.firstChild as HTMLElement;

      expect(card.className).toContain('border-burnished-gold');
    });

    it('should apply gradient colors for legendary traits', () => {
      const { container } = render(<TraitCard trait={mockLegendaryTrait} />);
      const card = container.firstChild as HTMLElement;

      // Legendary uses bg-gradient-to-br + burnished-gold border (not border-gradient-to-r)
      expect(card.className).toContain('border-burnished-gold');
      expect(card.className).toContain('bg-gradient-to-br');
    });
  });

  describe('Hover Effects', () => {
    it('should apply scale effect on hover', () => {
      const { container } = render(<TraitCard trait={mockGeneticTrait} />);
      const card = container.firstChild as HTMLElement;

      // Initial state
      expect(card.className).toContain('shadow-sm');
      expect(card.className).not.toContain('scale-105');

      // Hover
      fireEvent.mouseEnter(card);

      expect(card.className).toContain('shadow-lg');
      expect(card.className).toContain('scale-105');

      // Leave hover
      fireEvent.mouseLeave(card);

      expect(card.className).toContain('shadow-sm');
      expect(card.className).not.toContain('scale-105');
    });
  });

  describe('Impact Display', () => {
    it('should handle multiple stat impacts', () => {
      const trait = {
        ...mockGeneticTrait,
        impact: {
          stats: { speed: 10, stamina: 5, agility: -3 },
        },
      };
      const { container } = render(<TraitCard trait={trait} showTooltip={true} />);
      const card = container.firstChild as HTMLElement;

      fireEvent.mouseEnter(card);

      expect(screen.getByText('speed:')).toBeInTheDocument();
      expect(screen.getByText('stamina:')).toBeInTheDocument();
      expect(screen.getByText('agility:')).toBeInTheDocument();
      expect(screen.getByText('+10')).toBeInTheDocument();
      expect(screen.getByText('+5')).toBeInTheDocument();
      expect(screen.getByText('-3')).toBeInTheDocument();
    });

    it('should handle empty impact gracefully', () => {
      const trait = {
        ...mockGeneticTrait,
        impact: { stats: {}, disciplines: {} },
      };
      const { container } = render(<TraitCard trait={trait} showTooltip={true} />);
      const card = container.firstChild as HTMLElement;

      fireEvent.mouseEnter(card);

      // Should not crash, but shouldn't show impact sections either
      expect(screen.queryByText('Stat Impact:')).not.toBeInTheDocument();
      expect(screen.queryByText('Discipline Impact:')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      const { container } = render(<TraitCard trait={mockGeneticTrait} />);

      // Should have heading for trait name
      expect(container.querySelector('h4')).toBeInTheDocument();
    });

    it('should support keyboard navigation for tooltips', () => {
      const { container } = render(<TraitCard trait={mockGeneticTrait} showTooltip={true} />);
      const card = container.firstChild as HTMLElement;

      // Tooltips should be accessible via focus/blur
      fireEvent.focus(card);
      fireEvent.mouseEnter(card);

      expect(screen.getByText(mockGeneticTrait.description)).toBeInTheDocument();

      fireEvent.blur(card);
      fireEvent.mouseLeave(card);

      expect(screen.queryByText(mockGeneticTrait.description)).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle strength value of 0', () => {
      const trait = { ...mockGeneticTrait, strength: 0 };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText(/Low \(0\)/)).toBeInTheDocument();
    });

    it('should handle strength value of 100', () => {
      const trait = { ...mockGeneticTrait, strength: 100 };
      render(<TraitCard trait={trait} />);
      expect(screen.getByText(/Exceptional \(100\)/)).toBeInTheDocument();
    });

    it('should handle very long trait names', () => {
      const trait = {
        ...mockGeneticTrait,
        name: 'Super Ultra Mega Awesome Fantastic Incredible Legendary Speed Boost Plus',
      };
      render(<TraitCard trait={trait} />);
      expect(
        screen.getByText('Super Ultra Mega Awesome Fantastic Incredible Legendary Speed Boost Plus')
      ).toBeInTheDocument();
    });

    it('should handle traits with no description', () => {
      const trait = { ...mockGeneticTrait, description: '' };
      const { container } = render(<TraitCard trait={trait} showTooltip={true} />);
      const card = container.firstChild as HTMLElement;

      fireEvent.mouseEnter(card);

      // Should still render tooltip structure without crashing
      expect(screen.getByText('Stat Impact:')).toBeInTheDocument();
    });
  });

  // Equoria-6rf97 — backend-authoritative beneficial/detrimental valence badge.
  describe('Valence badge (Equoria-6rf97)', () => {
    it('renders a Beneficial badge for a positive trait', () => {
      render(<TraitCard trait={mockGeneticTrait} valence="positive" />);
      const badge = screen.getByTestId('trait-valence-badge');
      expect(badge).toHaveTextContent('Beneficial');
    });

    it('renders a Detrimental badge for a negative trait', () => {
      render(<TraitCard trait={mockGeneticTrait} valence="negative" />);
      const badge = screen.getByTestId('trait-valence-badge');
      expect(badge).toHaveTextContent('Detrimental');
    });

    it('sentinel: a positive and a negative trait render distinct badges (not color-only — text differs)', () => {
      const { unmount } = render(<TraitCard trait={mockGeneticTrait} valence="positive" />);
      expect(screen.getByTestId('trait-valence-badge')).toHaveTextContent('Beneficial');
      unmount();
      render(<TraitCard trait={{ ...mockGeneticTrait, name: 'Nervous' }} valence="negative" />);
      expect(screen.getByTestId('trait-valence-badge')).toHaveTextContent('Detrimental');
    });

    it('renders NO valence badge when valence is omitted', () => {
      render(<TraitCard trait={mockGeneticTrait} />);
      expect(screen.queryByTestId('trait-valence-badge')).not.toBeInTheDocument();
    });
  });

  // Equoria-4o9u4 / Equoria-vpgmc — keyboard + role + label + activation.
  describe('Interactive accessibility (Equoria-4o9u4 / vpgmc)', () => {
    it('is a focusable role=button with an accessible label when onSelect is provided', () => {
      render(<TraitCard trait={mockGeneticTrait} valence="positive" onSelect={() => {}} />);
      const card = screen.getByRole('button', { name: /speed boost trait - positive/i });
      expect(card).toHaveAttribute('tabindex', '0');
    });

    it('label conveys negative status per README spec ("<name> trait - negative")', () => {
      render(
        <TraitCard
          trait={{ ...mockGeneticTrait, name: 'Nervous' }}
          valence="negative"
          onSelect={() => {}}
        />
      );
      expect(screen.getByRole('button', { name: /nervous trait - negative/i })).toBeInTheDocument();
    });

    it('activates on click', () => {
      let called = 0;
      render(
        <TraitCard
          trait={mockGeneticTrait}
          onSelect={() => {
            called += 1;
          }}
        />
      );
      fireEvent.click(screen.getByRole('button'));
      expect(called).toBe(1);
    });

    it('activates on Enter and Space', () => {
      let called = 0;
      render(
        <TraitCard
          trait={mockGeneticTrait}
          onSelect={() => {
            called += 1;
          }}
        />
      );
      const card = screen.getByRole('button');
      fireEvent.keyDown(card, { key: 'Enter' });
      fireEvent.keyDown(card, { key: ' ' });
      expect(called).toBe(2);
    });

    it('is NOT interactive (no role=button, not focusable) when onSelect is omitted', () => {
      render(<TraitCard trait={mockGeneticTrait} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.getByTestId('trait-card')).not.toHaveAttribute('tabindex');
    });
  });
});
