/**
 * Tests for TraitModifierTooltip Component
 *
 * Comprehensive test suite covering:
 * - Rendering tests (4): Basic rendering and visibility
 * - Keyboard navigation tests (4): Focus, blur, escape key handling
 * - Content display tests (6): Trait info, effect, disciplines, description
 * - Effect description tests (3): Positive, negative, neutral formatting
 * - Discipline formatting tests (3): All disciplines, multiple, formatting utility
 * - Interaction tests (3): Learn more callback, hover persistence
 * - Accessibility tests (3): ARIA roles, labels, ids
 *
 * Story: Training Trait Modifiers - Task 2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TraitModifierTooltip, { type TraitModifier } from '../TraitModifierTooltip';

// Mock the formatDisciplineName utility
vi.mock('../../../lib/utils/training-utils', () => ({
  formatDisciplineName: vi.fn((id: string) => {
    const names: Record<string, string> = {
      racing: 'Racing',
      'show-jumping': 'Show Jumping',
      'barrel-racing': 'Barrel Racing',
      dressage: 'Dressage',
      eventing: 'Eventing',
    };
    return names[id] || id;
  }),
}));

describe('TraitModifierTooltip', () => {
  // ==================== TEST DATA ====================
  const positiveModifier: TraitModifier = {
    traitId: 'athletic',
    traitName: 'Athletic',
    effect: 3,
    description: 'Enhances physical disciplines with increased stamina and speed.',
    affectedDisciplines: ['racing', 'show-jumping'],
    category: 'positive',
  };

  const negativeModifier: TraitModifier = {
    traitId: 'nervous',
    traitName: 'Nervous',
    effect: -2,
    description: 'Reduces performance under pressure situations.',
    affectedDisciplines: ['dressage', 'show-jumping'],
    category: 'negative',
  };

  const neutralModifier: TraitModifier = {
    traitId: 'calm',
    traitName: 'Calm',
    effect: 0,
    description: 'Maintains consistent performance regardless of conditions.',
    affectedDisciplines: ['dressage'],
    category: 'neutral',
  };

  const allDisciplinesModifier: TraitModifier = {
    traitId: 'versatile',
    traitName: 'Versatile',
    effect: 1,
    description: 'Provides a small bonus across all training disciplines.',
    affectedDisciplines: ['all'],
    category: 'positive',
  };

  // Setup and teardown for timers
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==================== RENDERING TESTS (4) ====================
  describe('Rendering Tests', () => {
    it('should render trigger element (children)', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Athletic Badge</span>
        </TraitModifierTooltip>
      );

      expect(screen.getByTestId('trigger')).toBeInTheDocument();
      expect(screen.getByText('Athletic Badge')).toBeInTheDocument();
    });

    it('should have tooltip hidden by default', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span>Trigger</span>
        </TraitModifierTooltip>
      );

      // Tooltip content should not be visible
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should show tooltip on mouse enter after delay', async () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);

      // Should not show immediately
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Advance timer past the 200ms delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('should hide tooltip on mouse leave', async () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;

      // Show tooltip
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // Hide tooltip (needs to advance timer due to small delay for tooltip hover transition)
      fireEvent.mouseLeave(trigger);
      act(() => {
        vi.advanceTimersByTime(20);
      });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  // ==================== KEYBOARD NAVIGATION TESTS (4) ====================
  describe('Keyboard Navigation Tests', () => {
    it('should show tooltip on focus after delay', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.focus(trigger);

      // Should not show immediately
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Advance timer past the delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('should hide tooltip on blur', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;

      // Show tooltip
      fireEvent.focus(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // Hide tooltip on blur
      fireEvent.blur(trigger);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should close tooltip on Escape key press', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;

      // Show tooltip
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(trigger, { key: 'Escape' });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should make trigger focusable with tabIndex', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      expect(trigger).toHaveAttribute('tabIndex', '0');
    });
  });

  // ==================== CONTENT DISPLAY TESTS (6) ====================
  describe('Content Display Tests', () => {
    it('should display trait name as heading', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Find heading with trait name
      expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Athletic');
    });

    it('should show effect description', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByText(/Effect:/)).toBeInTheDocument();
    });

    it('should show affected disciplines list', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByText(/Disciplines:/)).toBeInTheDocument();
    });

    it('should show description text', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(
        screen.getByText('Enhances physical disciplines with increased stamina and speed.')
      ).toBeInTheDocument();
    });

    it('should show Learn More button when callback is provided', () => {
      const onLearnMore = vi.fn();

      render(
        <TraitModifierTooltip modifier={positiveModifier} onLearnMore={onLearnMore}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByRole('button', { name: /learn more/i })).toBeInTheDocument();
    });

    it('should hide Learn More button when no callback provided', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.queryByRole('button', { name: /learn more/i })).not.toBeInTheDocument();
    });
  });

  // ==================== EFFECT DESCRIPTION TESTS (3) ====================
  describe('Effect Description Tests', () => {
    it('should show positive effect with "+N to..." format', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Should show "+3 to" somewhere in the tooltip
      expect(screen.getByText(/\+3 to/)).toBeInTheDocument();
    });

    it('should show negative effect with "-N to..." format', () => {
      render(
        <TraitModifierTooltip modifier={negativeModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Should show "-2 to" somewhere in the tooltip
      expect(screen.getByText(/-2 to/)).toBeInTheDocument();
    });

    it('should show "No effect on training" for neutral traits', () => {
      render(
        <TraitModifierTooltip modifier={neutralModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByText(/No effect on training/)).toBeInTheDocument();
    });
  });

  // ==================== DISCIPLINE FORMATTING TESTS (3) ====================
  describe('Discipline Formatting Tests', () => {
    it('should show "All disciplines" when affectedDisciplines includes "all"', () => {
      render(
        <TraitModifierTooltip modifier={allDisciplinesModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByText(/All disciplines/)).toBeInTheDocument();
    });

    it('should format multiple disciplines correctly with commas', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Should show formatted disciplines: "Racing, Show Jumping"
      expect(screen.getByText(/Racing, Show Jumping/)).toBeInTheDocument();
    });

    it('should use formatDisciplineName utility for discipline display', async () => {
      const { formatDisciplineName } = await import('../../../lib/utils/training-utils');

      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Verify formatDisciplineName was called for each discipline
      expect(formatDisciplineName).toHaveBeenCalledWith('racing');
      expect(formatDisciplineName).toHaveBeenCalledWith('show-jumping');
    });
  });

  // ==================== INTERACTION TESTS (3) ====================
  describe('Interaction Tests', () => {
    it('should call onLearnMore callback when Learn More is clicked', () => {
      vi.useRealTimers(); // Need real timers for user event
      const onLearnMore = vi.fn();

      render(
        <TraitModifierTooltip modifier={positiveModifier} onLearnMore={onLearnMore}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);

      // Wait for tooltip to appear
      return waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      }).then(() => {
        const learnMoreButton = screen.getByRole('button', { name: /learn more/i });
        fireEvent.click(learnMoreButton);

        expect(onLearnMore).toHaveBeenCalledTimes(1);
      });
    });

    it('should keep tooltip visible when hovering tooltip itself', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;

      // Show tooltip
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toBeInTheDocument();

      // Leave trigger but enter tooltip
      fireEvent.mouseLeave(trigger);
      fireEvent.mouseEnter(tooltip);

      // Tooltip should still be visible
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('should handle multiple show/hide cycles correctly', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;

      // Cycle 1: Show
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // Cycle 1: Hide (advance timer for small hide delay)
      fireEvent.mouseLeave(trigger);
      act(() => {
        vi.advanceTimersByTime(20);
      });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Cycle 2: Show
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // Cycle 2: Hide (advance timer for small hide delay)
      fireEvent.mouseLeave(trigger);
      act(() => {
        vi.advanceTimersByTime(20);
      });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Cycle 3: Show again
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  // ==================== ACCESSIBILITY TESTS (3) ====================
  describe('Accessibility Tests', () => {
    it('should have role="tooltip" on tooltip content', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('should have aria-describedby on trigger pointing to tooltip id', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      const tooltip = screen.getByRole('tooltip');
      const tooltipId = tooltip.getAttribute('id');

      expect(tooltipId).toBeTruthy();
      expect(trigger).toHaveAttribute('aria-describedby', tooltipId);
    });

    it('should have unique id on tooltip', () => {
      render(
        <>
          <TraitModifierTooltip modifier={positiveModifier}>
            <span data-testid="trigger-1">Trigger 1</span>
          </TraitModifierTooltip>
          <TraitModifierTooltip modifier={negativeModifier}>
            <span data-testid="trigger-2">Trigger 2</span>
          </TraitModifierTooltip>
        </>
      );

      const trigger1 = screen.getByTestId('trigger-1').parentElement!;
      const trigger2 = screen.getByTestId('trigger-2').parentElement!;

      // Show both tooltips
      fireEvent.mouseEnter(trigger1);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      fireEvent.mouseEnter(trigger2);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      const tooltips = screen.getAllByRole('tooltip');
      const ids = tooltips.map((t) => t.getAttribute('id'));

      // Verify unique IDs
      expect(ids[0]).not.toBe(ids[1]);
      expect(ids[0]).toMatch(/tooltip-/);
      expect(ids[1]).toMatch(/tooltip-/);
    });
  });

  // ==================== ADDITIONAL EDGE CASE TESTS ====================
  describe('Edge Case Tests', () => {
    it('should cancel show delay if mouse leaves before delay completes', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;

      // Start hovering
      fireEvent.mouseEnter(trigger);

      // Leave before 200ms
      act(() => {
        vi.advanceTimersByTime(100);
      });
      fireEvent.mouseLeave(trigger);

      // Wait for the remaining time
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Tooltip should not appear
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should handle single discipline without comma', () => {
      const singleDisciplineModifier: TraitModifier = {
        traitId: 'focused',
        traitName: 'Focused',
        effect: 2,
        description: 'Improves concentration during dressage.',
        affectedDisciplines: ['dressage'],
        category: 'positive',
      };

      render(
        <TraitModifierTooltip modifier={singleDisciplineModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Should show "Dressage" without trailing comma
      const disciplineText = screen.getByText(/Dressage/);
      expect(disciplineText.textContent).not.toMatch(/Dressage,/);
    });

    it('should position tooltip below trigger by default', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('mt-2');
    });

    it('should close tooltip when mouse leaves tooltip area', () => {
      render(
        <TraitModifierTooltip modifier={positiveModifier}>
          <span data-testid="trigger">Trigger</span>
        </TraitModifierTooltip>
      );

      const trigger = screen.getByTestId('trigger').parentElement!;

      // Show tooltip
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });
      const tooltip = screen.getByRole('tooltip');

      // Move to tooltip
      fireEvent.mouseLeave(trigger);
      fireEvent.mouseEnter(tooltip);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // Leave tooltip
      fireEvent.mouseLeave(tooltip);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
