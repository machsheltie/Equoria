/**
 * Tests for EligibilityIndicator Component
 *
 * Tests cover:
 * - Eligibility states (Ready, Cooldown, Too Young, Too Old)
 * - Variant rendering (compact vs full)
 * - Icon display options
 * - Date formatting for cooldowns
 * - Accessibility (ARIA labels, semantic HTML)
 * - Edge cases
 *
 * Story 4-2: Training Eligibility Display - Task 1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import EligibilityIndicator from '../EligibilityIndicator';
import type { Horse } from '../../../lib/utils/training-utils';

describe('EligibilityIndicator', () => {
  // Mock the current date for consistent cooldown testing
  const mockCurrentDate = new Date('2026-01-30T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockCurrentDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==================== TEST DATA ====================
  // Ready to train horse (age 3-20, no cooldown)
  const readyHorse: Horse = {
    id: 1,
    name: 'Thunder',
    age: 5,
    health: 100,
    trainingCooldown: null,
    disciplineScores: {},
  };

  // Horse on cooldown (future date)
  const cooldownHorse: Horse = {
    id: 2,
    name: 'Storm',
    age: 7,
    health: 100,
    trainingCooldown: new Date('2026-02-03T12:00:00Z'), // 4 days in future
    disciplineScores: {},
  };

  // Horse on cooldown beyond a week
  const longCooldownHorse: Horse = {
    id: 3,
    name: 'Blaze',
    age: 8,
    health: 100,
    trainingCooldown: new Date('2026-02-15T12:00:00Z'), // 16 days in future
    disciplineScores: {},
  };

  // Too young horse (under 3)
  const youngHorse: Horse = {
    id: 4,
    name: 'Foal',
    age: 2,
    health: 100,
    trainingCooldown: null,
    disciplineScores: {},
  };

  // Too old horse (over 20)
  const oldHorse: Horse = {
    id: 5,
    name: 'Elder',
    age: 21,
    health: 100,
    trainingCooldown: null,
    disciplineScores: {},
  };

  // Horse at exact minimum age (3)
  const minAgeHorse: Horse = {
    id: 6,
    name: 'Junior',
    age: 3,
    health: 100,
    trainingCooldown: null,
    disciplineScores: {},
  };

  // Horse at exact maximum age (20)
  const maxAgeHorse: Horse = {
    id: 7,
    name: 'Senior',
    age: 20,
    health: 100,
    trainingCooldown: null,
    disciplineScores: {},
  };

  // Horse with cooldown in the past (should be eligible)
  const pastCooldownHorse: Horse = {
    id: 8,
    name: 'Available',
    age: 6,
    health: 100,
    trainingCooldown: new Date('2026-01-25T12:00:00Z'), // 5 days in past
    disciplineScores: {},
  };

  // ==================== ELIGIBILITY STATES TESTS ====================
  describe('Eligibility States', () => {
    it('should render "Ready to Train" for eligible horse (age 3-20, no cooldown)', () => {
      render(<EligibilityIndicator horse={readyHorse} />);

      expect(screen.getByText('Ready to Train')).toBeInTheDocument();
    });

    it('should render "On Cooldown" for horse with future cooldown date', () => {
      render(<EligibilityIndicator horse={cooldownHorse} />);

      expect(screen.getByText('On Cooldown')).toBeInTheDocument();
    });

    it('should render "Too Young" for horse under 3 years old', () => {
      render(<EligibilityIndicator horse={youngHorse} />);

      expect(screen.getByText('Too Young')).toBeInTheDocument();
    });

    it('should render "Too Old" for horse over 20 years old', () => {
      render(<EligibilityIndicator horse={oldHorse} />);

      expect(screen.getByText('Too Old')).toBeInTheDocument();
    });

    it('should show correct background color for ready state (green)', () => {
      const { container } = render(<EligibilityIndicator horse={readyHorse} />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('bg-green-100');
    });

    it('should show correct background color for cooldown state (amber)', () => {
      const { container } = render(<EligibilityIndicator horse={cooldownHorse} />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('bg-amber-100');
    });

    it('should show correct background color for too young state (gray)', () => {
      const { container } = render(<EligibilityIndicator horse={youngHorse} />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('bg-gray-100');
    });

    it('should show correct background color for too old state (red)', () => {
      const { container } = render(<EligibilityIndicator horse={oldHorse} />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('bg-red-100');
    });

    it('should show correct border color for ready state (green)', () => {
      const { container } = render(<EligibilityIndicator horse={readyHorse} />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('border-green-500');
    });

    it('should show correct border color for cooldown state (amber)', () => {
      const { container } = render(<EligibilityIndicator horse={cooldownHorse} />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('border-amber-500');
    });

    it('should show correct border color for too young state (gray)', () => {
      const { container } = render(<EligibilityIndicator horse={youngHorse} />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('border-gray-400');
    });

    it('should show correct border color for too old state (red)', () => {
      const { container } = render(<EligibilityIndicator horse={oldHorse} />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('border-red-500');
    });

    it('should show correct text color for ready state (green)', () => {
      const { container } = render(<EligibilityIndicator horse={readyHorse} />);

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toHaveClass('text-green-800');
    });

    it('should show correct text color for cooldown state (amber)', () => {
      const { container } = render(<EligibilityIndicator horse={cooldownHorse} />);

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toHaveClass('text-amber-800');
    });

    it('should show correct text color for too young state (gray)', () => {
      const { container } = render(<EligibilityIndicator horse={youngHorse} />);

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toHaveClass('text-gray-700');
    });

    it('should show correct text color for too old state (red)', () => {
      const { container } = render(<EligibilityIndicator horse={oldHorse} />);

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toHaveClass('text-red-800');
    });
  });

  // ==================== VARIANT RENDERING TESTS ====================
  describe('Variant Rendering', () => {
    it('should apply compact variant styles with smaller padding and text', () => {
      const { container } = render(<EligibilityIndicator horse={readyHorse} variant="compact" />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('px-2');
      expect(indicator).toHaveClass('py-1');

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toHaveClass('text-xs');
    });

    it('should apply full variant styles with standard padding and text', () => {
      const { container } = render(<EligibilityIndicator horse={readyHorse} variant="full" />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('px-3');
      expect(indicator).toHaveClass('py-2');

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toHaveClass('text-sm');
    });

    it('should default to full variant if not specified', () => {
      const { container } = render(<EligibilityIndicator horse={readyHorse} />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('px-3');
      expect(indicator).toHaveClass('py-2');

      const statusText = container.querySelector('[data-testid="status-text"]');
      expect(statusText).toHaveClass('text-sm');
    });

    it('should apply custom className when provided', () => {
      const { container } = render(
        <EligibilityIndicator horse={readyHorse} className="custom-test-class" />
      );

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('custom-test-class');
    });

    it('should have smaller icon in compact variant', () => {
      const { container } = render(<EligibilityIndicator horse={readyHorse} variant="compact" />);

      const icon = container.querySelector('[data-testid="status-icon"]');
      expect(icon).toHaveClass('w-4');
      expect(icon).toHaveClass('h-4');
    });

    it('should have standard icon size in full variant', () => {
      const { container } = render(<EligibilityIndicator horse={readyHorse} variant="full" />);

      const icon = container.querySelector('[data-testid="status-icon"]');
      expect(icon).toHaveClass('w-5');
      expect(icon).toHaveClass('h-5');
    });
  });

  // ==================== ICON DISPLAY TESTS ====================
  describe('Icon Display', () => {
    it('should show icon when showIcon is true (default)', () => {
      const { container } = render(<EligibilityIndicator horse={readyHorse} />);

      const icon = container.querySelector('[data-testid="status-icon"]');
      expect(icon).toBeInTheDocument();
    });

    it('should show icon when showIcon is explicitly true', () => {
      const { container } = render(<EligibilityIndicator horse={readyHorse} showIcon={true} />);

      const icon = container.querySelector('[data-testid="status-icon"]');
      expect(icon).toBeInTheDocument();
    });

    it('should hide icon when showIcon is false', () => {
      const { container } = render(<EligibilityIndicator horse={readyHorse} showIcon={false} />);

      const icon = container.querySelector('[data-testid="status-icon"]');
      expect(icon).not.toBeInTheDocument();
    });

    it('should render CheckCircle icon for ready state', () => {
      const { container } = render(<EligibilityIndicator horse={readyHorse} />);

      const icon = container.querySelector('[data-testid="status-icon"]');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-green-600');
      // Verify it's an SVG (Lucide icons render as SVG)
      expect(icon?.tagName.toLowerCase()).toBe('svg');
    });

    it('should render Clock icon for cooldown state', () => {
      const { container } = render(<EligibilityIndicator horse={cooldownHorse} />);

      const icon = container.querySelector('[data-testid="status-icon"]');
      expect(icon).toHaveClass('text-amber-600');
    });

    it('should render X icon for too young state', () => {
      const { container } = render(<EligibilityIndicator horse={youngHorse} />);

      const icon = container.querySelector('[data-testid="status-icon"]');
      expect(icon).toHaveClass('text-gray-500');
    });

    it('should render AlertCircle icon for too old state', () => {
      const { container } = render(<EligibilityIndicator horse={oldHorse} />);

      const icon = container.querySelector('[data-testid="status-icon"]');
      expect(icon).toHaveClass('text-red-600');
    });
  });

  // ==================== DATE FORMATTING TESTS ====================
  describe('Date Formatting', () => {
    it('should show formatted date when showDate is true and horse has cooldown', () => {
      render(<EligibilityIndicator horse={cooldownHorse} showDate={true} />);

      // Cooldown is 4 days away
      expect(screen.getByText('4 days')).toBeInTheDocument();
    });

    it('should hide date when showDate is false', () => {
      render(<EligibilityIndicator horse={cooldownHorse} showDate={false} />);

      expect(screen.queryByText(/days/)).not.toBeInTheDocument();
      expect(screen.queryByTestId('cooldown-date')).not.toBeInTheDocument();
    });

    it('should show date by default (showDate defaults to true)', () => {
      render(<EligibilityIndicator horse={cooldownHorse} />);

      const dateDisplay = screen.getByTestId('cooldown-date');
      expect(dateDisplay).toBeInTheDocument();
    });

    it('should display "Available in X days" format for cooldowns within a week', () => {
      render(<EligibilityIndicator horse={cooldownHorse} showDate={true} />);

      // 4 days cooldown
      expect(screen.getByText('4 days')).toBeInTheDocument();
    });

    it('should display specific date for cooldowns beyond a week', () => {
      render(<EligibilityIndicator horse={longCooldownHorse} showDate={true} />);

      // Should show the formatted date instead of days
      const dateDisplay = screen.getByTestId('cooldown-date');
      expect(dateDisplay).toBeInTheDocument();
      // Should contain a date format (e.g., "2/15/2026" or similar locale format)
      expect(dateDisplay.textContent).toMatch(/\d+/);
    });

    it('should not show date for ready horses', () => {
      render(<EligibilityIndicator horse={readyHorse} showDate={true} />);

      expect(screen.queryByTestId('cooldown-date')).not.toBeInTheDocument();
    });

    it('should display "1 day" (singular) for 1 day cooldown', () => {
      const oneDayCooldownHorse: Horse = {
        ...readyHorse,
        trainingCooldown: new Date('2026-01-31T12:00:00Z'), // 1 day in future
      };

      render(<EligibilityIndicator horse={oneDayCooldownHorse} showDate={true} />);

      expect(screen.getByText('1 day')).toBeInTheDocument();
    });
  });

  // ==================== ACCESSIBILITY TESTS ====================
  describe('Accessibility', () => {
    it('should have appropriate ARIA label for ready state', () => {
      const { container } = render(<EligibilityIndicator horse={readyHorse} />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveAttribute('aria-label', 'Training eligibility: Ready to Train');
    });

    it('should have appropriate ARIA label for cooldown state', () => {
      const { container } = render(<EligibilityIndicator horse={cooldownHorse} />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveAttribute('aria-label', 'Training eligibility: On Cooldown');
    });

    it('should have appropriate ARIA label for too young state', () => {
      const { container } = render(<EligibilityIndicator horse={youngHorse} />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveAttribute('aria-label', 'Training eligibility: Too Young');
    });

    it('should have appropriate ARIA label for too old state', () => {
      const { container } = render(<EligibilityIndicator horse={oldHorse} />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveAttribute('aria-label', 'Training eligibility: Too Old');
    });

    it('should have role attribute for status indication', () => {
      const { container } = render(<EligibilityIndicator horse={readyHorse} />);

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveAttribute('role', 'status');
    });

    it('should have screen reader friendly text', () => {
      render(<EligibilityIndicator horse={readyHorse} />);

      // The status text should be visible to screen readers
      expect(screen.getByText('Ready to Train')).toBeInTheDocument();
    });

    it('should have icons with aria-hidden="true"', () => {
      const { container } = render(<EligibilityIndicator horse={readyHorse} />);

      const icon = container.querySelector('[data-testid="status-icon"]');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('should include reason in ARIA label for ineligible states', () => {
      const { container } = render(<EligibilityIndicator horse={youngHorse} />);

      // Should have descriptive text for screen readers
      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveAttribute('aria-label');
    });
  });

  // ==================== EDGE CASES TESTS ====================
  describe('Edge Cases', () => {
    it('should handle horse at exactly age 3 (eligible)', () => {
      render(<EligibilityIndicator horse={minAgeHorse} />);

      expect(screen.getByText('Ready to Train')).toBeInTheDocument();
    });

    it('should handle horse at exactly age 20 (still eligible)', () => {
      render(<EligibilityIndicator horse={maxAgeHorse} />);

      expect(screen.getByText('Ready to Train')).toBeInTheDocument();
    });

    it('should handle horse with cooldown date in the past (eligible)', () => {
      render(<EligibilityIndicator horse={pastCooldownHorse} />);

      expect(screen.getByText('Ready to Train')).toBeInTheDocument();
    });

    it('should handle missing optional props gracefully', () => {
      // Horse with minimal data
      const minimalHorse: Horse = {
        id: 10,
        name: 'Minimal',
        age: 5,
      };

      // Should not throw and should render
      expect(() => render(<EligibilityIndicator horse={minimalHorse} />)).not.toThrow();
      expect(screen.getByText('Ready to Train')).toBeInTheDocument();
    });

    it('should handle horse with undefined cooldown', () => {
      const undefinedCooldownHorse: Horse = {
        id: 11,
        name: 'NoCooldown',
        age: 6,
        trainingCooldown: undefined,
      };

      render(<EligibilityIndicator horse={undefinedCooldownHorse} />);
      expect(screen.getByText('Ready to Train')).toBeInTheDocument();
    });

    it('should handle horse with cooldown as string', () => {
      const stringCooldownHorse: Horse = {
        id: 12,
        name: 'StringCooldown',
        age: 6,
        trainingCooldown: '2026-02-05T12:00:00Z', // 6 days in future
      };

      render(<EligibilityIndicator horse={stringCooldownHorse} showDate={true} />);
      expect(screen.getByText('On Cooldown')).toBeInTheDocument();
      expect(screen.getByText('6 days')).toBeInTheDocument();
    });

    it('should handle zero age horse', () => {
      const zeroAgeHorse: Horse = {
        id: 13,
        name: 'Newborn',
        age: 0,
      };

      render(<EligibilityIndicator horse={zeroAgeHorse} />);
      expect(screen.getByText('Too Young')).toBeInTheDocument();
    });

    it('should handle very old horse (age 100)', () => {
      const veryOldHorse: Horse = {
        id: 14,
        name: 'Ancient',
        age: 100,
      };

      render(<EligibilityIndicator horse={veryOldHorse} />);
      expect(screen.getByText('Too Old')).toBeInTheDocument();
    });

    it('should handle combined variant and className props', () => {
      const { container } = render(
        <EligibilityIndicator horse={readyHorse} variant="compact" className="mt-4 mb-2" />
      );

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('px-2', 'py-1', 'mt-4', 'mb-2');
    });

    it('should handle all props being explicitly set', () => {
      const { container } = render(
        <EligibilityIndicator
          horse={cooldownHorse}
          variant="compact"
          showIcon={true}
          showDate={true}
          className="custom-class"
        />
      );

      const indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass('custom-class');
      expect(screen.getByText('On Cooldown')).toBeInTheDocument();
      expect(screen.getByTestId('cooldown-date')).toBeInTheDocument();
    });
  });

  // ==================== INTEGRATION TESTS ====================
  describe('Integration', () => {
    it('should correctly use canTrain utility for eligibility determination', () => {
      // Test that the component correctly integrates with canTrain
      render(<EligibilityIndicator horse={readyHorse} />);
      expect(screen.getByText('Ready to Train')).toBeInTheDocument();

      // Cleanup and render young horse
      const { unmount } = render(<EligibilityIndicator horse={youngHorse} />);
      expect(screen.getAllByText('Too Young').length).toBeGreaterThan(0);
      unmount();
    });

    it('should correctly use formatCooldownDate utility for date display', () => {
      render(<EligibilityIndicator horse={cooldownHorse} showDate={true} />);

      // Should use formatCooldownDate which returns "X days" format for <7 days
      expect(screen.getByText('4 days')).toBeInTheDocument();
    });

    it('should render different states for multiple horses', () => {
      const { rerender } = render(<EligibilityIndicator horse={readyHorse} />);
      expect(screen.getByText('Ready to Train')).toBeInTheDocument();

      rerender(<EligibilityIndicator horse={cooldownHorse} />);
      expect(screen.getByText('On Cooldown')).toBeInTheDocument();

      rerender(<EligibilityIndicator horse={youngHorse} />);
      expect(screen.getByText('Too Young')).toBeInTheDocument();

      rerender(<EligibilityIndicator horse={oldHorse} />);
      expect(screen.getByText('Too Old')).toBeInTheDocument();
    });

    it('should maintain consistent styling across all states', () => {
      const { container, rerender } = render(<EligibilityIndicator horse={readyHorse} />);

      // All states should have the common base classes
      let indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('flex', 'items-center', 'gap-2', 'rounded-lg', 'border-2');

      rerender(<EligibilityIndicator horse={cooldownHorse} />);
      indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('flex', 'items-center', 'gap-2', 'rounded-lg', 'border-2');

      rerender(<EligibilityIndicator horse={youngHorse} />);
      indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('flex', 'items-center', 'gap-2', 'rounded-lg', 'border-2');

      rerender(<EligibilityIndicator horse={oldHorse} />);
      indicator = container.querySelector('[data-testid="eligibility-indicator"]');
      expect(indicator).toHaveClass('flex', 'items-center', 'gap-2', 'rounded-lg', 'border-2');
    });
  });
});
