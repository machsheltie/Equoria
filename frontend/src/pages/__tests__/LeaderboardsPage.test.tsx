/**
 * LeaderboardsPage Component Tests
 *
 * Comprehensive tests for the leaderboards page integration including:
 * - Page rendering with all sub-components
 * - URL state management (category, period, discipline, page)
 * - Data fetching via useLeaderboard and useUserRankSummary hooks
 * - Horse detail modal interaction
 * - Pagination controls
 * - Accessibility (landmarks, heading hierarchy)
 *
 * Story 5-5: Leaderboards - Task 6
 * Target: 25 tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from '../../test/utils';
import LeaderboardsPage from '../LeaderboardsPage';

// ---------------------------------------------------------------------------
// Mock AuthContext
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
    userRole: 'user',
    hasRole: () => false,
    hasAnyRole: () => false,
    isAdmin: false,
    isModerator: false,
  }),
}));

// ---------------------------------------------------------------------------
// Mock hooks
// ---------------------------------------------------------------------------
const mockUseLeaderboard = vi.fn();
const mockUseUserRankSummary = vi.fn();
const mockUseLeaderboardRefresh = vi.fn();
const mockUseLeaderboardHorseProfile = vi.fn();

vi.mock('@/hooks/api/useLeaderboard', () => ({
  useLeaderboard: (...args: unknown[]) => mockUseLeaderboard(...args),
}));

vi.mock('@/hooks/api/useUserRankSummary', () => ({
  useUserRankSummary: (...args: unknown[]) => mockUseUserRankSummary(...args),
}));

vi.mock('@/hooks/api/useLeaderboardRefresh', () => ({
  useLeaderboardRefresh: () => mockUseLeaderboardRefresh(),
}));

vi.mock('@/hooks/api/useLeaderboardHorseProfile', () => ({
  useLeaderboardHorseProfile: (...args: unknown[]) => mockUseLeaderboardHorseProfile(...args),
}));

// ---------------------------------------------------------------------------
// Mock navigate
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
// Shared mock data
// ---------------------------------------------------------------------------
const mockLeaderboardData = {
  category: 'level',
  period: 'all-time',
  totalEntries: 1254,
  currentPage: 1,
  totalPages: 26,
  entries: [
    {
      rank: 1,
      horseId: 101,
      horseName: 'Thunder Strike',
      ownerId: 'user-456',
      ownerName: 'Jane Smith',
      primaryStat: 20,
      secondaryStats: {
        totalCompetitions: 48,
        wins: 12,
        winRate: 25,
      },
      isCurrentUser: false,
      rankChange: 2,
    },
    {
      rank: 2,
      horseId: 102,
      horseName: 'Midnight Dream',
      ownerId: 'user-789',
      ownerName: 'Bob Wilson',
      primaryStat: 18,
      secondaryStats: {
        totalCompetitions: 35,
        wins: 8,
        winRate: 22.8,
      },
      isCurrentUser: false,
      rankChange: -1,
    },
  ],
  userRank: {
    rank: 42,
    entry: {
      rank: 42,
      horseId: 200,
      horseName: 'My Horse',
      ownerId: 'user-123',
      ownerName: 'John Doe',
      primaryStat: 15,
      secondaryStats: {
        totalCompetitions: 20,
        wins: 5,
        winRate: 25,
      },
      isCurrentUser: true,
      rankChange: 5,
    },
  },
  lastUpdated: '2026-02-03T10:30:00Z',
};

// Real horse profile the page now fetches via useLeaderboardHorseProfile
// (Equoria-8nfc). Distinctive values so tests prove REAL data renders, not
// the old fabricated placeholders (breed 'not recorded', age 0, stats 0).
const mockHorseProfile = {
  horseId: 101,
  name: 'Thunder Strike',
  breed: 'Arabian',
  age: 7,
  sex: 'Mare',
  stats: {
    speed: 88,
    stamina: 91,
    agility: 76,
    balance: 70,
    precision: 82,
    intelligence: 79,
    boldness: 84,
    flexibility: 73,
    obedience: 80,
    focus: 86,
  },
  totalEarnings: 125000,
  competitionWins: 12,
  topThreeFinishes: 21,
};

const mockUserRankData = {
  userId: 'user-123',
  userName: 'John Doe',
  rankings: [
    {
      category: 'level',
      categoryLabel: 'Horse Level',
      rank: 42,
      totalEntries: 1254,
      rankChange: 5,
      primaryStat: 15,
      statLabel: 'Level',
    },
    {
      category: 'prize-money',
      categoryLabel: 'Prize Money',
      rank: 8,
      totalEntries: 980,
      rankChange: -2,
      primaryStat: 125340,
      statLabel: 'Total Earnings',
    },
  ],
  bestRankings: [
    {
      category: 'prize-money',
      categoryLabel: 'Prize Money',
      rank: 8,
      achievement: 'Top 10',
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a fresh QueryClient for test isolation.
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

/**
 * Renders the LeaderboardsPage inside required providers with an optional
 * initial route for URL state testing.
 */
