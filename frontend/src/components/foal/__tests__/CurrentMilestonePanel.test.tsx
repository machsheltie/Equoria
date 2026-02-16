/**
 * Tests for CurrentMilestonePanel Component
 *
 * Testing Sprint - Story 6-2: Foal Milestone Timeline
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Header display (icon, title, milestone name)
 * - Age window information (min, max, current age)
 * - Focus area display (conditional, with icon)
 * - Description display (conditional)
 * - Days remaining (with plural handling)
 * - Progress bar (color coding, percentage, aria attributes)
 * - "Day X of Y" calculation
 * - Enrichment activities (count, percentage, progress bar, messages)
 * - Enrichment status color coding
 * - Guidance tips (3 variants based on conditions)
 * - Default prop values
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CurrentMilestonePanel from '../CurrentMilestonePanel';
import type { Milestone } from '@/types/foal';

// Mock calculateMilestoneProgress
vi.mock('@/types/foal', async () => {
  const actual = await vi.importActual('@/types/foal');
  return {
    ...actual,
    calculateMilestoneProgress: vi.fn((milestone: Milestone, foalAge: number) => {
      // Simple mock: calculate based on age window
      const { min, max } = milestone.ageWindow;
      const daysInWindow = max - min;
      const daysPassed = foalAge - min;
      return Math.min(100, Math.max(0, Math.round((daysPassed / daysInWindow) * 100)));
    }),
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Target: () => <svg data-testid="target-icon" />,
  Clock: () => <svg data-testid="clock-icon" />,
  TrendingUp: () => <svg data-testid="trending-up-icon" />,
  Sparkles: () => <svg data-testid="sparkles-icon" />,
}));

describe('CurrentMilestonePanel Component', () => {
  const mockMilestone: Milestone = {
    id: 'first-steps',
    name: 'First Steps',
    description: 'Introduction to standing and basic movement coordination.',
    ageWindow: {
      min: 1,
      max: 30,
    },
    focus: 'Physical coordination and bonding',
    requirements: [],
    rewards: {
      milestonePoints: 50,
      potentialTraits: ['Steady Gait', 'Strong Legs'],
    },
  };

  const defaultProps = {
    milestone: mockMilestone,
    foalAge: 15,
    daysRemaining: 15,
    enrichmentActivitiesCompleted: 3,
    totalEnrichmentActivities: 5,
  };

  describe('header', () => {
    it('should display Target icon', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByTestId('target-icon')).toBeInTheDocument();
    });

    it('should display "Current Milestone" title', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByText('Current Milestone')).toBeInTheDocument();
    });

    it('should display milestone name', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByText('First Steps')).toBeInTheDocument();
    });
  });

  describe('age window', () => {
    it('should display age window label', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByText('Age Window:')).toBeInTheDocument();
    });

    it('should display age window range', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByText('Days 1-30')).toBeInTheDocument();
    });

    it('should display foal age label', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByText('Foal Age:')).toBeInTheDocument();
    });

    it('should display current foal age', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByText('15 days old')).toBeInTheDocument();
    });

    it('should handle different age window ranges', () => {
      const milestoneWithDifferentWindow = {
        ...mockMilestone,
        ageWindow: { min: 45, max: 90 },
      };

      render(
        <CurrentMilestonePanel
          {...defaultProps}
          milestone={milestoneWithDifferentWindow}
          foalAge={60}
        />
      );

      expect(screen.getByText('Days 45-90')).toBeInTheDocument();
      expect(screen.getByText('60 days old')).toBeInTheDocument();
    });
  });

  describe('focus area', () => {
    it('should display focus area when provided', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByText('Developmental Focus')).toBeInTheDocument();
      expect(screen.getByText('Physical coordination and bonding')).toBeInTheDocument();
    });

    it('should display Sparkles icon for focus area', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByTestId('sparkles-icon')).toBeInTheDocument();
    });

    it('should not display focus section when focus is undefined', () => {
      const milestoneWithoutFocus = {
        ...mockMilestone,
        focus: undefined,
      };

      render(<CurrentMilestonePanel {...defaultProps} milestone={milestoneWithoutFocus} />);

      expect(screen.queryByText('Developmental Focus')).not.toBeInTheDocument();
    });

    it('should not display focus section when focus is empty string', () => {
      const milestoneWithEmptyFocus = {
        ...mockMilestone,
        focus: '',
      };

      render(<CurrentMilestonePanel {...defaultProps} milestone={milestoneWithEmptyFocus} />);

      expect(screen.queryByText('Developmental Focus')).not.toBeInTheDocument();
    });
  });

  describe('description', () => {
    it('should display description when provided', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(
        screen.getByText('Introduction to standing and basic movement coordination.')
      ).toBeInTheDocument();
    });

    it('should not display description when undefined', () => {
      const milestoneWithoutDesc = {
        ...mockMilestone,
        description: undefined,
      };

      render(<CurrentMilestonePanel {...defaultProps} milestone={milestoneWithoutDesc} />);

      expect(
        screen.queryByText('Introduction to standing and basic movement coordination.')
      ).not.toBeInTheDocument();
    });

    it('should not display description when empty string', () => {
      const milestoneWithEmptyDesc = {
        ...mockMilestone,
        description: '',
      };

      render(<CurrentMilestonePanel {...defaultProps} milestone={milestoneWithEmptyDesc} />);

      // Should not have any description paragraph
      const paragraphs = screen.queryAllByText(/./);
      const descriptionParagraph = paragraphs.find((p) =>
        p.className.includes('text-sm text-slate-700')
      );
      expect(descriptionParagraph).toBeUndefined();
    });
  });

  describe('days remaining', () => {
    it('should display Clock icon', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });

    it('should display days remaining label', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByText('Days remaining in window:')).toBeInTheDocument();
    });

    it('should display days remaining count with plural', () => {
      render(<CurrentMilestonePanel {...defaultProps} daysRemaining={15} />);
      expect(screen.getByText('15 days')).toBeInTheDocument();
    });

    it('should use singular "day" when daysRemaining is 1', () => {
      render(<CurrentMilestonePanel {...defaultProps} daysRemaining={1} />);
      expect(screen.getByText('1 day')).toBeInTheDocument();
    });

    it('should use plural "days" when daysRemaining is 0', () => {
      render(<CurrentMilestonePanel {...defaultProps} daysRemaining={0} />);
      expect(screen.getByText('0 days')).toBeInTheDocument();
    });

    it('should handle large daysRemaining values', () => {
      render(<CurrentMilestonePanel {...defaultProps} daysRemaining={100} />);
      expect(screen.getByText('100 days')).toBeInTheDocument();
    });
  });

  describe('progress bar', () => {
    it('should display TrendingUp icon', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument();
    });

    it('should display "Milestone Progress" label', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByText('Milestone Progress')).toBeInTheDocument();
    });

    it('should display progress percentage', () => {
      // foalAge 15, window 1-30, so progress is (15-1)/(30-1)*100 = 48%
      render(<CurrentMilestonePanel {...defaultProps} />);
      const progressText = screen.getByText(/\d+%/);
      expect(progressText).toBeInTheDocument();
    });

    it('should use green color for 75%+ progress', () => {
      // foalAge 28, window 1-30, progress = (28-1)/(30-1)*100 = 93%
      const { container } = render(
        <CurrentMilestonePanel {...defaultProps} foalAge={28} daysRemaining={2} />
      );

      const progressBar = container.querySelector('.bg-green-500');
      expect(progressBar).toBeInTheDocument();
    });

    it('should use blue color for 50-74% progress', () => {
      // foalAge 18, window 1-30, progress = (18-1)/(30-1)*100 = 58%
      const { container } = render(
        <CurrentMilestonePanel {...defaultProps} foalAge={18} daysRemaining={12} />
      );

      const progressBar = container.querySelector('.bg-blue-500');
      expect(progressBar).toBeInTheDocument();
    });

    it('should use yellow color for 25-49% progress', () => {
      // foalAge 9, window 1-30, progress = (9-1)/(30-1)*100 = 27%
      const { container } = render(
        <CurrentMilestonePanel {...defaultProps} foalAge={9} daysRemaining={21} />
      );

      const progressBar = container.querySelector('.bg-yellow-500');
      expect(progressBar).toBeInTheDocument();
    });

    it('should use amber color for <25% progress', () => {
      // foalAge 4, window 1-30, progress = (4-1)/(30-1)*100 = 10%
      const { container } = render(
        <CurrentMilestonePanel {...defaultProps} foalAge={4} daysRemaining={26} />
      );

      const progressBar = container.querySelector('.bg-amber-500');
      expect(progressBar).toBeInTheDocument();
    });

    it('should have correct aria attributes', () => {
      const { container } = render(<CurrentMilestonePanel {...defaultProps} />);
      const progressBar = container.querySelector('[role="progressbar"]');

      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-valuenow');
      expect(progressBar).toHaveAttribute('aria-label');
    });

    it('should display "Day X of Y" calculation', () => {
      // foalAge 15, window 1-30
      // Day in window: 15 - 1 + 1 = 15
      // Total days: 30 - 1 + 1 = 30
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByText('Day 15 of 30 in this window')).toBeInTheDocument();
    });

    it('should calculate day 1 for foalAge at window start', () => {
      // foalAge 1, window 1-30
      // Day in window: 1 - 1 + 1 = 1
      render(<CurrentMilestonePanel {...defaultProps} foalAge={1} daysRemaining={29} />);
      expect(screen.getByText('Day 1 of 30 in this window')).toBeInTheDocument();
    });

    it('should calculate final day for foalAge at window end', () => {
      // foalAge 30, window 1-30
      // Day in window: 30 - 1 + 1 = 30
      render(<CurrentMilestonePanel {...defaultProps} foalAge={30} daysRemaining={0} />);
      expect(screen.getByText('Day 30 of 30 in this window')).toBeInTheDocument();
    });
  });

  describe('enrichment activities', () => {
    it('should display "Enrichment Activities" header', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByText('Enrichment Activities')).toBeInTheDocument();
    });

    it('should display completion count', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByText('3 / 5')).toBeInTheDocument();
    });

    it('should calculate and display percentage correctly', () => {
      // 3/5 = 60%
      const { container } = render(<CurrentMilestonePanel {...defaultProps} />);
      const enrichmentBar = container.querySelector('.bg-emerald-600');
      expect(enrichmentBar).toHaveStyle({ width: '60%' });
    });

    it('should use green color for 80%+ completion', () => {
      // 4/5 = 80%
      render(<CurrentMilestonePanel {...defaultProps} enrichmentActivitiesCompleted={4} />);
      const statusText = screen.getByText('4 / 5');
      expect(statusText).toHaveClass('text-green-600');
    });

    it('should use blue color for 60-79% completion', () => {
      // 3/5 = 60%
      render(<CurrentMilestonePanel {...defaultProps} />);
      const statusText = screen.getByText('3 / 5');
      expect(statusText).toHaveClass('text-blue-600');
    });

    it('should use yellow color for 40-59% completion', () => {
      // 2/5 = 40%
      render(<CurrentMilestonePanel {...defaultProps} enrichmentActivitiesCompleted={2} />);
      const statusText = screen.getByText('2 / 5');
      expect(statusText).toHaveClass('text-yellow-600');
    });

    it('should use amber color for <40% completion', () => {
      // 1/5 = 20%
      render(<CurrentMilestonePanel {...defaultProps} enrichmentActivitiesCompleted={1} />);
      const statusText = screen.getByText('1 / 5');
      expect(statusText).toHaveClass('text-amber-600');
    });

    it('should display excellent message for 80%+ completion', () => {
      render(<CurrentMilestonePanel {...defaultProps} enrichmentActivitiesCompleted={4} />);
      expect(screen.getByText(/🌟 Excellent progress!/)).toBeInTheDocument();
    });

    it('should display good message for 60-79% completion', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByText(/✨ Good progress\./)).toBeInTheDocument();
    });

    it('should display making progress message for 40-59% completion', () => {
      render(<CurrentMilestonePanel {...defaultProps} enrichmentActivitiesCompleted={2} />);
      expect(screen.getByText(/💫 Making progress\./)).toBeInTheDocument();
    });

    it('should display needs more message for <40% completion', () => {
      render(<CurrentMilestonePanel {...defaultProps} enrichmentActivitiesCompleted={1} />);
      expect(screen.getByText(/⏳ More enrichment activities needed/)).toBeInTheDocument();
    });

    it('should handle 0 completed activities', () => {
      render(<CurrentMilestonePanel {...defaultProps} enrichmentActivitiesCompleted={0} />);
      expect(screen.getByText('0 / 5')).toBeInTheDocument();
    });

    it('should handle all activities completed', () => {
      render(<CurrentMilestonePanel {...defaultProps} enrichmentActivitiesCompleted={5} />);
      expect(screen.getByText('5 / 5')).toBeInTheDocument();
      expect(screen.getByText(/🌟 Excellent progress!/)).toBeInTheDocument();
    });
  });

  describe('guidance tips', () => {
    it('should display "Care Tip" label', () => {
      render(<CurrentMilestonePanel {...defaultProps} />);
      expect(screen.getByText('💡 Care Tip')).toBeInTheDocument();
    });

    it('should display approaching deadline tip when daysRemaining <= 2', () => {
      render(<CurrentMilestonePanel {...defaultProps} daysRemaining={2} />);
      expect(screen.getByText(/Milestone evaluation is approaching!/)).toBeInTheDocument();
    });

    it('should display approaching tip for 1 day remaining', () => {
      render(<CurrentMilestonePanel {...defaultProps} daysRemaining={1} />);
      expect(screen.getByText(/Milestone evaluation is approaching!/)).toBeInTheDocument();
    });

    it('should display low progress tip when progress < 50%', () => {
      // foalAge 9, window 1-30, progress = ~27% (< 50%)
      render(<CurrentMilestonePanel {...defaultProps} foalAge={9} daysRemaining={21} />);
      expect(screen.getByText(/Focus on daily enrichment activities/)).toBeInTheDocument();
    });

    it('should display continue tip when progress >= 50% and daysRemaining > 2', () => {
      // foalAge 18, progress ~58%, daysRemaining 12
      render(<CurrentMilestonePanel {...defaultProps} foalAge={18} daysRemaining={12} />);
      expect(screen.getByText(/Continue consistent care and bonding/)).toBeInTheDocument();
    });

    it('should prioritize deadline tip over progress tip', () => {
      // Even with low progress, deadline tip takes precedence
      render(<CurrentMilestonePanel {...defaultProps} foalAge={9} daysRemaining={2} />);
      expect(screen.getByText(/Milestone evaluation is approaching!/)).toBeInTheDocument();
      expect(screen.queryByText(/Focus on daily enrichment activities/)).not.toBeInTheDocument();
    });
  });

  describe('default props', () => {
    it('should use default enrichmentActivitiesCompleted (0) when not provided', () => {
      const propsWithoutEnrichment = {
        milestone: defaultProps.milestone,
        foalAge: defaultProps.foalAge,
        daysRemaining: defaultProps.daysRemaining,
        totalEnrichmentActivities: defaultProps.totalEnrichmentActivities,
      };
      render(<CurrentMilestonePanel {...propsWithoutEnrichment} />);

      expect(screen.getByText('0 / 5')).toBeInTheDocument();
    });

    it('should use default totalEnrichmentActivities (5) when not provided', () => {
      const propsWithoutTotal = {
        milestone: defaultProps.milestone,
        foalAge: defaultProps.foalAge,
        daysRemaining: defaultProps.daysRemaining,
        enrichmentActivitiesCompleted: 3,
      };
      render(<CurrentMilestonePanel {...propsWithoutTotal} />);

      expect(screen.getByText('3 / 5')).toBeInTheDocument();
    });

    it('should use both defaults when enrichment props not provided', () => {
      const propsWithoutEnrichment = {
        milestone: defaultProps.milestone,
        foalAge: defaultProps.foalAge,
        daysRemaining: defaultProps.daysRemaining,
      };

      render(<CurrentMilestonePanel {...propsWithoutEnrichment} />);

      expect(screen.getByText('0 / 5')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle very small age windows', () => {
      const smallWindowMilestone = {
        ...mockMilestone,
        ageWindow: { min: 1, max: 2 },
      };

      render(
        <CurrentMilestonePanel
          {...defaultProps}
          milestone={smallWindowMilestone}
          foalAge={1}
          daysRemaining={1}
        />
      );

      expect(screen.getByText('Days 1-2')).toBeInTheDocument();
      expect(screen.getByText('Day 1 of 2 in this window')).toBeInTheDocument();
    });

    it('should handle very large age windows', () => {
      const largeWindowMilestone = {
        ...mockMilestone,
        ageWindow: { min: 1, max: 365 },
      };

      render(
        <CurrentMilestonePanel
          {...defaultProps}
          milestone={largeWindowMilestone}
          foalAge={180}
          daysRemaining={185}
        />
      );

      expect(screen.getByText('Days 1-365')).toBeInTheDocument();
      expect(screen.getByText('180 days old')).toBeInTheDocument();
    });
  });
});
