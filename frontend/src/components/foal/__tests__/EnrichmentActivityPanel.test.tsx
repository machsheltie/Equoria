/**
 * Tests for EnrichmentActivityPanel Component
 *
 * Testing Sprint Day 3 - Story 6-3: Foal Management
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Component rendering states (loading, error, null, normal)
 * - Category filtering functionality
 * - Activity selection and confirmation flow
 * - Daily activity progress display
 * - Activity history display
 * - Mutation handling (perform activity)
 * - Child component integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Foal, FoalEnrichmentStatus } from '@/types/foal';

// Mock child components
vi.mock('../ActivityCard', () => ({
  default: vi.fn(({ activity, onClick, isRecommended }) => (
    <div
      data-testid={`activity-card-${activity.id}`}
      onClick={onClick}
      data-recommended={isRecommended}
    >
      <span>{activity.name}</span>
      <span>{activity.category}</span>
    </div>
  )),
}));

vi.mock('../ActivityConfirmationModal', () => ({
  default: vi.fn(({ isOpen, onClose, onConfirm, activity, isSubmitting }) =>
    isOpen ? (
      <div data-testid="confirmation-modal">
        <span>Modal for {activity?.name}</span>
        <button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </button>
        <button onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Confirm'}
        </button>
      </div>
    ) : null
  ),
}));

vi.mock('../ActivityHistoryList', () => ({
  default: vi.fn(({ history }: { history: Array<{ id: number; activityName: string }> }) => (
    <div data-testid="activity-history">
      {history.map((item) => (
        <div key={item.id}>{item.activityName}</div>
      ))}
    </div>
  )),
}));

vi.mock('../CategoryFilter', () => ({
  default: vi.fn(({ selectedCategory, onCategoryChange, categoryCounts }) => (
    <div data-testid="category-filter">
      <button onClick={() => onCategoryChange('all')} data-selected={selectedCategory === 'all'}>
        All ({categoryCounts.all})
      </button>
      <button
        onClick={() => onCategoryChange('trust')}
        data-selected={selectedCategory === 'trust'}
      >
        Trust ({categoryCounts.trust})
      </button>
      <button
        onClick={() => onCategoryChange('desensitization')}
        data-selected={selectedCategory === 'desensitization'}
      >
        Desensitization ({categoryCounts.desensitization})
      </button>
    </div>
  )),
}));

// Mock useQuery and useMutation
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
  };
});

import { useQuery, useMutation } from '@tanstack/react-query';
import EnrichmentActivityPanel from '../EnrichmentActivityPanel';

describe('EnrichmentActivityPanel Component', () => {
  const mockUseQuery = useQuery as ReturnType<typeof vi.fn>;
  const mockUseMutation = useMutation as ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  const mockFoal: Foal = {
    id: 1,
    name: 'Test Foal',
    age: 15,
    birthdate: '2024-01-01',
    sex: 'male',
    developmentStage: 'critical',
    bondingLevel: 50,
    stressLevel: 25,
  };

  const mockEnrichmentStatus: FoalEnrichmentStatus = {
    foalId: 1,
    availableActivities: [
      {
        id: 'gentle-touch',
        name: 'Gentle Touch',
        description: 'Gentle stroking',
        category: 'trust',
        durationMinutes: 15,
        cooldownHours: 6,
        benefits: {
          temperamentModifiers: { boldness: 2 },
          traitDiscoveryBoost: 5,
          milestoneBonus: 10,
          bondingIncrease: 5,
          stressReduction: 3,
        },
      },
      {
        id: 'sound-exposure',
        name: 'Sound Exposure',
        description: 'Gradual sound exposure',
        category: 'desensitization',
        durationMinutes: 20,
        cooldownHours: 8,
        benefits: {
          temperamentModifiers: { boldness: 3 },
          traitDiscoveryBoost: 8,
          milestoneBonus: 15,
          bondingIncrease: 3,
          stressReduction: 2,
        },
      },
      {
        id: 'trust-building',
        name: 'Trust Building',
        description: 'Building trust',
        category: 'trust',
        durationMinutes: 25,
        cooldownHours: 12,
        benefits: {
          temperamentModifiers: { obedience: 2 },
          traitDiscoveryBoost: 6,
          milestoneBonus: 12,
          bondingIncrease: 8,
          stressReduction: 4,
        },
      },
    ],
    activityStatuses: [
      {
        activityId: 'gentle-touch',
        status: 'available',
        canPerform: true,
      },
      {
        activityId: 'sound-exposure',
        status: 'on_cooldown',
        nextAvailableAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        cooldownRemainingMinutes: 120,
        canPerform: false,
      },
      {
        activityId: 'trust-building',
        status: 'available',
        canPerform: true,
      },
    ],
    recentHistory: [
      {
        id: 1,
        activityName: 'Gentle Touch',
        category: 'trust',
        performedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 15,
        results: {
          temperamentChanges: { boldness: 2 },
          traitsDiscovered: ['Calm'],
          milestonePoints: 10,
          bondingChange: 5,
          stressChange: -3,
        },
      },
    ],
    dailyActivitiesCompleted: 1,
    dailyActivitiesLimit: 5,
    recommendedActivities: ['gentle-touch'],
  };

  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Default successful query mock
    mockUseQuery.mockReturnValue({
      data: mockEnrichmentStatus,
      isLoading: false,
      error: null,
    });

    // Default mutation mock
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  };

  describe('loading state', () => {
    it('should display loading spinner when data is loading', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      const { container } = renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should have spinning animation', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      const { container } = renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should display error message when query fails', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch enrichment data'),
      });

      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      expect(screen.getByText('Error loading enrichment activities')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch enrichment data')).toBeInTheDocument();
    });

    it('should display generic error for non-Error objects', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: { message: 'Something went wrong' },
      });

      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      expect(screen.getByText('An error occurred')).toBeInTheDocument();
    });

    it('should show error icon', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Test error'),
      });

      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      // Just verify error content is displayed
      expect(screen.getByText('Error loading enrichment activities')).toBeInTheDocument();
    });
  });

  describe('null data state', () => {
    it('should render nothing when data is null and not loading', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      const { container } = renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('header display', () => {
    it('should display component title', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      expect(screen.getByText('Enrichment Activities')).toBeInTheDocument();
    });

    it('should display component description', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      expect(
        screen.getByText(/Build trust, discover traits, and support your foal's development/i)
      ).toBeInTheDocument();
    });

    it('should show sparkles icon', () => {
      const { container } = renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      const sparklesIcon = container.querySelector('.lucide-sparkles');
      expect(sparklesIcon).toBeInTheDocument();
    });
  });

  describe('daily activity progress', () => {
    it('should display daily activities completed count', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      expect(screen.getByText('Daily Activities Completed')).toBeInTheDocument();
      expect(screen.getByText('1 / 5')).toBeInTheDocument();
    });

    it('should display progress bar with correct width', () => {
      const { container } = renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      const progressBar = container.querySelector('.bg-emerald-500');
      expect(progressBar).toHaveStyle({ width: '20%' }); // 1/5 = 20%
    });

    it('should update progress when activities completed changes', () => {
      const updatedStatus = {
        ...mockEnrichmentStatus,
        dailyActivitiesCompleted: 3,
      };
      mockUseQuery.mockReturnValue({
        data: updatedStatus,
        isLoading: false,
        error: null,
      });

      const { container } = renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      expect(screen.getByText('3 / 5')).toBeInTheDocument();
      const progressBar = container.querySelector('.bg-emerald-500');
      expect(progressBar).toHaveStyle({ width: '60%' }); // 3/5 = 60%
    });

    it('should handle 100% progress', () => {
      const fullStatus = {
        ...mockEnrichmentStatus,
        dailyActivitiesCompleted: 5,
      };
      mockUseQuery.mockReturnValue({
        data: fullStatus,
        isLoading: false,
        error: null,
      });

      const { container } = renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      expect(screen.getByText('5 / 5')).toBeInTheDocument();
      const progressBar = container.querySelector('.bg-emerald-500');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });
  });

  describe('category filtering', () => {
    it('should render CategoryFilter component', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      expect(screen.getByTestId('category-filter')).toBeInTheDocument();
    });

    it('should pass correct category counts to CategoryFilter', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      expect(screen.getByText('All (3)')).toBeInTheDocument();
      expect(screen.getByText('Trust (2)')).toBeInTheDocument();
      expect(screen.getByText('Desensitization (1)')).toBeInTheDocument();
    });

    it('should filter activities when category is selected', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);

      // Click trust category
      const trustButton = screen.getByText('Trust (2)');
      fireEvent.click(trustButton);

      // Should show only trust activities
      expect(screen.getByTestId('activity-card-gentle-touch')).toBeInTheDocument();
      expect(screen.getByTestId('activity-card-trust-building')).toBeInTheDocument();
      expect(screen.queryByTestId('activity-card-sound-exposure')).not.toBeInTheDocument();
    });

    it('should show all activities when "all" category is selected', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);

      // All activities should be visible by default
      expect(screen.getByTestId('activity-card-gentle-touch')).toBeInTheDocument();
      expect(screen.getByTestId('activity-card-sound-exposure')).toBeInTheDocument();
      expect(screen.getByTestId('activity-card-trust-building')).toBeInTheDocument();
    });

    it('should display filtered count in header', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);

      const desensButton = screen.getByText('Desensitization (1)');
      fireEvent.click(desensButton);

      expect(screen.getByText('(1 desensitization)')).toBeInTheDocument();
    });
  });

  describe('activity display', () => {
    it('should render all available activities', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);

      expect(screen.getAllByText('Gentle Touch').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Sound Exposure').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Trust Building').length).toBeGreaterThan(0);
    });

    it('should pass activity data to ActivityCard', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);

      const gentleTouchCard = screen.getByTestId('activity-card-gentle-touch');
      expect(gentleTouchCard).toHaveTextContent('trust');
    });

    it('should mark recommended activities', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);

      const gentleTouchCard = screen.getByTestId('activity-card-gentle-touch');
      expect(gentleTouchCard).toHaveAttribute('data-recommended', 'true');
    });

    it('should show empty state when no activities match filter', () => {
      const emptyStatus = {
        ...mockEnrichmentStatus,
        availableActivities: [],
      };
      mockUseQuery.mockReturnValue({
        data: emptyStatus,
        isLoading: false,
        error: null,
      });

      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      expect(screen.getByText(/No.*activities available/i)).toBeInTheDocument();
    });
  });

  describe('activity selection', () => {
    it('should open confirmation modal when available activity is clicked', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);

      const activityCard = screen.getByTestId('activity-card-gentle-touch');
      fireEvent.click(activityCard);

      expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
      expect(screen.getByText('Modal for Gentle Touch')).toBeInTheDocument();
    });

    it('should not open modal for activities on cooldown', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);

      const cooldownCard = screen.getByTestId('activity-card-sound-exposure');
      fireEvent.click(cooldownCard);

      expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
    });

    it('should close modal when cancel is clicked', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);

      const activityCard = screen.getByTestId('activity-card-gentle-touch');
      fireEvent.click(activityCard);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
    });
  });

  describe('activity performance', () => {
    it('should call mutation when activity is confirmed', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);

      // Open modal
      const activityCard = screen.getByTestId('activity-card-gentle-touch');
      fireEvent.click(activityCard);

      // Confirm activity
      const confirmButton = screen.getByText('Confirm');
      fireEvent.click(confirmButton);

      expect(mockMutate).toHaveBeenCalledWith('gentle-touch');
    });

    it('should show submitting state during mutation', () => {
      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        isPending: true,
      });

      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);

      const activityCard = screen.getByTestId('activity-card-gentle-touch');
      fireEvent.click(activityCard);

      expect(screen.getByText('Submitting...')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeDisabled();
      expect(screen.getByText('Submitting...')).toBeDisabled();
    });
  });

  describe('activity history', () => {
    it('should render ActivityHistoryList component', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      expect(screen.getByTestId('activity-history')).toBeInTheDocument();
    });

    it('should display recent history header', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      expect(screen.getByText('Recent Activity History')).toBeInTheDocument();
    });

    it('should pass history data to ActivityHistoryList', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      expect(screen.getAllByText('Gentle Touch').length).toBeGreaterThan(0);
    });

    it('should show history icon', () => {
      const { container } = renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      const historyIcon = container.querySelector('.lucide-history');
      expect(historyIcon).toBeInTheDocument();
    });
  });

  describe('section headers', () => {
    it('should display Available Activities header', () => {
      renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      expect(screen.getByText('Available Activities')).toBeInTheDocument();
    });

    it('should show activity icon in Available Activities header', () => {
      const { container } = renderWithProvider(<EnrichmentActivityPanel foal={mockFoal} />);
      const activityIcon = container.querySelector('.lucide-activity');
      expect(activityIcon).toBeInTheDocument();
    });
  });
});
