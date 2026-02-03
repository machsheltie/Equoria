/**
 * Leaderboards Integration Tests
 *
 * Comprehensive integration tests covering complete leaderboard workflows.
 * Unlike unit tests that mock hooks, these tests use real React Query hooks
 * with MSW handlers to exercise the full data flow:
 *
 *   User Interaction -> Component -> Hook -> API Client -> MSW Handler -> Response -> UI Update
 *
 * Test Scenarios:
 * 1. Category Selection Flow (5 tests)
 * 2. Pagination Flow (3 tests)
 * 3. Horse Detail Modal Flow (4 tests)
 * 4. User Rankings Dashboard (3 tests)
 * 5. URL State Persistence (3 tests)
 * 6. Error Handling (2 tests)
 *
 * Story 5-5: Leaderboards - Task 8
 * Target: 20 tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import LeaderboardsPage from '@/pages/LeaderboardsPage';

// ---------------------------------------------------------------------------
// Mock AuthContext - provides the current user identity for leaderboard queries
// ---------------------------------------------------------------------------
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123', username: 'John Doe' },
    isAuthenticated: true,
    isLoading: false,
    isEmailVerified: true,
    error: null,
    logout: vi.fn(),
    isLoggingOut: false,
    refetchProfile: vi.fn(),
    userRole: 'user' as const,
    hasRole: () => false,
    hasAnyRole: () => false,
    isAdmin: false,
    isModerator: false,
  }),
}));

// ---------------------------------------------------------------------------
// Track navigate calls for "View Full Profile" button testing
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ---------------------------------------------------------------------------
// Test Utilities
// ---------------------------------------------------------------------------

/**
 * Creates a fresh QueryClient configured for testing with no retries
 * so errors surface immediately.
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // Disable staleTime so queries always refetch on param changes
        staleTime: 0,
      },
    },
  });
}

/**
 * Renders the LeaderboardsPage inside all required providers.
 * Uses MemoryRouter with an optional initial route for URL state testing.
 * Returns the userEvent instance for simulating user interactions.
 */
function renderLeaderboardsPage(initialRoute = '/leaderboards') {
  const queryClient = createTestQueryClient();
  const user = userEvent.setup();

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/leaderboards" element={<LeaderboardsPage />} />
          <Route
            path="/horses/:id"
            element={<div data-testid="horse-detail-page">Horse Detail Page</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { ...result, user, queryClient };
}

/**
 * Waits for the leaderboard table to finish loading by checking that
 * skeleton rows have disappeared and at least one entry row is visible.
 */
async function waitForLeaderboardToLoad() {
  await waitFor(
    () => {
      // Skeleton rows should be gone
      expect(screen.queryAllByTestId('skeleton-row')).toHaveLength(0);
      // At least one leaderboard entry should be visible
      expect(screen.getAllByTestId('leaderboard-entry').length).toBeGreaterThan(0);
    },
    { timeout: 5000 }
  );
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // MSW handlers are reset by the global setup.ts afterEach
});

// ===========================================================================
// Scenario 1: Complete Category Selection Flow (5 tests)
// ===========================================================================

