/**
 * Tests for EligibilityFilter Component
 *
 * Tests cover:
 * - Rendering (filter buttons, labels, counts, styling)
 * - Count calculations (eligible, cooldown, ineligible)
 * - Filter selection (click handling, callback invocation)
 * - Accessibility (ARIA labels, keyboard accessibility)
 * - Edge cases (empty arrays, boundary ages, prop changes)
 *
 * Story 4-2: Training Eligibility Display - Task 2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EligibilityFilter from '../EligibilityFilter';
import type { EligibilityFilterType } from '../EligibilityFilter';
import type { Horse } from '../../../lib/utils/training-utils';

describe('EligibilityFilter', () => {
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

  // Eligible horse (age 3-20, no cooldown)
  const mockEligibleHorse: Horse = {
    id: 1,
    name: 'Thunder',
    age: 5,
    trainingCooldown: null,
    disciplineScores: {},
  };

  // Second eligible horse
  const mockEligibleHorse2: Horse = {
    id: 2,
    name: 'Lightning',
    age: 8,
    trainingCooldown: null,
    disciplineScores: {},
  };

  // Horse on cooldown (future date)
  const mockCooldownHorse: Horse = {
    id: 3,
    name: 'Storm',
    age: 6,
    trainingCooldown: new Date('2026-02-05T12:00:00Z').toISOString(), // 6 days in future
    disciplineScores: {},
  };

  // Second cooldown horse
  const mockCooldownHorse2: Horse = {
    id: 4,
    name: 'Blaze',
    age: 7,
    trainingCooldown: new Date('2026-02-10T12:00:00Z').toISOString(),
    disciplineScores: {},
  };

  // Too young horse (under 3)
  const mockTooYoungHorse: Horse = {
    id: 5,
    name: 'Foal',
    age: 2,
    trainingCooldown: null,
    disciplineScores: {},
  };

  // Very young horse (age 0)
  const mockVeryYoungHorse: Horse = {
    id: 6,
    name: 'Newborn',
    age: 0,
    trainingCooldown: null,
    disciplineScores: {},
  };

  // Too old horse (over 20) - Note: canTrain only checks age < 3, but we test the component behavior
  const mockTooOldHorse: Horse = {
    id: 7,
    name: 'Elder',
    age: 21,
    trainingCooldown: null,
    disciplineScores: {},
  };

  // Boundary age horse (exactly 3)
  const mockMinAgeHorse: Horse = {
    id: 8,
    name: 'Junior',
    age: 3,
    trainingCooldown: null,
    disciplineScores: {},
  };

  // Boundary age horse (exactly 20)
  const mockMaxAgeHorse: Horse = {
    id: 9,
    name: 'Senior',
    age: 20,
    trainingCooldown: null,
    disciplineScores: {},
  };

  // Horse with cooldown in the past (should be eligible)
  const mockPastCooldownHorse: Horse = {
    id: 10,
    name: 'Available',
    age: 6,
    trainingCooldown: new Date('2026-01-25T12:00:00Z').toISOString(), // 5 days in past
    disciplineScores: {},
  };

  // Horse with undefined cooldown
  const mockUndefinedCooldownHorse: Horse = {
    id: 11,
    name: 'NoCooldown',
    age: 5,
    trainingCooldown: undefined,
    disciplineScores: {},
  };

  // Mixed array of horses
  const mixedHorses: Horse[] = [
    mockEligibleHorse,
    mockEligibleHorse2,
    mockCooldownHorse,
    mockCooldownHorse2,
    mockTooYoungHorse,
    mockVeryYoungHorse,
  ];

  // Default mock callback
  const mockOnFilterChange = vi.fn();

  // ==================== RENDERING TESTS ====================
  describe('Rendering', () => {
    it('should render all four filter buttons', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="all" onFilterChange={mockOnFilterChange} />
      );

      expect(screen.getByTestId('filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('filter-ready')).toBeInTheDocument();
      expect(screen.getByTestId('filter-cooldown')).toBeInTheDocument();
      expect(screen.getByTestId('filter-ineligible')).toBeInTheDocument();
    });

    it('should show correct button labels', () => {
      render(
        <EligibilityFilter
          horses={[]}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
          showCounts={false}
        />
      );

      expect(screen.getByTestId('filter-all')).toHaveTextContent('All');
      expect(screen.getByTestId('filter-ready')).toHaveTextContent('Ready');
      expect(screen.getByTestId('filter-cooldown')).toHaveTextContent('Cooldown');
      expect(screen.getByTestId('filter-ineligible')).toHaveTextContent('Ineligible');
    });

    it('should show counts when showCounts is true', () => {
      render(
        <EligibilityFilter
          horses={mixedHorses}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
          showCounts={true}
        />
      );

      expect(screen.getByTestId('count-all')).toBeInTheDocument();
      expect(screen.getByTestId('count-ready')).toBeInTheDocument();
      expect(screen.getByTestId('count-cooldown')).toBeInTheDocument();
      expect(screen.getByTestId('count-ineligible')).toBeInTheDocument();
    });

    it('should hide counts when showCounts is false', () => {
      render(
        <EligibilityFilter
          horses={mixedHorses}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
          showCounts={false}
        />
      );

      expect(screen.queryByTestId('count-all')).not.toBeInTheDocument();
      expect(screen.queryByTestId('count-ready')).not.toBeInTheDocument();
      expect(screen.queryByTestId('count-cooldown')).not.toBeInTheDocument();
      expect(screen.queryByTestId('count-ineligible')).not.toBeInTheDocument();
    });

    it('should apply correct active state styling for selected filter', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="ready" onFilterChange={mockOnFilterChange} />
      );

      const readyButton = screen.getByTestId('filter-ready');
      expect(readyButton).toHaveClass('bg-green-600', 'text-white');

      const allButton = screen.getByTestId('filter-all');
      expect(allButton).toHaveClass('bg-gray-200', 'text-gray-700');
    });

    it('should render flex-wrap for responsive layout', () => {
      const { container } = render(
        <EligibilityFilter horses={[]} selectedFilter="all" onFilterChange={mockOnFilterChange} />
      );

      const filterContainer = container.querySelector('[data-testid="eligibility-filter"]');
      expect(filterContainer).toHaveClass('flex', 'gap-2', 'flex-wrap');
    });
  });

  // ==================== COUNT CALCULATIONS TESTS ====================
  describe('Count Calculations', () => {
    it('should calculate total count correctly', () => {
      render(
        <EligibilityFilter
          horses={mixedHorses}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      expect(screen.getByTestId('count-all')).toHaveTextContent('(6)');
    });

    it('should calculate eligible count correctly', () => {
      render(
        <EligibilityFilter
          horses={mixedHorses}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      // 2 eligible horses: mockEligibleHorse, mockEligibleHorse2
      expect(screen.getByTestId('count-ready')).toHaveTextContent('(2)');
    });

    it('should calculate cooldown count correctly', () => {
      render(
        <EligibilityFilter
          horses={mixedHorses}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      // 2 cooldown horses: mockCooldownHorse, mockCooldownHorse2
      expect(screen.getByTestId('count-cooldown')).toHaveTextContent('(2)');
    });

    it('should calculate ineligible count correctly', () => {
      render(
        <EligibilityFilter
          horses={mixedHorses}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      // 2 ineligible horses: mockTooYoungHorse (age 2), mockVeryYoungHorse (age 0)
      expect(screen.getByTestId('count-ineligible')).toHaveTextContent('(2)');
    });

    it('should handle empty horses array', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="all" onFilterChange={mockOnFilterChange} />
      );

      expect(screen.getByTestId('count-all')).toHaveTextContent('(0)');
      expect(screen.getByTestId('count-ready')).toHaveTextContent('(0)');
      expect(screen.getByTestId('count-cooldown')).toHaveTextContent('(0)');
      expect(screen.getByTestId('count-ineligible')).toHaveTextContent('(0)');
    });

    it('should handle all eligible horses', () => {
      const allEligible: Horse[] = [mockEligibleHorse, mockEligibleHorse2, mockMinAgeHorse];

      render(
        <EligibilityFilter
          horses={allEligible}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      expect(screen.getByTestId('count-all')).toHaveTextContent('(3)');
      expect(screen.getByTestId('count-ready')).toHaveTextContent('(3)');
      expect(screen.getByTestId('count-cooldown')).toHaveTextContent('(0)');
      expect(screen.getByTestId('count-ineligible')).toHaveTextContent('(0)');
    });

    it('should handle all ineligible horses', () => {
      const allIneligible: Horse[] = [mockTooYoungHorse, mockVeryYoungHorse];

      render(
        <EligibilityFilter
          horses={allIneligible}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      expect(screen.getByTestId('count-all')).toHaveTextContent('(2)');
      expect(screen.getByTestId('count-ready')).toHaveTextContent('(0)');
      expect(screen.getByTestId('count-cooldown')).toHaveTextContent('(0)');
      expect(screen.getByTestId('count-ineligible')).toHaveTextContent('(2)');
    });

    it('should handle mixed eligibility states accurately', () => {
      const mixedStates: Horse[] = [
        mockEligibleHorse, // ready
        mockCooldownHorse, // cooldown
        mockTooYoungHorse, // ineligible
        mockMinAgeHorse, // ready (age 3)
        mockCooldownHorse2, // cooldown
      ];

      render(
        <EligibilityFilter
          horses={mixedStates}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      expect(screen.getByTestId('count-all')).toHaveTextContent('(5)');
      expect(screen.getByTestId('count-ready')).toHaveTextContent('(2)');
      expect(screen.getByTestId('count-cooldown')).toHaveTextContent('(2)');
      expect(screen.getByTestId('count-ineligible')).toHaveTextContent('(1)');
    });
  });

  // ==================== FILTER SELECTION TESTS ====================
  describe('Filter Selection', () => {
    beforeEach(() => {
      mockOnFilterChange.mockClear();
    });

    it('should call onFilterChange when All button clicked', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="ready" onFilterChange={mockOnFilterChange} />
      );

      fireEvent.click(screen.getByTestId('filter-all'));
      expect(mockOnFilterChange).toHaveBeenCalledWith('all');
      expect(mockOnFilterChange).toHaveBeenCalledTimes(1);
    });

    it('should call onFilterChange when Ready button clicked', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="all" onFilterChange={mockOnFilterChange} />
      );

      fireEvent.click(screen.getByTestId('filter-ready'));
      expect(mockOnFilterChange).toHaveBeenCalledWith('ready');
      expect(mockOnFilterChange).toHaveBeenCalledTimes(1);
    });

    it('should call onFilterChange when Cooldown button clicked', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="all" onFilterChange={mockOnFilterChange} />
      );

      fireEvent.click(screen.getByTestId('filter-cooldown'));
      expect(mockOnFilterChange).toHaveBeenCalledWith('cooldown');
      expect(mockOnFilterChange).toHaveBeenCalledTimes(1);
    });

    it('should call onFilterChange when Ineligible button clicked', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="all" onFilterChange={mockOnFilterChange} />
      );

      fireEvent.click(screen.getByTestId('filter-ineligible'));
      expect(mockOnFilterChange).toHaveBeenCalledWith('ineligible');
      expect(mockOnFilterChange).toHaveBeenCalledTimes(1);
    });

    it('should have selected filter button with active styling', () => {
      const { rerender } = render(
        <EligibilityFilter horses={[]} selectedFilter="all" onFilterChange={mockOnFilterChange} />
      );

      expect(screen.getByTestId('filter-all')).toHaveClass('bg-blue-600', 'text-white');

      rerender(
        <EligibilityFilter horses={[]} selectedFilter="ready" onFilterChange={mockOnFilterChange} />
      );
      expect(screen.getByTestId('filter-ready')).toHaveClass('bg-green-600', 'text-white');

      rerender(
        <EligibilityFilter
          horses={[]}
          selectedFilter="cooldown"
          onFilterChange={mockOnFilterChange}
        />
      );
      expect(screen.getByTestId('filter-cooldown')).toHaveClass('bg-amber-600', 'text-white');

      rerender(
        <EligibilityFilter
          horses={[]}
          selectedFilter="ineligible"
          onFilterChange={mockOnFilterChange}
        />
      );
      expect(screen.getByTestId('filter-ineligible')).toHaveClass('bg-gray-600', 'text-white');
    });
  });

  // ==================== ACCESSIBILITY TESTS ====================
  describe('Accessibility', () => {
    it('should have aria-label on all buttons', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="all" onFilterChange={mockOnFilterChange} />
      );

      expect(screen.getByTestId('filter-all')).toHaveAttribute('aria-label', 'Show all horses');
      expect(screen.getByTestId('filter-ready')).toHaveAttribute(
        'aria-label',
        'Show horses ready to train'
      );
      expect(screen.getByTestId('filter-cooldown')).toHaveAttribute(
        'aria-label',
        'Show horses on cooldown'
      );
      expect(screen.getByTestId('filter-ineligible')).toHaveAttribute(
        'aria-label',
        'Show ineligible horses'
      );
    });

    it('should have aria-pressed="true" on selected button', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="ready" onFilterChange={mockOnFilterChange} />
      );

      expect(screen.getByTestId('filter-ready')).toHaveAttribute('aria-pressed', 'true');
    });

    it('should have aria-pressed="false" on unselected buttons', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="ready" onFilterChange={mockOnFilterChange} />
      );

      expect(screen.getByTestId('filter-all')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('filter-cooldown')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('filter-ineligible')).toHaveAttribute('aria-pressed', 'false');
    });

    it('should use button elements for keyboard accessibility', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="all" onFilterChange={mockOnFilterChange} />
      );

      // All filters should be button elements
      expect(screen.getByTestId('filter-all').tagName.toLowerCase()).toBe('button');
      expect(screen.getByTestId('filter-ready').tagName.toLowerCase()).toBe('button');
      expect(screen.getByTestId('filter-cooldown').tagName.toLowerCase()).toBe('button');
      expect(screen.getByTestId('filter-ineligible').tagName.toLowerCase()).toBe('button');
    });

    it('should have role="group" on container with aria-label', () => {
      const { container } = render(
        <EligibilityFilter horses={[]} selectedFilter="all" onFilterChange={mockOnFilterChange} />
      );

      const filterGroup = container.querySelector('[data-testid="eligibility-filter"]');
      expect(filterGroup).toHaveAttribute('role', 'group');
      expect(filterGroup).toHaveAttribute('aria-label', 'Filter horses by training eligibility');
    });

    it('should have type="button" attribute on all buttons', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="all" onFilterChange={mockOnFilterChange} />
      );

      expect(screen.getByTestId('filter-all')).toHaveAttribute('type', 'button');
      expect(screen.getByTestId('filter-ready')).toHaveAttribute('type', 'button');
      expect(screen.getByTestId('filter-cooldown')).toHaveAttribute('type', 'button');
      expect(screen.getByTestId('filter-ineligible')).toHaveAttribute('type', 'button');
    });
  });

  // ==================== EDGE CASES TESTS ====================
  describe('Edge Cases', () => {
    it('should work with horses that have undefined trainingCooldown', () => {
      const horsesWithUndefinedCooldown: Horse[] = [mockUndefinedCooldownHorse, mockEligibleHorse];

      render(
        <EligibilityFilter
          horses={horsesWithUndefinedCooldown}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      // Both should be counted as eligible
      expect(screen.getByTestId('count-all')).toHaveTextContent('(2)');
      expect(screen.getByTestId('count-ready')).toHaveTextContent('(2)');
    });

    it('should work with horses of various ages (boundary testing)', () => {
      const boundaryHorses: Horse[] = [
        { id: 1, name: 'Age0', age: 0, trainingCooldown: null }, // ineligible
        { id: 2, name: 'Age1', age: 1, trainingCooldown: null }, // ineligible
        { id: 3, name: 'Age2', age: 2, trainingCooldown: null }, // ineligible
        { id: 4, name: 'Age3', age: 3, trainingCooldown: null }, // ready (boundary)
        { id: 5, name: 'Age10', age: 10, trainingCooldown: null }, // ready
        { id: 6, name: 'Age20', age: 20, trainingCooldown: null }, // ready (boundary)
      ];

      render(
        <EligibilityFilter
          horses={boundaryHorses}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      expect(screen.getByTestId('count-all')).toHaveTextContent('(6)');
      expect(screen.getByTestId('count-ready')).toHaveTextContent('(3)'); // ages 3, 10, 20
      expect(screen.getByTestId('count-ineligible')).toHaveTextContent('(3)'); // ages 0, 1, 2
    });

    it('should update counts when horses prop changes', () => {
      const { rerender } = render(
        <EligibilityFilter
          horses={[mockEligibleHorse]}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      expect(screen.getByTestId('count-all')).toHaveTextContent('(1)');
      expect(screen.getByTestId('count-ready')).toHaveTextContent('(1)');

      // Rerender with more horses
      rerender(
        <EligibilityFilter
          horses={mixedHorses}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      expect(screen.getByTestId('count-all')).toHaveTextContent('(6)');
      expect(screen.getByTestId('count-ready')).toHaveTextContent('(2)');
    });

    it('should handle horse with cooldown date in the past as eligible', () => {
      const horsesWithPastCooldown: Horse[] = [mockPastCooldownHorse, mockEligibleHorse];

      render(
        <EligibilityFilter
          horses={horsesWithPastCooldown}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      // Past cooldown horse should be counted as eligible
      expect(screen.getByTestId('count-ready')).toHaveTextContent('(2)');
      expect(screen.getByTestId('count-cooldown')).toHaveTextContent('(0)');
    });

    it('should handle horse with cooldown as Date object', () => {
      const horseDateCooldown: Horse = {
        id: 20,
        name: 'DateCooldown',
        age: 6,
        trainingCooldown: new Date('2026-02-10T12:00:00Z'),
        disciplineScores: {},
      };

      render(
        <EligibilityFilter
          horses={[horseDateCooldown]}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      expect(screen.getByTestId('count-cooldown')).toHaveTextContent('(1)');
    });

    it('should default showCounts to true when not specified', () => {
      render(
        <EligibilityFilter
          horses={mixedHorses}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      // Counts should be visible by default
      expect(screen.getByTestId('count-all')).toBeInTheDocument();
    });
  });

  // ==================== STYLING TESTS ====================
  describe('Styling', () => {
    it('should apply transition-colors class to all buttons', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="all" onFilterChange={mockOnFilterChange} />
      );

      expect(screen.getByTestId('filter-all')).toHaveClass('transition-colors');
      expect(screen.getByTestId('filter-ready')).toHaveClass('transition-colors');
      expect(screen.getByTestId('filter-cooldown')).toHaveClass('transition-colors');
      expect(screen.getByTestId('filter-ineligible')).toHaveClass('transition-colors');
    });

    it('should apply rounded class to all buttons', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="all" onFilterChange={mockOnFilterChange} />
      );

      expect(screen.getByTestId('filter-all')).toHaveClass('rounded');
      expect(screen.getByTestId('filter-ready')).toHaveClass('rounded');
      expect(screen.getByTestId('filter-cooldown')).toHaveClass('rounded');
      expect(screen.getByTestId('filter-ineligible')).toHaveClass('rounded');
    });

    it('should apply padding classes to all buttons', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="all" onFilterChange={mockOnFilterChange} />
      );

      expect(screen.getByTestId('filter-all')).toHaveClass('px-4', 'py-2');
      expect(screen.getByTestId('filter-ready')).toHaveClass('px-4', 'py-2');
      expect(screen.getByTestId('filter-cooldown')).toHaveClass('px-4', 'py-2');
      expect(screen.getByTestId('filter-ineligible')).toHaveClass('px-4', 'py-2');
    });

    it('should apply hover class to inactive buttons', () => {
      render(
        <EligibilityFilter horses={[]} selectedFilter="ready" onFilterChange={mockOnFilterChange} />
      );

      // All inactive button should have hover:bg-gray-300
      expect(screen.getByTestId('filter-all')).toHaveClass('hover:bg-gray-300');
      expect(screen.getByTestId('filter-cooldown')).toHaveClass('hover:bg-gray-300');
      expect(screen.getByTestId('filter-ineligible')).toHaveClass('hover:bg-gray-300');

      // Active button should not have the hover class
      expect(screen.getByTestId('filter-ready')).not.toHaveClass('hover:bg-gray-300');
    });

    it('should have correct color scheme for each filter type when selected', () => {
      const filterColors: Record<EligibilityFilterType, string[]> = {
        all: ['bg-blue-600', 'text-white'],
        ready: ['bg-green-600', 'text-white'],
        cooldown: ['bg-amber-600', 'text-white'],
        ineligible: ['bg-gray-600', 'text-white'],
      };

      const filters: EligibilityFilterType[] = ['all', 'ready', 'cooldown', 'ineligible'];

      for (const filter of filters) {
        const { unmount } = render(
          <EligibilityFilter
            horses={[]}
            selectedFilter={filter}
            onFilterChange={mockOnFilterChange}
          />
        );

        const button = screen.getByTestId(`filter-${filter}`);
        for (const className of filterColors[filter]) {
          expect(button).toHaveClass(className);
        }

        unmount();
      }
    });
  });

  // ==================== INTEGRATION TESTS ====================
  describe('Integration', () => {
    it('should correctly use canTrain utility for eligibility calculation', () => {
      const testHorses: Horse[] = [
        { id: 1, name: 'Ready1', age: 5, trainingCooldown: null },
        { id: 2, name: 'Ready2', age: 10, trainingCooldown: null },
        {
          id: 3,
          name: 'Cooldown',
          age: 6,
          trainingCooldown: new Date('2026-02-15T12:00:00Z').toISOString(),
        },
        { id: 4, name: 'TooYoung', age: 1, trainingCooldown: null },
      ];

      render(
        <EligibilityFilter
          horses={testHorses}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      expect(screen.getByTestId('count-all')).toHaveTextContent('(4)');
      expect(screen.getByTestId('count-ready')).toHaveTextContent('(2)');
      expect(screen.getByTestId('count-cooldown')).toHaveTextContent('(1)');
      expect(screen.getByTestId('count-ineligible')).toHaveTextContent('(1)');
    });

    it('should maintain consistent behavior across multiple renders', () => {
      const { rerender } = render(
        <EligibilityFilter
          horses={mixedHorses}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      const initialAll = screen.getByTestId('count-all').textContent;
      const initialReady = screen.getByTestId('count-ready').textContent;

      // Rerender with same props
      rerender(
        <EligibilityFilter
          horses={mixedHorses}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      expect(screen.getByTestId('count-all')).toHaveTextContent(initialAll!);
      expect(screen.getByTestId('count-ready')).toHaveTextContent(initialReady!);
    });

    it('should handle rapid filter changes', () => {
      render(
        <EligibilityFilter
          horses={mixedHorses}
          selectedFilter="all"
          onFilterChange={mockOnFilterChange}
        />
      );

      // Rapidly click different filters
      fireEvent.click(screen.getByTestId('filter-ready'));
      fireEvent.click(screen.getByTestId('filter-cooldown'));
      fireEvent.click(screen.getByTestId('filter-ineligible'));
      fireEvent.click(screen.getByTestId('filter-all'));

      expect(mockOnFilterChange).toHaveBeenCalledTimes(4);
      expect(mockOnFilterChange).toHaveBeenNthCalledWith(1, 'ready');
      expect(mockOnFilterChange).toHaveBeenNthCalledWith(2, 'cooldown');
      expect(mockOnFilterChange).toHaveBeenNthCalledWith(3, 'ineligible');
      expect(mockOnFilterChange).toHaveBeenNthCalledWith(4, 'all');
    });
  });
});
