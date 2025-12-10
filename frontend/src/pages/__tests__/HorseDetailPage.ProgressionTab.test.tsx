/**
 * Horse Detail Page - Progression Tab Tests
 *
 * Story 3-4: XP & Progression Display - Task 7
 *
 * Tests for the Progression tab integration into HorseDetailPage:
 * - Tab rendering and navigation
 * - Component integration (XPProgressBar, StatProgressionChart, etc.)
 * - Data loading and error states
 * - Responsive layout
 * - Loading skeleton states
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import HorseDetailPage from '../HorseDetailPage';
import * as apiClient from '@/lib/api-client';

// Mock Chart.js
vi.mock('react-chartjs-2', () => ({
  Line: vi.fn(() => <div data-testid="mock-chart">Chart</div>),
  Bar: vi.fn(() => <div data-testid="mock-chart">Chart</div>),
}));

// Mock HTMLCanvasElement for Chart.js fallback
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
})) as any;

// Mock API client
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual('@/lib/api-client');
  return {
    ...actual,
    horsesApi: {
      // Progression-specific endpoints
      getProgression: vi.fn(),
      getStatHistory: vi.fn(),
      getRecentGains: vi.fn(),
      // Component hook endpoints (correct method names)
      getXP: vi.fn(),
      getXPHistory: vi.fn(),
      getAge: vi.fn(),
      getStats: vi.fn(),
    },
  };
});

// Mock React Router params
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '1' }),
    useNavigate: () => vi.fn(),
  };
});

const mockHorse = {
  id: 1,
  name: 'Thunder',
  breed: 'Thoroughbred',
  age: 5,
  gender: 'Stallion',
  dateOfBirth: '2020-01-15',
  healthStatus: 'Excellent',
  stats: {
    speed: 85,
    stamina: 78,
    agility: 82,
    strength: 75,
    intelligence: 70,
    health: 95,
  },
  disciplineScores: {
    Dressage: 78,
    Racing: 85,
  },
};

const mockProgression = {
  horseId: 1,
  horseName: 'Thunder',
  currentLevel: 5,
  currentXP: 2450,
  xpToNextLevel: 5000,
  totalXP: 12450,
  progressPercentage: 49,
  recentLevelUps: [
    { level: 5, timestamp: '2025-12-01T10:00:00Z', xpGained: 1500 },
  ],
};

const mockStatHistory = {
  horseId: 1,
  horseName: 'Thunder',
  timeRange: '30d',
  statData: [
    {
      timestamp: '2025-12-01T00:00:00Z',
      speed: 85,
      stamina: 78,
      agility: 82,
      strength: 75,
      intelligence: 70,
      temperament: 80,
    },
  ],
};

const mockRecentGains = {
  horseId: 1,
  horseName: 'Thunder',
  days: 30,
  gains: [
    {
      stat: 'speed',
      change: 5,
      percentage: 6.25,
      timestamp: '2025-12-01T10:00:00Z',
    },
  ],
};

const mockXP = {
  horseId: 1,
  horseName: 'Thunder',
  currentXP: 2450,
  currentLevel: 5,
  xpToNextLevel: 5000,
  xpToNextStatPoint: 1200,
};

const mockXPHistory = {
  events: [
    {
      id: 1,
      amount: 150,
      reason: 'Training session completed',
      timestamp: '2025-12-01T10:00:00Z',
    },
    {
      id: 2,
      amount: 200,
      reason: 'Competition placement',
      timestamp: '2025-12-02T14:30:00Z',
    },
  ],
  count: 2,
  pagination: {
    limit: 10,
    offset: 0,
    total: 2,
  },
};

const mockHorseAge = {
  horseId: 1,
  horseName: 'Thunder',
  currentAge: {
    years: 5,
    months: 0,
  },
  ageInDays: 1825,
  nextMilestone: {
    name: 'Prime Training Window',
    ageYears: 6,
    daysRemaining: 365,
    monthsRemaining: 12,
    expectedStatGains: {
      speed: 3,
      stamina: 2,
      agility: 3,
      strength: 2,
      intelligence: 1,
      temperament: 1,
    },
  },
  trainingWindow: {
    isPrimeWindow: true,
    windowName: 'Prime Training',
    endsInDays: 730,
  },
};

const mockHorseStats = {
  horseId: 1,
  horseName: 'Thunder',
  age: {
    years: 5,
    months: 0,
  },
  currentStats: {
    speed: 85,
    stamina: 78,
    agility: 82,
    strength: 75,
    intelligence: 70,
    temperament: 80,
  },
  geneticPotential: {
    speed: 95,
    stamina: 88,
    agility: 90,
    strength: 85,
    intelligence: 80,
    temperament: 85,
  },
  trainingWindow: 'prime' as const,
  discipline: 'Racing',
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('HorseDetailPage - Progression Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ data: mockHorse }),
      } as Response)
    );

    // Configure API mocks with successful responses
    vi.mocked(apiClient.horsesApi.getProgression).mockResolvedValue(mockProgression);
    vi.mocked(apiClient.horsesApi.getStatHistory).mockResolvedValue(mockStatHistory);
    vi.mocked(apiClient.horsesApi.getRecentGains).mockResolvedValue(mockRecentGains);
    vi.mocked(apiClient.horsesApi.getXP).mockResolvedValue(mockXP);
    vi.mocked(apiClient.horsesApi.getXPHistory).mockResolvedValue(mockXPHistory);
    vi.mocked(apiClient.horsesApi.getAge).mockResolvedValue(mockHorseAge);
    vi.mocked(apiClient.horsesApi.getStats).mockResolvedValue(mockHorseStats);
  });

  describe('Tab Navigation', () => {
    it('should render Progression tab button', async () => {
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /progression/i })).toBeInTheDocument();
    });

    it('should switch to Progression tab when clicked', async () => {
      const user = userEvent.setup();
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const progressionTab = screen.getByRole('button', { name: /progression/i });
      await user.click(progressionTab);

      // Progression tab should be active (will have specific styling)
      expect(progressionTab).toHaveClass(/border-burnished-gold/);
    });

    it('should display Progression tab with correct icon', async () => {
      const { container } = render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const progressionTab = screen.getByRole('button', { name: /progression/i });
      // Verify the SVG icon is present (TrendingUp icon)
      const svg = progressionTab.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('lucide-trending-up');
    });
  });

  describe('Component Integration', () => {
    beforeEach(() => {
      vi.mocked(apiClient.horsesApi.getProgression).mockResolvedValue(mockProgression);
      vi.mocked(apiClient.horsesApi.getStatHistory).mockResolvedValue(mockStatHistory);
      vi.mocked(apiClient.horsesApi.getRecentGains).mockResolvedValue(mockRecentGains);
      vi.mocked(apiClient.horsesApi.getAge).mockResolvedValue(mockHorseAge);
      vi.mocked(apiClient.horsesApi.getStats).mockResolvedValue(mockHorseStats);
    });

    it('should render all progression components when tab is active', async () => {
      const user = userEvent.setup();
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Click Progression tab
      await user.click(screen.getByRole('button', { name: /progression/i }));

      // Wait for all components to load
      await waitFor(() => {
        // XPProgressBar - check for level display
        expect(screen.getByText(/level 5/i)).toBeInTheDocument();

        // StatProgressionChart - check for chart heading
        expect(screen.getByText(/stat progression/i)).toBeInTheDocument();

        // RecentGains - check for gains heading
        expect(screen.getByText(/recent gains/i)).toBeInTheDocument();

        // AgeUpCounter - check for age display
        expect(screen.getByText(/next age-up/i)).toBeInTheDocument();

        // TrainingRecommendations - check for recommendations heading
        expect(screen.getByText(/training recommendations/i)).toBeInTheDocument();
      });
    });

    it('should fetch all required data when tab becomes active', async () => {
      const user = userEvent.setup();
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Click Progression tab
      await user.click(screen.getByRole('button', { name: /progression/i }));

      // Verify all API calls were made
      await waitFor(() => {
        expect(apiClient.horsesApi.getProgression).toHaveBeenCalledWith(1);
        expect(apiClient.horsesApi.getStatHistory).toHaveBeenCalledWith(1, '30d');
        expect(apiClient.horsesApi.getRecentGains).toHaveBeenCalledWith(1, 30);
        expect(apiClient.horsesApi.getAge).toHaveBeenCalledWith(1);
        expect(apiClient.horsesApi.getStats).toHaveBeenCalledWith(1);
      });
    });

    it('should render XPProgressBar with correct data', async () => {
      const user = userEvent.setup();
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /progression/i }));

      await waitFor(() => {
        expect(screen.getByText(/level 5/i)).toBeInTheDocument();
        expect(screen.getByText(/2,450.*5,000/)).toBeInTheDocument();
      });
    });

    it('should render StatProgressionChart with time range selector', async () => {
      const user = userEvent.setup();
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /progression/i }));

      await waitFor(() => {
        expect(screen.getByText(/stat progression/i)).toBeInTheDocument();
        // Check for time range buttons
        expect(screen.getByRole('button', { name: /7d/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /30d/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /90d/i })).toBeInTheDocument();
      });
    });

    it('should render RecentGains with stat changes', async () => {
      const user = userEvent.setup();
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /progression/i }));

      await waitFor(() => {
        expect(screen.getByText(/recent gains/i)).toBeInTheDocument();
        expect(screen.getByText(/speed/i)).toBeInTheDocument();
        expect(screen.getByText(/\+5/)).toBeInTheDocument();
      });
    });

    it('should render AgeUpCounter with countdown', async () => {
      const user = userEvent.setup();
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /progression/i }));

      await waitFor(() => {
        expect(screen.getByText(/next age-up/i)).toBeInTheDocument();
        expect(screen.getByText(/30 days/i)).toBeInTheDocument();
      });
    });

    it('should render TrainingRecommendations based on stats', async () => {
      const user = userEvent.setup();
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /progression/i }));

      await waitFor(() => {
        expect(screen.getByText(/training recommendations/i)).toBeInTheDocument();
        // Should show recommendations for stats below potential
        expect(screen.getByText(/stamina/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading skeleton while fetching progression data', async () => {
      const user = userEvent.setup();

      // Delay API responses
      vi.mocked(apiClient.horsesApi.getProgression).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockProgression), 100))
      );
      vi.mocked(apiClient.horsesApi.getStatHistory).mockResolvedValue(mockStatHistory);
      vi.mocked(apiClient.horsesApi.getRecentGains).mockResolvedValue(mockRecentGains);
      vi.mocked(apiClient.horsesApi.getAge).mockResolvedValue(mockHorseAge);
      vi.mocked(apiClient.horsesApi.getStats).mockResolvedValue(mockHorseStats);

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /progression/i }));

      // Should show loading state
      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText(/level 5/i)).toBeInTheDocument();
      }, { timeout: 200 });
    });

    it('should show loading state for each component independently', async () => {
      const user = userEvent.setup();

      // Delay one specific API response
      vi.mocked(apiClient.horsesApi.getProgression).mockResolvedValue(mockProgression);
      vi.mocked(apiClient.horsesApi.getStatHistory).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockStatHistory), 100))
      );
      vi.mocked(apiClient.horsesApi.getRecentGains).mockResolvedValue(mockRecentGains);
      vi.mocked(apiClient.horsesApi.getAge).mockResolvedValue(mockHorseAge);
      vi.mocked(apiClient.horsesApi.getStats).mockResolvedValue(mockHorseStats);

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /progression/i }));

      // XP Progress should load immediately
      await waitFor(() => {
        expect(screen.getByText(/level 5/i)).toBeInTheDocument();
      });

      // Stat chart should show loading
      expect(screen.getByText(/loading.*chart/i)).toBeInTheDocument();

      // Wait for stat chart to load
      await waitFor(() => {
        expect(screen.queryByText(/loading.*chart/i)).not.toBeInTheDocument();
      }, { timeout: 200 });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when progression data fails to load', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.horsesApi.getProgression).mockRejectedValue(
        new Error('Failed to fetch progression data')
      );
      vi.mocked(apiClient.horsesApi.getStatHistory).mockResolvedValue(mockStatHistory);
      vi.mocked(apiClient.horsesApi.getRecentGains).mockResolvedValue(mockRecentGains);
      vi.mocked(apiClient.horsesApi.getAge).mockResolvedValue(mockHorseAge);
      vi.mocked(apiClient.horsesApi.getStats).mockResolvedValue(mockHorseStats);

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /progression/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch progression data/i)).toBeInTheDocument();
      });
    });

    it('should display error for stat history failure', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.horsesApi.getProgression).mockResolvedValue(mockProgression);
      vi.mocked(apiClient.horsesApi.getStatHistory).mockRejectedValue(
        new Error('Failed to fetch stat history')
      );
      vi.mocked(apiClient.horsesApi.getRecentGains).mockResolvedValue(mockRecentGains);
      vi.mocked(apiClient.horsesApi.getAge).mockResolvedValue(mockHorseAge);
      vi.mocked(apiClient.horsesApi.getStats).mockResolvedValue(mockHorseStats);

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /progression/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch stat history/i)).toBeInTheDocument();
      });
    });

    it('should handle partial data failures gracefully', async () => {
      const user = userEvent.setup();
      // Some APIs succeed, one fails
      vi.mocked(apiClient.horsesApi.getProgression).mockResolvedValue(mockProgression);
      vi.mocked(apiClient.horsesApi.getStatHistory).mockResolvedValue(mockStatHistory);
      vi.mocked(apiClient.horsesApi.getRecentGains).mockRejectedValue(
        new Error('Failed to fetch recent gains')
      );
      vi.mocked(apiClient.horsesApi.getAge).mockResolvedValue(mockHorseAge);
      vi.mocked(apiClient.horsesApi.getStats).mockResolvedValue(mockHorseStats);

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /progression/i }));

      await waitFor(() => {
        // Should show successful components
        expect(screen.getByText(/level 5/i)).toBeInTheDocument();
        expect(screen.getByText(/stat progression/i)).toBeInTheDocument();

        // Should show error for failed component
        expect(screen.getByText(/failed to fetch recent gains/i)).toBeInTheDocument();
      });
    });

    it('should provide retry button for failed data fetches', async () => {
      const user = userEvent.setup();
      let callCount = 0;
      vi.mocked(apiClient.horsesApi.getProgression).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Failed to fetch'));
        }
        return Promise.resolve(mockProgression);
      });
      vi.mocked(apiClient.horsesApi.getStatHistory).mockResolvedValue(mockStatHistory);
      vi.mocked(apiClient.horsesApi.getRecentGains).mockResolvedValue(mockRecentGains);
      vi.mocked(apiClient.horsesApi.getAge).mockResolvedValue(mockHorseAge);
      vi.mocked(apiClient.horsesApi.getStats).mockResolvedValue(mockHorseStats);

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /progression/i }));

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Should successfully load after retry
      await waitFor(() => {
        expect(screen.getByText(/level 5/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Layout', () => {
    it('should render components in correct grid layout', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.horsesApi.getProgression).mockResolvedValue(mockProgression);
      vi.mocked(apiClient.horsesApi.getStatHistory).mockResolvedValue(mockStatHistory);
      vi.mocked(apiClient.horsesApi.getRecentGains).mockResolvedValue(mockRecentGains);
      vi.mocked(apiClient.horsesApi.getAge).mockResolvedValue(mockHorseAge);
      vi.mocked(apiClient.horsesApi.getStats).mockResolvedValue(mockHorseStats);

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /progression/i }));

      await waitFor(() => {
        // XP Progress Bar should be full width (single column)
        const xpBar = screen.getByText(/level 5/i).closest('div');
        expect(xpBar).toHaveClass(/col-span-full/);

        // Stat Chart should be full width
        const statChart = screen.getByText(/stat progression/i).closest('div');
        expect(statChart).toHaveClass(/col-span-full/);

        // Recent Gains and Age Counter should be side-by-side (2 columns)
        const recentGains = screen.getByText(/recent gains/i).closest('div');
        expect(recentGains).toHaveClass(/col-span-1/);

        const ageCounter = screen.getByText(/next age-up/i).closest('div');
        expect(ageCounter).toHaveClass(/col-span-1/);

        // Training Recommendations should be full width
        const recommendations = screen.getByText(/training recommendations/i).closest('div');
        expect(recommendations).toHaveClass(/col-span-full/);
      });
    });
  });

  describe('Data Refresh', () => {
    it('should refresh progression data when tab is switched away and back', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.horsesApi.getProgression).mockResolvedValue(mockProgression);
      vi.mocked(apiClient.horsesApi.getStatHistory).mockResolvedValue(mockStatHistory);
      vi.mocked(apiClient.horsesApi.getRecentGains).mockResolvedValue(mockRecentGains);
      vi.mocked(apiClient.horsesApi.getAge).mockResolvedValue(mockHorseAge);
      vi.mocked(apiClient.horsesApi.getStats).mockResolvedValue(mockHorseStats);

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Click Progression tab
      await user.click(screen.getByRole('button', { name: /progression/i }));

      await waitFor(() => {
        expect(screen.getByText(/level 5/i)).toBeInTheDocument();
      });

      // Switch to Overview tab
      await user.click(screen.getByRole('button', { name: /overview/i }));

      // Switch back to Progression tab
      await user.click(screen.getByRole('button', { name: /progression/i }));

      // Data should still be available (cached by React Query)
      await waitFor(() => {
        expect(screen.getByText(/level 5/i)).toBeInTheDocument();
      });

      // Should use cached data (no additional API calls beyond initial fetch)
      expect(apiClient.horsesApi.getProgression).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty State', () => {
    it('should show "no data" message when no progression data exists', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.horsesApi.getProgression).mockResolvedValue({
        ...mockProgression,
        currentXP: 0,
        totalXP: 0,
        recentLevelUps: [],
      });
      vi.mocked(apiClient.horsesApi.getStatHistory).mockResolvedValue({
        ...mockStatHistory,
        statData: [],
      });
      vi.mocked(apiClient.horsesApi.getRecentGains).mockResolvedValue({
        ...mockRecentGains,
        gains: [],
      });
      vi.mocked(apiClient.horsesApi.getAge).mockResolvedValue(mockHorseAge);
      vi.mocked(apiClient.horsesApi.getStats).mockResolvedValue(mockHorseStats);

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /progression/i }));

      await waitFor(() => {
        // Should show empty state messages
        expect(screen.getByText(/no.*gains/i)).toBeInTheDocument();
        expect(screen.getByText(/no.*history/i)).toBeInTheDocument();
      });
    });
  });
});