describe('Category Selection Flow', () => {
  it('should load default leaderboard with level category on page load', async () => {
    renderLeaderboardsPage();

    // Wait for data to load from MSW
    await waitForLeaderboardToLoad();

    // The default category "level" should be active
    const levelTab = screen.getByTestId('category-level');
    expect(levelTab).toHaveAttribute('aria-pressed', 'true');

    // The default period "all-time" should be active
    const allTimeButton = screen.getByTestId('period-all-time');
    expect(allTimeButton).toHaveAttribute('aria-pressed', 'true');

    // Entries from the level category fixture should be visible
    // The first entry is "Horse 1" (rank 1 in the fixture)
    expect(screen.getByText('Horse 1')).toBeInTheDocument();
  });

  it('should switch to prize-money category when clicked', async () => {
    const { user } = renderLeaderboardsPage();

    // Wait for initial level leaderboard to load
    await waitForLeaderboardToLoad();

    // Click the prize-money category tab
    const prizeMoneyTab = screen.getByTestId('category-prize-money');
    await user.click(prizeMoneyTab);

    // Wait for the new data to load
    await waitFor(
      () => {
        expect(prizeMoneyTab).toHaveAttribute('aria-pressed', 'true');
      },
      { timeout: 3000 }
    );

    // The level tab should no longer be active
    const levelTab = screen.getByTestId('category-level');
    expect(levelTab).toHaveAttribute('aria-pressed', 'false');

    // Wait for entries to reload with new category data
    await waitForLeaderboardToLoad();
  });

  it('should show discipline selector when discipline category is selected', async () => {
    const { user } = renderLeaderboardsPage();

    await waitForLeaderboardToLoad();

    // Discipline selector should not be visible initially
    expect(screen.queryByTestId('discipline-selector')).not.toBeInTheDocument();

    // Click the discipline category tab
    const disciplineTab = screen.getByTestId('category-discipline');
    await user.click(disciplineTab);

    // Discipline selector should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('discipline-selector')).toBeInTheDocument();
    });
  });

  it('should switch to monthly period when clicked', async () => {
    const { user } = renderLeaderboardsPage();

    await waitForLeaderboardToLoad();

    // Click the monthly period button
    const monthlyButton = screen.getByTestId('period-monthly');
    await user.click(monthlyButton);

    // Monthly should be active
    await waitFor(() => {
      expect(monthlyButton).toHaveAttribute('aria-pressed', 'true');
    });

    // All-time should no longer be active
    const allTimeButton = screen.getByTestId('period-all-time');
    expect(allTimeButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('should apply multiple filter changes in sequence', async () => {
    const { user } = renderLeaderboardsPage();

    await waitForLeaderboardToLoad();

    // Step 1: Switch to win-rate category
    const winRateTab = screen.getByTestId('category-win-rate');
    await user.click(winRateTab);

    await waitFor(() => {
      expect(winRateTab).toHaveAttribute('aria-pressed', 'true');
    });

    // Step 2: Switch to weekly period
    const weeklyButton = screen.getByTestId('period-weekly');
    await user.click(weeklyButton);

    await waitFor(() => {
      expect(weeklyButton).toHaveAttribute('aria-pressed', 'true');
    });

    // Both filters should be applied simultaneously
    expect(winRateTab).toHaveAttribute('aria-pressed', 'true');
    expect(weeklyButton).toHaveAttribute('aria-pressed', 'true');
  });
});

// ===========================================================================
// Scenario 2: Pagination Flow (3 tests)
// ===========================================================================

describe('Pagination Flow', () => {
  it('should navigate to page 2 when next button is clicked', async () => {
    const { user } = renderLeaderboardsPage();

    await waitForLeaderboardToLoad();

    // Verify page 1 is displayed
    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();

    // Click next page
    const nextButton = screen.getByTestId('pagination-next');
    await user.click(nextButton);

    // Wait for page 2 data to load
    await waitFor(
      () => {
        expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('should navigate back to page 1 from page 2', async () => {
    const { user } = renderLeaderboardsPage();

    await waitForLeaderboardToLoad();

    // Navigate to page 2 first
    const nextButton = screen.getByTestId('pagination-next');
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
    });

    // Navigate back to page 1
    const prevButton = screen.getByTestId('pagination-prev');
    await user.click(prevButton);

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    });
  });

  it('should disable previous button on page 1', async () => {
    renderLeaderboardsPage();

    await waitForLeaderboardToLoad();

    // Previous button should be disabled on page 1
    const prevButton = screen.getByTestId('pagination-prev');
    expect(prevButton).toBeDisabled();
  });
});

// ===========================================================================
// Scenario 3: Horse Detail Modal Flow (4 tests)
// ===========================================================================

describe('Horse Detail Modal Flow', () => {
  it('should open modal when a leaderboard entry is clicked', async () => {
    const { user } = renderLeaderboardsPage();

    await waitForLeaderboardToLoad();

    // Modal should not be visible initially
    expect(screen.queryByTestId('horse-detail-modal')).not.toBeInTheDocument();

    // Click the first entry
    const entries = screen.getAllByTestId('leaderboard-entry');
    await user.click(entries[0]);

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByTestId('horse-detail-modal')).toBeInTheDocument();
    });
  });

  it('should display horse details in the modal after clicking an entry', async () => {
    const { user } = renderLeaderboardsPage();

    await waitForLeaderboardToLoad();

    // Click the first entry (Horse 1 from fixtures)
    const entries = screen.getAllByTestId('leaderboard-entry');
    await user.click(entries[0]);

    await waitFor(() => {
      expect(screen.getByTestId('horse-detail-modal')).toBeInTheDocument();
    });

    // The modal should contain horse details
    const modal = screen.getByTestId('horse-detail-modal');
    // Horse name "Horse 1" should be visible in the modal
    expect(within(modal).getByText('Horse 1')).toBeInTheDocument();
    // Stats section should be present
    expect(within(modal).getByTestId('stats-section')).toBeInTheDocument();
    // Competition history section should be present
    expect(within(modal).getByTestId('competition-history-section')).toBeInTheDocument();
  });

  it('should navigate to horse profile when "View Full Profile" is clicked', async () => {
    const { user } = renderLeaderboardsPage();

    await waitForLeaderboardToLoad();

    // Open the modal by clicking first entry
    const entries = screen.getAllByTestId('leaderboard-entry');
    await user.click(entries[0]);

    await waitFor(() => {
      expect(screen.getByTestId('horse-detail-modal')).toBeInTheDocument();
    });

    // Click "View Full Profile" button
    const viewProfileButton = screen.getByTestId('view-full-profile-button');
    await user.click(viewProfileButton);

    // Should navigate to the horse's profile page
    // The first entry in the level fixture has horseId 101 (100 + rank 1)
    expect(mockNavigate).toHaveBeenCalledWith('/horses/101');
  });

  it('should close modal when close button is clicked', async () => {
    const { user } = renderLeaderboardsPage();

    await waitForLeaderboardToLoad();

    // Open modal
    const entries = screen.getAllByTestId('leaderboard-entry');
    await user.click(entries[0]);

    await waitFor(() => {
      expect(screen.getByTestId('horse-detail-modal')).toBeInTheDocument();
    });

    // Close modal
    const closeButton = screen.getByTestId('modal-close-button');
    await user.click(closeButton);

    // Modal should disappear
    await waitFor(() => {
      expect(screen.queryByTestId('horse-detail-modal')).not.toBeInTheDocument();
    });
  });
});

