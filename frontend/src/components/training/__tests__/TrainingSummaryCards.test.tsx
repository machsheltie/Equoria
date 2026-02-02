import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrainingSummaryCards, { TrainingSummary } from '../TrainingSummaryCards';

describe('TrainingSummaryCards', () => {
  const mockSummary: TrainingSummary = {
    readyCount: 8,
    cooldownCount: 5,
    ineligibleCount: 3,
    totalHorses: 16,
  };

  describe('Rendering', () => {
    it('renders all three summary cards', () => {
      render(<TrainingSummaryCards summary={mockSummary} />);

      expect(screen.getByText('Ready to Train')).toBeInTheDocument();
      expect(screen.getByText('In Cooldown')).toBeInTheDocument();
      expect(screen.getByText('Ineligible')).toBeInTheDocument();
    });

    it('displays correct counts for each status', () => {
      render(<TrainingSummaryCards summary={mockSummary} />);

      expect(screen.getByText('8')).toBeInTheDocument(); // ready
      expect(screen.getByText('5')).toBeInTheDocument(); // cooldown
      expect(screen.getByText('3')).toBeInTheDocument(); // ineligible
    });

    it('calculates and displays percentages correctly', () => {
      render(<TrainingSummaryCards summary={mockSummary} />);

      expect(screen.getByText('50% of total')).toBeInTheDocument(); // 8/16 = 50%
      expect(screen.getByText('31% of total')).toBeInTheDocument(); // 5/16 = 31%
      expect(screen.getByText('19% of total')).toBeInTheDocument(); // 3/16 = 19%
    });
  });

  describe('Edge Cases', () => {
    it('handles zero horses gracefully', () => {
      const emptySummary: TrainingSummary = {
        readyCount: 0,
        cooldownCount: 0,
        ineligibleCount: 0,
        totalHorses: 0,
      };

      render(<TrainingSummaryCards summary={emptySummary} />);

      const percentages = screen.getAllByText('0% of total');
      expect(percentages).toHaveLength(3); // All three cards show 0%
    });

    it('handles all horses ready', () => {
      const allReadySummary: TrainingSummary = {
        readyCount: 10,
        cooldownCount: 0,
        ineligibleCount: 0,
        totalHorses: 10,
      };

      render(<TrainingSummaryCards summary={allReadySummary} />);

      expect(screen.getByText('100% of total')).toBeInTheDocument();
      expect(screen.getAllByText('0% of total')).toHaveLength(2);
    });

    it('rounds percentages correctly', () => {
      const oddSummary: TrainingSummary = {
        readyCount: 1,
        cooldownCount: 1,
        ineligibleCount: 1,
        totalHorses: 3,
      };

      render(<TrainingSummaryCards summary={oddSummary} />);

      expect(screen.getAllByText('33% of total')).toHaveLength(3);
    });
  });

  describe('Visual Indicators', () => {
    it('applies green styling to ready card', () => {
      const { container } = render(<TrainingSummaryCards summary={mockSummary} />);

      const readyCard = container.querySelector('.border-green-500');
      expect(readyCard).toBeInTheDocument();
    });

    it('applies yellow styling to cooldown card', () => {
      const { container } = render(<TrainingSummaryCards summary={mockSummary} />);

      const cooldownCard = container.querySelector('.border-yellow-500');
      expect(cooldownCard).toBeInTheDocument();
    });

    it('applies red styling to ineligible card', () => {
      const { container } = render(<TrainingSummaryCards summary={mockSummary} />);

      const ineligibleCard = container.querySelector('.border-red-500');
      expect(ineligibleCard).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('has responsive grid classes', () => {
      const { container } = render(<TrainingSummaryCards summary={mockSummary} />);

      const grid = container.querySelector('.grid-cols-1');
      expect(grid).toHaveClass('md:grid-cols-3');
    });
  });

  describe('Accessibility', () => {
    it('icons have aria-hidden attribute', () => {
      const { container } = render(<TrainingSummaryCards summary={mockSummary} />);

      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Custom Styling', () => {
    it('accepts and applies custom className', () => {
      const { container } = render(
        <TrainingSummaryCards summary={mockSummary} className="custom-test-class" />
      );

      expect(container.firstChild).toHaveClass('custom-test-class');
    });
  });
});
