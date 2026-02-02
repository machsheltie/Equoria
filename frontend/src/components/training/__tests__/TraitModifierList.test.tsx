/**
 * Tests for TraitModifierList Component
 *
 * Tests cover:
 * - Basic rendering and display
 * - Grouping logic (positive, negative, neutral)
 * - Net effect calculation
 * - Badge integration
 * - Section visibility
 * - Props handling
 *
 * Story: Training Trait Modifiers - Task 3
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TraitModifierList, { type TraitModifierListProps } from '../TraitModifierList';
import type { TraitModifier } from '../TraitModifierBadge';

// Mock the TraitModifierBadge component
vi.mock('../TraitModifierBadge', () => ({
  default: ({ modifier }: { modifier: TraitModifier }) => (
    <div data-testid={`badge-${modifier.traitId}`}>{modifier.traitName}</div>
  ),
}));

// Mock the TraitModifierTooltip component
vi.mock('../TraitModifierTooltip', () => ({
  default: ({
    children,
    modifier,
    onLearnMore,
  }: {
    children: React.ReactNode;
    modifier: TraitModifier;
    onLearnMore?: () => void;
  }) => (
    <div data-testid={`tooltip-${modifier.traitId}`} data-learn-more={!!onLearnMore}>
      {children}
    </div>
  ),
}));

describe('TraitModifierList', () => {
  // ==================== TEST DATA ====================
  const positiveModifier1: TraitModifier = {
    traitId: 'athletic',
    traitName: 'Athletic',
    effect: 3,
    description: 'Enhances physical disciplines',
    affectedDisciplines: ['racing', 'show-jumping'],
    category: 'positive',
  };

  const positiveModifier2: TraitModifier = {
    traitId: 'agile',
    traitName: 'Agile',
    effect: 2,
    description: 'Improves agility disciplines',
    affectedDisciplines: ['dressage'],
    category: 'positive',
  };

  const negativeModifier1: TraitModifier = {
    traitId: 'nervous',
    traitName: 'Nervous',
    effect: -2,
    description: 'Reduces performance under pressure',
    affectedDisciplines: ['dressage', 'show-jumping'],
    category: 'negative',
  };

  const negativeModifier2: TraitModifier = {
    traitId: 'stubborn',
    traitName: 'Stubborn',
    effect: -1,
    description: 'Reduces trainability',
    affectedDisciplines: ['all'],
    category: 'negative',
  };

  const neutralModifier1: TraitModifier = {
    traitId: 'calm',
    traitName: 'Calm',
    effect: 0,
    description: 'Maintains consistent performance',
    affectedDisciplines: ['dressage'],
    category: 'neutral',
  };

  const neutralModifier2: TraitModifier = {
    traitId: 'curious',
    traitName: 'Curious',
    effect: 0,
    description: 'Shows interest in new activities',
    affectedDisciplines: ['all'],
    category: 'neutral',
  };

  const defaultProps: TraitModifierListProps = {
    modifiers: [positiveModifier1, negativeModifier1, neutralModifier1],
    baseGain: 10,
  };

  // ==================== RENDERING TESTS ====================
  describe('Rendering Tests', () => {
    it('should render without crashing', () => {
      render(<TraitModifierList {...defaultProps} />);
      expect(screen.getByText(/Base Gain/)).toBeInTheDocument();
    });

    it('should display base gain correctly', () => {
      render(<TraitModifierList {...defaultProps} />);
      expect(screen.getByText(/\+10/)).toBeInTheDocument();
    });

    it('should show net effect section by default', () => {
      render(<TraitModifierList {...defaultProps} />);
      expect(screen.getByText(/Net Effect/)).toBeInTheDocument();
    });

    it('should render empty state when no modifiers provided', () => {
      render(<TraitModifierList modifiers={[]} baseGain={10} />);
      expect(screen.getByText(/No trait modifiers for this discipline/)).toBeInTheDocument();
    });

    it('should accept className prop and apply to container', () => {
      const { container } = render(
        <TraitModifierList {...defaultProps} className="custom-class" />
      );
      const listContainer = container.firstChild;
      expect(listContainer).toHaveClass('custom-class');
    });
  });

  // ==================== GROUPING TESTS ====================
  describe('Grouping Tests', () => {
    it('should group positive traits in "Positive Traits" section', () => {
      render(
        <TraitModifierList modifiers={[positiveModifier1, positiveModifier2]} baseGain={10} />
      );
      expect(screen.getByText('Positive Traits:')).toBeInTheDocument();
      expect(screen.getByTestId('badge-athletic')).toBeInTheDocument();
      expect(screen.getByTestId('badge-agile')).toBeInTheDocument();
    });

    it('should group negative traits in "Negative Traits" section', () => {
      render(
        <TraitModifierList modifiers={[negativeModifier1, negativeModifier2]} baseGain={10} />
      );
      expect(screen.getByText('Negative Traits:')).toBeInTheDocument();
      expect(screen.getByTestId('badge-nervous')).toBeInTheDocument();
      expect(screen.getByTestId('badge-stubborn')).toBeInTheDocument();
    });

    it('should group neutral traits in "Other Traits" section', () => {
      render(<TraitModifierList modifiers={[neutralModifier1, neutralModifier2]} baseGain={10} />);
      expect(screen.getByText('Other Traits:')).toBeInTheDocument();
      expect(screen.getByTestId('badge-calm')).toBeInTheDocument();
      expect(screen.getByTestId('badge-curious')).toBeInTheDocument();
    });

    it('should only show sections with traits present', () => {
      render(<TraitModifierList modifiers={[positiveModifier1]} baseGain={10} />);
      expect(screen.getByText('Positive Traits:')).toBeInTheDocument();
      expect(screen.queryByText('Negative Traits:')).not.toBeInTheDocument();
      expect(screen.queryByText('Other Traits:')).not.toBeInTheDocument();
    });
  });

  // ==================== NET EFFECT CALCULATION TESTS ====================
  describe('Net Effect Calculation Tests', () => {
    it('should calculate net effect with only positive traits', () => {
      render(
        <TraitModifierList modifiers={[positiveModifier1, positiveModifier2]} baseGain={10} />
      );
      // Net effect = 10 + 3 + 2 = 15
      expect(screen.getByText(/\+15/)).toBeInTheDocument();
    });

    it('should calculate net effect with only negative traits', () => {
      render(
        <TraitModifierList modifiers={[negativeModifier1, negativeModifier2]} baseGain={10} />
      );
      // Net effect = 10 - 2 - 1 = 7
      expect(screen.getByText(/\+7/)).toBeInTheDocument();
    });

    it('should calculate net effect with mixed traits', () => {
      render(
        <TraitModifierList modifiers={[positiveModifier1, negativeModifier1]} baseGain={10} />
      );
      // Net effect = 10 + 3 - 2 = 11
      expect(screen.getByText(/\+11/)).toBeInTheDocument();
    });

    it('should show calculation breakdown (base + pos - neg)', () => {
      render(
        <TraitModifierList modifiers={[positiveModifier1, negativeModifier1]} baseGain={10} />
      );
      // Should show: +11 (10 + 3 - 2)
      expect(screen.getByText(/\(10 \+ 3 - 2\)/)).toBeInTheDocument();
    });

    it('should handle zero effect correctly', () => {
      render(<TraitModifierList modifiers={[neutralModifier1]} baseGain={10} />);
      // Net effect = 10 + 0 - 0 = 10
      // Check that the net effect section shows the full breakdown
      expect(screen.getByText(/\+10 \(10 \+ 0 - 0\)/)).toBeInTheDocument();
    });
  });

  // ==================== BADGE INTEGRATION TESTS ====================
  describe('Badge Integration Tests', () => {
    it('should render TraitModifierBadge for each modifier', () => {
      render(<TraitModifierList {...defaultProps} />);
      expect(screen.getByTestId('badge-athletic')).toBeInTheDocument();
      expect(screen.getByTestId('badge-nervous')).toBeInTheDocument();
      expect(screen.getByTestId('badge-calm')).toBeInTheDocument();
    });

    it('should wrap each badge in TraitModifierTooltip', () => {
      render(<TraitModifierList {...defaultProps} />);
      expect(screen.getByTestId('tooltip-athletic')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-nervous')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-calm')).toBeInTheDocument();
    });

    it('should pass correct traitId as key (verified by testid)', () => {
      render(<TraitModifierList {...defaultProps} />);
      // Keys are internal to React, but we can verify badges render with correct IDs
      expect(screen.getByTestId('badge-athletic')).toBeInTheDocument();
      expect(screen.getByTestId('badge-nervous')).toBeInTheDocument();
      expect(screen.getByTestId('badge-calm')).toBeInTheDocument();
    });
  });

  // ==================== SECTION VISIBILITY TESTS ====================
  describe('Section Visibility Tests', () => {
    it('should hide positive section when no positive traits exist', () => {
      render(<TraitModifierList modifiers={[negativeModifier1, neutralModifier1]} baseGain={10} />);
      expect(screen.queryByText('Positive Traits:')).not.toBeInTheDocument();
    });

    it('should hide negative section when no negative traits exist', () => {
      render(<TraitModifierList modifiers={[positiveModifier1, neutralModifier1]} baseGain={10} />);
      expect(screen.queryByText('Negative Traits:')).not.toBeInTheDocument();
    });

    it('should hide neutral section when no neutral traits exist', () => {
      render(
        <TraitModifierList modifiers={[positiveModifier1, negativeModifier1]} baseGain={10} />
      );
      expect(screen.queryByText('Other Traits:')).not.toBeInTheDocument();
    });

    it('should show all sections when all categories are present', () => {
      render(
        <TraitModifierList
          modifiers={[positiveModifier1, negativeModifier1, neutralModifier1]}
          baseGain={10}
        />
      );
      expect(screen.getByText('Positive Traits:')).toBeInTheDocument();
      expect(screen.getByText('Negative Traits:')).toBeInTheDocument();
      expect(screen.getByText('Other Traits:')).toBeInTheDocument();
    });
  });

  // ==================== PROPS TESTS ====================
  describe('Props Tests', () => {
    it('should hide net effect section when showNetEffect is false', () => {
      render(<TraitModifierList {...defaultProps} showNetEffect={false} />);
      expect(screen.queryByText(/Net Effect/)).not.toBeInTheDocument();
    });

    it('should show net effect section when showNetEffect is true', () => {
      render(<TraitModifierList {...defaultProps} showNetEffect={true} />);
      expect(screen.getByText(/Net Effect/)).toBeInTheDocument();
    });

    it('should pass onLearnMore to tooltips', () => {
      const onLearnMoreMock = vi.fn();
      render(<TraitModifierList {...defaultProps} onLearnMore={onLearnMoreMock} />);
      // Check if data-learn-more attribute is set to true on tooltips
      const tooltip = screen.getByTestId('tooltip-athletic');
      expect(tooltip).toHaveAttribute('data-learn-more', 'true');
    });

    it('should apply className to container element', () => {
      const { container } = render(
        <TraitModifierList {...defaultProps} className="test-class another-class" />
      );
      const listContainer = container.firstChild;
      expect(listContainer).toHaveClass('test-class');
      expect(listContainer).toHaveClass('another-class');
    });
  });

  // ==================== ADDITIONAL EDGE CASE TESTS ====================
  describe('Edge Cases', () => {
    it('should handle single positive modifier correctly', () => {
      render(<TraitModifierList modifiers={[positiveModifier1]} baseGain={5} />);
      // Net effect = 5 + 3 = 8
      expect(screen.getByText(/\+8/)).toBeInTheDocument();
    });

    it('should handle single negative modifier correctly', () => {
      render(<TraitModifierList modifiers={[negativeModifier1]} baseGain={5} />);
      // Net effect = 5 - 2 = 3
      expect(screen.getByText(/\+3/)).toBeInTheDocument();
    });

    it('should handle large number of modifiers', () => {
      const manyModifiers: TraitModifier[] = [
        positiveModifier1,
        positiveModifier2,
        negativeModifier1,
        negativeModifier2,
        neutralModifier1,
        neutralModifier2,
      ];
      render(<TraitModifierList modifiers={manyModifiers} baseGain={10} />);
      // All modifiers should be rendered
      expect(screen.getByTestId('badge-athletic')).toBeInTheDocument();
      expect(screen.getByTestId('badge-agile')).toBeInTheDocument();
      expect(screen.getByTestId('badge-nervous')).toBeInTheDocument();
      expect(screen.getByTestId('badge-stubborn')).toBeInTheDocument();
      expect(screen.getByTestId('badge-calm')).toBeInTheDocument();
      expect(screen.getByTestId('badge-curious')).toBeInTheDocument();
    });

    it('should display correct base gain label with icon', () => {
      render(<TraitModifierList {...defaultProps} />);
      expect(screen.getByText(/Base Gain/)).toBeInTheDocument();
    });

    it('should display correct net effect label with icon', () => {
      render(<TraitModifierList {...defaultProps} />);
      expect(screen.getByText(/Net Effect/)).toBeInTheDocument();
    });

    it('should not pass onLearnMore to tooltips when not provided', () => {
      render(<TraitModifierList {...defaultProps} />);
      const tooltip = screen.getByTestId('tooltip-athletic');
      expect(tooltip).toHaveAttribute('data-learn-more', 'false');
    });

    it('should render with zero base gain', () => {
      render(<TraitModifierList modifiers={[positiveModifier1]} baseGain={0} />);
      // Net effect = 0 + 3 = 3
      expect(screen.getByText(/\+3/)).toBeInTheDocument();
    });

    it('should correctly format breakdown when positive sum is zero', () => {
      render(<TraitModifierList modifiers={[negativeModifier1]} baseGain={10} />);
      // Breakdown: (10 + 0 - 2)
      expect(screen.getByText(/\(10 \+ 0 - 2\)/)).toBeInTheDocument();
    });

    it('should correctly format breakdown when negative sum is zero', () => {
      render(<TraitModifierList modifiers={[positiveModifier1]} baseGain={10} />);
      // Breakdown: (10 + 3 - 0)
      expect(screen.getByText(/\(10 \+ 3 - 0\)/)).toBeInTheDocument();
    });
  });
});
