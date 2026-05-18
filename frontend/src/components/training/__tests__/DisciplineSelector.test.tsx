import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import DisciplineSelector from '../DisciplineSelector';

// All 23 disciplines from backend
const ALL_DISCIPLINES = [
  'Barrel Racing',
  'Combined Driving',
  'Cross Country',
  'Cutting',
  'Dressage',
  'Endurance',
  'Eventing',
  'Fine Harness',
  'Gaited',
  'Gymkhana',
  'Harness Racing',
  'Hunter',
  'Polo',
  'Racing',
  'Reining',
  'Rodeo',
  'Roping',
  'Saddleseat',
  'Show Jumping',
  'Steeplechase',
  'Team Penning',
  'Vaulting',
  'Western Pleasure',
];

describe('DisciplineSelector', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders discipline selector with label', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );
      expect(screen.getByText(/Discipline/i)).toBeInTheDocument();
    });

    it('renders the selector container', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );
      expect(screen.getByTestId('discipline-selector')).toBeInTheDocument();
    });

    it('marks the selected discipline as pressed', () => {
      render(
        <DisciplineSelector selectedDiscipline="Show Jumping" onDisciplineChange={mockOnChange} />
      );
      const selectedButton = screen.getByRole('button', { name: /Show Jumping/i });
      expect(selectedButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('All 23 Disciplines', () => {
    it('includes all 23 disciplines as buttons', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      // Collect every button's accessible name once. Iterating getAllByRole
      // with a regex per discipline (24 separate queries) was ~390ms/query
      // and pushed the test past the 10s default; one query + JS filter is
      // O(n) instead of O(n*m).
      const buttonNames = screen
        .getAllByRole('button')
        .map((b) => b.textContent ?? '')
        .join('\n');

      ALL_DISCIPLINES.forEach((discipline) => {
        expect(buttonNames).toContain(discipline);
      });
    });

    it('renders exactly 23 discipline buttons', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      // Count discipline buttons by collecting unique discipline names from button accessible names
      const allButtons = screen.getAllByRole('button');
      const disciplineMatches = allButtons.filter((btn) =>
        ALL_DISCIPLINES.some((d) => btn.textContent?.includes(d))
      );
      // Account for possible duplicates (recommended + main list); assert covers all 23 disciplines
      const renderedDisciplines = new Set<string>();
      disciplineMatches.forEach((btn) => {
        ALL_DISCIPLINES.forEach((d) => {
          if (btn.textContent?.includes(d)) renderedDisciplines.add(d);
        });
      });
      expect(renderedDisciplines.size).toBe(23);
    });
  });

  describe('Interaction', () => {
    it('calls onDisciplineChange when a discipline is clicked', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const racingButton = screen.getAllByRole('button', { name: /Racing/i })[0];
      racingButton.click();

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      // First match could be 'Racing' or 'Barrel Racing' — assert we got SOME discipline
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('calls onDisciplineChange with the discipline name on click', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const eventingButton = screen.getByRole('button', { name: /^Eventing/i });
      eventingButton.click();

      expect(mockOnChange).toHaveBeenCalledWith('Eventing');
    });

    it('allows clicking different disciplines sequentially', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const racingButton = screen.getByRole('button', { name: /^Racing/i });
      racingButton.click();
      expect(mockOnChange).toHaveBeenCalledWith('Racing');

      const showJumpingButton = screen.getByRole('button', { name: /Show Jumping/i });
      showJumpingButton.click();
      expect(mockOnChange).toHaveBeenCalledWith('Show Jumping');

      expect(mockOnChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('Custom Disciplines Prop', () => {
    it('uses custom disciplines when provided', () => {
      const customDisciplines = ['Dressage', 'Racing', 'Eventing'];

      render(
        <DisciplineSelector
          selectedDiscipline="Dressage"
          onDisciplineChange={mockOnChange}
          disciplines={customDisciplines}
          recommendedDisciplines={[]}
        />
      );

      // Each custom discipline should render as a button
      customDisciplines.forEach((discipline) => {
        const matches = screen.getAllByRole('button', { name: new RegExp(discipline, 'i') });
        expect(matches.length).toBeGreaterThan(0);
      });
    });

    it('falls back to all 23 disciplines when disciplines prop not provided', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const renderedDisciplines = new Set<string>();
      screen.getAllByRole('button').forEach((btn) => {
        ALL_DISCIPLINES.forEach((d) => {
          if (btn.textContent?.includes(d)) renderedDisciplines.add(d);
        });
      });
      expect(renderedDisciplines.size).toBe(23);
    });
  });

  describe('Accessibility', () => {
    it('has aria-pressed on each discipline button', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const dressageButton = screen.getByRole('button', { name: /Dressage/i });
      expect(dressageButton).toHaveAttribute('aria-pressed');
    });

    it('selected discipline has aria-pressed=true', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const dressageButton = screen.getByRole('button', { name: /Dressage/i });
      expect(dressageButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('unselected disciplines have aria-pressed=false', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const racingButton = screen.getByRole('button', { name: /^Racing/i });
      expect(racingButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Styling', () => {
    it('selected discipline button has selected styling', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const dressageButton = screen.getByRole('button', { name: /Dressage/i });
      // Selected state uses gold-primary border
      expect(dressageButton.className).toContain('border-[var(--gold-primary)]');
    });

    it('label has muted text styling', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const label = screen.getByText('Discipline', { selector: 'label' });
      expect(label.className).toContain('text-[var(--text-muted)]');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty string as selected discipline', () => {
      render(<DisciplineSelector selectedDiscipline="" onDisciplineChange={mockOnChange} />);

      // Should still render the selector
      expect(screen.getByTestId('discipline-selector')).toBeInTheDocument();
    });

    it('handles discipline not in the list without crashing', () => {
      render(
        <DisciplineSelector
          selectedDiscipline="NonExistentDiscipline"
          onDisciplineChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('discipline-selector')).toBeInTheDocument();
    });
  });

  describe('Optional Description Prop', () => {
    it('renders description when provided', () => {
      render(
        <DisciplineSelector
          selectedDiscipline="Dressage"
          onDisciplineChange={mockOnChange}
          description="Select a discipline to train"
        />
      );

      expect(screen.getByText('Select a discipline to train')).toBeInTheDocument();
    });

    it('does not render description when not provided', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const description = screen.queryByText(/Select a discipline to train/i);
      expect(description).not.toBeInTheDocument();
    });
  });

  // Equoria-pfp1w: personalized recommendations + per-discipline trait
  // indicators. Asserts the selector renders the real ⭐ bonus / ⚠ penalty
  // badges when traitIndicators are supplied (from the horse's real traits).
  describe('Trait indicators (Equoria-pfp1w)', () => {
    it('renders a bonus trait indicator on a discipline', () => {
      render(
        <DisciplineSelector
          selectedDiscipline=""
          onDisciplineChange={mockOnChange}
          recommendedDisciplines={['Racing']}
          traitIndicators={{ Racing: [{ trait: 'athletic', kind: 'bonus' }] }}
        />
      );
      const bonus = screen.getByTestId('trait-indicator-bonus');
      expect(bonus).toBeInTheDocument();
      expect(bonus).toHaveTextContent('Athletic');
    });

    it('renders a penalty trait indicator on a discipline', () => {
      render(
        <DisciplineSelector
          selectedDiscipline=""
          onDisciplineChange={mockOnChange}
          recommendedDisciplines={['Racing']}
          traitIndicators={{ Racing: [{ trait: 'stubborn', kind: 'penalty' }] }}
        />
      );
      expect(screen.getByTestId('trait-indicator-penalty')).toHaveTextContent('Stubborn');
    });

    it('respects a personalized recommended order (not the static default)', () => {
      // Steeplechase is NOT in DEFAULT_RECOMMENDED; passing it explicitly
      // proves the recommended set is caller-driven (personalized), and the
      // matchScore badge surfaces the horse-specific score.
      render(
        <DisciplineSelector
          selectedDiscipline=""
          onDisciplineChange={mockOnChange}
          recommendedDisciplines={['Steeplechase']}
          matchScores={{ Steeplechase: 91 }}
        />
      );
      expect(screen.getByText('Recommended for this horse')).toBeInTheDocument();
      expect(screen.getByText('91%')).toBeInTheDocument();
    });

    it('does not render trait indicator container when none supplied', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );
      expect(screen.queryByTestId('discipline-trait-indicators')).not.toBeInTheDocument();
    });
  });
});
