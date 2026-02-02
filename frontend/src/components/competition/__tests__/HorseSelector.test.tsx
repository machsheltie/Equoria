/**
 * HorseSelector Component Tests
 *
 * Tests for the horse selection container component including:
 * - Component rendering (horses list, empty state, loading state)
 * - Horse selection (single, multiple, select all, deselect all)
 * - Eligibility filtering (age, health, already entered, level)
 * - Data fetching (fetch, filter, error handling)
 * - User interactions (selection change callbacks)
 *
 * Story 5-1: Competition Entry System - Task 5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw/server';
import HorseSelector, {
  type HorseSelectorProps,
  type Horse,
} from '../HorseSelector';

describe('HorseSelector', () => {
  const mockOnSelectionChange = vi.fn();

  const sampleHorses: Horse[] = [
    {
      id: 1,
      name: 'Thunder Strike',
      age: 5,
      sex: 'Stallion',
      level: 8,
      health: 'healthy',
      disciplines: { racing: 75, showJumping: 60, dressage: 45 },
    },
    {
      id: 2,
      name: 'Silver Moon',
      age: 4,
      sex: 'Mare',
      level: 6,
      health: 'healthy',
      disciplines: { racing: 65, showJumping: 70, dressage: 55 },
    },
    {
      id: 3,
      name: 'Golden Dawn',
      age: 2,
      sex: 'Gelding',
      level: 3,
      health: 'healthy',
      disciplines: { racing: 40, showJumping: 35, dressage: 30 },
    },
    {
      id: 4,
      name: 'Storm Cloud',
      age: 22,
      sex: 'Mare',
      level: 15,
      health: 'healthy',
      disciplines: { racing: 80, showJumping: 75, dressage: 70 },
    },
    {
      id: 5,
      name: 'Midnight Star',
      age: 6,
      sex: 'Stallion',
      level: 10,
      health: 'injured',
      disciplines: { racing: 70, showJumping: 65, dressage: 60 },
    },
  ];

  const defaultProps: HorseSelectorProps = {
    competitionId: 1,
    discipline: 'racing',
    selectedHorses: [],
    onSelectionChange: mockOnSelectionChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default MSW handler for horses
    server.use(
      http.get('http://localhost:3001/api/horses/user/eligible', () => {
        return HttpResponse.json({
          success: true,
          data: sampleHorses,
        });
      }),
      http.get('http://localhost:3001/api/competitions/:id/entries', () => {
        return HttpResponse.json({
          success: true,
          data: [
            { horseId: 6, horseName: 'Already Entered Horse' }, // Different horse
          ],
        });
      })
    );
  });

  // ==================== COMPONENT RENDERING (5 tests) ====================
  describe('Component Rendering', () => {
    it('renders with horses list', async () => {
      render(<HorseSelector {...defaultProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('horse-selector')).toBeInTheDocument();
      expect(screen.getByText('Thunder Strike')).toBeInTheDocument();
      expect(screen.getByText('Silver Moon')).toBeInTheDocument();
    });

    it('shows empty state with no horses', async () => {
      server.use(
        http.get('http://localhost:3001/api/horses/user/eligible', () => {
          return HttpResponse.json({
            success: true,
            data: [],
          });
        })
      );

      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('horse-selector-empty')).toBeInTheDocument();
      expect(screen.getByText(/no eligible horses/i)).toBeInTheDocument();
    });

    it('displays selected count correctly', async () => {
      render(<HorseSelector {...defaultProps} selectedHorses={[1, 2]} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      const selectedCount = screen.getByTestId('selected-count');
      expect(selectedCount).toHaveTextContent('2');
    });

    it('renders selection controls', async () => {
      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('select-all-button')).toBeInTheDocument();
      expect(screen.getByTestId('deselect-all-button')).toBeInTheDocument();
    });

    it('shows loading state during fetch', () => {
      render(<HorseSelector {...defaultProps} />);

      expect(screen.getByTestId('horse-selector-loading')).toBeInTheDocument();
    });
  });

  // ==================== HORSE SELECTION (7 tests) ====================
  describe('Horse Selection', () => {
    it('single horse selection works', async () => {
      const user = userEvent.setup();
      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      const thunderStrikeCard = screen.getByText('Thunder Strike').closest('[data-testid="horse-selection-card"]');
      const checkbox = within(thunderStrikeCard!).getByRole('checkbox');
      await user.click(checkbox);

      expect(mockOnSelectionChange).toHaveBeenCalledWith([1]);
    });

    it('multiple horse selection works', async () => {
      const user = userEvent.setup();
      render(<HorseSelector {...defaultProps} selectedHorses={[1]} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      const silverMoonCard = screen.getByText('Silver Moon').closest('[data-testid="horse-selection-card"]');
      const checkbox = within(silverMoonCard!).getByRole('checkbox');
      await user.click(checkbox);

      expect(mockOnSelectionChange).toHaveBeenCalledWith([1, 2]);
    });

    it('deselection works', async () => {
      const user = userEvent.setup();
      render(<HorseSelector {...defaultProps} selectedHorses={[1, 2]} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      const thunderStrikeCard = screen.getByText('Thunder Strike').closest('[data-testid="horse-selection-card"]');
      const checkbox = within(thunderStrikeCard!).getByRole('checkbox');
      await user.click(checkbox);

      expect(mockOnSelectionChange).toHaveBeenCalledWith([2]);
    });

    it('Select All Eligible works', async () => {
      const user = userEvent.setup();
      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      const selectAllButton = screen.getByTestId('select-all-button');
      await user.click(selectAllButton);

      // Should select only eligible horses (Thunder Strike: 1, Silver Moon: 2)
      // Not Golden Dawn (too young), Storm Cloud (too old), Midnight Star (injured)
      expect(mockOnSelectionChange).toHaveBeenCalledWith(expect.arrayContaining([1, 2]));
    });

    it('Deselect All works', async () => {
      const user = userEvent.setup();
      render(<HorseSelector {...defaultProps} selectedHorses={[1, 2]} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      const deselectAllButton = screen.getByTestId('deselect-all-button');
      await user.click(deselectAllButton);

      expect(mockOnSelectionChange).toHaveBeenCalledWith([]);
    });

    it('max selections enforced', async () => {
      const user = userEvent.setup();
      render(<HorseSelector {...defaultProps} selectedHorses={[1, 2]} maxSelections={2} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      // Try to select a third horse (there should be another eligible one if we add it)
      // All other horses should show as disabled due to max selections
      const selectAllButton = screen.getByTestId('select-all-button');
      await user.click(selectAllButton);

      // Should only include up to maxSelections
      const lastCall = mockOnSelectionChange.mock.calls[mockOnSelectionChange.mock.calls.length - 1];
      expect(lastCall[0].length).toBeLessThanOrEqual(2);
    });

    it('disabled horses cannot be selected', async () => {
      const user = userEvent.setup();
      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      // Golden Dawn (too young) should be disabled
      const goldenDawnCard = screen.getByText('Golden Dawn').closest('[data-testid="horse-selection-card"]');
      const checkbox = within(goldenDawnCard!).getByRole('checkbox');

      expect(checkbox).toBeDisabled();
      await user.click(checkbox);

      // Selection should not change
      expect(mockOnSelectionChange).not.toHaveBeenCalled();
    });
  });

  // ==================== ELIGIBILITY FILTERING (6 tests) ====================
  describe('Eligibility Filtering', () => {
    it('filters by age - too young (under 3 years)', async () => {
      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      // Golden Dawn (age 2) should show "Too Young" badge
      const goldenDawnCard = screen.getByText('Golden Dawn').closest('[data-testid="horse-selection-card"]');
      expect(within(goldenDawnCard!).getByTestId('eligibility-badge')).toHaveTextContent(/too young/i);
    });

    it('filters by age - too old (over 20 years)', async () => {
      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      // Storm Cloud (age 22) should show "Too Old" badge
      const stormCloudCard = screen.getByText('Storm Cloud').closest('[data-testid="horse-selection-card"]');
      expect(within(stormCloudCard!).getByTestId('eligibility-badge')).toHaveTextContent(/too old/i);
    });

    it('filters by health status', async () => {
      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      // Midnight Star (injured) should show "Injured" badge
      const midnightStarCard = screen.getByText('Midnight Star').closest('[data-testid="horse-selection-card"]');
      expect(within(midnightStarCard!).getByTestId('eligibility-badge')).toHaveTextContent(/injured/i);
    });

    it('filters by already entered status', async () => {
      // Set up a horse that's already entered
      server.use(
        http.get('http://localhost:3001/api/competitions/:id/entries', () => {
          return HttpResponse.json({
            success: true,
            data: [{ horseId: 1, horseName: 'Thunder Strike' }],
          });
        })
      );

      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      // Thunder Strike should show "Already Entered" badge
      const thunderStrikeCard = screen.getByText('Thunder Strike').closest('[data-testid="horse-selection-card"]');
      expect(within(thunderStrikeCard!).getByTestId('eligibility-badge')).toHaveTextContent(/already entered/i);
    });

    it('shows eligible count', async () => {
      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      const eligibleCount = screen.getByTestId('eligible-count');
      // Thunder Strike and Silver Moon should be eligible
      expect(eligibleCount).toHaveTextContent('2');
    });

    it('sorts eligible horses first', async () => {
      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      const horseCards = screen.getAllByTestId('horse-selection-card');
      // First cards should be eligible horses
      const firstCardBadge = within(horseCards[0]).getByTestId('eligibility-badge');
      expect(firstCardBadge).toHaveTextContent(/eligible/i);
    });
  });

  // ==================== DATA FETCHING (4 tests) ====================
  describe('Data Fetching', () => {
    it('fetches user horses on mount', async () => {
      const fetchSpy = vi.fn();
      server.use(
        http.get('http://localhost:3001/api/horses/user/eligible', () => {
          fetchSpy();
          return HttpResponse.json({
            success: true,
            data: sampleHorses,
          });
        })
      );

      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });
    });

    it('filters by competition eligibility', async () => {
      render(<HorseSelector {...defaultProps} competitionId={1} discipline="racing" />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      // Horses should be filtered based on competition requirements
      expect(screen.getByText('Thunder Strike')).toBeInTheDocument();
    });

    it('handles fetch error gracefully', async () => {
      server.use(
        http.get('http://localhost:3001/api/horses/user/eligible', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('horse-selector-error')).toBeInTheDocument();
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });

    it('shows loading spinner during fetch', () => {
      render(<HorseSelector {...defaultProps} />);

      const loadingSpinner = screen.getByTestId('horse-selector-loading');
      expect(loadingSpinner).toBeInTheDocument();
    });
  });

  // ==================== USER INTERACTIONS (3 tests) ====================
  describe('User Interactions', () => {
    it('calls onSelectionChange with correct IDs', async () => {
      const user = userEvent.setup();
      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      const thunderStrikeCard = screen.getByText('Thunder Strike').closest('[data-testid="horse-selection-card"]');
      const checkbox = within(thunderStrikeCard!).getByRole('checkbox');
      await user.click(checkbox);

      expect(mockOnSelectionChange).toHaveBeenCalledWith([1]);
    });

    it('updates selection count on change', async () => {
      const { rerender } = render(<HorseSelector {...defaultProps} selectedHorses={[]} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      let selectedCount = screen.getByTestId('selected-count');
      expect(selectedCount).toHaveTextContent('0');

      rerender(<HorseSelector {...defaultProps} selectedHorses={[1]} />);

      selectedCount = screen.getByTestId('selected-count');
      expect(selectedCount).toHaveTextContent('1');
    });

    it('maintains selection state correctly', async () => {
      render(<HorseSelector {...defaultProps} selectedHorses={[1, 2]} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      // Thunder Strike and Silver Moon should be checked
      const thunderStrikeCard = screen.getByText('Thunder Strike').closest('[data-testid="horse-selection-card"]');
      const silverMoonCard = screen.getByText('Silver Moon').closest('[data-testid="horse-selection-card"]');

      expect(within(thunderStrikeCard!).getByRole('checkbox')).toBeChecked();
      expect(within(silverMoonCard!).getByRole('checkbox')).toBeChecked();

      // Golden Dawn should not be checked
      const goldenDawnCard = screen.getByText('Golden Dawn').closest('[data-testid="horse-selection-card"]');
      expect(within(goldenDawnCard!).getByRole('checkbox')).not.toBeChecked();
    });
  });

  // ==================== ACCESSIBILITY ====================
  describe('Accessibility', () => {
    it('has proper heading for horse selector', async () => {
      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { name: /select horses/i })).toBeInTheDocument();
    });

    it('announces selection changes to screen readers', async () => {
      const user = userEvent.setup();
      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
    });
  });

  // ==================== EDGE CASES ====================
  describe('Edge Cases', () => {
    it('handles all horses being ineligible', async () => {
      const allIneligibleHorses: Horse[] = [
        {
          id: 1,
          name: 'Young Horse',
          age: 2,
          sex: 'Stallion',
          level: 1,
          health: 'healthy',
          disciplines: { racing: 30 },
        },
      ];

      server.use(
        http.get('http://localhost:3001/api/horses/user/eligible', () => {
          return HttpResponse.json({
            success: true,
            data: allIneligibleHorses,
          });
        })
      );

      render(<HorseSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      // Select All button should be disabled when no eligible horses
      const selectAllButton = screen.getByTestId('select-all-button');
      expect(selectAllButton).toBeDisabled();
    });

    it('handles undefined maxSelections', async () => {
      const user = userEvent.setup();
      render(<HorseSelector {...defaultProps} maxSelections={undefined} />);

      await waitFor(() => {
        expect(screen.queryByTestId('horse-selector-loading')).not.toBeInTheDocument();
      });

      // Should be able to select all eligible horses
      const selectAllButton = screen.getByTestId('select-all-button');
      await user.click(selectAllButton);

      // Should include all eligible horses without limit
      expect(mockOnSelectionChange).toHaveBeenCalled();
    });
  });
});