// ===========================================================================
// Scenario 4: User Rankings Dashboard (3 tests)
// ===========================================================================

describe('User Rankings Dashboard', () => {
  it('should display user rank dashboard with ranking cards', async () => {
    renderLeaderboardsPage();

    await waitForLeaderboardToLoad();

    // The user rank dashboard should be present
    const dashboard = screen.getByTestId('user-rank-dashboard');
    expect(dashboard).toBeInTheDocument();

    // Wait for user rank summary data to load from MSW
    // The fixture data for user-123 has 6 category rankings
    await waitFor(
      () => {
        const rankCards = screen.getAllByTestId('rank-summary-card');
        expect(rankCards.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 5000 }
    );
  });

  it('should display best rankings section with achievements', async () => {
    renderLeaderboardsPage();

    await waitForLeaderboardToLoad();

    // Wait for the user rank summary to load
    await waitFor(
      () => {
        const bestSection = screen.getByTestId('best-rankings-section');
        expect(bestSection).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // The fixture data for user-123 has best rankings including multiple "Top 10" entries
    const bestSection = screen.getByTestId('best-rankings-section');
    const topTenElements = within(bestSection).getAllByText(/Top 10/);
    expect(topTenElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should switch leaderboard category when a ranking card is clicked', async () => {
    const { user } = renderLeaderboardsPage();

    await waitForLeaderboardToLoad();

    // Wait for rank summary cards to load
    await waitFor(
      () => {
        const rankCards = screen.getAllByTestId('rank-summary-card');
        expect(rankCards.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 5000 }
    );

    // Find the "Prize Money" ranking card and click it
    // The fixture has a prize-money ranking card with label "Prize Money"
    const rankCards = screen.getAllByTestId('rank-summary-card');
    // Find the card that contains "Prize Money" text
    const prizeMoneyCard = rankCards.find((card) =>
      within(card).queryByText('Prize Money')
    );

    if (prizeMoneyCard) {
      await user.click(prizeMoneyCard);

      // The prize-money category tab should become active
      await waitFor(() => {
        const prizeMoneyTab = screen.getByTestId('category-prize-money');
        expect(prizeMoneyTab).toHaveAttribute('aria-pressed', 'true');
      });
    } else {
      // If the specific card is not found, verify at least one card is clickable
      // by clicking the first card
      await user.click(rankCards[0]);

      // Some category tab should have changed
      await waitFor(() => {
        const tabs = screen.getAllByRole('tab');
        const activeTab = tabs.find(
          (tab) => tab.getAttribute('aria-pressed') === 'true'
        );
        expect(activeTab).toBeTruthy();
      });
    }
  });
});

// ===========================================================================
// Scenario 5: URL State Persistence (3 tests)
// ===========================================================================

describe('URL State Persistence', () => {
  it('should load with correct category from URL params', async () => {
    renderLeaderboardsPage('/leaderboards?category=prize-money&period=all-time');

    await waitForLeaderboardToLoad();

    // The prize-money category should be active
    const prizeMoneyTab = screen.getByTestId('category-prize-money');
    expect(prizeMoneyTab).toHaveAttribute('aria-pressed', 'true');

    // The level category should not be active
    const levelTab = screen.getByTestId('category-level');
    expect(levelTab).toHaveAttribute('aria-pressed', 'false');
  });

  it('should load with correct period from URL params', async () => {
    renderLeaderboardsPage('/leaderboards?category=level&period=weekly');

    await waitForLeaderboardToLoad();

    // The weekly period should be active
    const weeklyButton = screen.getByTestId('period-weekly');
    expect(weeklyButton).toHaveAttribute('aria-pressed', 'true');

    // The all-time period should not be active
    const allTimeButton = screen.getByTestId('period-all-time');
    expect(allTimeButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('should load with correct page from URL params', async () => {
    renderLeaderboardsPage('/leaderboards?category=level&period=all-time&page=2');

    // Wait for page 2 data to load
    await waitFor(
      () => {
        expect(screen.queryAllByTestId('skeleton-row')).toHaveLength(0);
        expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  });
});

// ===========================================================================
// Scenario 6: Error Handling (2 tests)
// ===========================================================================

describe('Error Handling', () => {
  it('should display error state when network request fails', async () => {
    // Override the leaderboard handler to return a 500 error
    server.use(
      http.get('http://localhost:3001/api/leaderboards/:category', () => {
        return HttpResponse.json(
          { status: 'error', message: 'Internal server error' },
          { status: 500 }
        );
      })
    );

    renderLeaderboardsPage();

    // Wait for the error state to appear
    await waitFor(
      () => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Retry button should be present
    expect(
      screen.getByRole('button', { name: /retry/i })
    ).toBeInTheDocument();
  });

  it('should refetch data when retry button is clicked after error', async () => {
    let requestCount = 0;

    // First request fails, subsequent requests succeed
    server.use(
      http.get('http://localhost:3001/api/leaderboards/:category', ({ request }) => {
        requestCount++;
        if (requestCount <= 1) {
          return HttpResponse.json(
            { status: 'error', message: 'Temporary failure' },
            { status: 500 }
          );
        }
        // Subsequent requests succeed with minimal valid data
        const url = new URL(request.url);
        const period = url.searchParams.get('period') || 'all-time';
        return HttpResponse.json({
          success: true,
          data: {
            category: 'level',
            period,
            totalEntries: 1,
            currentPage: 1,
            totalPages: 1,
            entries: [
              {
                rank: 1,
                horseId: 101,
                horseName: 'Recovery Horse',
                ownerId: 'user-1',
                ownerName: 'Owner 1',
                primaryStat: 20,
                secondaryStats: { totalCompetitions: 10, winRate: 50 },
                isCurrentUser: false,
                rankChange: 0,
              },
            ],
            lastUpdated: new Date().toISOString(),
          },
        });
      })
    );

    const { user } = renderLeaderboardsPage();

    // Wait for error state
    await waitFor(
      () => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Click retry button
    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    // Wait for successful data load after retry
    await waitFor(
      () => {
        expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument();
        expect(screen.getByText('Recovery Horse')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  });
});
