/**
 * Tests for TraitModifierBadge Component
 *
 * Tests cover:
 * - Basic rendering and display
 * - Positive trait styling (green colors, Plus icon)
 * - Negative trait styling (red colors, Minus icon)
 * - Neutral trait styling (gray colors, Info icon)
 * - Size variants (sm, md, lg)
 * - Accessibility (ARIA labels, role attributes)
 * - Props handling (className, showTooltip)
 *
 * Story: Training Trait Modifiers - Task 1
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TraitModifierBadge, {
  type TraitModifier,
  type TraitModifierBadgeProps,
} from '../TraitModifierBadge';

describe('TraitModifierBadge', () => {
  // ==================== TEST DATA ====================
  const positiveModifier: TraitModifier = {
    traitId: 'athletic',
    traitName: 'Athletic',
    effect: 3,
    description: 'Enhances physical disciplines',
    affectedDisciplines: ['racing', 'show-jumping'],
    category: 'positive',
  };

  const negativeModifier: TraitModifier = {
    traitId: 'nervous',
    traitName: 'Nervous',
    effect: -2,
    description: 'Reduces performance under pressure',
    affectedDisciplines: ['dressage', 'show-jumping'],
    category: 'negative',
  };

  const neutralModifier: TraitModifier = {
    traitId: 'calm',
    traitName: 'Calm',
    effect: 0,
    description: 'Maintains consistent performance',
    affectedDisciplines: ['dressage'],
    category: 'neutral',
  };

  // ==================== RENDERING TESTS ====================
  describe('Rendering Tests', () => {
    it('should render without crashing', () => {
      render(<TraitModifierBadge modifier={positiveModifier} />);
      // Use regex to find text containing "Athletic" (component shows "Athletic +3")
      expect(screen.getByText(/Athletic/)).toBeInTheDocument();
    });

    it('should display trait name correctly', () => {
      render(<TraitModifierBadge modifier={positiveModifier} />);
      expect(screen.getByText(/Athletic/)).toBeInTheDocument();
    });

    it('should show effect number for positive traits', () => {
      render(<TraitModifierBadge modifier={positiveModifier} />);
      expect(screen.getByText(/\+3/)).toBeInTheDocument();
    });

    it('should show effect number for negative traits', () => {
      render(<TraitModifierBadge modifier={negativeModifier} />);
      expect(screen.getByText(/-2/)).toBeInTheDocument();
    });

    it('should hide effect number for neutral traits', () => {
      render(<TraitModifierBadge modifier={neutralModifier} />);
      // Should only show the trait name, no number
      const badge = screen.getByTestId('trait-badge-calm');
      expect(badge.textContent).not.toMatch(/\+0/);
      expect(badge.textContent).not.toMatch(/-0/);
      expect(badge.textContent).not.toMatch(/\s0/);
    });
  });

  // ==================== POSITIVE TRAIT TESTS ====================
  describe('Positive Trait Tests', () => {
    it('should use green background (bg-green-100) for positive traits', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-athletic"]');
      expect(badge).toHaveClass('bg-green-100');
    });

    it('should use green border (border-green-500) for positive traits', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-athletic"]');
      expect(badge).toHaveClass('border-green-500');
    });

    it('should show Plus icon for positive traits', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      const icon = container.querySelector('[data-testid="trait-icon"]');
      expect(icon).toBeInTheDocument();
      // Verify it's an SVG element (lucide-react renders SVG icons)
      expect(icon?.tagName.toLowerCase()).toBe('svg');
    });

    it('should show +N format for positive effect', () => {
      render(<TraitModifierBadge modifier={positiveModifier} />);
      // Check that the text contains "+3" format
      expect(screen.getByText(/Athletic \+3/)).toBeInTheDocument();
    });
  });

  // ==================== NEGATIVE TRAIT TESTS ====================
  describe('Negative Trait Tests', () => {
    it('should use red background (bg-red-100) for negative traits', () => {
      const { container } = render(<TraitModifierBadge modifier={negativeModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-nervous"]');
      expect(badge).toHaveClass('bg-red-100');
    });

    it('should use red border (border-red-500) for negative traits', () => {
      const { container } = render(<TraitModifierBadge modifier={negativeModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-nervous"]');
      expect(badge).toHaveClass('border-red-500');
    });

    it('should show Minus icon for negative traits', () => {
      const { container } = render(<TraitModifierBadge modifier={negativeModifier} />);
      const icon = container.querySelector('[data-testid="trait-icon"]');
      expect(icon).toBeInTheDocument();
      expect(icon?.tagName.toLowerCase()).toBe('svg');
    });

    it('should show -N format for negative effect', () => {
      render(<TraitModifierBadge modifier={negativeModifier} />);
      // Check that the text contains "-2" format
      expect(screen.getByText(/Nervous -2/)).toBeInTheDocument();
    });
  });

  // ==================== NEUTRAL TRAIT TESTS ====================
  describe('Neutral Trait Tests', () => {
    it('should use gray background (bg-gray-100) for neutral traits', () => {
      const { container } = render(<TraitModifierBadge modifier={neutralModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-calm"]');
      expect(badge).toHaveClass('bg-gray-100');
    });

    it('should use gray border (border-gray-300) for neutral traits', () => {
      const { container } = render(<TraitModifierBadge modifier={neutralModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-calm"]');
      expect(badge).toHaveClass('border-gray-300');
    });

    it('should show Info icon for neutral traits', () => {
      const { container } = render(<TraitModifierBadge modifier={neutralModifier} />);
      const icon = container.querySelector('[data-testid="trait-icon"]');
      expect(icon).toBeInTheDocument();
      expect(icon?.tagName.toLowerCase()).toBe('svg');
    });
  });

  // ==================== SIZE VARIANT TESTS ====================
  describe('Size Variant Tests', () => {
    it('should apply small size classes when size="sm"', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} size="sm" />);
      const badge = container.querySelector('[data-testid="trait-badge-athletic"]');
      expect(badge).toHaveClass('text-xs');
      expect(badge).toHaveClass('px-1.5');
      expect(badge).toHaveClass('py-0.5');
    });

    it('should apply medium size classes by default (size="md")', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-athletic"]');
      expect(badge).toHaveClass('text-xs');
      expect(badge).toHaveClass('px-2');
      expect(badge).toHaveClass('py-1');
    });

    it('should apply large size classes when size="lg"', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} size="lg" />);
      const badge = container.querySelector('[data-testid="trait-badge-athletic"]');
      expect(badge).toHaveClass('text-sm');
      expect(badge).toHaveClass('px-3');
      expect(badge).toHaveClass('py-1.5');
    });
  });

  // ==================== ACCESSIBILITY TESTS ====================
  describe('Accessibility Tests', () => {
    it('should have proper ARIA label for positive traits', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-athletic"]');
      expect(badge).toHaveAttribute('aria-label', 'Athletic trait: +3 bonus');
    });

    it('should have proper ARIA label for negative traits', () => {
      const { container } = render(<TraitModifierBadge modifier={negativeModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-nervous"]');
      expect(badge).toHaveAttribute('aria-label', 'Nervous trait: -2 penalty');
    });

    it('should have proper ARIA label for neutral traits', () => {
      const { container } = render(<TraitModifierBadge modifier={neutralModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-calm"]');
      expect(badge).toHaveAttribute('aria-label', 'Calm trait: no effect');
    });

    it('should have role="status" for screen readers', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-athletic"]');
      expect(badge).toHaveAttribute('role', 'status');
    });

    it('should have aria-hidden on icon', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      const icon = container.querySelector('[data-testid="trait-icon"]');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ==================== PROPS TESTS ====================
  describe('Props Tests', () => {
    it('should accept and apply custom className', () => {
      const { container } = render(
        <TraitModifierBadge modifier={positiveModifier} className="custom-test-class" />
      );
      const badge = container.querySelector('[data-testid="trait-badge-athletic"]');
      expect(badge).toHaveClass('custom-test-class');
    });

    it('should accept showTooltip prop (for future tooltip integration)', () => {
      // This test verifies the prop is accepted without causing errors
      expect(() =>
        render(<TraitModifierBadge modifier={positiveModifier} showTooltip={true} />)
      ).not.toThrow();

      expect(() =>
        render(<TraitModifierBadge modifier={positiveModifier} showTooltip={false} />)
      ).not.toThrow();
    });
  });

  // ==================== EDGE CASES & ADDITIONAL TESTS ====================
  describe('Edge Cases', () => {
    it('should handle large positive effect numbers', () => {
      const largePositive: TraitModifier = {
        ...positiveModifier,
        effect: 10,
      };
      render(<TraitModifierBadge modifier={largePositive} />);
      expect(screen.getByText(/\+10/)).toBeInTheDocument();
    });

    it('should handle large negative effect numbers', () => {
      const largeNegative: TraitModifier = {
        ...negativeModifier,
        effect: -15,
      };
      render(<TraitModifierBadge modifier={largeNegative} />);
      expect(screen.getByText(/-15/)).toBeInTheDocument();
    });

    it('should render correct data-testid based on traitId', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      expect(container.querySelector('[data-testid="trait-badge-athletic"]')).toBeInTheDocument();
    });

    it('should have inline-flex display for badge alignment', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-athletic"]');
      expect(badge).toHaveClass('inline-flex');
    });

    it('should have items-center for vertical alignment', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-athletic"]');
      expect(badge).toHaveClass('items-center');
    });

    it('should have gap-1 for spacing between icon and text', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-athletic"]');
      expect(badge).toHaveClass('gap-1');
    });

    it('should have rounded-full for pill shape', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-athletic"]');
      expect(badge).toHaveClass('rounded-full');
    });

    it('should have border class for outline', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-athletic"]');
      expect(badge).toHaveClass('border');
    });
  });

  // ==================== TEXT COLOR TESTS ====================
  describe('Text Color Tests', () => {
    it('should use green text color (text-green-700) for positive traits', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-athletic"]');
      expect(badge).toHaveClass('text-green-700');
    });

    it('should use red text color (text-red-700) for negative traits', () => {
      const { container } = render(<TraitModifierBadge modifier={negativeModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-nervous"]');
      expect(badge).toHaveClass('text-red-700');
    });

    it('should use gray text color (text-gray-600) for neutral traits', () => {
      const { container } = render(<TraitModifierBadge modifier={neutralModifier} />);
      const badge = container.querySelector('[data-testid="trait-badge-calm"]');
      expect(badge).toHaveClass('text-gray-600');
    });
  });

  // ==================== ICON SIZE TESTS ====================
  describe('Icon Size Tests', () => {
    it('should apply small icon size (w-2.5 h-2.5) when size="sm"', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} size="sm" />);
      const icon = container.querySelector('[data-testid="trait-icon"]');
      expect(icon).toHaveClass('w-2.5');
      expect(icon).toHaveClass('h-2.5');
    });

    it('should apply medium icon size (w-3 h-3) by default', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      const icon = container.querySelector('[data-testid="trait-icon"]');
      expect(icon).toHaveClass('w-3');
      expect(icon).toHaveClass('h-3');
    });

    it('should apply large icon size (w-4 h-4) when size="lg"', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} size="lg" />);
      const icon = container.querySelector('[data-testid="trait-icon"]');
      expect(icon).toHaveClass('w-4');
      expect(icon).toHaveClass('h-4');
    });
  });

  // ==================== FONT WEIGHT TEST ====================
  describe('Font Weight Test', () => {
    it('should have font-medium on the text span', () => {
      const { container } = render(<TraitModifierBadge modifier={positiveModifier} />);
      const textSpan = container.querySelector('[data-testid="trait-text"]');
      expect(textSpan).toHaveClass('font-medium');
    });
  });
});
