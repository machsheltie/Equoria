/**
 * HorseSelectionCard Component Tests
 *
 * Tests for the individual horse selection card component including:
 * - Component rendering (horse details, eligibility badge, stats)
 * - Eligibility states (6 different states with color-coded badges)
 * - Horse selection (checkbox toggle, disabled state)
 * - Stats display (top 3 relevant stats)
 * - Performance preview (expected score)
 *
 * Story 5-1: Competition Entry System - Task 5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HorseSelectionCard, {
  type HorseSelectionCardProps,
  type Horse,
  type EligibilityStatus,
} from '../HorseSelectionCard';

describe('HorseSelectionCard', () => {
  const mockOnToggle = vi.fn();

  const sampleHorse: Horse = {
    id: 1,
    name: 'Thunder Strike',
    age: 5,
    sex: 'Stallion',
    level: 8,
    health: 'healthy',
    disciplines: {
      racing: 75,
      showJumping: 60,
      dressage: 45,
      eventing: 55,
      crossCountry: 50,
    },
  };

  const sampleRelevantStats = [
    { name: 'Speed', value: 85 },
    { name: 'Stamina', value: 78 },
    { name: 'Agility', value: 72 },
  ];

  const defaultProps: HorseSelectionCardProps = {
    horse: sampleHorse,
    isSelected: false,
    onToggle: mockOnToggle,
    eligibilityStatus: 'eligible',
    relevantStats: sampleRelevantStats,
    expectedPerformance: 82,
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== COMPONENT RENDERING (5 tests) ====================
  describe('Component Rendering', () => {
    it('renders horse details correctly', () => {
      render(<HorseSelectionCard {...defaultProps} />);

      expect(screen.getByTestId('horse-selection-card')).toBeInTheDocument();
      expect(screen.getByText('Thunder Strike')).toBeInTheDocument();
      expect(screen.getByTestId('horse-age')).toHaveTextContent('5');
      expect(screen.getByTestId('horse-sex')).toHaveTextContent('Stallion');
      expect(screen.getByTestId('horse-level')).toHaveTextContent('8');
    });

    it('shows eligibility badge', () => {
      render(<HorseSelectionCard {...defaultProps} />);

      const badge = screen.getByTestId('eligibility-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/eligible/i);
    });

    it('displays relevant stats', () => {
      render(<HorseSelectionCard {...defaultProps} />);

      const statsContainer = screen.getByTestId('horse-stats');
      expect(statsContainer).toBeInTheDocument();
      expect(within(statsContainer).getByText('Speed')).toBeInTheDocument();
      expect(within(statsContainer).getByText('85')).toBeInTheDocument();
    });

    it('shows expected performance', () => {
      render(<HorseSelectionCard {...defaultProps} />);

      const performance = screen.getByTestId('expected-performance');
      expect(performance).toBeInTheDocument();
      expect(performance).toHaveTextContent('82');
    });

    it('renders checkbox', () => {
      render(<HorseSelectionCard {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });
  });

  // ==================== ELIGIBILITY STATES (6 tests) ====================
  describe('Eligibility States', () => {
    it('displays "Eligible" badge with green styling', () => {
      render(<HorseSelectionCard {...defaultProps} eligibilityStatus="eligible" />);

      const badge = screen.getByTestId('eligibility-badge');
      expect(badge).toHaveTextContent(/eligible/i);
      expect(badge).toHaveClass('bg-green-100');
      expect(badge).toHaveClass('text-green-800');
    });

    it('displays "Too Young" badge with yellow styling and tooltip', async () => {
      const user = userEvent.setup();
      render(
        <HorseSelectionCard
          {...defaultProps}
          eligibilityStatus="too-young"
          ineligibilityReason="Horse must be at least 3 years old"
        />
      );

      const badge = screen.getByTestId('eligibility-badge');
      expect(badge).toHaveTextContent(/too young/i);
      expect(badge).toHaveClass('bg-yellow-100');
      expect(badge).toHaveClass('text-yellow-800');

      // Hover to show tooltip - Radix UI creates multiple tooltip elements
      await user.hover(badge);
      const tooltips = await screen.findAllByRole('tooltip');
      expect(tooltips.some((t) => t.textContent?.match(/must be at least 3 years old/i))).toBe(
        true
      );
    });

    it('displays "Too Old" badge with gray styling and tooltip', async () => {
      const user = userEvent.setup();
      render(
        <HorseSelectionCard
          {...defaultProps}
          eligibilityStatus="too-old"
          ineligibilityReason="Horse must be under 20 years old"
        />
      );

      const badge = screen.getByTestId('eligibility-badge');
      expect(badge).toHaveTextContent(/too old/i);
      expect(badge).toHaveClass('bg-gray-100');
      expect(badge).toHaveClass('text-gray-800');

      // Radix UI creates multiple tooltip elements
      await user.hover(badge);
      const tooltips = await screen.findAllByRole('tooltip');
      expect(tooltips.some((t) => t.textContent?.match(/must be under 20 years old/i))).toBe(true);
    });

    it('displays "Wrong Level" badge with orange styling and tooltip', async () => {
      const user = userEvent.setup();
      render(
        <HorseSelectionCard
          {...defaultProps}
          eligibilityStatus="wrong-level"
          ineligibilityReason="Horse must be at least level 5"
        />
      );

      const badge = screen.getByTestId('eligibility-badge');
      expect(badge).toHaveTextContent(/wrong level/i);
      expect(badge).toHaveClass('bg-orange-100');
      expect(badge).toHaveClass('text-orange-800');

      // Radix UI creates multiple tooltip elements
      await user.hover(badge);
      const tooltips = await screen.findAllByRole('tooltip');
      expect(tooltips.some((t) => t.textContent?.match(/must be at least level 5/i))).toBe(true);
    });

    it('displays "Already Entered" badge with red styling', () => {
      render(<HorseSelectionCard {...defaultProps} eligibilityStatus="already-entered" />);

      const badge = screen.getByTestId('eligibility-badge');
      expect(badge).toHaveTextContent(/already entered/i);
      expect(badge).toHaveClass('bg-red-100');
      expect(badge).toHaveClass('text-red-800');
    });

    it('displays "Injured" badge with red styling and tooltip', async () => {
      const user = userEvent.setup();
      render(
        <HorseSelectionCard
          {...defaultProps}
          eligibilityStatus="injured"
          ineligibilityReason="Horse must be healthy to compete"
        />
      );

      const badge = screen.getByTestId('eligibility-badge');
      expect(badge).toHaveTextContent(/injured/i);
      expect(badge).toHaveClass('bg-red-100');
      expect(badge).toHaveClass('text-red-800');

      // Radix UI creates multiple tooltip elements
      await user.hover(badge);
      const tooltips = await screen.findAllByRole('tooltip');
      expect(tooltips.some((t) => t.textContent?.match(/must be healthy to compete/i))).toBe(true);
    });
  });

  // ==================== HORSE SELECTION (4 tests) ====================
  describe('Horse Selection', () => {
    it('checkbox toggles selection', async () => {
      const user = userEvent.setup();
      render(<HorseSelectionCard {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(mockOnToggle).toHaveBeenCalledTimes(1);
    });

    it('calls onToggle with horse ID', async () => {
      const user = userEvent.setup();
      render(<HorseSelectionCard {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(mockOnToggle).toHaveBeenCalledWith(1);
    });

    it('disabled state prevents selection', async () => {
      const user = userEvent.setup();
      render(<HorseSelectionCard {...defaultProps} disabled={true} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();

      await user.click(checkbox);
      expect(mockOnToggle).not.toHaveBeenCalled();
    });

    it('selected state shows visual feedback', () => {
      render(<HorseSelectionCard {...defaultProps} isSelected={true} />);

      const card = screen.getByTestId('horse-selection-card');
      expect(card).toHaveClass('ring-2');
      expect(card).toHaveClass('ring-blue-500');

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });
  });

  // ==================== STATS DISPLAY (4 tests) ====================
  describe('Stats Display', () => {
    it('shows top 3 relevant stats for discipline', () => {
      render(<HorseSelectionCard {...defaultProps} />);

      const statsContainer = screen.getByTestId('horse-stats');
      const statItems = within(statsContainer).getAllByTestId('stat-item');
      expect(statItems).toHaveLength(3);
    });

    it('formats stat values correctly', () => {
      render(<HorseSelectionCard {...defaultProps} />);

      const statsContainer = screen.getByTestId('horse-stats');
      expect(within(statsContainer).getByText('85')).toBeInTheDocument();
      expect(within(statsContainer).getByText('78')).toBeInTheDocument();
      expect(within(statsContainer).getByText('72')).toBeInTheDocument();
    });

    it('displays stat names', () => {
      render(<HorseSelectionCard {...defaultProps} />);

      const statsContainer = screen.getByTestId('horse-stats');
      expect(within(statsContainer).getByText('Speed')).toBeInTheDocument();
      expect(within(statsContainer).getByText('Stamina')).toBeInTheDocument();
      expect(within(statsContainer).getByText('Agility')).toBeInTheDocument();
    });

    it('highlights high stats', () => {
      const highStats = [
        { name: 'Speed', value: 90 },
        { name: 'Stamina', value: 85 },
        { name: 'Agility', value: 60 },
      ];
      render(<HorseSelectionCard {...defaultProps} relevantStats={highStats} />);

      const statsContainer = screen.getByTestId('horse-stats');
      const statItems = within(statsContainer).getAllByTestId('stat-item');

      // High stats (>80) should have special styling
      expect(statItems[0]).toHaveClass('text-green-600');
      expect(statItems[1]).toHaveClass('text-green-600');
      expect(statItems[2]).not.toHaveClass('text-green-600');
    });
  });

  // ==================== PERFORMANCE PREVIEW (3 tests) ====================
  describe('Performance Preview', () => {
    it('shows expected performance score', () => {
      render(<HorseSelectionCard {...defaultProps} expectedPerformance={82} />);

      const performance = screen.getByTestId('expected-performance');
      expect(performance).toHaveTextContent('82');
    });

    it('formats as percentage or rating', () => {
      render(<HorseSelectionCard {...defaultProps} expectedPerformance={75} />);

      const performance = screen.getByTestId('expected-performance');
      // Should show as percentage or rating indicator
      expect(performance.textContent).toMatch(/75%?/);
    });

    it('shows N/A for unavailable predictions', () => {
      render(<HorseSelectionCard {...defaultProps} expectedPerformance={undefined} />);

      const performance = screen.getByTestId('expected-performance');
      expect(performance).toHaveTextContent(/n\/a/i);
    });
  });

  // ==================== ACCESSIBILITY (3 additional tests) ====================
  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<HorseSelectionCard {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-label', expect.stringContaining('Thunder Strike'));
    });

    it('card is focusable', () => {
      render(<HorseSelectionCard {...defaultProps} />);

      const card = screen.getByTestId('horse-selection-card');
      expect(card).toHaveAttribute('tabindex', '0');
    });

    it('disabled card has reduced opacity', () => {
      render(<HorseSelectionCard {...defaultProps} disabled={true} />);

      const card = screen.getByTestId('horse-selection-card');
      expect(card).toHaveClass('opacity-60');
    });
  });

  // ==================== EDGE CASES ====================
  describe('Edge Cases', () => {
    it('handles missing disciplines gracefully', () => {
      const horseNoDisciplines: Horse = {
        ...sampleHorse,
        disciplines: {},
      };
      render(<HorseSelectionCard {...defaultProps} horse={horseNoDisciplines} />);

      expect(screen.getByTestId('horse-selection-card')).toBeInTheDocument();
    });

    it('handles empty stats array', () => {
      render(<HorseSelectionCard {...defaultProps} relevantStats={[]} />);

      const statsContainer = screen.getByTestId('horse-stats');
      expect(statsContainer).toHaveTextContent(/no stats/i);
    });

    it('handles zero expected performance', () => {
      render(<HorseSelectionCard {...defaultProps} expectedPerformance={0} />);

      const performance = screen.getByTestId('expected-performance');
      expect(performance).toHaveTextContent('0');
    });
  });
});
