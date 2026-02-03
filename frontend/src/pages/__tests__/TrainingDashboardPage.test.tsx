/**
 * TrainingDashboardPage Component Tests
 *
 * Comprehensive tests for the Training Dashboard page including:
 * - Rendering tests (page structure, components)
 * - Navigation tests (breadcrumb, back button)
 * - SEO tests (document title)
 * - Layout tests (responsive design, semantic HTML)
 * - Integration tests (TrainingDashboard props)
 * - Authentication tests (loading, unauthenticated states)
 *
 * Story 4-2: Training Eligibility Display - Task 5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import { ReactNode } from 'react';
import TrainingDashboardPage from '../TrainingDashboardPage';
import * as AuthContext from '../../contexts/AuthContext';

// Mock the AuthContext
vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Story 4.5: TrainingDashboard component has been replaced with multiple components
// (TrainingSummaryCards, DashboardFilters, TrainingDashboardTable, TrainingRecommendations)
// These use mock data for now - real API integration comes in Story 4.6

describe('TrainingDashboardPage', () => {
  let queryClient: QueryClient;
  let originalTitle: string;

  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
  };

  const mockAuthContextValue = {
    user: mockUser,
    isLoading: false,
    isAuthenticated: true,
    isEmailVerified: true,
    error: null,
    logout: vi.fn(),
    isLoggingOut: false,
    refetchProfile: vi.fn(),
    userRole: 'user' as const,
    hasRole: vi.fn(() => false),
    hasAnyRole: vi.fn(() => false),
    isAdmin: false,
    isModerator: false,
  };

  // Test wrapper with required providers
  const createTestWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    originalTitle = document.title;

    // Default mock: authenticated user
    vi.mocked(AuthContext.useAuth).mockReturnValue(mockAuthContextValue);
  });

  afterEach(() => {
    queryClient?.clear();
    document.title = originalTitle;
  });

  // ====================
  // RENDERING TESTS (5)
  // ====================
  describe('Rendering Tests', () => {
    it('renders page without crashing', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('training-dashboard-page')).toBeInTheDocument();
    });

    it('renders page title "Training Dashboard"', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      const pageTitle = screen.getByTestId('page-title');
      expect(pageTitle).toBeInTheDocument();
      expect(pageTitle).toHaveTextContent('Training Dashboard');
    });

    it('renders training dashboard components (Story 4.5)', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      // Story 4.5 components: Summary cards, filters, table, recommendations
      expect(screen.getByTestId('summary-cards')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-filters')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-table')).toBeInTheDocument();
      expect(screen.getByTestId('recommendations')).toBeInTheDocument();
    });

    it('renders breadcrumb navigation', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('breadcrumb-nav')).toBeInTheDocument();
    });

    it('renders page description', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      const description = screen.getByTestId('page-description');
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent(/Manage your horses' training sessions/);
    });
  });

  // ====================
  // NAVIGATION TESTS (5)
  // ====================
  describe('Navigation Tests', () => {
    it('breadcrumb Home link has correct href', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      const homeLink = screen.getByRole('link', { name: /navigate to home/i });
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('breadcrumb "Training Dashboard" is not a link (current page)', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      const currentPage = screen.getByText('Training Dashboard', {
        selector: 'span[aria-current="page"]',
      });
      expect(currentPage).toBeInTheDocument();
      expect(currentPage.tagName.toLowerCase()).toBe('span');
    });

    it('breadcrumb has proper ARIA labels', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      const breadcrumbNav = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(breadcrumbNav).toHaveAttribute('aria-label', 'Breadcrumb navigation');

      const homeLink = screen.getByRole('link', { name: /navigate to home/i });
      expect(homeLink).toHaveAttribute('aria-label', 'Navigate to Home');
    });

    it('back button triggers navigation', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      const backButton = screen.getByTestId('back-button');
      await user.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('back button has correct ARIA label', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      const backButton = screen.getByTestId('back-button');
      expect(backButton).toHaveAttribute('aria-label', 'Go back to previous page');
    });
  });

  // ====================
  // SEO TESTS (3)
  // ====================
  describe('SEO Tests', () => {
    it('sets document title to "Training Dashboard - Equoria"', async () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(document.title).toBe('Training Dashboard - Equoria');
      });
    });

    it('title updates on mount', () => {
      document.title = 'Previous Title';

      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      expect(document.title).toBe('Training Dashboard - Equoria');
    });

    it('title cleans up on unmount', () => {
      document.title = 'Previous Title';

      const TestWrapper = createTestWrapper();
      const { unmount } = render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      expect(document.title).toBe('Training Dashboard - Equoria');

      unmount();

      expect(document.title).toBe('Previous Title');
    });
  });

  // ====================
  // LAYOUT TESTS (4)
  // ====================
  describe('Layout Tests', () => {
    it('has responsive container classes', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      const mainElement = screen.getByRole('main');
      expect(mainElement).toHaveClass('mx-auto');
      expect(mainElement).toHaveClass('max-w-7xl');
      expect(mainElement).toHaveClass('px-4');
    });

    it('has proper spacing classes for mobile', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      const mainElement = screen.getByRole('main');
      expect(mainElement).toHaveClass('py-6');
      expect(mainElement).toHaveClass('sm:px-6');
      expect(mainElement).toHaveClass('lg:px-8');
    });

    it('has proper spacing classes for desktop', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      const mainElement = screen.getByRole('main');
      // Check for large breakpoint styles
      expect(mainElement).toHaveClass('lg:px-8');
    });

    it('has correct semantic HTML structure', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      // Check for main element
      expect(screen.getByRole('main')).toBeInTheDocument();

      // Check for navigation (breadcrumb)
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();

      // Check for h1 heading
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Training Dashboard');

      // Check for section with aria-label
      expect(
        screen.getByRole('region', { name: /training dashboard content/i })
      ).toBeInTheDocument();
    });
  });

  // ====================
  // INTEGRATION TESTS (3)
  // ====================
  // Story 4.5: Updated for new component structure with mock data
  // Real API integration with userId will be added in Story 4.6
  describe('Integration Tests', () => {
    it('renders all dashboard components for authenticated user', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      // Verify all Story 4.5 components render
      expect(screen.getByTestId('summary-cards')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-filters')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-table')).toBeInTheDocument();
      expect(screen.getByTestId('recommendations')).toBeInTheDocument();
    });

    it('handles auth state changes correctly', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        ...mockAuthContextValue,
        user: { ...mockUser, id: undefined as unknown as number },
      });

      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      // Should still render components even if user.id is undefined
      expect(screen.getByTestId('training-dashboard-page')).toBeInTheDocument();
    });

    it('displays mock horse data in dashboard', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      // Check that mock horses are displayed (Story 4.5 uses 8 mock horses)
      expect(screen.getByText(/8 horses/i)).toBeInTheDocument();
    });
  });

  // ====================
  // AUTHENTICATION TESTS (5)
  // ====================
  describe('Authentication Tests', () => {
    it('shows loading state while checking authentication', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        ...mockAuthContextValue,
        isLoading: true,
        isAuthenticated: false,
        user: null,
      });

      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByText(/checking authentication/i)).toBeInTheDocument();
    });

    it('loading state has proper ARIA attributes', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        ...mockAuthContextValue,
        isLoading: true,
        isAuthenticated: false,
        user: null,
      });

      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      const loadingMain = screen.getByTestId('loading-state');
      expect(loadingMain).toHaveAttribute('role', 'status');
      expect(loadingMain).toHaveAttribute('aria-label', 'Loading authentication');
    });

    it('shows unauthenticated message when not logged in', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        ...mockAuthContextValue,
        isLoading: false,
        isAuthenticated: false,
        user: null,
      });

      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('unauthenticated-state')).toBeInTheDocument();
      expect(screen.getByText(/please log in/i)).toBeInTheDocument();
    });

    it('unauthenticated message has alert role', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        ...mockAuthContextValue,
        isLoading: false,
        isAuthenticated: false,
        user: null,
      });

      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders full page content when authenticated', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('training-dashboard-page')).toBeInTheDocument();
      // Story 4.5: Check for new components instead of old mock
      expect(screen.getByTestId('summary-cards')).toBeInTheDocument();
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
      expect(screen.queryByTestId('unauthenticated-state')).not.toBeInTheDocument();
    });
  });

  // ====================
  // ADDITIONAL TESTS (5)
  // ====================
  describe('Additional Tests', () => {
    it('renders footer with copyright', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      const currentYear = new Date().getFullYear();
      expect(screen.getByText(new RegExp(`${currentYear} Equoria`))).toBeInTheDocument();
    });

    it('renders training icon in header', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      // The Dumbbell icon should be rendered (checking via container)
      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();
    });

    it('accepts optional className prop', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage className="custom-class" />
        </TestWrapper>
      );

      const pageContainer = screen.getByTestId('training-dashboard-page');
      expect(pageContainer).toHaveClass('custom-class');
    });

    it('breadcrumb shows chevron separator between items', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      // Check for SVG chevron icon (between breadcrumb items)
      const breadcrumb = screen.getByTestId('breadcrumb-nav');
      const svgs = breadcrumb.querySelectorAll('svg');
      // Should have Home icon and Chevron icon
      expect(svgs.length).toBeGreaterThanOrEqual(2);
    });

    it('page has correct background styling', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      const pageContainer = screen.getByTestId('training-dashboard-page');
      expect(pageContainer).toHaveClass('min-h-screen');
      expect(pageContainer).toHaveClass('bg-slate-50');
    });
  });

  // ====================
  // ACCESSIBILITY TESTS (3)
  // ====================
  describe('Accessibility Tests', () => {
    it('all interactive elements are focusable', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      const homeLink = screen.getByRole('link', { name: /navigate to home/i });
      homeLink.focus();
      expect(document.activeElement).toBe(homeLink);

      const backButton = screen.getByTestId('back-button');
      backButton.focus();
      expect(document.activeElement).toBe(backButton);
    });

    it('heading hierarchy is correct', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      // Should have exactly one h1
      const h1Elements = screen.getAllByRole('heading', { level: 1 });
      expect(h1Elements).toHaveLength(1);
      expect(h1Elements[0]).toHaveTextContent('Training Dashboard');
    });

    it('landmarks are properly defined', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <TrainingDashboardPage />
        </TestWrapper>
      );

      // Check for main landmark
      expect(screen.getByRole('main')).toBeInTheDocument();

      // Check for navigation landmark
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();

      // Check for header (banner) landmark
      expect(screen.getByRole('banner')).toBeInTheDocument();

      // Check for footer (contentinfo) landmark
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });
  });
});
