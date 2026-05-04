/**
 * Tests for MilestoneTooltip Component
 *
 * Testing Sprint - Story 6-2: Foal Milestone Timeline
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Active/inactive state handling
 * - Null/empty payload handling
 * - Status-based rendering (completed, current, pending)
 * - Status icons and colors (CheckCircle, Target, Clock)
 * - Milestone details (name, age, progress)
 * - Progress bar visualization and color coding
 * - Score display (conditional on completed status)
 * - Traits confirmation display
 * - Edge cases (empty traits, undefined score, missing data)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MilestoneTooltip from '../MilestoneTooltip';
import type { MilestoneTooltipProps } from '../MilestoneTooltip';

describe('MilestoneTooltip Component', () => {
  describe('inactive/null rendering', () => {
    it('should return null when active is false', () => {
      const { container } = render(<MilestoneTooltip active={false} payload={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('should return null when active is undefined', () => {
      const { container } = render(<MilestoneTooltip payload={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('should return null when payload is undefined', () => {
      const { container } = render(<MilestoneTooltip active={true} />);
      expect(container.firstChild).toBeNull();
    });

    it('should return null when payload is empty array', () => {
      const { container } = render(<MilestoneTooltip active={true} payload={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render when active is true and payload has data', () => {
      const { container } = render(
        <MilestoneTooltip
          active={true}
          payload={[
            {
              payload: {
                name: 'Test Milestone',
                ageDay: 30,
                progress: 50,
                status: 'pending',
                completed: false,
                current: false,
                traits: [],
              },
            },
          ]}
        />
      );
      // Component migrated to dark theme: tooltip wrapper uses bg-[rgba(15,35,70,0.95)]
      expect(
        container.querySelector('.bg-\\[rgba\\(15\\,35\\,70\\,0\\.95\\)\\]')
      ).toBeInTheDocument();
    });
  });

  describe('completed milestone status', () => {
    const completedPayload: MilestoneTooltipProps = {
      active: true,
      payload: [
        {
          payload: {
            name: 'First Steps',
            ageDay: 1,
            progress: 100,
            status: 'completed',
            completed: true,
            current: false,
            traits: ['Steady Gait'],
            score: 8,
          },
        },
      ],
    };

    it('should display CheckCircle icon for completed status', () => {
      // Component migrated to dark theme: completed icon uses text-emerald-400
      const { container } = render(<MilestoneTooltip {...completedPayload} />);
      expect(container.querySelector('.text-emerald-400')).toBeInTheDocument();
    });

    it('should display "Completed" label', () => {
      // Component migrated to dark theme: label uses text-emerald-400
      render(<MilestoneTooltip {...completedPayload} />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toHaveClass('text-emerald-400');
    });

    it('should show green progress bar for completed status', () => {
      const { container } = render(<MilestoneTooltip {...completedPayload} />);
      const progressBar = container.querySelector('.bg-green-500');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    it('should display evaluation score when status is completed', () => {
      render(<MilestoneTooltip {...completedPayload} />);
      expect(screen.getByText('Evaluation Score:')).toBeInTheDocument();
      expect(screen.getByText('+8')).toBeInTheDocument();
    });

    it('should use green color for high scores (>= 5)', () => {
      // Component migrated to dark theme: score >=5 uses text-emerald-400
      render(<MilestoneTooltip {...completedPayload} />);
      const scoreElement = screen.getByText('+8');
      expect(scoreElement).toHaveClass('text-emerald-400');
    });

    it('should use blue color for mid scores (0-4)', () => {
      const midScorePayload = {
        ...completedPayload,
        payload: [
          {
            ...completedPayload.payload![0],
            payload: {
              ...completedPayload.payload![0].payload,
              score: 3,
            },
          },
        ],
      };
      render(<MilestoneTooltip {...midScorePayload} />);
      // Component migrated to dark theme: score 0-4 uses text-blue-400
      const scoreElement = screen.getByText('+3');
      expect(scoreElement).toHaveClass('text-blue-400');
    });

    it('should use amber color for negative scores', () => {
      const negativeScorePayload = {
        ...completedPayload,
        payload: [
          {
            ...completedPayload.payload![0],
            payload: {
              ...completedPayload.payload![0].payload,
              score: -2,
            },
          },
        ],
      };
      render(<MilestoneTooltip {...negativeScorePayload} />);
      // Component migrated to dark theme: negative score uses text-amber-400
      const scoreElement = screen.getByText('-2');
      expect(scoreElement).toHaveClass('text-amber-400');
    });

    it('should not display + sign for negative scores', () => {
      const negativeScorePayload = {
        ...completedPayload,
        payload: [
          {
            ...completedPayload.payload![0],
            payload: {
              ...completedPayload.payload![0].payload,
              score: -2,
            },
          },
        ],
      };
      render(<MilestoneTooltip {...negativeScorePayload} />);
      expect(screen.getByText('-2')).toBeInTheDocument();
      expect(screen.queryByText('+-2')).not.toBeInTheDocument();
    });
  });

  describe('current milestone status', () => {
    const currentPayload: MilestoneTooltipProps = {
      active: true,
      payload: [
        {
          payload: {
            name: 'Socialization',
            ageDay: 45,
            progress: 60,
            status: 'current',
            completed: false,
            current: true,
            traits: [],
          },
        },
      ],
    };

    it('should display Target icon for current status', () => {
      // Component migrated to dark theme: current uses text-blue-400
      const { container } = render(<MilestoneTooltip {...currentPayload} />);
      expect(container.querySelector('.text-blue-400')).toBeInTheDocument();
    });

    it('should display "In Progress" label', () => {
      // Component migrated to dark theme: current label uses text-blue-400
      render(<MilestoneTooltip {...currentPayload} />);
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toHaveClass('text-blue-400');
    });

    it('should show blue progress bar for current status', () => {
      const { container } = render(<MilestoneTooltip {...currentPayload} />);
      const progressBar = container.querySelector('.bg-blue-500');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveStyle({ width: '60%' });
    });

    it('should not display evaluation score when not completed', () => {
      render(<MilestoneTooltip {...currentPayload} />);
      expect(screen.queryByText('Evaluation Score:')).not.toBeInTheDocument();
    });
  });

  describe('pending milestone status', () => {
    const pendingPayload: MilestoneTooltipProps = {
      active: true,
      payload: [
        {
          payload: {
            name: 'Advanced Training',
            ageDay: 180,
            progress: 0,
            status: 'pending',
            completed: false,
            current: false,
            traits: [],
          },
        },
      ],
    };

    it('should display Clock icon for pending status', () => {
      // Component migrated to dark theme: pending uses text-[rgb(148,163,184)]
      const { container } = render(<MilestoneTooltip {...pendingPayload} />);
      expect(container.querySelector('.text-\\[rgb\\(148\\,163\\,184\\)\\]')).toBeInTheDocument();
    });

    it('should display "Upcoming" label', () => {
      // Component migrated to dark theme: pending label uses text-[rgb(148,163,184)]
      render(<MilestoneTooltip {...pendingPayload} />);
      expect(screen.getByText('Upcoming')).toBeInTheDocument();
      expect(screen.getByText('Upcoming')).toHaveClass('text-[rgb(148,163,184)]');
    });

    it('should show gray progress bar for pending status', () => {
      // Component migrated to dark theme: pending bar uses bg-[rgb(148,163,184)]
      const { container } = render(<MilestoneTooltip {...pendingPayload} />);
      const progressBar = container.querySelector('.bg-\\[rgb\\(148\\,163\\,184\\)\\]');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('should not display evaluation score for pending milestones', () => {
      render(<MilestoneTooltip {...pendingPayload} />);
      expect(screen.queryByText('Evaluation Score:')).not.toBeInTheDocument();
    });
  });

  describe('milestone details', () => {
    const detailsPayload: MilestoneTooltipProps = {
      active: true,
      payload: [
        {
          payload: {
            name: 'Weaning',
            ageDay: 120,
            progress: 75,
            status: 'current',
            completed: false,
            current: true,
            traits: [],
          },
        },
      ],
    };

    it('should display milestone name', () => {
      render(<MilestoneTooltip {...detailsPayload} />);
      expect(screen.getByText('Weaning')).toBeInTheDocument();
    });

    it('should display age window with "Day" prefix', () => {
      render(<MilestoneTooltip {...detailsPayload} />);
      expect(screen.getByText('Age Window:')).toBeInTheDocument();
      expect(screen.getByText('Day 120+')).toBeInTheDocument();
    });

    it('should display progress percentage', () => {
      render(<MilestoneTooltip {...detailsPayload} />);
      expect(screen.getByText('Progress:')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should render progress bar with correct width', () => {
      const { container } = render(<MilestoneTooltip {...detailsPayload} />);
      const progressBar = container.querySelector('.bg-blue-500');
      expect(progressBar).toHaveStyle({ width: '75%' });
    });
  });

  describe('traits confirmation', () => {
    it('should display traits section when traits array has items', () => {
      const traitsPayload: MilestoneTooltipProps = {
        active: true,
        payload: [
          {
            payload: {
              name: 'First Steps',
              ageDay: 1,
              progress: 100,
              status: 'completed',
              completed: true,
              current: false,
              traits: ['Steady Gait', 'Strong Legs'],
            },
          },
        ],
      };

      render(<MilestoneTooltip {...traitsPayload} />);
      expect(screen.getByText('Traits Confirmed:')).toBeInTheDocument();
      expect(screen.getByText('Steady Gait')).toBeInTheDocument();
      expect(screen.getByText('Strong Legs')).toBeInTheDocument();
    });

    it('should apply trait badge styling', () => {
      const traitsPayload: MilestoneTooltipProps = {
        active: true,
        payload: [
          {
            payload: {
              name: 'First Steps',
              ageDay: 1,
              progress: 100,
              status: 'completed',
              completed: true,
              current: false,
              traits: ['Steady Gait'],
            },
          },
        ],
      };

      render(<MilestoneTooltip {...traitsPayload} />);
      // Component migrated to dark theme: trait badge uses translucent emerald + emerald-400
      const traitBadge = screen.getByText('Steady Gait');
      expect(traitBadge).toHaveClass('bg-[rgba(16,185,129,0.15)]');
      expect(traitBadge).toHaveClass('text-emerald-400');
    });

    it('should not display traits section when traits array is empty', () => {
      const noTraitsPayload: MilestoneTooltipProps = {
        active: true,
        payload: [
          {
            payload: {
              name: 'Test',
              ageDay: 30,
              progress: 50,
              status: 'pending',
              completed: false,
              current: false,
              traits: [],
            },
          },
        ],
      };

      render(<MilestoneTooltip {...noTraitsPayload} />);
      expect(screen.queryByText('Traits Confirmed:')).not.toBeInTheDocument();
    });

    it('should handle multiple traits (3+ traits)', () => {
      const multipleTraitsPayload: MilestoneTooltipProps = {
        active: true,
        payload: [
          {
            payload: {
              name: 'Milestone',
              ageDay: 90,
              progress: 100,
              status: 'completed',
              completed: true,
              current: false,
              traits: ['Trait One', 'Trait Two', 'Trait Three', 'Trait Four'],
            },
          },
        ],
      };

      render(<MilestoneTooltip {...multipleTraitsPayload} />);
      expect(screen.getByText('Trait One')).toBeInTheDocument();
      expect(screen.getByText('Trait Two')).toBeInTheDocument();
      expect(screen.getByText('Trait Three')).toBeInTheDocument();
      expect(screen.getByText('Trait Four')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle score of 0 (no + sign)', () => {
      const zeroScorePayload: MilestoneTooltipProps = {
        active: true,
        payload: [
          {
            payload: {
              name: 'Test',
              ageDay: 30,
              progress: 100,
              status: 'completed',
              completed: true,
              current: false,
              traits: [],
              score: 0,
            },
          },
        ],
      };

      render(<MilestoneTooltip {...zeroScorePayload} />);
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.queryByText('+0')).not.toBeInTheDocument();
    });

    it('should not display score when score is undefined', () => {
      const noScorePayload: MilestoneTooltipProps = {
        active: true,
        payload: [
          {
            payload: {
              name: 'Test',
              ageDay: 30,
              progress: 100,
              status: 'completed',
              completed: true,
              current: false,
              traits: [],
              // score is undefined
            },
          },
        ],
      };

      render(<MilestoneTooltip {...noScorePayload} />);
      expect(screen.queryByText('Evaluation Score:')).not.toBeInTheDocument();
    });

    it('should handle ageDay of 0', () => {
      const zeroAgePayload: MilestoneTooltipProps = {
        active: true,
        payload: [
          {
            payload: {
              name: 'Birth',
              ageDay: 0,
              progress: 100,
              status: 'completed',
              completed: true,
              current: false,
              traits: [],
            },
          },
        ],
      };

      render(<MilestoneTooltip {...zeroAgePayload} />);
      expect(screen.getByText('Day 0+')).toBeInTheDocument();
    });

    it('should handle progress of 0%', () => {
      const zeroProgressPayload: MilestoneTooltipProps = {
        active: true,
        payload: [
          {
            payload: {
              name: 'Future Milestone',
              ageDay: 365,
              progress: 0,
              status: 'pending',
              completed: false,
              current: false,
              traits: [],
            },
          },
        ],
      };

      const { container } = render(<MilestoneTooltip {...zeroProgressPayload} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
      // Component migrated to dark theme: pending bar uses bg-[rgb(148,163,184)]
      const progressBar = container.querySelector('.bg-\\[rgb\\(148\\,163\\,184\\)\\]');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('should handle empty name string', () => {
      const emptyNamePayload: MilestoneTooltipProps = {
        active: true,
        payload: [
          {
            payload: {
              name: '',
              ageDay: 30,
              progress: 50,
              status: 'pending',
              completed: false,
              current: false,
              traits: [],
            },
          },
        ],
      };

      const { container } = render(<MilestoneTooltip {...emptyNamePayload} />);
      // Component should still render even with empty name (migrated to dark theme wrapper)
      expect(
        container.querySelector('.bg-\\[rgba\\(15\\,35\\,70\\,0\\.95\\)\\]')
      ).toBeInTheDocument();
    });

    it('should handle very high progress values', () => {
      const highProgressPayload: MilestoneTooltipProps = {
        active: true,
        payload: [
          {
            payload: {
              name: 'Test',
              ageDay: 30,
              progress: 150, // Edge case: over 100%
              status: 'current',
              completed: false,
              current: true,
              traits: [],
            },
          },
        ],
      };

      const { container } = render(<MilestoneTooltip {...highProgressPayload} />);
      expect(screen.getByText('150%')).toBeInTheDocument();
      const progressBar = container.querySelector('.bg-blue-500');
      expect(progressBar).toHaveStyle({ width: '150%' }); // Component doesn't clamp, test actual behavior
    });
  });

  describe('tooltip structure', () => {
    it('should render with correct container styling', () => {
      const payload: MilestoneTooltipProps = {
        active: true,
        payload: [
          {
            payload: {
              name: 'Test',
              ageDay: 30,
              progress: 50,
              status: 'pending',
              completed: false,
              current: false,
              traits: [],
            },
          },
        ],
      };

      const { container } = render(<MilestoneTooltip {...payload} />);
      // Component migrated to dark theme — bg + cobalt border replaces bg-white + gray-200
      const wrapper = container.querySelector(
        '.bg-\\[rgba\\(15\\,35\\,70\\,0\\.95\\)\\].border.rounded-lg.p-4.shadow-lg.max-w-xs'
      );
      expect(wrapper).toBeInTheDocument();
    });

    it('should have proper spacing between sections', () => {
      const payload: MilestoneTooltipProps = {
        active: true,
        payload: [
          {
            payload: {
              name: 'Test',
              ageDay: 30,
              progress: 50,
              status: 'completed',
              completed: true,
              current: false,
              traits: ['Trait'],
              score: 5,
            },
          },
        ],
      };

      const { container } = render(<MilestoneTooltip {...payload} />);
      // Check for space-y-2 class (spacing between details)
      const detailsSection = container.querySelector('.space-y-2');
      expect(detailsSection).toBeInTheDocument();
    });

    it('should have border-top separators for score and traits sections', () => {
      const payload: MilestoneTooltipProps = {
        active: true,
        payload: [
          {
            payload: {
              name: 'Test',
              ageDay: 30,
              progress: 100,
              status: 'completed',
              completed: true,
              current: false,
              traits: ['Trait'],
              score: 5,
            },
          },
        ],
      };

      const { container } = render(<MilestoneTooltip {...payload} />);
      // Component migrated to dark theme — border-t separators use translucent cobalt
      const borderedSections = container.querySelectorAll(
        '.border-t.border-\\[rgba\\(37\\,99\\,235\\,0\\.3\\)\\]'
      );
      // Should have at least 2 bordered sections (score and traits)
      expect(borderedSections.length).toBeGreaterThanOrEqual(2);
    });
  });
});
