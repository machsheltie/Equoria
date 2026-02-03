/**
 * Tests for TrainingDashboard Component
 *
 * Tests cover:
 * - Rendering (dashboard title, filter, horse cards, section headers)
 * - Horse grouping (ready, cooldown, ineligible)
 * - Filtering functionality
 * - Quick action buttons
 * - Loading states
 * - Error states
 * - Empty states
 * - Accessibility
 * - Interactions
 *
 * Story 4-2: Training Eligibility Display - Task 3
 *
 * Target: 35+ tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from '../../../test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TrainingDashboard from '../TrainingDashboard';

// ==================== MOCK DATA ====================

// Ready horse (eligible, no cooldown, age 3-20)
const mockReadyHorse = {
  id: 1,
  name: 'Thunder',
  level: 5,
  breed: 'Arabian',
  ageYears: 5,
  bestDisciplines: ['dressage', 'racing'],
  nextEligibleAt: null,
};

// Second ready horse
const mockReadyHorse2 = {
  id: 2,
  name: 'Lightning',
  level: 8,
  breed: 'Thoroughbred',
  ageYears: 7,
  bestDisciplines: ['show_jumping'],
  nextEligibleAt: null,
};

// Horse on cooldown
const mockCooldownHorse = {
  id: 3,
  name: 'Storm',
  level: 3,
  breed: 'Mustang',
  ageYears: 6,
  bestDisciplines: ['barrel_racing'],
  nextEligibleAt: '2026-02-05T00:00:00Z',
};

// Second cooldown horse
const mockCooldownHorse2 = {
  id: 4,
  name: 'Blaze',
  level: 4,
  breed: 'Quarter Horse',
  ageYears: 8,
  bestDisciplines: ['reining'],
  nextEligibleAt: '2026-02-10T00:00:00Z',
};

// Too young horse (age < 3)
const mockTooYoungHorse = {
  id: 5,
  name: 'Foal',
  level: 1,
  breed: 'Friesian',
  ageYears: 2,
  bestDisciplines: [],
  nextEligibleAt: null,
};

// Too old horse (age > 20) - Note: canTrain checks age < 3, so this is ready
// For testing ineligible, we use age 0-2
const mockTooYoungHorse2 = {
  id: 6,
  name: 'Newborn',
  level: 0,
  breed: 'Welsh Pony',
  ageYears: 0,
  bestDisciplines: [],
  nextEligibleAt: null,
};

// Mixed horses array for comprehensive testing
const mockMixedHorses = [
  mockReadyHorse,
  mockReadyHorse2,
  mockCooldownHorse,
  mockCooldownHorse2,
  mockTooYoungHorse,
  mockTooYoungHorse2,
];

// ==================== MOCKS ====================

const mockRefetch = vi.fn();

// Mock useTrainableHorses hook
const mockUseTrainableHorses = vi.fn();

// Mock useProfile hook
const mockUseProfile = vi.fn(() => ({
  data: { user: { id: 'test-user-123' } },
  isLoading: false,
  isError: false,
}));

// Mock useNavigate
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/api/useTraining', () => ({
  useTrainableHorses: () => mockUseTrainableHorses(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useProfile: () => mockUseProfile(),
}));

// Mock child components for isolation
vi.mock('../TrainingSessionModal', () => ({
  default: function MockTrainingSessionModal({
    horse,
    onClose,
    onCompleted,
  }: {
    horse: { name: string };
    onClose: () => void;
    onCompleted?: () => void;
  }) {
    return (
      <div data-testid="training-modal">
        <span>Training Modal for {horse.name}</span>
        <button onClick={onClose}>Close Modal</button>
        <button onClick={onCompleted}>Complete Training</button>
      </div>
    );
  },
}));

vi.mock('../TrainingHistoryPanel', () => ({
  default: function MockTrainingHistoryPanel({ horseId }: { horseId?: number }) {
    return <div data-testid="training-history">History Panel for horse {horseId ?? 'none'}</div>;
  },
}));

// ==================== TEST UTILITIES ====================

/**
 * Wrapper component with all providers
 */
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

