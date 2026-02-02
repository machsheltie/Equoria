/**
 * Tests for DisciplinePicker Component
 *
 * Tests cover:
 * - Rendering all 23 disciplines and 4 categories
 * - Discipline score display
 * - Selection interactions and visual states
 * - Disabled/cooldown discipline handling
 * - Hover effects on enabled disciplines
 * - Accessibility (ARIA labels, keyboard navigation)
 * - Edge cases (empty scores, all disabled, large numbers)
 * - Responsive grid layout
 *
 * Story 4-1: Training Session Interface - Task 3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DisciplinePicker from '../DisciplinePicker';
import { DISCIPLINES } from '../../../lib/utils/training-utils';

describe('DisciplinePicker', () => {
  const mockDisciplineScores = {
    'western-pleasure': 10,
    reining: 25,
    cutting: 0,
    'barrel-racing': 50,
    racing: 100,
    dressage: 75,
  };

  const mockProps = {
    disciplineScores: mockDisciplineScores,
    selectedDiscipline: null,
    onSelectDiscipline: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== RENDERING TESTS ====================
  describe('Rendering', () => {
    it('should render all 23 disciplines', () => {
      render(<DisciplinePicker {...mockProps} />);

      // Verify all disciplines are present by checking button count
      const allButtons = screen.getAllByRole('button');
      expect(allButtons).toHaveLength(23);

      // Verify specific disciplines with exact aria-label matching
      expect(
        screen.getByRole('button', {
          name: /Select Western Pleasure discipline/i,
        })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Select Dressage discipline/i })
      ).toBeInTheDocument();
    });

    it('should render all 4 category sections', () => {
      render(<DisciplinePicker {...mockProps} />);

      const headings = screen.getAllByRole('heading', { level: 3 });
      const headingTexts = headings.map((h) => h.textContent);

      expect(headingTexts).toContain('Western');
      expect(headingTexts).toContain('English');
      expect(headingTexts).toContain('Specialized');
      expect(headingTexts).toContain('Racing');
    });

    it('should render 7 Western disciplines', () => {
      render(<DisciplinePicker {...mockProps} />);

      const westernDisciplines = [
        'Western Pleasure',
        'Reining',
        'Cutting',
        'Barrel Racing',
        'Roping',
        'Team Penning',
        'Rodeo',
      ];

      westernDisciplines.forEach((name) => {
        expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeInTheDocument();
      });
    });

    it('should render 6 English disciplines', () => {
      render(<DisciplinePicker {...mockProps} />);

      const englishDisciplines = [
        'Hunter',
        'Saddleseat',
        'Dressage',
        'Show Jumping',
        'Eventing',
        'Cross Country',
      ];

      englishDisciplines.forEach((name) => {
        expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeInTheDocument();
      });
    });

    it('should render 7 Specialized disciplines', () => {
      render(<DisciplinePicker {...mockProps} />);

      const specializedDisciplines = [
        'Endurance',
        'Vaulting',
        'Polo',
        'Combined Driving',
        'Fine Harness',
        'Gaited',
        'Gymkhana',
      ];

      specializedDisciplines.forEach((name) => {
        expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeInTheDocument();
      });
    });

    it('should render 3 Racing disciplines', () => {
      render(<DisciplinePicker {...mockProps} />);

      // Use specific aria-label queries to avoid conflicts with "Barrel Racing"
      expect(
        screen.getByRole('button', { name: /Select Racing discipline.*score:/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Select Steeplechase discipline/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Select Harness Racing discipline/i })
      ).toBeInTheDocument();
    });

    it('should show current scores for each discipline', () => {
      render(<DisciplinePicker {...mockProps} />);

      // Western Pleasure should show score: 10
      const westernPleasureButton = screen.getByRole('button', {
        name: /Western Pleasure.*score: 10/i,
      });
      expect(westernPleasureButton).toBeInTheDocument();

      // Racing should show score: 100 (use exact match)
      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score: 100/i,
      });
      expect(racingButton).toBeInTheDocument();
    });

    it('should show "Score: 0" for untrained disciplines', () => {
      render(<DisciplinePicker {...mockProps} />);

      // Cutting has score: 0 in mock data
      const cuttingButton = screen.getByRole('button', {
        name: /Cutting.*score: 0/i,
      });
      expect(cuttingButton).toBeInTheDocument();

      // Hunter not in mock data, should default to 0
      const hunterButton = screen.getByRole('button', {
        name: /Hunter.*score: 0/i,
      });
      expect(hunterButton).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = render(
        <DisciplinePicker {...mockProps} className="custom-test-class" />
      );

      const picker = container.querySelector('[data-testid="discipline-picker"]');
      expect(picker).toHaveClass('custom-test-class');
    });

    it('should have responsive grid layout classes', () => {
      const { container } = render(<DisciplinePicker {...mockProps} />);

      const grid = container.querySelector('.grid');
      expect(grid).toHaveClass('grid-cols-1');
      expect(grid).toHaveClass('md:grid-cols-2');
      expect(grid).toHaveClass('lg:grid-cols-4');
    });
  });

  // ==================== INTERACTION TESTS ====================
  describe('Interactions', () => {
    it('should call onSelectDiscipline when discipline is clicked', async () => {
      const user = userEvent.setup();
      render(<DisciplinePicker {...mockProps} />);

      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score:/i,
      });
      await user.click(racingButton);

      expect(mockProps.onSelectDiscipline).toHaveBeenCalledWith('racing');
      expect(mockProps.onSelectDiscipline).toHaveBeenCalledTimes(1);
    });

    it('should call onSelectDiscipline with correct discipline ID', async () => {
      const user = userEvent.setup();
      render(<DisciplinePicker {...mockProps} />);

      const westernPleasureButton = screen.getByRole('button', {
        name: /Western Pleasure/i,
      });
      await user.click(westernPleasureButton);

      expect(mockProps.onSelectDiscipline).toHaveBeenCalledWith('western-pleasure');
    });

    it('should highlight selected discipline with blue background', () => {
      render(<DisciplinePicker {...mockProps} selectedDiscipline="racing" />);

      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score:/i,
      });
      expect(racingButton).toHaveClass('bg-blue-600', 'text-white', 'border-blue-600');
    });

    it('should show aria-selected=true for selected discipline', () => {
      render(<DisciplinePicker {...mockProps} selectedDiscipline="dressage" />);

      const dressageButton = screen.getByRole('button', { name: /Dressage/i });
      expect(dressageButton).toHaveAttribute('aria-selected', 'true');
    });

    it('should show aria-selected=false for unselected disciplines', () => {
      render(<DisciplinePicker {...mockProps} selectedDiscipline="racing" />);

      const dressageButton = screen.getByRole('button', { name: /Dressage/i });
      expect(dressageButton).toHaveAttribute('aria-selected', 'false');
    });

    it('should NOT call onSelectDiscipline when disabled discipline is clicked', async () => {
      const user = userEvent.setup();
      render(<DisciplinePicker {...mockProps} disabledDisciplines={['racing', 'dressage']} />);

      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score:/i,
      });
      await user.click(racingButton);

      expect(mockProps.onSelectDiscipline).not.toHaveBeenCalled();
    });

    it('should disable button for disabled disciplines', () => {
      render(<DisciplinePicker {...mockProps} disabledDisciplines={['racing', 'dressage']} />);

      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score:/i,
      });
      const dressageButton = screen.getByRole('button', { name: /Dressage/i });

      expect(racingButton).toBeDisabled();
      expect(dressageButton).toBeDisabled();
    });

    it('should apply disabled styling to disabled disciplines', () => {
      render(<DisciplinePicker {...mockProps} disabledDisciplines={['racing']} />);

      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score:/i,
      });
      expect(racingButton).toHaveClass('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
    });

    it('should handle multiple clicks on same discipline', async () => {
      const user = userEvent.setup();
      render(<DisciplinePicker {...mockProps} />);

      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score:/i,
      });

      await user.click(racingButton);
      await user.click(racingButton);
      await user.click(racingButton);

      expect(mockProps.onSelectDiscipline).toHaveBeenCalledTimes(3);
      expect(mockProps.onSelectDiscipline).toHaveBeenCalledWith('racing');
    });

    it('should handle clicking different disciplines sequentially', async () => {
      const user = userEvent.setup();
      render(<DisciplinePicker {...mockProps} />);

      await user.click(screen.getByRole('button', { name: /Select Racing discipline.*score:/i }));
      await user.click(screen.getByRole('button', { name: /Dressage/i }));
      await user.click(screen.getByRole('button', { name: /Reining/i }));

      expect(mockProps.onSelectDiscipline).toHaveBeenNthCalledWith(1, 'racing');
      expect(mockProps.onSelectDiscipline).toHaveBeenNthCalledWith(2, 'dressage');
      expect(mockProps.onSelectDiscipline).toHaveBeenNthCalledWith(3, 'reining');
    });

    it('should have hover effects on enabled disciplines', () => {
      render(<DisciplinePicker {...mockProps} />);

      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score:/i,
      });
      expect(racingButton).toHaveClass('hover:border-blue-400', 'hover:shadow-sm');
    });
  });

  // ==================== ACCESSIBILITY TESTS ====================
  describe('Accessibility', () => {
    it('should have proper aria-label for all discipline buttons', () => {
      render(<DisciplinePicker {...mockProps} />);

      // Check that all buttons have proper aria-labels with scores
      const allButtons = screen.getAllByRole('button');
      expect(allButtons).toHaveLength(23);

      allButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label');
        const ariaLabel = button.getAttribute('aria-label') || '';
        expect(ariaLabel).toMatch(/Select .* discipline, current score:/i);
      });
    });

    it('should have aria-disabled on disabled buttons', () => {
      render(<DisciplinePicker {...mockProps} disabledDisciplines={['racing']} />);

      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score:/i,
      });
      expect(racingButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('should have aria-selected for selection state', () => {
      render(<DisciplinePicker {...mockProps} selectedDiscipline="dressage" />);

      const dressageButton = screen.getByRole('button', {
        name: /Select Dressage discipline/i,
      });
      expect(dressageButton).toHaveAttribute('aria-selected', 'true');

      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score:/i,
      });
      expect(racingButton).toHaveAttribute('aria-selected', 'false');
    });

    it('should support keyboard navigation with Tab', async () => {
      const user = userEvent.setup();
      render(<DisciplinePicker {...mockProps} />);

      const firstButton = screen.getByRole('button', { name: /Western Pleasure/i });
      const secondButton = screen.getByRole('button', { name: /Reining/i });

      firstButton.focus();
      expect(firstButton).toHaveFocus();

      await user.tab();
      expect(secondButton).toHaveFocus();
    });

    it('should support keyboard activation with Enter key', async () => {
      const user = userEvent.setup();
      render(<DisciplinePicker {...mockProps} />);

      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score:/i,
      });
      racingButton.focus();

      await user.keyboard('{Enter}');

      expect(mockProps.onSelectDiscipline).toHaveBeenCalledWith('racing');
    });

    it('should support keyboard activation with Space key', async () => {
      const user = userEvent.setup();
      render(<DisciplinePicker {...mockProps} />);

      const dressageButton = screen.getByRole('button', { name: /Dressage/i });
      dressageButton.focus();

      await user.keyboard(' ');

      expect(mockProps.onSelectDiscipline).toHaveBeenCalledWith('dressage');
    });

    it('should have focus ring on keyboard focus', () => {
      render(<DisciplinePicker {...mockProps} />);

      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score:/i,
      });
      const classList = racingButton.className;
      expect(classList).toContain('focus:outline-none');
      expect(classList).toContain('focus:ring-2');
      expect(classList).toContain('focus:ring-blue-500');
    });

    it('should prevent keyboard activation of disabled buttons', async () => {
      const user = userEvent.setup();
      render(<DisciplinePicker {...mockProps} disabledDisciplines={['racing']} />);

      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score:/i,
      });
      racingButton.focus();

      await user.keyboard('{Enter}');

      expect(mockProps.onSelectDiscipline).not.toHaveBeenCalled();
    });
  });

  // ==================== EDGE CASES ====================
  describe('Edge Cases', () => {
    it('should handle empty disciplineScores object', () => {
      render(<DisciplinePicker {...mockProps} disciplineScores={{}} />);

      // All disciplines should show score: 0
      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score: 0/i,
      });
      expect(racingButton).toBeInTheDocument();

      const dressageButton = screen.getByRole('button', {
        name: /Select Dressage discipline.*score: 0/i,
      });
      expect(dressageButton).toBeInTheDocument();
    });

    it('should handle all disciplines disabled', () => {
      const allDisciplineIds = DISCIPLINES.map((d) => d.id);
      render(<DisciplinePicker {...mockProps} disabledDisciplines={allDisciplineIds} />);

      // All buttons should be disabled
      const allButtons = screen.getAllByRole('button');
      allButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it('should show loading state correctly', () => {
      render(<DisciplinePicker {...mockProps} isLoading={true} />);

      expect(screen.getByText('Loading disciplines...')).toBeInTheDocument();
    });

    it('should disable all buttons when loading', () => {
      render(<DisciplinePicker {...mockProps} isLoading={true} />);

      const allButtons = screen.getAllByRole('button');
      allButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it('should have proper ARIA attributes on loading message', () => {
      render(<DisciplinePicker {...mockProps} isLoading={true} />);

      const loadingMessage = screen.getByText('Loading disciplines...');
      expect(loadingMessage).toHaveAttribute('role', 'status');
      expect(loadingMessage).toHaveAttribute('aria-live', 'polite');
    });

    it('should NOT show loading message when not loading', () => {
      render(<DisciplinePicker {...mockProps} isLoading={false} />);

      expect(screen.queryByText('Loading disciplines...')).not.toBeInTheDocument();
    });

    it('should handle no selection state', () => {
      render(<DisciplinePicker {...mockProps} selectedDiscipline={null} />);

      const allButtons = screen.getAllByRole('button');
      allButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-selected', 'false');
      });
    });

    it('should display large score numbers correctly', () => {
      render(
        <DisciplinePicker
          {...mockProps}
          disciplineScores={{
            racing: 999999,
            dressage: 123456,
          }}
        />
      );

      expect(
        screen.getByRole('button', {
          name: /Select Racing discipline.*score: 999999/i,
        })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: /Select Dressage discipline.*score: 123456/i,
        })
      ).toBeInTheDocument();
    });

    it('should handle undefined disabledDisciplines prop', () => {
      render(<DisciplinePicker {...mockProps} disabledDisciplines={undefined} />);

      // All buttons should be enabled (not disabled by prop)
      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score:/i,
      });
      expect(racingButton).not.toBeDisabled();
    });

    it('should handle empty disabledDisciplines array', () => {
      render(<DisciplinePicker {...mockProps} disabledDisciplines={[]} />);

      const allButtons = screen.getAllByRole('button');
      allButtons.forEach((button) => {
        expect(button).not.toBeDisabled();
      });
    });
  });

  // ==================== INTEGRATION TESTS ====================
  describe('Integration', () => {
    it('should handle complete selection workflow', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<DisciplinePicker {...mockProps} />);

      // Select Racing
      await user.click(screen.getByRole('button', { name: /Select Racing discipline.*score:/i }));
      expect(mockProps.onSelectDiscipline).toHaveBeenCalledWith('racing');

      // Simulate parent updating selectedDiscipline
      rerender(<DisciplinePicker {...mockProps} selectedDiscipline="racing" />);

      // Verify Racing is now highlighted
      const racingButton = screen.getByRole('button', {
        name: /Select Racing discipline.*score:/i,
      });
      expect(racingButton).toHaveClass('bg-blue-600');
      expect(racingButton).toHaveAttribute('aria-selected', 'true');
    });

    it('should render all categories with correct discipline counts', () => {
      render(<DisciplinePicker {...mockProps} />);

      // Western section should have 7 disciplines
      const westernHeading = screen.getByRole('heading', { name: /Western/i });
      const westernSection = westernHeading.closest('div');
      const westernButtons = within(westernSection as HTMLElement).getAllByRole('button');
      expect(westernButtons).toHaveLength(7);

      // English section should have 6 disciplines
      const englishHeading = screen.getByRole('heading', { name: /English/i });
      const englishSection = englishHeading.closest('div');
      const englishButtons = within(englishSection as HTMLElement).getAllByRole('button');
      expect(englishButtons).toHaveLength(6);

      // Specialized section should have 7 disciplines
      const specializedHeading = screen.getByRole('heading', { name: /Specialized/i });
      const specializedSection = specializedHeading.closest('div');
      const specializedButtons = within(specializedSection as HTMLElement).getAllByRole('button');
      expect(specializedButtons).toHaveLength(7);

      // Racing section should have 3 disciplines
      const racingHeading = screen.getByRole('heading', { name: /Racing/i });
      const racingSection = racingHeading.closest('div');
      const racingButtons = within(racingSection as HTMLElement).getAllByRole('button');
      expect(racingButtons).toHaveLength(3);
    });

    it('should maintain state consistency across multiple interactions', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<DisciplinePicker {...mockProps} />);

      // Select first discipline
      await user.click(screen.getByRole('button', { name: /Select Racing discipline.*score:/i }));
      rerender(<DisciplinePicker {...mockProps} selectedDiscipline="racing" />);

      expect(
        screen.getByRole('button', {
          name: /Select Racing discipline.*score:/i,
        })
      ).toHaveAttribute('aria-selected', 'true');

      // Select second discipline
      await user.click(
        screen.getByRole('button', {
          name: /Select Dressage discipline/i,
        })
      );
      rerender(<DisciplinePicker {...mockProps} selectedDiscipline="dressage" />);

      expect(
        screen.getByRole('button', {
          name: /Select Dressage discipline/i,
        })
      ).toHaveAttribute('aria-selected', 'true');
      expect(
        screen.getByRole('button', {
          name: /Select Racing discipline.*score:/i,
        })
      ).toHaveAttribute('aria-selected', 'false');
    });
  });
});
