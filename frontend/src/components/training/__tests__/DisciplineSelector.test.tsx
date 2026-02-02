import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
      expect(screen.getByLabelText(/Discipline/i)).toBeInTheDocument();
    });

    it('renders select element', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );
      const select = screen.getByRole('combobox', { name: /Discipline/i });
      expect(select).toBeInTheDocument();
    });

    it('displays selected discipline', () => {
      render(
        <DisciplineSelector selectedDiscipline="Show Jumping" onDisciplineChange={mockOnChange} />
      );
      const select = screen.getByRole('combobox', { name: /Discipline/i }) as HTMLSelectElement;
      expect(select.value).toBe('Show Jumping');
    });
  });

  describe('All 23 Disciplines', () => {
    it('includes all 23 disciplines as options', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      ALL_DISCIPLINES.forEach((discipline) => {
        expect(screen.getByRole('option', { name: discipline })).toBeInTheDocument();
      });
    });

    it('has exactly 23 options', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(23);
    });

    it('renders disciplines in alphabetical order', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const options = screen.getAllByRole('option');
      const disciplineNames = options.map((opt) => opt.textContent);

      // Check that it matches the sorted ALL_DISCIPLINES array
      expect(disciplineNames).toEqual(ALL_DISCIPLINES);
    });
  });

  describe('Interaction', () => {
    it('calls onDisciplineChange when discipline is selected', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const select = screen.getByRole('combobox', { name: /Discipline/i });
      fireEvent.change(select, { target: { value: 'Racing' } });

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('Racing');
    });

    it('calls onDisciplineChange with correct discipline on change', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const select = screen.getByRole('combobox', { name: /Discipline/i });
      fireEvent.change(select, { target: { value: 'Eventing' } });

      expect(mockOnChange).toHaveBeenCalledWith('Eventing');
    });

    it('allows changing to different disciplines multiple times', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const select = screen.getByRole('combobox', { name: /Discipline/i });

      fireEvent.change(select, { target: { value: 'Racing' } });
      expect(mockOnChange).toHaveBeenCalledWith('Racing');

      fireEvent.change(select, { target: { value: 'Show Jumping' } });
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
        />
      );

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);

      customDisciplines.forEach((discipline) => {
        expect(screen.getByRole('option', { name: discipline })).toBeInTheDocument();
      });
    });

    it('falls back to all 23 disciplines when disciplines prop not provided', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(23);
    });
  });

  describe('Accessibility', () => {
    it('has proper label association', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const select = screen.getByLabelText(/Discipline/i);
      expect(select).toHaveAttribute('id', 'discipline-selector');
    });

    it('select has accessible name', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const select = screen.getByRole('combobox', { name: /Discipline/i });
      expect(select).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies correct CSS classes to select', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const select = screen.getByRole('combobox', { name: /Discipline/i });
      expect(select).toHaveClass('rounded-md');
      expect(select).toHaveClass('border');
      expect(select).toHaveClass('border-slate-200');
    });

    it('applies correct CSS classes to label', () => {
      render(
        <DisciplineSelector selectedDiscipline="Dressage" onDisciplineChange={mockOnChange} />
      );

      const label = screen.getByText(/Discipline/i);
      expect(label).toHaveClass('text-sm');
      expect(label).toHaveClass('font-medium');
      expect(label).toHaveClass('text-slate-700');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty string as selected discipline', () => {
      render(<DisciplineSelector selectedDiscipline="" onDisciplineChange={mockOnChange} />);

      const select = screen.getByRole('combobox', { name: /Discipline/i }) as HTMLSelectElement;
      // Should default to first discipline if empty
      expect(select.value).toBeTruthy();
    });

    it('handles discipline not in the list', () => {
      render(
        <DisciplineSelector
          selectedDiscipline="NonExistentDiscipline"
          onDisciplineChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox', { name: /Discipline/i }) as HTMLSelectElement;
      // Should still render without crashing
      expect(select).toBeInTheDocument();
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

      const description = screen.queryByText(/Select a discipline/i);
      expect(description).not.toBeInTheDocument();
    });
  });
});