function renderPage(initialRoute = '/leaderboards') {
  const queryClient = createTestQueryClient();
  const user = userEvent.setup();

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/leaderboards" element={<LeaderboardsPage />} />
          <Route
            path="/horses/:id"
            element={<div data-testid="horse-detail-page">Horse Detail</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { ...result, user };
}

/**
 * Sets up the default hook mocks returning loaded data.
 */
function setupDefaultMocks() {
  mockUseLeaderboard.mockReturnValue({
    data: mockLeaderboardData,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });

  mockUseUserRankSummary.mockReturnValue({
    data: mockUserRankData,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });

  mockUseLeaderboardRefresh.mockReturnValue({
    refreshAll: vi.fn(),
    refreshCategory: vi.fn(),
    isRefreshing: false,
  });

  mockUseLeaderboardHorseProfile.mockReturnValue({
    data: mockHorseProfile,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

// ===================================================================
// 1. Page Rendering Tests (5 tests)
// ===================================================================

describe('Page rendering', () => {
  it('renders the page title and subtitle', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Leaderboards');
    // Subtitle now ends with "— who reigns supreme in Equoria?". Use a regex
    // matcher to remain flexible if the suffix changes again.
    expect(screen.getByText(/view top performers across all categories/i)).toBeInTheDocument();
  });

  it('renders the UserRankDashboard component', () => {
    renderPage();

    expect(screen.getByTestId('user-rank-dashboard')).toBeInTheDocument();
  });

  it('renders the LeaderboardCategorySelector component', () => {
    renderPage();

    expect(screen.getByTestId('leaderboard-category-selector')).toBeInTheDocument();
  });

  it('renders the LeaderboardTable component', () => {
    renderPage();

    expect(screen.getByTestId('leaderboard-table')).toBeInTheDocument();
  });

  it('renders all sections with proper structure', () => {
    renderPage();

    // Title section exists
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    // User rank dashboard exists
    expect(screen.getByTestId('user-rank-dashboard')).toBeInTheDocument();
    // Category selector exists
    expect(screen.getByTestId('leaderboard-category-selector')).toBeInTheDocument();
    // Table exists
    expect(screen.getByTestId('leaderboard-table')).toBeInTheDocument();
  });
});

// ===================================================================
// 2. URL State Management Tests (8 tests)
// ===================================================================

describe('URL state management', () => {
  it('reads initial category from URL params', () => {
    renderPage('/leaderboards?category=prize-money');

    // The hook should be called with category prize-money
    expect(mockUseLeaderboard).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'prize-money' })
    );
  });

  it('reads initial period from URL params', () => {
    renderPage('/leaderboards?period=monthly');

    expect(mockUseLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ period: 'monthly' }));
  });

  it('reads initial page from URL params', () => {
    renderPage('/leaderboards?page=3');

    expect(mockUseLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ page: 3 }));
  });

  it('reads initial discipline from URL params for discipline category', () => {
    renderPage('/leaderboards?category=discipline&discipline=show-jumping');

    expect(mockUseLeaderboard).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'discipline',
        discipline: 'show-jumping',
      })
    );
  });

  it('updates URL when category changes', async () => {
    const { user } = renderPage();

    const prizeMoneyTab = screen.getByTestId('category-prize-money');
    await user.click(prizeMoneyTab);

    // After category change, hook should be called with the new category
    await waitFor(() => {
      expect(mockUseLeaderboard).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'prize-money' })
      );
    });
  });

  it('updates URL when period changes', async () => {
    const { user } = renderPage();

    const weeklyButton = screen.getByTestId('period-weekly');
    await user.click(weeklyButton);

    await waitFor(() => {
      expect(mockUseLeaderboard).toHaveBeenCalledWith(
        expect.objectContaining({ period: 'weekly' })
      );
    });
  });

  it('resets page to 1 when category changes', async () => {
    const { user } = renderPage('/leaderboards?category=level&page=5');

    const prizeMoneyTab = screen.getByTestId('category-prize-money');
    await user.click(prizeMoneyTab);

    await waitFor(() => {
      expect(mockUseLeaderboard).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'prize-money', page: 1 })
      );
    });
  });

  it('resets page to 1 when period changes', async () => {
    const { user } = renderPage('/leaderboards?period=all-time&page=5');

    const weeklyButton = screen.getByTestId('period-weekly');
    await user.click(weeklyButton);

    await waitFor(() => {
      expect(mockUseLeaderboard).toHaveBeenCalledWith(
        expect.objectContaining({ period: 'weekly', page: 1 })
      );
    });
  });
});

