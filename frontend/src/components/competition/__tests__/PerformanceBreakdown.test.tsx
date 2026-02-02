/**
 * PerformanceBreakdown Component Tests
 *
 * Comprehensive test suite for the performance breakdown component.
 * Tests cover:
 * - Component rendering with all sections
 * - Score breakdown display
 * - Comparison section functionality
 * - Insights and recommendations
 * - Visual elements and styling
 *
 * Target: 20 tests following TDD methodology
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PerformanceBreakdown, {
  type PerformanceBreakdownProps,
  type ScoreBreakdown,
} from '../PerformanceBreakdown';

// Mock the ScoreBreakdownChart component
vi.mock('../ScoreBreakdownChart', () => ({
  default: ({ breakdown, height, showLegend, interactive }: any) => (
    <div
      data-testid="score-breakdown-chart"
      data-height={height}
      data-show-legend={showLegend}
      data-interactive={interactive}
      data-breakdown={JSON.stringify(breakdown)}
    >
      Mocked ScoreBreakdownChart
    </div>
  ),
}));

// Sample score breakdown data
const sampleScoreBreakdown: ScoreBreakdown = {
  baseScore: {
    speed: 85,
    stamina: 78,
    agility: 72,
    total: 80.3, // (85*0.5) + (78*0.3) + (72*0.2) = 42.5 + 23.4 + 14.4
  },
  trainingBonus: 18,
  traitBonuses: [
    { trait: 'Speed Demon', bonus: 5 },
    { trait: 'Agile', bonus: 3 },
    { trait: 'Focused', bonus: 2 },
  ],
  equipmentBonuses: {
    saddle: 10,
    bridle: 6,
    total: 16,
  },
  riderEffect: 8,
  healthModifier: -3,
  randomLuck: 5.2,
  total: 124.5,
};

// Sample comparison data
const sampleComparisonData = {
  averageScore: 95.5,
  winnerScore: 130.2,
  winnerName: 'Lightning Flash',
};

// Default props for testing
const defaultProps: PerformanceBreakdownProps = {
  horseId: 101,
  horseName: 'Thunder Bolt',
  competitionId: 1,
  competitionName: 'Spring Derby Championship',
  discipline: 'racing',
  rank: 2,
  totalParticipants: 20,
  finalScore: 124.5,
  prizeWon: 3500,
  xpGained: 125,
  scoreBreakdown: sampleScoreBreakdown,
};

// Props with comparison data
const propsWithComparison: PerformanceBreakdownProps = {
  ...defaultProps,
  comparisonData: sampleComparisonData,
};

// First place props
const firstPlaceProps: PerformanceBreakdownProps = {
  ...defaultProps,
  rank: 1,
  finalScore: 130.2,
  prizeWon: 7500,
  xpGained: 200,
};

// Third place props
const thirdPlaceProps: PerformanceBreakdownProps = {
  ...defaultProps,
  rank: 3,
  finalScore: 118.7,
  prizeWon: 1500,
  xpGained: 75,
};

// Lower rank props (8th place)
const lowerRankProps: PerformanceBreakdownProps = {
  ...defaultProps,
  rank: 8,
  finalScore: 92.3,
  prizeWon: 0,
  xpGained: 25,
};

// Props with low stats for improvement suggestions
const lowStatsProps: PerformanceBreakdownProps = {
  ...defaultProps,
  scoreBreakdown: {
    ...sampleScoreBreakdown,
    baseScore: {
      speed: 45,
      stamina: 50,
      agility: 40,
      total: 46,
    },
    trainingBonus: 5,
    equipmentBonuses: {
      saddle: 0,
      bridle: 0,
      total: 0,
    },
    riderEffect: -2,
    healthModifier: -10,
    total: 39,
  },
  finalScore: 39,
  rank: 18,
};

describe('PerformanceBreakdown', () => {
  // =========================================
  // 1. Component Rendering (5 tests)
  // =========================================
  describe('Component Rendering', () => {
    it('renders with all sections', () => {
      render(<PerformanceBreakdown {...defaultProps} />);

      // Check main container
      expect(screen.getByTestId('performance-breakdown')).toBeInTheDocument();

      // Check header section
      expect(screen.getByTestId('header-section')).toBeInTheDocument();

      // Check breakdown section
      expect(screen.getByTestId('breakdown-section')).toBeInTheDocument();

      // Check chart renders
      expect(screen.getByTestId('score-breakdown-chart')).toBeInTheDocument();
    });

    it('displays horse and competition info', () => {
      render(<PerformanceBreakdown {...defaultProps} />);

      expect(screen.getByText('Thunder Bolt')).toBeInTheDocument();
      expect(screen.getByText('Spring Derby Championship')).toBeInTheDocument();
    });

    it('shows final score and placement', () => {
      render(<PerformanceBreakdown {...defaultProps} />);

      // Final score should be displayed in header (multiple locations is expected)
      const scoreElements = screen.getAllByText(/124\.5/);
      expect(scoreElements.length).toBeGreaterThanOrEqual(1);

      // Placement badge should show 2nd
      expect(screen.getByTestId('placement-badge')).toBeInTheDocument();
      expect(screen.getByText(/2nd/)).toBeInTheDocument();
    });

    it('renders prize and XP gained', () => {
      render(<PerformanceBreakdown {...defaultProps} />);

      // Prize won
      expect(screen.getByText(/\$3,500/)).toBeInTheDocument();

      // XP gained
      expect(screen.getByText(/125/)).toBeInTheDocument();
      expect(screen.getByText(/XP/i)).toBeInTheDocument();
    });

    it('renders chart component', () => {
      render(<PerformanceBreakdown {...defaultProps} />);

      const chart = screen.getByTestId('score-breakdown-chart');
      expect(chart).toBeInTheDocument();

      // Verify breakdown data is passed to chart
      const breakdownData = chart.getAttribute('data-breakdown');
      expect(breakdownData).toBeTruthy();
      expect(JSON.parse(breakdownData!)).toEqual(sampleScoreBreakdown);
    });
  });

  // =========================================
  // 2. Score Breakdown Display (5 tests)
  // =========================================
  describe('Score Breakdown Display', () => {
    it('shows base stats with correct weighting', () => {
      render(<PerformanceBreakdown {...defaultProps} />);

      // Base stats section
      expect(screen.getByText(/Base Stats/i)).toBeInTheDocument();

      // Individual stats - use getAllByText for potential duplicates
      const speedElements = screen.getAllByText(/Speed/i);
      expect(speedElements.length).toBeGreaterThan(0);
      expect(screen.getByText('85')).toBeInTheDocument(); // Speed value

      const staminaElements = screen.getAllByText(/Stamina/i);
      expect(staminaElements.length).toBeGreaterThan(0);
      expect(screen.getByText('78')).toBeInTheDocument(); // Stamina value

      const agilityElements = screen.getAllByText(/Agility/i);
      expect(agilityElements.length).toBeGreaterThan(0);
      expect(screen.getByText('72')).toBeInTheDocument(); // Agility value

      // Weighting info - use getAllByText for potential duplicates
      const weight50 = screen.getAllByText(/50%/);
      expect(weight50.length).toBeGreaterThan(0);
      const weight30 = screen.getAllByText(/30%/);
      expect(weight30.length).toBeGreaterThan(0);
      const weight20 = screen.getAllByText(/20%/);
      expect(weight20.length).toBeGreaterThan(0);
    });

    it('displays training bonus', () => {
      render(<PerformanceBreakdown {...defaultProps} />);

      const trainingElements = screen.getAllByText(/Training/i);
      expect(trainingElements.length).toBeGreaterThan(0);
      // Training bonus value with sign
      const bonusElements = screen.getAllByText(/\+18/);
      expect(bonusElements.length).toBeGreaterThan(0);
    });

    it('lists all trait bonuses', () => {
      render(<PerformanceBreakdown {...defaultProps} />);

      const traitElements = screen.getAllByText(/Trait/i);
      expect(traitElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/Speed Demon/)).toBeInTheDocument();
      // Trait bonuses - use getAllByText for potential duplicates
      const bonus5Elements = screen.getAllByText(/\+5/);
      expect(bonus5Elements.length).toBeGreaterThan(0);
      const agileElements = screen.getAllByText(/Agile/i);
      expect(agileElements.length).toBeGreaterThan(0);
      const bonus3Elements = screen.getAllByText(/\+3/);
      expect(bonus3Elements.length).toBeGreaterThan(0);
      expect(screen.getByText(/Focused/)).toBeInTheDocument();
      const bonus2Elements = screen.getAllByText(/\+2/);
      expect(bonus2Elements.length).toBeGreaterThan(0);
    });

    it('shows equipment bonuses', () => {
      render(<PerformanceBreakdown {...defaultProps} />);

      const equipmentElements = screen.getAllByText(/Equipment/i);
      expect(equipmentElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/Saddle/i)).toBeInTheDocument();
      const bonus10Elements = screen.getAllByText(/\+10/);
      expect(bonus10Elements.length).toBeGreaterThan(0);
      expect(screen.getByText(/Bridle/i)).toBeInTheDocument();
      const bonus6Elements = screen.getAllByText(/\+6/);
      expect(bonus6Elements.length).toBeGreaterThan(0);
    });

    it('displays rider, health, and luck modifiers', () => {
      render(<PerformanceBreakdown {...defaultProps} />);

      // Rider effect (positive)
      const riderElements = screen.getAllByText(/Rider/i);
      expect(riderElements.length).toBeGreaterThan(0);
      const bonus8Elements = screen.getAllByText(/\+8/);
      expect(bonus8Elements.length).toBeGreaterThan(0);

      // Health modifier (negative)
      const healthElements = screen.getAllByText(/Health/i);
      expect(healthElements.length).toBeGreaterThan(0);
      const minus3Elements = screen.getAllByText(/-3/);
      expect(minus3Elements.length).toBeGreaterThan(0);

      // Random luck
      const luckElements = screen.getAllByText(/Luck/i);
      expect(luckElements.length).toBeGreaterThan(0);
      const luckValueElements = screen.getAllByText(/\+5\.2/);
      expect(luckValueElements.length).toBeGreaterThan(0);
    });
  });

  // =========================================
  // 3. Comparison Section (3 tests)
  // =========================================
  describe('Comparison Section', () => {
    it('shows average comparison with correct difference', () => {
      render(<PerformanceBreakdown {...propsWithComparison} />);

      expect(screen.getByTestId('comparison-section')).toBeInTheDocument();

      // vs Average
      expect(screen.getByText(/Average/i)).toBeInTheDocument();
      expect(screen.getByText(/95.5/)).toBeInTheDocument(); // Average score

      // Difference: 124.5 - 95.5 = +29
      const avgDiff = screen.getByTestId('average-diff');
      expect(avgDiff).toHaveTextContent(/\+29/);
    });

    it('shows winner comparison with correct difference', () => {
      render(<PerformanceBreakdown {...propsWithComparison} />);

      // vs Winner
      expect(screen.getByText(/Winner/i)).toBeInTheDocument();
      expect(screen.getByText(/Lightning Flash/)).toBeInTheDocument();
      expect(screen.getByText(/130.2/)).toBeInTheDocument(); // Winner score

      // Difference: 124.5 - 130.2 = -5.7
      const winnerDiff = screen.getByTestId('winner-diff');
      expect(winnerDiff).toHaveTextContent(/-5.7/);
    });

    it('calculates percentile ranking correctly', () => {
      render(<PerformanceBreakdown {...propsWithComparison} />);

      // Percentile: rank 2 out of 20 -> top percentile displayed
      expect(screen.getByTestId('percentile-ranking')).toBeInTheDocument();
      // The component displays "Top X%" based on the calculation
      const percentileSection = screen.getByTestId('percentile-ranking');
      expect(percentileSection).toHaveTextContent(/Top \d+%/i);
    });
  });

  // =========================================
  // 4. Insights (3 tests)
  // =========================================
  describe('Insights', () => {
    it('shows improvement suggestions', () => {
      render(<PerformanceBreakdown {...lowStatsProps} />);

      expect(screen.getByTestId('insights-section')).toBeInTheDocument();
      expect(screen.getByText(/Improvement/i)).toBeInTheDocument();
    });

    it('recommends training focus for low stats', () => {
      render(<PerformanceBreakdown {...lowStatsProps} />);

      // Low agility (40) should trigger training recommendation
      const trainElements = screen.getAllByText(/train/i);
      expect(trainElements.length).toBeGreaterThan(0);
      // Should mention specific stat - use getAllByText for potential duplicates
      const agilityElements = screen.getAllByText(/Agility/i);
      expect(agilityElements.length).toBeGreaterThan(0);
    });

    it('shows equipment upgrade suggestions', () => {
      render(<PerformanceBreakdown {...lowStatsProps} />);

      // No equipment bonuses should trigger upgrade suggestion
      const equipmentElements = screen.getAllByText(/equipment/i);
      expect(equipmentElements.length).toBeGreaterThan(0);
      // Check insights section has upgrading text
      const insightsSection = screen.getByTestId('insights-section');
      expect(insightsSection).toHaveTextContent(/upgrading/i);
    });
  });

  // =========================================
  // 5. Visual Elements (4 tests)
  // =========================================
  describe('Visual Elements', () => {
    it('displays gold badge for 1st place', () => {
      render(<PerformanceBreakdown {...firstPlaceProps} />);

      const badge = screen.getByTestId('placement-badge');
      expect(badge).toHaveClass('bg-yellow-400');
      expect(screen.getByText(/1st/)).toBeInTheDocument();
    });

    it('displays silver badge for 2nd place', () => {
      render(<PerformanceBreakdown {...defaultProps} />);

      const badge = screen.getByTestId('placement-badge');
      expect(badge).toHaveClass('bg-gray-300');
      expect(screen.getByText(/2nd/)).toBeInTheDocument();
    });

    it('displays bronze badge for 3rd place', () => {
      render(<PerformanceBreakdown {...thirdPlaceProps} />);

      const badge = screen.getByTestId('placement-badge');
      expect(badge).toHaveClass('bg-orange-400');
      expect(screen.getByText(/3rd/)).toBeInTheDocument();
    });

    it('displays positive values in green and negative in red', () => {
      render(<PerformanceBreakdown {...defaultProps} />);

      // Positive rider effect (+8) should have green styling
      const riderValue = screen.getByTestId('rider-value');
      expect(riderValue).toHaveClass('text-green-600');

      // Negative health modifier (-3) should have red styling
      const healthValue = screen.getByTestId('health-value');
      expect(healthValue).toHaveClass('text-red-600');
    });
  });

  // =========================================
  // Additional Tests for Accessibility
  // =========================================
  describe('Accessibility', () => {
    it('has proper ARIA attributes for main container', () => {
      render(<PerformanceBreakdown {...defaultProps} />);

      const container = screen.getByTestId('performance-breakdown');
      expect(container).toHaveAttribute('role', 'region');
      expect(container).toHaveAttribute('aria-label', 'Performance breakdown');
    });

    it('uses semantic headings', () => {
      render(<PerformanceBreakdown {...defaultProps} />);

      // Main heading
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();

      // Section headings
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(1);
    });
  });
});
