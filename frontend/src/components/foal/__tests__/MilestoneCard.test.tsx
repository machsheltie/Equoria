/**
 * Tests for MilestoneCard Component
 *
 * Testing Sprint - Story 6-2: Foal Milestone Timeline
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Status icons (CheckCircle for completed, Target for current, Clock for pending)
 * - Status labels (Completed, In Progress, Upcoming)
 * - Card styling (current, completed, pending states)
 * - Clickable vs non-clickable behavior
 * - Milestone info display (name, age window, status)
 * - Description display (conditional)
 * - Focus area display (conditional)
 * - Completed milestone details (score with color coding, traits badges)
 * - Pending milestone info ("Begins in X days")
 * - Current milestone progress (text and progress bar)
 * - ChevronRight icon for clickable cards
 * - onClick handling
 * - Edge cases (score variations, missing fields)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import MilestoneCard from '../MilestoneCard';
import type { Milestone } from '@/types/foal';

// Mock getDaysUntilMilestone
vi.mock('@/types/foal', async () => {
  const actual = await vi.importActual('@/types/foal');
  return {
    ...actual,
    getDaysUntilMilestone: vi.fn((milestone: Milestone, foalAge: number) => {
      return Math.max(0, milestone.ageWindow.min - foalAge);
    }),
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  CheckCircle: () => <svg data-testid="check-circle-icon" />,
  Clock: () => <svg data-testid="clock-icon" />,
  Target: () => <svg data-testid="target-icon" />,
  ChevronRight: () => <svg data-testid="chevron-right-icon" />,
  Award: () => <svg data-testid="award-icon" />,
}));

describe('MilestoneCard Component', () => {
  const completedMilestone: Milestone = {
    id: 'first-steps',
    type: 'first-steps',
    name: 'First Steps',
    description: 'Learning to stand and walk',
    ageWindow: { min: 1, max: 30 },
    focus: 'Physical coordination',
    status: 'completed',
    requirements: [],
    rewards: { milestonePoints: 50, potentialTraits: [] },
    score: 8,
    traitsConfirmed: ['Steady Gait', 'Strong Legs'],
  };

  const currentMilestone: Milestone = {
    id: 'socialization',
    type: 'socialization',
    name: 'Socialization',
    description: 'Building trust and bonding',
    ageWindow: { min: 31, max: 90 },
    focus: 'Social development',
    status: 'in_progress',
    requirements: [],
    rewards: { milestonePoints: 75, potentialTraits: [] },
  };

  const pendingMilestone: Milestone = {
    id: 'weaning',
    type: 'weaning',
    name: 'Weaning',
    description: 'Transition to independence',
    ageWindow: { min: 91, max: 180 },
    focus: 'Independence',
    status: 'pending',
    requirements: [],
    rewards: { milestonePoints: 100, potentialTraits: [] },
  };

  describe('status icons', () => {
    it('should display CheckCircle icon for completed milestone', () => {
      render(<MilestoneCard milestone={completedMilestone} foalAge={30} isCurrent={false} />);
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    });

    it('should display Target icon for current milestone', () => {
      render(<MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={true} />);
      expect(screen.getByTestId('target-icon')).toBeInTheDocument();
    });

    it('should display Clock icon for pending milestone', () => {
      render(<MilestoneCard milestone={pendingMilestone} foalAge={45} isCurrent={false} />);
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });

    it('should display Clock icon for non-current in_progress milestone', () => {
      render(<MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={false} />);
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });
  });

  describe('status labels', () => {
    it('should display "Completed" for completed milestone', () => {
      render(<MilestoneCard milestone={completedMilestone} foalAge={30} isCurrent={false} />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should display "In Progress" for current milestone', () => {
      render(<MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={true} />);
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('should display "Upcoming" for pending milestone', () => {
      render(<MilestoneCard milestone={pendingMilestone} foalAge={45} isCurrent={false} />);
      expect(screen.getByText('Upcoming')).toBeInTheDocument();
    });

    it('should display "Upcoming" for non-current in_progress milestone', () => {
      render(<MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={false} />);
      expect(screen.getByText('Upcoming')).toBeInTheDocument();
    });
  });

  describe('card styling', () => {
    it('should apply current milestone styling when isCurrent is true', () => {
      const { container } = render(
        <MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={true} />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-blue-500');
      expect(card.className).toContain('bg-blue-50');
      expect(card.className).toContain('ring-2');
    });

    it('should apply completed milestone styling', () => {
      const { container } = render(
        <MilestoneCard milestone={completedMilestone} foalAge={30} isCurrent={false} />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('bg-green-50/50');
      expect(card.className).toContain('border-green-200');
    });

    it('should apply pending milestone styling', () => {
      const { container } = render(
        <MilestoneCard milestone={pendingMilestone} foalAge={45} isCurrent={false} />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('bg-gray-50/50');
      expect(card.className).toContain('border-gray-200');
      expect(card.className).toContain('opacity-80');
    });

    it('should apply default styling when not current, completed, or pending', () => {
      const { container } = render(
        <MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={false} />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-slate-200');
      expect(card.className).toContain('bg-white');
    });
  });

  describe('clickable behavior', () => {
    it('should apply cursor pointer when onClick is provided', () => {
      const mockOnClick = vi.fn();
      const { container } = render(
        <MilestoneCard
          milestone={currentMilestone}
          foalAge={45}
          isCurrent={true}
          onClick={mockOnClick}
        />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('cursor-pointer');
      expect(card.className).toContain('hover:shadow-md');
    });

    it('should have button role when onClick is provided', () => {
      const mockOnClick = vi.fn();
      const { container } = render(
        <MilestoneCard
          milestone={currentMilestone}
          foalAge={45}
          isCurrent={true}
          onClick={mockOnClick}
        />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.getAttribute('role')).toBe('button');
    });

    it('should call onClick when card is clicked', async () => {
      const user = userEvent.setup();
      const mockOnClick = vi.fn();
      const { container } = render(
        <MilestoneCard
          milestone={currentMilestone}
          foalAge={45}
          isCurrent={true}
          onClick={mockOnClick}
        />
      );

      const card = container.firstChild as HTMLElement;
      await user.click(card);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should not have button role when onClick is not provided', () => {
      const { container } = render(
        <MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={true} />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.getAttribute('role')).toBeNull();
    });

    it('should display ChevronRight icon when onClick is provided', () => {
      const mockOnClick = vi.fn();
      render(
        <MilestoneCard
          milestone={currentMilestone}
          foalAge={45}
          isCurrent={true}
          onClick={mockOnClick}
        />
      );
      expect(screen.getByTestId('chevron-right-icon')).toBeInTheDocument();
    });

    it('should not display ChevronRight icon when onClick is not provided', () => {
      render(<MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={true} />);
      expect(screen.queryByTestId('chevron-right-icon')).not.toBeInTheDocument();
    });
  });

  describe('milestone info display', () => {
    it('should display milestone name', () => {
      render(<MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={true} />);
      expect(screen.getByText('Socialization')).toBeInTheDocument();
    });

    it('should display age window', () => {
      render(<MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={true} />);
      expect(screen.getByText('Age Window: Days 31-90')).toBeInTheDocument();
    });
  });

  describe('description display', () => {
    it('should display description when provided', () => {
      render(<MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={true} />);
      expect(screen.getByText('Building trust and bonding')).toBeInTheDocument();
    });

    it('should not display description when undefined', () => {
      const noDescMilestone = {
        ...currentMilestone,
        description: undefined,
      };

      render(<MilestoneCard milestone={noDescMilestone} foalAge={45} isCurrent={true} />);
      expect(screen.queryByText('Building trust and bonding')).not.toBeInTheDocument();
    });

    it('should not display description when empty string', () => {
      const emptyDescMilestone = {
        ...currentMilestone,
        description: '',
      };

      render(<MilestoneCard milestone={emptyDescMilestone} foalAge={45} isCurrent={true} />);
      // Should not render empty paragraph
      const paragraphs = screen.queryAllByText(/./);
      const descParagraph = paragraphs.find((p) =>
        p.className?.includes('text-sm text-slate-600 mt-2')
      );
      expect(descParagraph).toBeUndefined();
    });
  });

  describe('focus area display', () => {
    it('should display focus area when provided', () => {
      render(<MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={true} />);
      expect(screen.getByText('Focus:')).toBeInTheDocument();
      expect(screen.getByText('Social development')).toBeInTheDocument();
    });

    it('should not display focus area when undefined', () => {
      const noFocusMilestone = {
        ...currentMilestone,
        focus: undefined,
      };

      render(<MilestoneCard milestone={noFocusMilestone} foalAge={45} isCurrent={true} />);
      expect(screen.queryByText('Focus:')).not.toBeInTheDocument();
    });

    it('should not display focus area when empty string', () => {
      const emptyFocusMilestone = {
        ...currentMilestone,
        focus: '',
      };

      render(<MilestoneCard milestone={emptyFocusMilestone} foalAge={45} isCurrent={true} />);
      expect(screen.queryByText('Focus:')).not.toBeInTheDocument();
    });
  });

  describe('completed milestone details', () => {
    it('should display Award icon for score', () => {
      render(<MilestoneCard milestone={completedMilestone} foalAge={30} isCurrent={false} />);
      expect(screen.getByTestId('award-icon')).toBeInTheDocument();
    });

    it('should display score label', () => {
      render(<MilestoneCard milestone={completedMilestone} foalAge={30} isCurrent={false} />);
      expect(screen.getByText('Score:')).toBeInTheDocument();
    });

    it('should display score with + prefix for positive values', () => {
      render(<MilestoneCard milestone={completedMilestone} foalAge={30} isCurrent={false} />);
      expect(screen.getByText('+8')).toBeInTheDocument();
    });

    it('should use green color for scores >= 5', () => {
      render(<MilestoneCard milestone={completedMilestone} foalAge={30} isCurrent={false} />);
      const scoreText = screen.getByText('+8');
      expect(scoreText).toHaveClass('text-green-600');
    });

    it('should use blue color for scores 0-4', () => {
      const midScoreMilestone = {
        ...completedMilestone,
        score: 3,
      };

      render(<MilestoneCard milestone={midScoreMilestone} foalAge={30} isCurrent={false} />);
      const scoreText = screen.getByText('+3');
      expect(scoreText).toHaveClass('text-blue-600');
    });

    it('should use amber color for scores -5 to -1', () => {
      const lowScoreMilestone = {
        ...completedMilestone,
        score: -3,
      };

      render(<MilestoneCard milestone={lowScoreMilestone} foalAge={30} isCurrent={false} />);
      const scoreText = screen.getByText('-3');
      expect(scoreText).toHaveClass('text-amber-600');
    });

    it('should use red color for scores < -5', () => {
      const veryLowScoreMilestone = {
        ...completedMilestone,
        score: -8,
      };

      render(<MilestoneCard milestone={veryLowScoreMilestone} foalAge={30} isCurrent={false} />);
      const scoreText = screen.getByText('-8');
      expect(scoreText).toHaveClass('text-red-600');
    });

    it('should not display + prefix for score of 0', () => {
      const zeroScoreMilestone = {
        ...completedMilestone,
        score: 0,
      };

      render(<MilestoneCard milestone={zeroScoreMilestone} foalAge={30} isCurrent={false} />);
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.queryByText('+0')).not.toBeInTheDocument();
    });

    it('should not display score section when score is undefined', () => {
      const noScoreMilestone = {
        ...completedMilestone,
        score: undefined,
      };

      render(<MilestoneCard milestone={noScoreMilestone} foalAge={30} isCurrent={false} />);
      expect(screen.queryByText('Score:')).not.toBeInTheDocument();
    });

    it('should display "Traits Confirmed:" header', () => {
      render(<MilestoneCard milestone={completedMilestone} foalAge={30} isCurrent={false} />);
      expect(screen.getByText('Traits Confirmed:')).toBeInTheDocument();
    });

    it('should display all confirmed traits', () => {
      render(<MilestoneCard milestone={completedMilestone} foalAge={30} isCurrent={false} />);
      expect(screen.getByText('Steady Gait')).toBeInTheDocument();
      expect(screen.getByText('Strong Legs')).toBeInTheDocument();
    });

    it('should apply green badge styling to traits', () => {
      render(<MilestoneCard milestone={completedMilestone} foalAge={30} isCurrent={false} />);
      const traitBadge = screen.getByText('Steady Gait');
      expect(traitBadge).toHaveClass('bg-green-100');
      expect(traitBadge).toHaveClass('text-green-700');
    });

    it('should not display traits section when traitsConfirmed is empty', () => {
      const noTraitsMilestone = {
        ...completedMilestone,
        traitsConfirmed: [],
      };

      render(<MilestoneCard milestone={noTraitsMilestone} foalAge={30} isCurrent={false} />);
      expect(screen.queryByText('Traits Confirmed:')).not.toBeInTheDocument();
    });

    it('should not display traits section when traitsConfirmed is undefined', () => {
      const noTraitsMilestone = {
        ...completedMilestone,
        traitsConfirmed: undefined,
      };

      render(<MilestoneCard milestone={noTraitsMilestone} foalAge={30} isCurrent={false} />);
      expect(screen.queryByText('Traits Confirmed:')).not.toBeInTheDocument();
    });

    it('should not display completed details for non-completed milestones', () => {
      render(<MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={true} />);
      expect(screen.queryByText('Score:')).not.toBeInTheDocument();
      expect(screen.queryByText('Traits Confirmed:')).not.toBeInTheDocument();
    });
  });

  describe('pending milestone info', () => {
    it('should display "Begins in" text for pending milestone', () => {
      render(<MilestoneCard milestone={pendingMilestone} foalAge={45} isCurrent={false} />);
      expect(screen.getByText(/Begins in:/)).toBeInTheDocument();
    });

    it('should display days until milestone starts', () => {
      // foalAge 45, milestone starts at 91, so 46 days until
      render(<MilestoneCard milestone={pendingMilestone} foalAge={45} isCurrent={false} />);
      expect(screen.getByText('46 days')).toBeInTheDocument();
    });

    it('should not display pending info when daysUntil is 0', () => {
      render(<MilestoneCard milestone={pendingMilestone} foalAge={91} isCurrent={false} />);
      expect(screen.queryByText(/Begins in:/)).not.toBeInTheDocument();
    });

    it('should not display pending info for non-pending milestones', () => {
      render(<MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={true} />);
      expect(screen.queryByText(/Begins in:/)).not.toBeInTheDocument();
    });
  });

  describe('current milestone progress', () => {
    it('should display "Progress in window:" label', () => {
      render(<MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={true} />);
      expect(screen.getByText('Progress in window:')).toBeInTheDocument();
    });

    it('should display current day and max day', () => {
      render(<MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={true} />);
      expect(screen.getByText('Day 45 of 90')).toBeInTheDocument();
    });

    it('should render progress bar', () => {
      const { container } = render(
        <MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={true} />
      );
      const progressBar = container.querySelector('.bg-blue-600');
      expect(progressBar).toBeInTheDocument();
    });

    it('should calculate progress percentage correctly', () => {
      // foalAge 45, window 31-90
      // Progress: (45 - 31) / (90 - 31) = 14 / 59 = ~23.7%
      const { container } = render(
        <MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={true} />
      );
      const progressBar = container.querySelector('.bg-blue-600') as HTMLElement;
      const width = progressBar.style.width;
      // Check it's approximately 23.7%
      expect(width).toMatch(/2[34]\.?/); // 23 or 24 percent
    });

    it('should not exceed 100% progress', () => {
      // foalAge beyond max should cap at 100%
      const { container } = render(
        <MilestoneCard milestone={currentMilestone} foalAge={100} isCurrent={true} />
      );
      const progressBar = container.querySelector('.bg-blue-600') as HTMLElement;
      expect(progressBar.style.width).toBe('100%');
    });

    it('should show 0% progress at window start', () => {
      const { container } = render(
        <MilestoneCard milestone={currentMilestone} foalAge={31} isCurrent={true} />
      );
      const progressBar = container.querySelector('.bg-blue-600') as HTMLElement;
      expect(progressBar.style.width).toBe('0%');
    });

    it('should not display progress for non-current milestones', () => {
      render(<MilestoneCard milestone={currentMilestone} foalAge={45} isCurrent={false} />);
      expect(screen.queryByText('Progress in window:')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle milestone with all optional fields missing', () => {
      const minimalMilestone: Milestone = {
        id: 'minimal',
        type: 'minimal',
        name: 'Minimal Milestone',
        ageWindow: { min: 1, max: 30 },
        status: 'pending',
        requirements: [],
        rewards: { milestonePoints: 0, potentialTraits: [] },
      };

      render(<MilestoneCard milestone={minimalMilestone} foalAge={15} isCurrent={false} />);
      expect(screen.getByText('Minimal Milestone')).toBeInTheDocument();
      expect(screen.queryByText('Focus:')).not.toBeInTheDocument();
      expect(screen.queryByText('Score:')).not.toBeInTheDocument();
    });

    it('should handle single trait in traitsConfirmed', () => {
      const singleTraitMilestone = {
        ...completedMilestone,
        traitsConfirmed: ['Steady Gait'],
      };

      render(<MilestoneCard milestone={singleTraitMilestone} foalAge={30} isCurrent={false} />);
      expect(screen.getByText('Steady Gait')).toBeInTheDocument();
      expect(screen.queryByText('Strong Legs')).not.toBeInTheDocument();
    });

    it('should handle many traits in traitsConfirmed', () => {
      const manyTraitsMilestone = {
        ...completedMilestone,
        traitsConfirmed: ['Trait 1', 'Trait 2', 'Trait 3', 'Trait 4'],
      };

      render(<MilestoneCard milestone={manyTraitsMilestone} foalAge={30} isCurrent={false} />);
      expect(screen.getByText('Trait 1')).toBeInTheDocument();
      expect(screen.getByText('Trait 4')).toBeInTheDocument();
    });

    it('should handle very long milestone names', () => {
      const longNameMilestone = {
        ...currentMilestone,
        name: 'This is a very long milestone name that should still display correctly',
      };

      render(<MilestoneCard milestone={longNameMilestone} foalAge={45} isCurrent={true} />);
      expect(
        screen.getByText('This is a very long milestone name that should still display correctly')
      ).toBeInTheDocument();
    });

    it('should handle very wide age windows', () => {
      const wideWindowMilestone = {
        ...currentMilestone,
        ageWindow: { min: 1, max: 365 },
      };

      render(<MilestoneCard milestone={wideWindowMilestone} foalAge={180} isCurrent={true} />);
      expect(screen.getByText('Age Window: Days 1-365')).toBeInTheDocument();
    });
  });
});