/**
 * Render helper with providers
 */
const renderDashboard = (props = {}) => {
  return render(<TrainingDashboard userId="test-user-123" {...props} />, {
    wrapper: createWrapper(),
  });
};

// ==================== TESTS ====================

describe('TrainingDashboard', () => {
  const mockCurrentDate = new Date('2026-01-30T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockCurrentDate);
    vi.clearAllMocks();
    mockRefetch.mockClear();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==================== RENDERING TESTS ====================
  describe('Rendering', () => {
    beforeEach(() => {
      mockUseTrainableHorses.mockReturnValue({
        data: mockMixedHorses,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it('should render dashboard title', () => {
      renderDashboard();
      expect(screen.getByText('Training Dashboard')).toBeInTheDocument();
    });

    it('should render dashboard description', () => {
      renderDashboard();
      expect(screen.getByText(/Track readiness, start sessions/i)).toBeInTheDocument();
    });

    it('should render EligibilityFilter component', () => {
      renderDashboard();
      expect(screen.getByTestId('eligibility-filter')).toBeInTheDocument();
    });

    it('should render Refresh button', () => {
      renderDashboard();
      expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
    });

    it('should display horse cards when horses exist', () => {
      renderDashboard();
      expect(screen.getByText('Thunder')).toBeInTheDocument();
      expect(screen.getByText('Lightning')).toBeInTheDocument();
      expect(screen.getByText('Storm')).toBeInTheDocument();
    });

    it('should render section headers with counts when filter is all', () => {
      renderDashboard();
      expect(screen.getByText(/Ready to Train \(2\)/)).toBeInTheDocument();
      expect(screen.getByText(/On Cooldown \(2\)/)).toBeInTheDocument();
      expect(screen.getByText(/Ineligible \(2\)/)).toBeInTheDocument();
    });
  });

  // ==================== HORSE GROUPING TESTS ====================
  describe('Horse Grouping', () => {
    beforeEach(() => {
      mockUseTrainableHorses.mockReturnValue({
        data: mockMixedHorses,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it('should group horses into ready category correctly', () => {
      renderDashboard();
      const readySection = screen.getByTestId('section-ready');
      expect(within(readySection).getByText('Thunder')).toBeInTheDocument();
      expect(within(readySection).getByText('Lightning')).toBeInTheDocument();
    });

    it('should group horses into cooldown category correctly', () => {
      renderDashboard();
      const cooldownSection = screen.getByTestId('section-cooldown');
      expect(within(cooldownSection).getByText('Storm')).toBeInTheDocument();
      expect(within(cooldownSection).getByText('Blaze')).toBeInTheDocument();
    });

    it('should group horses into ineligible category correctly', () => {
      renderDashboard();
      const ineligibleSection = screen.getByTestId('section-ineligible');
      expect(within(ineligibleSection).getByText('Foal')).toBeInTheDocument();
      expect(within(ineligibleSection).getByText('Newborn')).toBeInTheDocument();
    });

    it('should show correct counts in section headers', () => {
      renderDashboard();
      expect(screen.getByText(/Ready to Train \(2\)/)).toBeInTheDocument();
      expect(screen.getByText(/On Cooldown \(2\)/)).toBeInTheDocument();
      expect(screen.getByText(/Ineligible \(2\)/)).toBeInTheDocument();
    });

    it('should not display empty sections', () => {
      mockUseTrainableHorses.mockReturnValue({
        data: [mockReadyHorse, mockReadyHorse2], // Only ready horses
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      renderDashboard();
      expect(screen.getByTestId('section-ready')).toBeInTheDocument();
      expect(screen.queryByTestId('section-cooldown')).not.toBeInTheDocument();
      expect(screen.queryByTestId('section-ineligible')).not.toBeInTheDocument();
    });

    it('should display all sections when horses in each category', () => {
      renderDashboard();
      expect(screen.getByTestId('section-ready')).toBeInTheDocument();
      expect(screen.getByTestId('section-cooldown')).toBeInTheDocument();
      expect(screen.getByTestId('section-ineligible')).toBeInTheDocument();
    });
  });

  // ==================== FILTERING TESTS ====================
  describe('Filtering', () => {
    beforeEach(() => {
      mockUseTrainableHorses.mockReturnValue({
        data: mockMixedHorses,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it('should show all horses and sections when "all" filter selected', () => {
      renderDashboard();
      expect(screen.getByText('Thunder')).toBeInTheDocument();
      expect(screen.getByText('Storm')).toBeInTheDocument();
      expect(screen.getByText('Foal')).toBeInTheDocument();
      expect(screen.getByTestId('section-ready')).toBeInTheDocument();
      expect(screen.getByTestId('section-cooldown')).toBeInTheDocument();
      expect(screen.getByTestId('section-ineligible')).toBeInTheDocument();
    });

    it('should show only ready horses when "ready" filter selected', async () => {
      renderDashboard();
      const readyButton = screen.getByTestId('filter-ready');
      fireEvent.click(readyButton);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
        expect(screen.getByText('Lightning')).toBeInTheDocument();
        expect(screen.queryByText('Storm')).not.toBeInTheDocument();
        expect(screen.queryByText('Foal')).not.toBeInTheDocument();
      });
    });

    it('should show only cooldown horses when "cooldown" filter selected', async () => {
      renderDashboard();
      const cooldownButton = screen.getByTestId('filter-cooldown');
      fireEvent.click(cooldownButton);

      await waitFor(() => {
        expect(screen.queryByText('Thunder')).not.toBeInTheDocument();
        expect(screen.getByText('Storm')).toBeInTheDocument();
        expect(screen.getByText('Blaze')).toBeInTheDocument();
        expect(screen.queryByText('Foal')).not.toBeInTheDocument();
      });
    });

    it('should show only ineligible horses when "ineligible" filter selected', async () => {
      renderDashboard();
      const ineligibleButton = screen.getByTestId('filter-ineligible');
      fireEvent.click(ineligibleButton);

      await waitFor(() => {
        expect(screen.queryByText('Thunder')).not.toBeInTheDocument();
        expect(screen.queryByText('Storm')).not.toBeInTheDocument();
        expect(screen.getByText('Foal')).toBeInTheDocument();
        expect(screen.getByText('Newborn')).toBeInTheDocument();
      });
    });

    it('should update displayed horses when filter changes', async () => {
      renderDashboard();

      // Start with all
      expect(screen.getByText('Thunder')).toBeInTheDocument();
      expect(screen.getByText('Storm')).toBeInTheDocument();

      // Filter to ready
      fireEvent.click(screen.getByTestId('filter-ready'));
      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
        expect(screen.queryByText('Storm')).not.toBeInTheDocument();
      });

      // Filter to cooldown
      fireEvent.click(screen.getByTestId('filter-cooldown'));
      await waitFor(() => {
        expect(screen.queryByText('Thunder')).not.toBeInTheDocument();
        expect(screen.getByText('Storm')).toBeInTheDocument();
      });
    });

    it('should show grouped sections only for "all" filter', async () => {
      renderDashboard();

      // All filter shows grouped sections
      expect(screen.getByTestId('section-ready')).toBeInTheDocument();
      expect(screen.getByTestId('section-cooldown')).toBeInTheDocument();

      // Ready filter shows flat grid
      fireEvent.click(screen.getByTestId('filter-ready'));
      await waitFor(() => {
        expect(screen.queryByTestId('section-ready')).not.toBeInTheDocument();
        expect(screen.getByTestId('filtered-grid')).toBeInTheDocument();
      });
    });
  });

  // ==================== QUICK ACTION BUTTON TESTS ====================
  describe('Quick Action Buttons', () => {
    beforeEach(() => {
      mockUseTrainableHorses.mockReturnValue({
        data: mockMixedHorses,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it('should show "Train" button for eligible horses', () => {
      renderDashboard();
      expect(screen.getByTestId('train-button-1')).toBeInTheDocument(); // Thunder
      expect(screen.getByTestId('train-button-2')).toBeInTheDocument(); // Lightning
    });

    it('should not show "Train" button for cooldown horses', () => {
      renderDashboard();
      expect(screen.queryByTestId('train-button-3')).not.toBeInTheDocument(); // Storm
      expect(screen.queryByTestId('train-button-4')).not.toBeInTheDocument(); // Blaze
    });

    it('should not show "Train" button for ineligible horses', () => {
      renderDashboard();
      expect(screen.queryByTestId('train-button-5')).not.toBeInTheDocument(); // Foal
      expect(screen.queryByTestId('train-button-6')).not.toBeInTheDocument(); // Newborn
    });

    it('should open training modal when "Train" button clicked', async () => {
      renderDashboard();
      const trainButton = screen.getByTestId('train-button-1');
      fireEvent.click(trainButton);

      await waitFor(() => {
        expect(screen.getByTestId('training-modal')).toBeInTheDocument();
        expect(screen.getByText(/Training Modal for Thunder/)).toBeInTheDocument();
      });
    });

    it('should close modal when close button clicked', async () => {
      renderDashboard();
      fireEvent.click(screen.getByTestId('train-button-1'));

      await waitFor(() => {
        expect(screen.getByTestId('training-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Close Modal/i }));

      await waitFor(() => {
        expect(screen.queryByTestId('training-modal')).not.toBeInTheDocument();
      });
    });
  });

  // ==================== LOADING STATE TESTS ====================
  describe('Loading States', () => {
    it('should show loading message when isLoading is true', () => {
      mockUseTrainableHorses.mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      renderDashboard();
      expect(screen.getByText(/Loading trainable horses/i)).toBeInTheDocument();
    });

    it('should not show horses when loading', () => {
      mockUseTrainableHorses.mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      renderDashboard();
      expect(screen.queryByText('Thunder')).not.toBeInTheDocument();
      expect(screen.queryByTestId('section-ready')).not.toBeInTheDocument();
    });

    it('should have accessible loading state', () => {
      mockUseTrainableHorses.mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      renderDashboard();
      const loadingElement = screen.getByTestId('loading-state');
      expect(loadingElement).toHaveAttribute('role', 'status');
      expect(loadingElement).toHaveAttribute('aria-label', 'Loading horses');
    });
  });

  // ==================== ERROR STATE TESTS ====================
  describe('Error States', () => {
    it('should show error message when isError is true', () => {
      mockUseTrainableHorses.mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: { message: 'Failed to fetch horses' },
        refetch: mockRefetch,
      });

      renderDashboard();
      expect(screen.getByText(/Error loading horses/i)).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch horses/i)).toBeInTheDocument();
    });

    it('should display error details from error object', () => {
      mockUseTrainableHorses.mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: { message: 'Network timeout' },
        refetch: mockRefetch,
      });

      renderDashboard();
      expect(screen.getByText(/Network timeout/i)).toBeInTheDocument();
    });

    it('should have accessible error state', () => {
      mockUseTrainableHorses.mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: { message: 'API Error' },
        refetch: mockRefetch,
      });

      renderDashboard();
      const errorElement = screen.getByTestId('error-state');
      expect(errorElement).toHaveAttribute('role', 'alert');
    });
  });

  // ==================== EMPTY STATE TESTS ====================
  describe('Empty States', () => {
    it('should show empty message when no horses', () => {
      mockUseTrainableHorses.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      renderDashboard();
      expect(screen.getByText(/No trainable horses found/i)).toBeInTheDocument();
    });

    it('should have user-friendly empty message', () => {
      mockUseTrainableHorses.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      renderDashboard();
      expect(screen.getByText(/Add horses to start training/i)).toBeInTheDocument();
    });

    it('should show empty filtered message when filter has no results', async () => {
      mockUseTrainableHorses.mockReturnValue({
        data: [mockCooldownHorse], // Only cooldown horse
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      renderDashboard();
      fireEvent.click(screen.getByTestId('filter-ready'));

      await waitFor(() => {
        expect(screen.getByText(/No ready horses found/i)).toBeInTheDocument();
      });
    });
  });

  // ==================== ACCESSIBILITY TESTS ====================
  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseTrainableHorses.mockReturnValue({
        data: mockMixedHorses,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it('should use semantic h3 for section headers', () => {
      renderDashboard();
      const headers = screen.getAllByRole('heading', { level: 3 });
      expect(headers.length).toBeGreaterThanOrEqual(3);
    });

    it('should render horse cards with accessible structure', () => {
      renderDashboard();
      const horseCard = screen.getByTestId('horse-card-1');
      expect(horseCard).toBeInTheDocument();
      expect(within(horseCard).getByText('Thunder')).toBeInTheDocument();
    });

    it('should have accessible Train buttons', () => {
      renderDashboard();
      const trainButton = screen.getByTestId('train-button-1');
      expect(trainButton.tagName.toLowerCase()).toBe('button');
      expect(trainButton).toHaveAttribute('type', 'button');
    });
  });

  // ==================== INTERACTION TESTS ====================
  describe('Interactions', () => {
    beforeEach(() => {
      mockUseTrainableHorses.mockReturnValue({
        data: mockMixedHorses,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it('should call refetch when Refresh button clicked', () => {
      renderDashboard();
      const refreshButton = screen.getByRole('button', { name: /Refresh/i });
      fireEvent.click(refreshButton);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('should render training history panel', () => {
      renderDashboard();
      expect(screen.getByTestId('training-history')).toBeInTheDocument();
    });

    it('should pass selected horse to history panel when modal open', async () => {
      renderDashboard();
      fireEvent.click(screen.getByTestId('train-button-1'));

      await waitFor(() => {
        expect(screen.getByText(/History Panel for horse 1/)).toBeInTheDocument();
      });
    });

    it('should show eligibility indicator in horse cards', () => {
      renderDashboard();
      // EligibilityIndicator should be rendered for each horse
      const indicators = screen.getAllByTestId('eligibility-indicator');
      expect(indicators.length).toBe(6); // All 6 horses
    });
  });

  // ==================== HORSE CARD TESTS ====================
  describe('Horse Card Display', () => {
    beforeEach(() => {
      mockUseTrainableHorses.mockReturnValue({
        data: mockMixedHorses,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it('should display horse name in card', () => {
      renderDashboard();
      expect(screen.getByText('Thunder')).toBeInTheDocument();
    });

    it('should display horse age in card', () => {
      renderDashboard();
      expect(screen.getAllByText(/Age: 5 years/i).length).toBeGreaterThan(0);
    });

    it('should display horse level when available', () => {
      renderDashboard();
      expect(screen.getByText('Level 5')).toBeInTheDocument();
    });

    it('should display horse breed when available', () => {
      renderDashboard();
      expect(screen.getByText('Arabian')).toBeInTheDocument();
    });

    it('should display best disciplines when available', () => {
      renderDashboard();
      expect(screen.getAllByText(/dressage, racing/i).length).toBeGreaterThan(0);
    });
  });

  // ==================== FILTER COUNT TESTS ====================
  describe('Filter Counts', () => {
    it('should show correct filter counts', () => {
      mockUseTrainableHorses.mockReturnValue({
        data: mockMixedHorses,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      renderDashboard();

      // Check that filter counts are displayed
      expect(screen.getByTestId('count-all')).toHaveTextContent('(6)');
      expect(screen.getByTestId('count-ready')).toHaveTextContent('(2)');
      expect(screen.getByTestId('count-cooldown')).toHaveTextContent('(2)');
      expect(screen.getByTestId('count-ineligible')).toHaveTextContent('(2)');
    });
  });
});
