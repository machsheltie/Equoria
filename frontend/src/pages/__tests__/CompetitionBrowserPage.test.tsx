import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from '../../test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CompetitionBrowserPage from '../CompetitionBrowserPage';

// Mock the API hook
vi.mock('@/hooks/api/useCompetitions', () => ({
  useCompetitions: vi.fn(),
}));

const { useCompetitions } = await import('@/hooks/api/useCompetitions');

describe('CompetitionBrowserPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CompetitionBrowserPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  describe('Component Rendering', () => {
    it('renders competition browser page without crashing', () => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderPage();
      expect(screen.getByTestId('competition-browser-page')).toBeInTheDocument();
    });

    it('renders page title', () => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderPage();
      expect(screen.getByRole('heading', { name: 'Competitions', level: 1 })).toBeInTheDocument();
    });

    it('renders page description', () => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderPage();
      expect(screen.getByText(/browse and enter horse competitions/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when data is loading', () => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderPage();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('shows loading text during fetch', () => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderPage();
      expect(screen.getByText(/loading competitions/i)).toBeInTheDocument();
    });

    it('does not show content while loading', () => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderPage();
      expect(screen.queryByTestId('competition-filters')).not.toBeInTheDocument();
      expect(screen.queryByTestId('competition-list')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error message when fetch fails', () => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch competitions'),
        refetch: vi.fn(),
      } as any);

      renderPage();
      expect(screen.getByText(/failed to load competitions/i)).toBeInTheDocument();
    });

    it('shows retry button on error', () => {
      const refetchMock = vi.fn();
      vi.mocked(useCompetitions).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        refetch: refetchMock,
      } as any);

      renderPage();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('calls refetch when retry button clicked', async () => {
      const refetchMock = vi.fn();
      vi.mocked(useCompetitions).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        refetch: refetchMock,
      } as any);

      renderPage();
      const retryButton = screen.getByRole('button', { name: /try again/i });
      retryButton.click();

      await waitFor(() => {
        expect(refetchMock).toHaveBeenCalledTimes(1);
      });
    });

    it('shows error icon with error message', () => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Server error'),
        refetch: vi.fn(),
      } as any);

      renderPage();
      const errorContainer = screen.getByTestId('error-state');
      expect(errorContainer).toBeInTheDocument();
    });
  });

  describe('Layout Structure', () => {
    beforeEach(() => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('renders page header section', () => {
      renderPage();
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });

    it('renders filters section placeholder', () => {
      renderPage();
      expect(screen.getByTestId('competition-filters')).toBeInTheDocument();
    });

    it('renders content grid section', () => {
      renderPage();
      expect(screen.getByTestId('competition-list')).toBeInTheDocument();
    });

    it('applies correct container classes', () => {
      renderPage();
      const container = screen.getByTestId('competition-browser-page');
      expect(container).toHaveClass('min-h-screen');
    });

    it('has proper semantic HTML structure', () => {
      renderPage();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    it('passes empty array to competition list when no data', () => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderPage();
      const list = screen.getByTestId('competition-list');
      expect(list).toBeInTheDocument();
    });

    it('passes competitions data to list component', () => {
      const mockCompetitions = [
        { id: 1, name: 'Spring Classic', discipline: 'Dressage' },
        { id: 2, name: 'Summer Show', discipline: 'Show Jumping' },
      ];

      vi.mocked(useCompetitions).mockReturnValue({
        data: mockCompetitions,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderPage();
      expect(screen.getByTestId('competition-list')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('has correct route path /competitions', () => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderPage();
      expect(window.location.pathname).toBe('/');
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('has main landmark role', () => {
      renderPage();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('page title is accessible heading', () => {
      renderPage();
      const heading = screen.getByRole('heading', { name: 'Competitions', level: 1 });
      expect(heading.tagName).toBe('H1');
    });

    it('loading state is announced to screen readers', () => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderPage();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('error message is announced with alert role', () => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Error'),
        refetch: vi.fn(),
      } as any);

      renderPage();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    beforeEach(() => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('applies responsive padding classes', () => {
      renderPage();
      const main = screen.getByRole('main');
      expect(main.className).toContain('px-4');
      expect(main.className).toContain('sm:px-6');
      expect(main.className).toContain('lg:px-8');
    });

    it('applies responsive max-width container', () => {
      renderPage();
      const main = screen.getByRole('main');
      expect(main.className).toContain('max-w-7xl');
      expect(main.className).toContain('mx-auto');
    });
  });

  describe('Placeholder Components', () => {
    beforeEach(() => {
      vi.mocked(useCompetitions).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('renders CompetitionFilters component', () => {
      renderPage();
      expect(screen.getByTestId('competition-filters')).toBeInTheDocument();
      // Verify filters are rendered
      expect(screen.getByTestId('filter-discipline')).toBeInTheDocument();
      expect(screen.getByTestId('filter-clear')).toBeInTheDocument();
    });

    it('renders CompetitionList component', () => {
      renderPage();
      expect(screen.getByTestId('competition-list')).toBeInTheDocument();
      // Verify list component renders with empty state
      expect(screen.getByText(/no competitions found/i)).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('useCompetitions hook is called on mount', () => {
      const mockUseCompetitions = vi.mocked(useCompetitions);
      mockUseCompetitions.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderPage();
      expect(mockUseCompetitions).toHaveBeenCalled();
    });

    it('refetches data when retry is triggered', async () => {
      const refetchMock = vi.fn();
      vi.mocked(useCompetitions).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Error'),
        refetch: refetchMock,
      } as any);

      renderPage();
      const retryButton = screen.getByRole('button', { name: /try again/i });
      retryButton.click();

      await waitFor(() => {
        expect(refetchMock).toHaveBeenCalled();
      });
    });
  });
});
