import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect } from 'vitest';
import HorseStatsCard from '../HorseStatsCard';
import type { TrainableHorse } from '@/lib/api-client';

describe('HorseStatsCard', () => {
  const mockHorse: TrainableHorse = {
    id: 1,
    name: 'Thunder',
    level: 5,
    breed: 'Thoroughbred',
    gender: 'Mare',
    sex: 'Female',
    ageYears: 4,
    bestDisciplines: ['Racing', 'Show Jumping', 'Dressage'],
  };

  describe('Rendering', () => {
    it('renders horse stats card', () => {
      render(<HorseStatsCard horse={mockHorse} />);
      expect(screen.getByText('Horse Stats')).toBeInTheDocument();
    });

    it('displays horse name', () => {
      render(<HorseStatsCard horse={mockHorse} />);
      expect(screen.getByText('Thunder')).toBeInTheDocument();
    });

    it('displays horse level when provided', () => {
      render(<HorseStatsCard horse={mockHorse} />);
      expect(screen.getByText(/Level 5/i)).toBeInTheDocument();
    });

    it('displays horse breed when provided', () => {
      render(<HorseStatsCard horse={mockHorse} />);
      expect(screen.getByText(/Breed:/i)).toBeInTheDocument();
      expect(screen.getByText(/Thoroughbred/i)).toBeInTheDocument();
    });

    it('displays horse age when provided', () => {
      render(<HorseStatsCard horse={mockHorse} />);
      expect(screen.getByText(/Age:/i)).toBeInTheDocument();
      expect(screen.getByText(/4 years/i)).toBeInTheDocument();
    });

    it('displays horse gender when provided', () => {
      render(<HorseStatsCard horse={mockHorse} />);
      expect(screen.getByText(/Gender:/i)).toBeInTheDocument();
      expect(screen.getByText(/Mare/i)).toBeInTheDocument();
    });

    it('displays best disciplines when provided', () => {
      render(<HorseStatsCard horse={mockHorse} />);
      expect(screen.getByText(/Best Disciplines:/i)).toBeInTheDocument();
      expect(screen.getByText(/Racing/i)).toBeInTheDocument();
      expect(screen.getByText(/Show Jumping/i)).toBeInTheDocument();
      expect(screen.getByText(/Dressage/i)).toBeInTheDocument();
    });
  });

  describe('Missing Data Handling', () => {
    it('handles missing level gracefully', () => {
      const horseWithoutLevel = { ...mockHorse, level: undefined };
      render(<HorseStatsCard horse={horseWithoutLevel} />);
      expect(screen.queryByText(/Level/i)).not.toBeInTheDocument();
    });

    it('handles missing breed gracefully', () => {
      const horseWithoutBreed = { ...mockHorse, breed: undefined };
      render(<HorseStatsCard horse={horseWithoutBreed} />);
      expect(screen.queryByText(/Breed:/i)).not.toBeInTheDocument();
    });

    it('handles missing age gracefully', () => {
      const horseWithoutAge = { ...mockHorse, ageYears: undefined };
      render(<HorseStatsCard horse={horseWithoutAge} />);
      expect(screen.queryByText(/Age:/i)).not.toBeInTheDocument();
    });

    it('handles missing gender gracefully', () => {
      const horseWithoutGender = { ...mockHorse, gender: undefined };
      render(<HorseStatsCard horse={horseWithoutGender} />);
      expect(screen.queryByText(/Gender:/i)).not.toBeInTheDocument();
    });

    it('handles missing best disciplines gracefully', () => {
      const horseWithoutDisciplines = { ...mockHorse, bestDisciplines: undefined };
      render(<HorseStatsCard horse={horseWithoutDisciplines} />);
      expect(screen.queryByText(/Best Disciplines:/i)).not.toBeInTheDocument();
    });

    it('handles empty best disciplines array', () => {
      const horseWithEmptyDisciplines = { ...mockHorse, bestDisciplines: [] };
      render(<HorseStatsCard horse={horseWithEmptyDisciplines} />);
      expect(screen.queryByText(/Best Disciplines:/i)).not.toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies correct CSS classes to container', () => {
      const { container } = render(<HorseStatsCard horse={mockHorse} />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('rounded-md');
      expect(card).toHaveClass('border');
    });

    it('displays stats in grid layout', () => {
      const { container } = render(<HorseStatsCard horse={mockHorse} />);
      const statsGrid = container.querySelector('.grid');
      expect(statsGrid).toBeInTheDocument();
    });
  });

  describe('Best Disciplines Display', () => {
    it('displays disciplines as comma-separated list', () => {
      render(<HorseStatsCard horse={mockHorse} />);
      const disciplinesText = screen.getByText(/Racing, Show Jumping, Dressage/i);
      expect(disciplinesText).toBeInTheDocument();
    });

    it('handles single discipline correctly', () => {
      const horseWithOneDiscipline = { ...mockHorse, bestDisciplines: ['Racing'] };
      render(<HorseStatsCard horse={horseWithOneDiscipline} />);
      expect(screen.getByText(/Racing/i)).toBeInTheDocument();
    });

    it('handles multiple disciplines with proper formatting', () => {
      render(<HorseStatsCard horse={mockHorse} />);
      // Should show "Racing, Show Jumping, Dressage" (comma-separated)
      expect(screen.getByText(/Racing/i)).toBeInTheDocument();
      expect(screen.getByText(/Show Jumping/i)).toBeInTheDocument();
      expect(screen.getByText(/Dressage/i)).toBeInTheDocument();
    });
  });

  describe('Age Formatting', () => {
    it('displays "1 year" for age of 1', () => {
      const youngHorse = { ...mockHorse, ageYears: 1 };
      render(<HorseStatsCard horse={youngHorse} />);
      expect(screen.getByText(/1 year/i)).toBeInTheDocument();
      expect(screen.queryByText(/1 years/i)).not.toBeInTheDocument();
    });

    it('displays "X years" for age greater than 1', () => {
      render(<HorseStatsCard horse={mockHorse} />);
      expect(screen.getByText(/4 years/i)).toBeInTheDocument();
    });

    it('displays "0 years" for newborn horse', () => {
      const newborn = { ...mockHorse, ageYears: 0 };
      render(<HorseStatsCard horse={newborn} />);
      expect(screen.getByText(/0 years/i)).toBeInTheDocument();
    });
  });
});
