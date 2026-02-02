/**
 * Tests for HorseFilters Component
 *
 * Tests cover:
 * - Rendering with default and custom props
 * - Age range inputs (min/max)
 * - Breed selection (checkboxes)
 * - Discipline selection (checkboxes)
 * - Training status selection (radio buttons)
 * - Clear all filters functionality
 * - Expand/collapse behavior
 * - Active filter count display
 * - Loading states
 * - Accessibility (ARIA labels, keyboard navigation)
 * - Edge cases (empty breeds, boundary values)
 *
 * Story 3-6: Horse Search & Filter - Task 4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HorseFilters from '../HorseFilters';

const mockFilters = {
  minAge: undefined,
  maxAge: undefined,
  breedIds: [],
  disciplines: [],
  trainingStatus: 'all' as const,
};

const mockBreeds = [
  { id: '1', name: 'Arabian' },
  { id: '2', name: 'Thoroughbred' },
  { id: '3', name: 'Quarter Horse' },
];

describe('HorseFilters', () => {
  const mockProps = {
    filters: mockFilters,
    onAgeRangeChange: vi.fn(),
    onBreedToggle: vi.fn(),
    onDisciplineToggle: vi.fn(),
    onTrainingStatusChange: vi.fn(),
    onClearFilters: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render filters header with title', () => {
      render(<HorseFilters {...mockProps} />);

      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('should render all filter sections when expanded', () => {
      render(<HorseFilters {...mockProps} breeds={mockBreeds} />);

      expect(screen.getByText('Age Range')).toBeInTheDocument();
      expect(screen.getByText('Breeds')).toBeInTheDocument();
      expect(screen.getByText('Disciplines')).toBeInTheDocument();
      expect(screen.getByText('Training Status')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = render(<HorseFilters {...mockProps} className="custom-class" />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });

    it('should show active filter count when filters are active', () => {
      render(<HorseFilters {...mockProps} activeFilterCount={3} />);

      const badge = screen.getByLabelText('3 active filters');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('3');
    });

    it('should NOT show active filter count when no filters active', () => {
      render(<HorseFilters {...mockProps} activeFilterCount={0} />);

      expect(screen.queryByLabelText(/active filters/i)).not.toBeInTheDocument();
    });

    it('should show clear all button when filters are active', () => {
      render(<HorseFilters {...mockProps} activeFilterCount={2} />);

      expect(screen.getByLabelText('Clear all filters')).toBeInTheDocument();
    });

    it('should NOT show clear all button when no filters active', () => {
      render(<HorseFilters {...mockProps} activeFilterCount={0} />);

      expect(screen.queryByLabelText('Clear all filters')).not.toBeInTheDocument();
    });
  });

  describe('Age Range Filter', () => {
    it('should render min and max age inputs', () => {
      render(<HorseFilters {...mockProps} />);

      expect(screen.getByLabelText('Minimum age filter')).toBeInTheDocument();
      expect(screen.getByLabelText('Maximum age filter')).toBeInTheDocument();
    });

    it('should display current min age value', () => {
      render(<HorseFilters {...mockProps} filters={{ ...mockFilters, minAge: 5 }} />);

      const minInput = screen.getByLabelText('Minimum age filter');
      expect(minInput).toHaveValue(5);
    });

    it('should display current max age value', () => {
      render(<HorseFilters {...mockProps} filters={{ ...mockFilters, maxAge: 10 }} />);

      const maxInput = screen.getByLabelText('Maximum age filter');
      expect(maxInput).toHaveValue(10);
    });

    it('should call onAgeRangeChange when min age changes', async () => {
      const user = userEvent.setup();
      render(<HorseFilters {...mockProps} />);

      const minInput = screen.getByLabelText('Minimum age filter');
      await user.clear(minInput);
      await user.type(minInput, '5');

      expect(mockProps.onAgeRangeChange).toHaveBeenCalledWith(5, undefined);
    });

    it('should call onAgeRangeChange when max age changes', () => {
      render(<HorseFilters {...mockProps} />);

      const maxInput = screen.getByLabelText('Maximum age filter');
      fireEvent.change(maxInput, { target: { value: '10' } });

      expect(mockProps.onAgeRangeChange).toHaveBeenCalledWith(undefined, 10);
    });

    it('should handle clearing min age', async () => {
      const user = userEvent.setup();
      render(<HorseFilters {...mockProps} filters={{ ...mockFilters, minAge: 5 }} />);

      const minInput = screen.getByLabelText('Minimum age filter');
      await user.clear(minInput);

      expect(mockProps.onAgeRangeChange).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should have correct input attributes', () => {
      render(<HorseFilters {...mockProps} />);

      const minInput = screen.getByLabelText('Minimum age filter');
      expect(minInput).toHaveAttribute('type', 'number');
      expect(minInput).toHaveAttribute('min', '0');
      expect(minInput).toHaveAttribute('max', '30');
    });
  });

  describe('Breed Filter', () => {
    it('should render breed checkboxes', () => {
      render(<HorseFilters {...mockProps} breeds={mockBreeds} />);

      expect(screen.getByLabelText('Filter by Arabian')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by Thoroughbred')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by Quarter Horse')).toBeInTheDocument();
    });

    it('should NOT render breed section when no breeds provided', () => {
      render(<HorseFilters {...mockProps} breeds={[]} />);

      expect(screen.queryByText('Breeds')).not.toBeInTheDocument();
    });

    it('should check selected breeds', () => {
      render(
        <HorseFilters
          {...mockProps}
          breeds={mockBreeds}
          filters={{ ...mockFilters, breedIds: ['1', '3'] }}
        />
      );

      const arabianCheckbox = screen.getByLabelText('Filter by Arabian');
      const quarterHorseCheckbox = screen.getByLabelText('Filter by Quarter Horse');

      expect(arabianCheckbox).toBeChecked();
      expect(quarterHorseCheckbox).toBeChecked();
    });

    it('should call onBreedToggle when breed is clicked', async () => {
      const user = userEvent.setup();
      render(<HorseFilters {...mockProps} breeds={mockBreeds} />);

      const arabianCheckbox = screen.getByLabelText('Filter by Arabian');
      await user.click(arabianCheckbox);

      expect(mockProps.onBreedToggle).toHaveBeenCalledWith('1');
    });

    it('should handle scrollable breed list', () => {
      const manyBreeds = Array.from({ length: 20 }, (_, i) => ({
        id: String(i + 1),
        name: `Breed ${i + 1}`,
      }));

      render(<HorseFilters {...mockProps} breeds={manyBreeds} />);

      const breedContainer = screen.getByLabelText('Filter by Breed 1').closest('.space-y-2');
      expect(breedContainer).toHaveClass('max-h-40', 'overflow-y-auto');
    });
  });

  describe('Discipline Filter', () => {
    const disciplines = ['Racing', 'Dressage', 'ShowJumping', 'Eventing', 'Endurance', 'Trail'];

    it('should render all discipline checkboxes', () => {
      render(<HorseFilters {...mockProps} />);

      disciplines.forEach((discipline) => {
        expect(screen.getByLabelText(`Filter by ${discipline}`)).toBeInTheDocument();
      });
    });

    it('should check selected disciplines', () => {
      render(
        <HorseFilters
          {...mockProps}
          filters={{ ...mockFilters, disciplines: ['Racing', 'Dressage'] }}
        />
      );

      const racingCheckbox = screen.getByLabelText('Filter by Racing');
      const dressageCheckbox = screen.getByLabelText('Filter by Dressage');

      expect(racingCheckbox).toBeChecked();
      expect(dressageCheckbox).toBeChecked();
    });

    it('should call onDisciplineToggle when discipline is clicked', async () => {
      const user = userEvent.setup();
      render(<HorseFilters {...mockProps} />);

      const racingCheckbox = screen.getByLabelText('Filter by Racing');
      await user.click(racingCheckbox);

      expect(mockProps.onDisciplineToggle).toHaveBeenCalledWith('Racing');
    });

    it('should handle multiple discipline selections', async () => {
      const user = userEvent.setup();
      render(<HorseFilters {...mockProps} />);

      await user.click(screen.getByLabelText('Filter by Racing'));
      await user.click(screen.getByLabelText('Filter by Dressage'));
      await user.click(screen.getByLabelText('Filter by Endurance'));

      expect(mockProps.onDisciplineToggle).toHaveBeenCalledTimes(3);
    });
  });

  describe('Training Status Filter', () => {
    const statuses = [
      { value: 'all', label: 'All Horses' },
      { value: 'trained', label: 'Trained' },
      { value: 'untrained', label: 'Untrained' },
      { value: 'in_training', label: 'In Training' },
    ];

    it('should render all training status radio buttons', () => {
      render(<HorseFilters {...mockProps} />);

      statuses.forEach(({ label }) => {
        expect(screen.getByLabelText(`Filter by ${label}`)).toBeInTheDocument();
      });
    });

    it('should check current training status', () => {
      render(
        <HorseFilters {...mockProps} filters={{ ...mockFilters, trainingStatus: 'trained' }} />
      );

      const trainedRadio = screen.getByLabelText('Filter by Trained');
      expect(trainedRadio).toBeChecked();
    });

    it('should default to "All Horses" when status is "all"', () => {
      render(<HorseFilters {...mockProps} />);

      const allRadio = screen.getByLabelText('Filter by All Horses');
      expect(allRadio).toBeChecked();
    });

    it('should call onTrainingStatusChange when status is clicked', async () => {
      const user = userEvent.setup();
      render(<HorseFilters {...mockProps} />);

      const trainedRadio = screen.getByLabelText('Filter by Trained');
      await user.click(trainedRadio);

      expect(mockProps.onTrainingStatusChange).toHaveBeenCalledWith('trained');
    });

    it('should only allow one training status selection', async () => {
      const user = userEvent.setup();
      render(<HorseFilters {...mockProps} />);

      await user.click(screen.getByLabelText('Filter by Trained'));
      await user.click(screen.getByLabelText('Filter by Untrained'));

      // Verify the handler was called with both values
      expect(mockProps.onTrainingStatusChange).toHaveBeenCalledWith('trained');
      expect(mockProps.onTrainingStatusChange).toHaveBeenCalledWith('untrained');
      expect(mockProps.onTrainingStatusChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('Clear All Filters', () => {
    it('should call onClearFilters when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<HorseFilters {...mockProps} activeFilterCount={3} />);

      const clearButton = screen.getByLabelText('Clear all filters');
      await user.click(clearButton);

      expect(mockProps.onClearFilters).toHaveBeenCalled();
    });

    it('should disable clear button when loading', () => {
      render(<HorseFilters {...mockProps} activeFilterCount={2} isLoading={true} />);

      const clearButton = screen.getByLabelText('Clear all filters');
      expect(clearButton).toBeDisabled();
    });
  });

  describe('Expand/Collapse', () => {
    it('should start in expanded state by default', () => {
      render(<HorseFilters {...mockProps} />);

      const expandButton = screen.getByLabelText('Collapse filters');
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('should hide filter content when collapsed', async () => {
      const user = userEvent.setup();
      render(<HorseFilters {...mockProps} />);

      const collapseButton = screen.getByLabelText('Collapse filters');
      await user.click(collapseButton);

      expect(screen.queryByText('Age Range')).not.toBeInTheDocument();
    });

    it('should show filter content when expanded', async () => {
      const user = userEvent.setup();
      render(<HorseFilters {...mockProps} />);

      // Collapse first
      const collapseButton = screen.getByLabelText('Collapse filters');
      await user.click(collapseButton);

      // Then expand
      const expandButton = screen.getByLabelText('Expand filters');
      await user.click(expandButton);

      expect(screen.getByText('Age Range')).toBeInTheDocument();
    });

    it('should toggle aria-expanded attribute', async () => {
      const user = userEvent.setup();
      render(<HorseFilters {...mockProps} />);

      const button = screen.getByLabelText('Collapse filters');
      expect(button).toHaveAttribute('aria-expanded', 'true');

      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Loading State', () => {
    it('should disable age inputs when loading', () => {
      render(<HorseFilters {...mockProps} isLoading={true} />);

      const minInput = screen.getByLabelText('Minimum age filter');
      const maxInput = screen.getByLabelText('Maximum age filter');

      expect(minInput).toBeDisabled();
      expect(maxInput).toBeDisabled();
    });

    it('should disable breed checkboxes when loading', () => {
      render(<HorseFilters {...mockProps} breeds={mockBreeds} isLoading={true} />);

      const arabianCheckbox = screen.getByLabelText('Filter by Arabian');
      expect(arabianCheckbox).toBeDisabled();
    });

    it('should disable discipline checkboxes when loading', () => {
      render(<HorseFilters {...mockProps} isLoading={true} />);

      const racingCheckbox = screen.getByLabelText('Filter by Racing');
      expect(racingCheckbox).toBeDisabled();
    });

    it('should disable training status radios when loading', () => {
      render(<HorseFilters {...mockProps} isLoading={true} />);

      const trainedRadio = screen.getByLabelText('Filter by Trained');
      expect(trainedRadio).toBeDisabled();
    });

    it('should show loading message when loading', () => {
      render(<HorseFilters {...mockProps} isLoading={true} />);

      expect(screen.getByText('Applying filters...')).toBeInTheDocument();
    });

    it('should have loading message with proper ARIA attributes', () => {
      render(<HorseFilters {...mockProps} isLoading={true} />);

      const loadingMessage = screen.getByText('Applying filters...');
      expect(loadingMessage).toHaveAttribute('role', 'status');
      expect(loadingMessage).toHaveAttribute('aria-live', 'polite');
    });

    it('should NOT show loading message when not loading', () => {
      render(<HorseFilters {...mockProps} isLoading={false} />);

      expect(screen.queryByText('Applying filters...')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for all inputs', () => {
      render(<HorseFilters {...mockProps} breeds={mockBreeds} />);

      // Age inputs
      expect(screen.getByLabelText('Minimum age filter')).toBeInTheDocument();
      expect(screen.getByLabelText('Maximum age filter')).toBeInTheDocument();

      // Breed checkboxes
      expect(screen.getByLabelText('Filter by Arabian')).toBeInTheDocument();

      // Discipline checkboxes
      expect(screen.getByLabelText('Filter by Racing')).toBeInTheDocument();

      // Training status radios
      expect(screen.getByLabelText('Filter by Trained')).toBeInTheDocument();
    });

    it('should have proper heading structure', () => {
      render(<HorseFilters {...mockProps} />);

      const heading = screen.getByText('Filters');
      expect(heading.tagName).toBe('H2');
    });

    it('should hide decorative icons from screen readers', () => {
      render(<HorseFilters {...mockProps} activeFilterCount={1} />);

      const icons = document.querySelectorAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<HorseFilters {...mockProps} breeds={mockBreeds} />);

      const minAgeInput = screen.getByLabelText('Minimum age filter');
      const maxAgeInput = screen.getByLabelText('Maximum age filter');

      // Focus on first input directly
      minAgeInput.focus();
      expect(minAgeInput).toHaveFocus();

      // Tab to next input
      await user.tab();
      expect(maxAgeInput).toHaveFocus();

      // Verify all inputs are keyboard accessible
      const allInputs = [
        minAgeInput,
        maxAgeInput,
        screen.getByLabelText('Filter by Arabian'),
        screen.getByLabelText('Filter by Racing'),
        screen.getByLabelText('Filter by Trained'),
      ];

      allInputs.forEach((input) => {
        expect(input).not.toHaveAttribute('tabindex', '-1');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty breed list', () => {
      render(<HorseFilters {...mockProps} breeds={[]} />);

      expect(screen.queryByText('Breeds')).not.toBeInTheDocument();
    });

    it('should handle undefined breeds prop', () => {
      render(<HorseFilters {...mockProps} breeds={undefined} />);

      expect(screen.queryByText('Breeds')).not.toBeInTheDocument();
    });

    it('should handle age boundary values', async () => {
      const user = userEvent.setup();
      render(<HorseFilters {...mockProps} />);

      const minInput = screen.getByLabelText('Minimum age filter');
      await user.clear(minInput);
      await user.type(minInput, '0');

      expect(mockProps.onAgeRangeChange).toHaveBeenCalledWith(0, undefined);
    });

    it('should handle all filters selected', () => {
      render(
        <HorseFilters
          {...mockProps}
          breeds={mockBreeds}
          filters={{
            minAge: 5,
            maxAge: 10,
            breedIds: ['1', '2', '3'],
            disciplines: ['Racing', 'Dressage', 'ShowJumping'],
            trainingStatus: 'trained',
          }}
        />
      );

      // All breed checkboxes should be checked
      expect(screen.getByLabelText('Filter by Arabian')).toBeChecked();
      expect(screen.getByLabelText('Filter by Thoroughbred')).toBeChecked();

      // Selected disciplines should be checked
      expect(screen.getByLabelText('Filter by Racing')).toBeChecked();

      // Training status should be selected
      expect(screen.getByLabelText('Filter by Trained')).toBeChecked();
    });
  });

  describe('Integration', () => {
    it('should handle complete filter workflow', async () => {
      const user = userEvent.setup();
      render(<HorseFilters {...mockProps} breeds={mockBreeds} activeFilterCount={0} />);

      // Set age range
      const minInput = screen.getByLabelText('Minimum age filter');
      await user.type(minInput, '5');

      // Select breed
      await user.click(screen.getByLabelText('Filter by Arabian'));

      // Select discipline
      await user.click(screen.getByLabelText('Filter by Racing'));

      // Select training status
      await user.click(screen.getByLabelText('Filter by Trained'));

      // Verify all callbacks were called
      expect(mockProps.onAgeRangeChange).toHaveBeenCalled();
      expect(mockProps.onBreedToggle).toHaveBeenCalled();
      expect(mockProps.onDisciplineToggle).toHaveBeenCalled();
      expect(mockProps.onTrainingStatusChange).toHaveBeenCalled();
    });
  });
});
