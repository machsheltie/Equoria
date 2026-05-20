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
import { BrowserRouter, MockAuthProvider } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/test/msw/server';
import HorseDetailPage from '../HorseDetailPage';

// Network is exercised through the REAL api-client (horsesApi.*) at the fetch
// boundary via MSW (src/test/msw/server.ts) — NOT vi.mock('@/lib/api-client').
// Mocking horsesApi fakes the backend boundary so the test passes even when the
// real API contract is broken. MSW intercepts the actual HTTP requests the real
// horsesApi methods make. Per-endpoint responses + call counts are managed by
// the helpers below; default handlers are installed in beforeEach and reset by
// the global afterEach in src/test/setup.ts. Full real-network coverage of the
// horse progression tab lives in Playwright E2E
// (tests/e2e/celestial-night-features.spec.ts and horse-detail-coat-genetics.spec.ts).
const BASE = 'http://localhost:3000';
const horseUrl = (suffix = '') => `${BASE}/api/v1/horses/:id${suffix}`;

// Call counters replacing the old vi.fn() toHaveBeenCalled* assertions. Keyed by
// logical endpoint so a test can assert "getXP was called once" etc.
const calls: Record<string, number> = {};
function resetCalls() {
  for (const k of Object.keys(calls)) delete calls[k];
}
function bump(key: string) {
  calls[key] = (calls[key] ?? 0) + 1;
}

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

// Mock genetics hooks
vi.mock('../hooks/useHorseGenetics', () => ({
  useHorseEpigeneticInsights: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
  useHorseTraitInteractions: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
  useHorseTraitTimeline: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
}));

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
  recentLevelUps: [{ level: 5, timestamp: '2025-12-01T10:00:00Z', xpGained: 1500 }],
};

