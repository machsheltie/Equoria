import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect } from 'vitest';
import TrainingResultsDisplay from '../TrainingResultsDisplay';
import type { TrainingResult } from '@/lib/api-client';

describe('TrainingResultsDisplay', () => {
  const mockOnClose = vi.fn();
  const mockOnTrainAgain = vi.fn();

  const mockSuccessResult: TrainingResult = {
    updatedScore: 85,
    nextEligibleDate: '2025-12-10T10:00:00Z',
    discipline: 'Barrel Racing',
    horseId: 1,
    message: 'Excellent training session!',
  };

  const mockFailureResult: TrainingResult = {
    updatedScore: 45,
    nextEligibleDate: '2025-12-10T10:00:00Z',
    discipline: 'Show Jumping',
    horseId: 2,
    message: 'Training completed, but performance was below average.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders training results display', () => {
      render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      expect(screen.getByText(/Training Results/i)).toBeInTheDocument();
    });

    it('displays discipline name', () => {
      render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      expect(screen.getByText(/Barrel Racing/i)).toBeInTheDocument();
    });

    it('displays updated score', () => {
      render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      expect(screen.getByText(/85/)).toBeInTheDocument();
    });

    it('displays score change when provided', () => {
      render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      // Score change: 85 - 75 = +10
      expect(screen.getByText(/\+10/)).toBeInTheDocument();
    });

    it('displays message when provided', () => {
      render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      expect(screen.getByText(/Excellent training session!/i)).toBeInTheDocument();
    });

    it('displays next eligible date', () => {
      render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      expect(screen.getByText(/Next Training:/i)).toBeInTheDocument();
    });
  });

  describe('Score Change Display', () => {
    it('shows positive score change with + prefix', () => {
      render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      expect(screen.getByText(/\+10/)).toBeInTheDocument();
    });

    it('shows negative score change with - prefix', () => {
      const negativeResult = { ...mockSuccessResult, updatedScore: 65 };
      render(
        <TrainingResultsDisplay
          result={negativeResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      expect(screen.getByText(/-10/)).toBeInTheDocument();
    });

    it('shows zero score change', () => {
      const noChangeResult = { ...mockSuccessResult, updatedScore: 75 };
      render(
        <TrainingResultsDisplay
          result={noChangeResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      // Look for "Score unchanged" message which appears when score change is 0
      expect(screen.getByText(/Score unchanged/i)).toBeInTheDocument();
    });

    it('handles undefined previous score gracefully', () => {
      render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={undefined}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      // Should still show updated score
      expect(screen.getByText(/85/)).toBeInTheDocument();
      // Should not show score change
      expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
    });
  });

  describe('Success/Failure Indication', () => {
    it('shows success styling for improved score', () => {
      const { container } = render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      // Check for success-related classes (emerald/green colors)
      const successElements = container.querySelectorAll('[class*="emerald"], [class*="green"]');
      expect(successElements.length).toBeGreaterThan(0);
    });

    it('shows warning styling for declined score', () => {
      const declinedResult = { ...mockSuccessResult, updatedScore: 65 };
      const { container } = render(
        <TrainingResultsDisplay
          result={declinedResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      // Check for warning-related classes (amber/orange colors)
      const warningElements = container.querySelectorAll('[class*="amber"], [class*="orange"]');
      expect(warningElements.length).toBeGreaterThan(0);
    });
  });

  describe('Buttons', () => {
    it('renders Train Again button', () => {
      render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      expect(screen.getByRole('button', { name: /Train Again/i })).toBeInTheDocument();
    });

    it('renders Close button', () => {
      render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument();
    });

    it('calls onTrainAgain when Train Again button clicked', () => {
      render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      const trainAgainButton = screen.getByRole('button', { name: /Train Again/i });
      trainAgainButton.click();
      expect(mockOnTrainAgain).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Close button clicked', () => {
      render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      const closeButton = screen.getByRole('button', { name: /Close/i });
      closeButton.click();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Styling', () => {
    it('applies correct CSS classes to container', () => {
      const { container } = render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      const resultsCard = container.firstChild as HTMLElement;
      expect(resultsCard).toHaveClass('rounded-md');
      expect(resultsCard).toHaveClass('border');
    });

    it('displays score with large font', () => {
      render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      const scoreElement = screen.getByText('85');
      expect(scoreElement).toHaveClass('text-2xl', { exact: false });
    });
  });

  describe('Date Formatting', () => {
    it('formats next eligible date correctly', () => {
      render(
        <TrainingResultsDisplay
          result={mockSuccessResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      // Should display formatted date (not raw ISO string)
      expect(screen.queryByText('2025-12-10T10:00:00Z')).not.toBeInTheDocument();
      // Should have "Next Training:" label
      expect(screen.getByText(/Next Training:/i)).toBeInTheDocument();
    });
  });

  describe('Missing Data Handling', () => {
    it('handles missing message gracefully', () => {
      const noMessageResult = { ...mockSuccessResult, message: undefined };
      render(
        <TrainingResultsDisplay
          result={noMessageResult}
          previousScore={75}
          onClose={mockOnClose}
          onTrainAgain={mockOnTrainAgain}
        />
      );
      // Should not crash, should still display core information
      expect(screen.getByText(/85/)).toBeInTheDocument();
    });
  });
});
