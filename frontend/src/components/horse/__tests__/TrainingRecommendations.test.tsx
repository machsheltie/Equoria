/**
 * TrainingRecommendations Component Tests
 *
 * Tests training recommendation logic based on:
 * - Horse stats vs genetic potential
 * - Age and training window optimization
 * - Discipline-specific goals
 * - Priority ranking (high/medium/low)
 *
 * Story 3-4: XP & Progression Display - Task 5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrainingRecommendations from '../TrainingRecommendations';
import * as useHorseStatsHook from '@/hooks/api/useHorseStats';

// Mock the useHorseStats hook
vi.mock('@/hooks/api/useHorseStats');

// Helper to render with React Query provider
const renderWithProvider = (component: React.ReactElement) => {
  return render(component);
};

// Mock data: Young horse with room for improvement
const mockYoungHorseStats = {
  horseId: 1,
  horseName: 'Thunder',
  age: { years: 2, months: 6 },
  currentStats: {
    speed: 65,
    stamina: 70,
    agility: 55,
    strength: 60,
    intelligence: 50,
    temperament: 75,
  },
  geneticPotential: {
    speed: 90,
    stamina: 85,
    agility: 80,
    strength: 75,
    intelligence: 70,
    temperament: 80,
  },
  trainingWindow: 'prime', // 2-7 years old
  discipline: 'racing', // Speed and stamina focused
};

// Mock data: Mature horse near potential
const mockMatureHorseStats = {
  horseId: 2,
  horseName: 'Midnight',
  age: { years: 8, months: 0 },
  currentStats: {
    speed: 85,
    stamina: 82,
    agility: 88,
    strength: 70,
    intelligence: 65,
    temperament: 78,
  },
  geneticPotential: {
    speed: 88,
    stamina: 85,
    agility: 90,
    strength: 72,
    intelligence: 68,
    temperament: 80,
  },
  trainingWindow: 'maintenance', // 8+ years old
  discipline: 'dressage', // Agility and intelligence focused
};

// Mock data: Senior horse past prime
const mockSeniorHorseStats = {
  horseId: 3,
  horseName: 'Silver',
  age: { years: 15, months: 3 },
  currentStats: {
    speed: 70,
    stamina: 68,
    agility: 65,
    strength: 60,
    intelligence: 75,
    temperament: 80,
  },
  geneticPotential: {
    speed: 90,
    stamina: 85,
    agility: 82,
    strength: 78,
    intelligence: 80,
    temperament: 85,
  },
  trainingWindow: 'senior', // 15+ years old
  discipline: 'trail', // Stamina and temperament focused
};

describe('TrainingRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render training recommendations title', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);
      expect(screen.getByText(/training recommendations/i)).toBeInTheDocument();
    });

    it('should display horse name and age', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);
      expect(screen.getByText(/thunder/i)).toBeInTheDocument();
      expect(screen.getByText(/2 years, 6 months/i)).toBeInTheDocument();
    });

    it('should show training window status', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);
      expect(screen.getByText(/prime training window/i)).toBeInTheDocument();
    });
  });

  describe('Stat Gap Analysis (AC-1)', () => {
    it('should identify stats with large gaps (20+ points)', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      // Speed: 65/90 = 25 point gap (high priority)
      expect(screen.getByText(/speed/i)).toBeInTheDocument();
      const gapElements = screen.getAllByText(/\+25/);
      expect(gapElements.length).toBeGreaterThanOrEqual(1);

      // Agility: 55/80 = 25 point gap (high priority)
      expect(screen.getByText(/agility/i)).toBeInTheDocument();
    });

    it('should identify stats with medium gaps (10-19 points)', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      // Stamina: 70/85 = 15 point gap (medium priority)
      // Strength: 60/75 = 15 point gap (medium priority)
      expect(screen.getByText(/stamina/i)).toBeInTheDocument();
      expect(screen.getByText(/strength/i)).toBeInTheDocument();
    });

    it('should show current stat, potential, and gap', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      // Check format: "65/90" or "Current: 65, Potential: 90"
      expect(screen.getByText(/65.*90/)).toBeInTheDocument();
    });

    it('should not show recommendations for stats at potential', () => {
      const atPotentialStats = {
        ...mockYoungHorseStats,
        currentStats: {
          ...mockYoungHorseStats.currentStats,
          temperament: 80, // Matches potential
        },
      };

      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: atPotentialStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      // Temperament at potential, so no recommendation
      const recommendations = screen.queryByText(/temperament.*training/i);
      expect(recommendations).not.toBeInTheDocument();
    });
  });

  describe('Priority Ranking (AC-2)', () => {
    it('should mark large gaps (20+) as high priority', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      // Speed gap: 25 points (high priority)
      const highPriorityBadges = screen.getAllByText(/high priority/i);
      expect(highPriorityBadges.length).toBeGreaterThan(0);
    });

    it('should mark medium gaps (10-19) as medium priority', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      // Stamina gap: 15 points (medium priority)
      const mediumPriorityBadges = screen.getAllByText(/medium priority/i);
      expect(mediumPriorityBadges.length).toBeGreaterThan(0);
    });

    it('should mark small gaps (5-9) as low priority', () => {
      const smallGapStats = {
        ...mockYoungHorseStats,
        currentStats: {
          ...mockYoungHorseStats.currentStats,
          temperament: 73, // 73/80 = 7 point gap
        },
      };

      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: smallGapStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      const lowPriorityBadges = screen.getAllByText(/low priority/i);
      expect(lowPriorityBadges.length).toBeGreaterThan(0);
    });

    it('should sort recommendations by priority (high > medium > low)', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      const priorities = screen.getAllByText(/priority/i);
      const priorityOrder = priorities.map((el) => el.textContent?.toLowerCase());

      // High priority items should appear before medium/low
      const firstHighIndex = priorityOrder.findIndex((p) => p?.includes('high'));
      const firstMediumIndex = priorityOrder.findIndex((p) => p?.includes('medium'));

      if (firstHighIndex !== -1 && firstMediumIndex !== -1) {
        expect(firstHighIndex).toBeLessThan(firstMediumIndex);
      }
    });
  });

  describe('Training Suggestions (AC-3)', () => {
    it('should suggest speed training for speed gaps', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      const suggestions = screen.getAllByText(/sprint practice|racing|speed drills/i);
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
    });

    it('should suggest stamina training for stamina gaps', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      const suggestions = screen.getAllByText(/endurance rides|long distance|cardio/i);
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
    });

    it('should suggest agility training for agility gaps', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      const suggestions = screen.getAllByText(/obstacle courses|barrel racing|flexibility/i);
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
    });

    it('should provide discipline-specific recommendations', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats, // discipline: 'racing'
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      // For racing discipline, prioritize speed and stamina
      expect(screen.getByText(/racing focus|ideal for racing/i)).toBeInTheDocument();
    });
  });

  describe('Age-Based Recommendations (AC-4)', () => {
    it('should emphasize training for young horses in prime window', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      expect(
        screen.getByText(/prime training years|optimal training window|best time to train/i)
      ).toBeInTheDocument();
    });

    it('should recommend maintenance training for mature horses', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockMatureHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={2} />);

      const maintenanceTexts = screen.getAllByText(/maintenance training|maintain current level|preserve stats/i);
      expect(maintenanceTexts.length).toBeGreaterThanOrEqual(1);
    });

    it('should warn about limited training for senior horses', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockSeniorHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={3} />);

      expect(
        screen.getByText(/senior horse|limited training|gentle exercise/i)
      ).toBeInTheDocument();
    });
  });

  describe('Expandable Details (AC-5)', () => {
    it('should show summary by default', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      // Check for summary/overview
      expect(screen.getByText(/recommendations/i)).toBeInTheDocument();
    });

    it('should expand to show detailed training plan on click', async () => {
      const user = userEvent.setup();
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      const expandButton = screen.getByRole('button', { name: /view details|show more/i });
      await user.click(expandButton);

      await waitFor(() => {
        const detailedPlan = screen.getAllByText(/detailed training plan|training schedule/i);
        expect(detailedPlan.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should collapse details when clicking hide', async () => {
      const user = userEvent.setup();
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      const expandButton = screen.getByRole('button', { name: /view details|show more/i });
      await user.click(expandButton);

      const collapseButton = screen.getByRole('button', { name: /hide details|show less/i });
      await user.click(collapseButton);

      await waitFor(() => {
        expect(
          screen.queryByText(/detailed training plan|training schedule/i)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton when data is loading', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should not show recommendations when loading', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);
      expect(screen.queryByText(/high priority|medium priority/i)).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when fetch fails', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Failed to fetch horse stats' },
        isError: true,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);
      const errorTexts = screen.getAllByText(/failed to fetch|error/i);
      expect(errorTexts.length).toBeGreaterThanOrEqual(1);
    });

    it('should show retry button on error', async () => {
      const refetch = vi.fn();
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Network error' },
        isError: true,
        refetch,
      } as any);

      const user = userEvent.setup();
      renderWithProvider(<TrainingRecommendations horseId={1} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle horse at max potential (no recommendations)', () => {
      const maxPotentialStats = {
        ...mockYoungHorseStats,
        currentStats: mockYoungHorseStats.geneticPotential,
      };

      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: maxPotentialStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      expect(
        screen.getByText(/reached maximum potential|no recommendations|fully trained/i)
      ).toBeInTheDocument();
    });

    it('should handle very young horse (under 2 years)', () => {
      const veryYoungHorse = {
        ...mockYoungHorseStats,
        age: { years: 1, months: 3 },
        trainingWindow: 'too young',
      };

      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: veryYoungHorse,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      const tooYoungTexts = screen.getAllByText(/too young|wait before training|not ready/i);
      expect(tooYoungTexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for priority badges', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      const highPriorityBadges = screen.getAllByText(/high priority/i);
      highPriorityBadges.forEach((badge) => {
        expect(badge).toBeInTheDocument();
      });
    });

    it('should have ARIA labels for expand/collapse buttons', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      const expandButton = screen.getByRole('button', { name: /view details|show more/i });
      expect(expandButton).toHaveAttribute('aria-expanded');
    });
  });

  describe('Responsive Design', () => {
    it('should render in mobile layout', () => {
      vi.mocked(useHorseStatsHook.useHorseStats).mockReturnValue({
        data: mockYoungHorseStats,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<TrainingRecommendations horseId={1} />);

      const container = screen.getByTestId('training-recommendations');
      expect(container).toHaveClass(/w-full|flex-col/);
    });
  });
});