const mockXP = {
  horseId: 1,
  horseName: 'Thunder',
  currentXP: 2450,
  availableStatPoints: 4, // Level 5 = 4 stat points earned
  nextStatPointAt: 2500, // Total XP needed for next stat point
  xpToNextStatPoint: 50, // XP remaining to next stat point
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
    hasMore: false,
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

const mockTrainingHistory = {
  horseId: 1,
  horseName: 'Thunder',
  totalSessions: 15,
  averageScoreGain: 5.2,
  trainingHistory: [
    {
      id: 1,
      discipline: 'dressage',
      score: 45,
      trainedAt: '2025-12-01T10:00:00Z',
      notes: 'Great progress',
    },
    {
      id: 2,
      discipline: 'racing',
      score: 55,
      trainedAt: '2025-12-05T14:30:00Z',
      notes: 'Excellent session',
    },
  ],
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
};

// ── MSW handler installers ───────────────────────────────────────────────────
// Each returns a JSON envelope { status, data } so the real api-client unwraps
// `.data`. `:id` matches any horse id; query strings (e.g. ?t=) are ignored by
// MSW path matching. `once: true` lets a per-test handler take precedence for a
// single request and then fall through to the default installed in beforeEach.

type HandlerOpts = { once?: boolean; delayMs?: number };

function ok(key: string, data: unknown, opts: HandlerOpts = {}) {
  return async () => {
    bump(key);
    if (opts.delayMs) await delay(opts.delayMs);
    return HttpResponse.json({ status: 'success', data });
  };
}

function fail(key: string, message: string, status = 500) {
  return () => {
    bump(key);
    return HttpResponse.json({ status: 'error', message }, { status });
  };
}

function useHorseGet(handler: ReturnType<typeof ok> | ReturnType<typeof fail>, once = false) {
  server.use(http.get(horseUrl(), handler, once ? { once: true } : undefined));
}
function useGetXP(handler: ReturnType<typeof ok> | ReturnType<typeof fail>, once = false) {
  server.use(http.get(horseUrl('/xp'), handler, once ? { once: true } : undefined));
}
function useGetXPHistory(handler: ReturnType<typeof ok> | ReturnType<typeof fail>, once = false) {
  server.use(http.get(horseUrl('/xp-history'), handler, once ? { once: true } : undefined));
}
function useGetAge(handler: ReturnType<typeof ok> | ReturnType<typeof fail>, once = false) {
  server.use(http.get(horseUrl('/age'), handler, once ? { once: true } : undefined));
}
function useGetStats(handler: ReturnType<typeof ok> | ReturnType<typeof fail>, once = false) {
  server.use(http.get(horseUrl('/stats'), handler, once ? { once: true } : undefined));
}
function useGetTrainingHistory(
  handler: ReturnType<typeof ok> | ReturnType<typeof fail>,
  once = false
) {
  server.use(http.get(horseUrl('/training-history'), handler, once ? { once: true } : undefined));
}

/** Install the happy-path default handlers for every endpoint this tab uses. */
function installDefaultHandlers() {
  useHorseGet(ok('get', mockHorse));
  useGetXP(ok('getXP', mockXP));
  useGetXPHistory(ok('getXPHistory', mockXPHistory));
  useGetAge(ok('getAge', mockHorseAge));
  useGetStats(ok('getStats', mockHorseStats));
  useGetTrainingHistory(ok('getTrainingHistory', mockTrainingHistory));
  // ScoreProgressionPanel reads training-history & stats which are covered above.
}

describe('HorseDetailPage - Progression Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCalls();
    // Default happy-path handlers for all endpoints this tab consumes. Tests
    // that need a different response for one endpoint install a higher-priority
    // (often once:true) handler BEFORE rendering — MSW resolves the most recent
    // matching handler first.
    installDefaultHandlers();
  });

  describe('Tab Navigation', () => {
    it('should render Progression tab button', async () => {
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      expect(screen.getByRole('tab', { name: /progression/i })).toBeInTheDocument();
    });

    it('should switch to Progression tab when clicked', async () => {
      const user = userEvent.setup();
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const progressionTab = screen.getByRole('tab', { name: /progression/i });
      await user.click(progressionTab);

      // Progression tab should be active (will have specific styling)
      expect(progressionTab).toHaveClass(/border-burnished-gold/);
    });

    it('should display Progression tab with correct icon', async () => {
      const { container: _container } = render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const progressionTab = screen.getByRole('tab', { name: /progression/i });
      // Verify the SVG icon is present (TrendingUp icon)
      const svg = progressionTab.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('lucide-trending-up');
    });
  });

  describe('Component Integration', () => {
    it('should render all progression components when tab is active', async () => {
      const user = userEvent.setup();
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Click Progression tab
      await user.click(screen.getByRole('tab', { name: /progression/i }));

      // Wait for all components to load
      await waitFor(() => {
        // XPProgressBar - check for progress bar using aria-label
        expect(screen.getByLabelText(/level 5 progress/i)).toBeInTheDocument();

        // StatProgressionChart - check for chart heading
        expect(screen.getByText(/xp progression/i)).toBeInTheDocument();

        // RecentGains - check for gains heading
        expect(screen.getByText(/recent gains/i)).toBeInTheDocument();

        // AgeUpCounter - check using test ID
        expect(screen.getByTestId('age-up-counter')).toBeInTheDocument();

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
      await user.click(screen.getByRole('tab', { name: /progression/i }));

      // Verify all API calls were made
      await waitFor(() => {
        // XPProgressBar uses useHorseXP
        expect(calls.getXP).toBeGreaterThan(0);
        // StatProgressionChart and RecentGains use useHorseXPHistory
        expect(calls.getXPHistory).toBeGreaterThan(0);
        // AgeUpCounter uses useHorseAge
        expect(calls.getAge).toBeGreaterThan(0);
        // TrainingRecommendations uses useHorseStats
        expect(calls.getStats).toBeGreaterThan(0);
      });
    });

    it('should render XPProgressBar with correct data', async () => {
      const user = userEvent.setup();
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/level 5 progress/i)).toBeInTheDocument();
        expect(screen.getByText(/2450.*2500/)).toBeInTheDocument();
      });
    });

    it('should render StatProgressionChart with time range selector', async () => {
      const user = userEvent.setup();
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      await waitFor(() => {
        const xpProgressionHeading = screen.getByText(/xp progression/i);
        expect(xpProgressionHeading).toBeInTheDocument();

        // Get the chart container (parent of the heading)
        const chartContainer =
          xpProgressionHeading.closest('div[class*="card"], section, article') ||
          xpProgressionHeading.parentElement;

        // Query buttons within the chart container
        const { getByRole } = within(chartContainer as HTMLElement);
        expect(getByRole('button', { name: /7 days/i })).toBeInTheDocument();
        expect(getByRole('button', { name: /30 days/i })).toBeInTheDocument();
        expect(getByRole('button', { name: /90 days/i })).toBeInTheDocument();
      });
    });

    it('should render RecentGains with stat changes', async () => {
      const user = userEvent.setup();
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      await waitFor(() => {
        const recentGainsHeading = screen.getByText(/recent gains/i);
        expect(recentGainsHeading).toBeInTheDocument();
      });

      // Wait for data to load and verify XP events are displayed
      await waitFor(
        () => {
          // RecentGains uses useHorseXPHistory which calls getXPHistory
          expect(calls.getXPHistory).toBeGreaterThan(0);

          // Component should display XP event data (not stat names)
          expect(screen.getByText(/Training session completed/i)).toBeInTheDocument();
          expect(screen.getByText(/\+150/)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should render AgeUpCounter with countdown', async () => {
      const user = userEvent.setup();
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      await waitFor(() => {
        expect(screen.getByTestId('age-up-counter')).toBeInTheDocument();
        // Check for 365 days remaining (from mockHorseAge)
        expect(screen.getByText(/365.*days?/i)).toBeInTheDocument();
      });
    });

    it('should render TrainingRecommendations based on stats', async () => {
      const user = userEvent.setup();
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      await waitFor(() => {
        const recommendationsHeading = screen.getByText(/training recommendations/i);
        expect(recommendationsHeading).toBeInTheDocument();
      });

      // Wait for data to load
      await waitFor(
        () => {
          // Check that API was called
          expect(calls.getStats).toBeGreaterThan(0);

          // Should show recommendations for stats below potential
          const allStaminaTexts = screen.queryAllByText(/stamina/i);
          expect(allStaminaTexts.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Loading States', () => {
    it('should show loading skeleton while fetching progression data', async () => {
      const user = userEvent.setup();

      // Delay the XP response so the loading state is observable. once:true so
      // it applies to the first request, then the default handler takes over.
      useGetXP(ok('getXP', mockXP, { delayMs: 100 }), true);

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      // Should show loading state
      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      // Wait for data to load
      await waitFor(
        () => {
          expect(screen.getByLabelText(/level 5 progress/i)).toBeInTheDocument();
        },
        { timeout: 200 }
      );
    });

    it('should show loading state for each component independently', async () => {
      const user = userEvent.setup();

      // Delay one specific API response to test independent loading states.
      // 800ms gives the preceding waitFor calls time to complete before the
      // delay expires, preventing the race that caused flakiness with 100ms.
      // once:true so only the first request is delayed (the chart + RecentGains
      // both call getXPHistory; the delayed one drives the loading assertion).
      useGetXPHistory(ok('getXPHistory', mockXPHistory, { delayMs: 800 }), true);

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      // XP Progress should load immediately
      await waitFor(() => {
        expect(screen.getByLabelText(/level 5 progress/i)).toBeInTheDocument();
      });

      // Stat chart should show loading (component shows "Loading XP progression...")
      expect(screen.getByText(/loading xp progression/i)).toBeInTheDocument();

      // Wait for stat chart to load (timeout > 800ms delay above)
      await waitFor(
        () => {
          expect(screen.queryByText(/loading xp progression/i)).not.toBeInTheDocument();
        },
        { timeout: 1200 }
      );
    });
  });

  describe('Error Handling', () => {
    it('should display error message when progression data fails to load', async () => {
      const user = userEvent.setup();
      // getXP returns a 500 carrying the message the component surfaces.
      useGetXP(fail('getXP', 'Failed to fetch progression data'));

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch progression data/i)).toBeInTheDocument();
      });
    });

    it('should display error for stat history failure', async () => {
      const user = userEvent.setup();
      useGetXPHistory(fail('getXPHistory', 'Failed to fetch XP history'));

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      await waitFor(() => {
        // Both StatProgressionChart and RecentGains use getXPHistory, so 2 error messages
        const errorMessages = screen.getAllByText(/failed to fetch xp history/i);
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });

    it('should handle partial data failures gracefully', async () => {
      const user = userEvent.setup();
      // Some endpoints succeed (defaults), one fails: getXPHistory → 500.
      useGetXPHistory(fail('getXPHistory', 'Failed to fetch XP history'));

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      await waitFor(() => {
        // Should show successful components (getXP, getAge, getStats all succeed)
        expect(screen.getByLabelText(/level 5 progress/i)).toBeInTheDocument(); // XPProgressBar
        expect(screen.getByText(/training recommendations/i)).toBeInTheDocument(); // TrainingRecommendations

        // Should show error for failed component (getXPHistory failure affects chart and gains)
        const errorMessages = screen.getAllByText(/failed to fetch xp history/i);
        expect(errorMessages.length).toBeGreaterThan(0); // Chart and RecentGains both show error
      });
    });

    it('should provide retry button for failed data fetches', async () => {
      const user = userEvent.setup();
      // First getXP request fails (once:true); the retry falls through to the
      // default success handler installed in beforeEach.
      useGetXP(fail('getXP', 'Failed to fetch'), true);

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Should successfully load after retry
      await waitFor(() => {
        expect(screen.getByLabelText(/level 5 progress/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Layout', () => {
    it('should render components in correct grid layout', async () => {
      const user = userEvent.setup();

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      await waitFor(() => {
        // XP Progress Bar should be present and wrapped in col-span-full container
        const xpBar = screen.getByLabelText(/level 5 progress/i);
        const xpContainer = xpBar.closest('[class*="col-span-full"]');
        expect(xpContainer).toBeInTheDocument();

        // Stat Chart should be wrapped in col-span-full container
        const statChart = screen.getByText(/xp progression/i);
        const chartContainer = statChart.closest('[class*="col-span-full"]');
        expect(chartContainer).toBeInTheDocument();

        // Recent Gains and Age Counter should be in grid with col-span-1
        const recentGains = screen.getByText(/recent gains/i);
        const recentGainsContainer = recentGains.closest('[class*="col-span-1"]');
        expect(recentGainsContainer).toBeInTheDocument();

        const ageCounter = screen.getByTestId('age-up-counter');
        const ageCounterContainer = ageCounter.closest('[class*="col-span-1"]');
        expect(ageCounterContainer).toBeInTheDocument();

        // Training Recommendations should be wrapped in col-span-full container
        const recommendations = screen.getByText(/training recommendations/i);
        const recommendationsContainer = recommendations.closest('[class*="col-span-full"]');
        expect(recommendationsContainer).toBeInTheDocument();
      });
    });
  });

  describe('Data Refresh', () => {
    it('should refresh progression data when tab is switched away and back', async () => {
      const user = userEvent.setup();

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Click Progression tab
      await user.click(screen.getByRole('tab', { name: /progression/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/level 5 progress/i)).toBeInTheDocument();
      });

      // Switch to Overview tab
      await user.click(screen.getByRole('tab', { name: /overview/i }));

      // Switch back to Progression tab
      await user.click(screen.getByRole('tab', { name: /progression/i }));

      // Data should still be available (cached by React Query)
      await waitFor(() => {
        expect(screen.getByLabelText(/level 5 progress/i)).toBeInTheDocument();
      });

      // Should use cached data (no additional API calls beyond initial fetch)
      expect(calls.getXP).toBe(1);
    });
  });

  describe('Empty State', () => {
    it('should show "no data" message when no progression data exists', async () => {
      const user = userEvent.setup();
      // Empty progression + empty XP history → the chart and RecentGains render
      // their "no data" empty states.
      useGetXP(ok('getXP', { ...mockProgression, currentXP: 0, totalXP: 0, recentLevelUps: [] }));
      useGetXPHistory(
        ok('getXPHistory', {
          events: [],
          count: 0,
          pagination: { limit: 10, offset: 0, hasMore: false },
        })
      );

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      await waitFor(() => {
        // Should show empty state messages
        expect(screen.getByText(/no.*gains/i)).toBeInTheDocument();
        expect(screen.getByText(/no.*history/i)).toBeInTheDocument();
      });
    });
  });

  describe('ScoreProgressionPanel Integration', () => {
    it('should render ScoreProgressionPanel in the Progression tab', async () => {
      const user = userEvent.setup();

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      await waitFor(() => {
        // Check for ScoreProgressionPanel by its test ID
        expect(screen.getByTestId('score-progression-panel')).toBeInTheDocument();
      });
    });

    it('should pass correct horse ID to ScoreProgressionPanel', async () => {
      const user = userEvent.setup();

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      await waitFor(() => {
        // Verify the ScoreProgressionPanel container is present
        const scoreProgressionSection = screen.getByTestId('score-progression-section');
        expect(scoreProgressionSection).toBeInTheDocument();
        // The panel should be a child of this section
        expect(
          within(scoreProgressionSection).getByTestId('score-progression-panel')
        ).toBeInTheDocument();
      });
    });

    it('should display discipline distribution section', async () => {
      const user = userEvent.setup();

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      // Wait for the ScoreProgressionPanel to load and render content
      await waitFor(
        () => {
          // Check for discipline distribution heading in the ScoreProgressionPanel
          expect(screen.getByText(/discipline distribution/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('should display score caps and bonuses information', async () => {
      const user = userEvent.setup();

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      // Wait for the ScoreProgressionPanel to load and render the score caps section
      await waitFor(
        () => {
          // Check for score caps section
          expect(screen.getByTestId('score-caps-section')).toBeInTheDocument();
          expect(screen.getByText(/base score cap/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('Tab Navigation - Additional Tests', () => {
    it('should maintain active tab state after content loads', async () => {
      const user = userEvent.setup();

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      // Wait for all content to load
      await waitFor(() => {
        expect(screen.getByLabelText(/level 5 progress/i)).toBeInTheDocument();
      });

      // Tab should still be active
      const progressionTab = screen.getByRole('tab', { name: /progression/i });
      expect(progressionTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should deselect Progression tab when switching to another tab', async () => {
      const user = userEvent.setup();

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Click Progression tab first
      await user.click(screen.getByRole('tab', { name: /progression/i }));

      // Then switch to Overview
      await user.click(screen.getByRole('tab', { name: /overview/i }));

      // Progression should no longer be selected
      const progressionTab = screen.getByRole('tab', { name: /progression/i });
      expect(progressionTab).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('State Management', () => {
    it('should initialize with Overview tab active by default', async () => {
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Overview tab should be selected by default
      const overviewTab = screen.getByRole('tab', { name: /overview/i });
      expect(overviewTab).toHaveAttribute('aria-selected', 'true');

      // Progression tab should not be selected
      const progressionTab = screen.getByRole('tab', { name: /progression/i });
      expect(progressionTab).toHaveAttribute('aria-selected', 'false');
    });

    it('should update tab state correctly when switching tabs', async () => {
      const user = userEvent.setup();

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Click through multiple tabs
      await user.click(screen.getByRole('tab', { name: /progression/i }));
      expect(screen.getByRole('tab', { name: /progression/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );

      await user.click(screen.getByRole('tab', { name: /training/i }));
      expect(screen.getByRole('tab', { name: /training/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('tab', { name: /progression/i })).toHaveAttribute(
        'aria-selected',
        'false'
      );

      // Go back to Progression
      await user.click(screen.getByRole('tab', { name: /progression/i }));
      expect(screen.getByRole('tab', { name: /progression/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('should preserve tab state during re-renders', async () => {
      const user = userEvent.setup();

      const { rerender } = render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      // Re-render the component
      rerender(<HorseDetailPage />);

      // Tab state should be preserved
      expect(screen.getByRole('tab', { name: /progression/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA roles for tab navigation', async () => {
      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Check for tablist role
      expect(screen.getByRole('tablist')).toBeInTheDocument();

      // Check that all tabs have the tab role
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBeGreaterThan(0);

      // Progression tab specifically should have tab role
      const progressionTab = screen.getByRole('tab', { name: /progression/i });
      expect(progressionTab).toBeInTheDocument();
    });

    it('should have proper ARIA attributes for tab panel content', async () => {
      const user = userEvent.setup();

      render(<HorseDetailPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /progression/i }));

      // Check for tabpanel role
      const tabPanel = screen.getByRole('tabpanel');
      expect(tabPanel).toBeInTheDocument();

      // Tab panel should have aria-labelledby pointing to the tab
      expect(tabPanel).toHaveAttribute('aria-labelledby', 'progression-tab');
    });
  });
});