// ===================================================================
// 3. Data Fetching Tests (4 tests)
// ===================================================================

describe('Data fetching', () => {
  it('calls useLeaderboard with correct params from URL', () => {
    renderPage('/leaderboards?category=win-rate&period=daily&page=2');

    expect(mockUseLeaderboard).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'win-rate',
        period: 'daily',
        page: 2,
      })
    );
  });

  it('calls useUserRankSummary with the current userId', () => {
    renderPage();

    expect(mockUseUserRankSummary).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-123' })
    );
  });

  it('displays loading state while fetching data', () => {
    mockUseLeaderboard.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    // The table should show skeleton rows when loading
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
  });

  it('displays error state on fetch error with retry button', () => {
    mockUseLeaderboard.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

// ===================================================================
// 4. Modal Integration Tests (4 tests)
// ===================================================================

describe('Modal integration', () => {
  it('opens modal when a leaderboard entry is clicked', async () => {
    const { user } = renderPage();

    const entries = screen.getAllByTestId('leaderboard-entry');
    await user.click(entries[0]);

    await waitFor(() => {
      expect(screen.getByTestId('horse-detail-modal')).toBeInTheDocument();
    });
  });

  it('displays horse details in the modal', async () => {
    const { user } = renderPage();

    const entries = screen.getAllByTestId('leaderboard-entry');
    await user.click(entries[0]);

    await waitFor(() => {
      expect(screen.getByTestId('horse-detail-modal')).toBeInTheDocument();
    });

    // BaseModal renders via createPortal to document.body, so the modal
    // content is OUTSIDE the `horse-detail-modal` wrapper div. Use the
    // BaseModal-provided title testid instead of `within()`.
    expect(screen.getByTestId('base-modal-title')).toHaveTextContent('Thunder Strike');
  });

  it('renders REAL fetched horse profile (breed/age), not fabricated placeholders (Equoria-8nfc)', async () => {
    const { user } = renderPage();

    const entries = screen.getAllByTestId('leaderboard-entry');
    await user.click(entries[0]);

    await waitFor(() => {
      expect(screen.getByTestId('base-modal')).toBeInTheDocument();
    });

    // Real persisted breed 'Arabian' must appear — the pre-fix code
    // hardcoded breed to 'Unknown'/'not recorded' and age to 0. The
    // absence of 'Arabian' / presence of a 0 age would mean the modal is
    // still showing synthetic data.
    expect(screen.getByText(/Arabian/)).toBeInTheDocument();
    // Sentinel: the old fabricated path would have rendered breed
    // 'not recorded' even though this horse HAS a breed. Assert it does not.
    expect(screen.queryByText('not recorded')).not.toBeInTheDocument();
  });

  it('shows the modal loading state while the real profile is fetching (Equoria-8nfc)', async () => {
    mockUseLeaderboardHorseProfile.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const { user } = renderPage();

    const entries = screen.getAllByTestId('leaderboard-entry');
    await user.click(entries[0]);

    await waitFor(() => {
      expect(screen.getByTestId('base-modal')).toBeInTheDocument();
    });

    // While loading, no fabricated breed/age is shown — the modal renders
    // its loading skeleton, not invented '0'/'Unknown' data.
    expect(screen.queryByText(/Arabian/)).not.toBeInTheDocument();
    expect(screen.queryByText('not recorded')).not.toBeInTheDocument();
  });

  it('closes modal when close button is clicked', async () => {
    const { user } = renderPage();

    // Open the modal
    const entries = screen.getAllByTestId('leaderboard-entry');
    await user.click(entries[0]);

    await waitFor(() => {
      expect(screen.getByTestId('horse-detail-modal')).toBeInTheDocument();
    });

    // Close the modal — BaseModal namespaces the close button as
    // `base-modal-close-button` (LeaderboardHorseDetailModal does not pass
    // a custom data-testid prop to BaseModal).
    const closeButton = screen.getByTestId('base-modal-close-button');
    await user.click(closeButton);

    await waitFor(() => {
      // The `horse-detail-modal` wrapper div is always rendered as a portal
      // mount point. Use the BaseModal's own testid (which only renders
      // while open) to detect the closed state.
      expect(screen.queryByTestId('base-modal')).not.toBeInTheDocument();
    });
  });

  it('navigates to horse detail page when "View Full Profile" is clicked', async () => {
    const { user } = renderPage();

    // Open the modal
    const entries = screen.getAllByTestId('leaderboard-entry');
    await user.click(entries[0]);

    await waitFor(() => {
      expect(screen.getByTestId('horse-detail-modal')).toBeInTheDocument();
    });

    const viewProfileButton = screen.getByTestId('view-full-profile-button');
    await user.click(viewProfileButton);

    expect(mockNavigate).toHaveBeenCalledWith('/horses/101');
  });
});

// ===================================================================
// 5. Pagination Tests (2 tests)
// ===================================================================

describe('Pagination', () => {
  it('calls updatePage when next page button is clicked', async () => {
    const { user } = renderPage();

    const nextButton = screen.getByTestId('pagination-next');
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockUseLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });
  });

  it('calls updatePage when previous page button is clicked', async () => {
    // Override mock to return currentPage=3 so the prev button is enabled
    mockUseLeaderboard.mockReturnValue({
      data: { ...mockLeaderboardData, currentPage: 3, totalPages: 26 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const { user } = renderPage('/leaderboards?page=3');

    const prevButton = screen.getByTestId('pagination-prev');
    await user.click(prevButton);

    await waitFor(() => {
      expect(mockUseLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });
  });
});

// ===================================================================
// 6. Accessibility Tests (2 tests)
// ===================================================================

describe('Accessibility', () => {
  it('renders top-level page structure with sections', () => {
    renderPage();

    // The page no longer wraps content in a <main> element. It uses
    // sections with aria-label instead. Verify those structural landmarks.
    expect(screen.getByRole('region', { name: /your rankings/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /leaderboard filters/i })).toBeInTheDocument();
  });

  it('has headings in correct hierarchy (h1 for title, h2 for sections)', () => {
    renderPage();

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Leaderboards');

    // The UserRankDashboard section should have an h2
    const h2Elements = screen.getAllByRole('heading', { level: 2 });
    expect(h2Elements.length).toBeGreaterThanOrEqual(1);
  });
});
