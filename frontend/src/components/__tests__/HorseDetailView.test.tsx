import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HorseDetailView from '../HorseDetailView';
import * as useHorsesHooks from '@/hooks/api/useHorses';

// Mock the hooks
vi.mock('@/hooks/api/useHorses', () => ({
  useHorse: vi.fn(),
  useHorseTrainingHistory: vi.fn(),
}));

const mockUseHorse = useHorsesHooks.useHorse as ReturnType<typeof vi.fn>;
const mockUseHorseTrainingHistory = useHorsesHooks.useHorseTrainingHistory as ReturnType<
  typeof vi.fn
>;

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Test data
const mockHorse = {
  id: 1,
  name: 'Thunder',
  breed: 'Arabian',
  ageYears: 5,
  sex: 'Stallion',
  level: 10,
};

const mockTrainingHistory = [
  {
    id: 1,
    discipline: 'Dressage',
    score: 85,
    trainedAt: '2025-01-01T10:00:00Z',
  },
  {
    id: 2,
    discipline: 'Show Jumping',
    score: 92,
    trainedAt: '2025-01-02T14:30:00Z',
  },
];

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement, { horseId = '1' } = {}) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/horses/${horseId}`]}>
        <Routes>
          <Route path="/horses/:id" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('HorseDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Component Rendering', () => {
    it('should show loading state while fetching horse data', () => {
      mockUseHorse.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      renderWithProviders(<HorseDetailView />);

      expect(screen.getByText(/Loading horse details/i)).toBeInTheDocument();
      expect(screen.getByText(/Please wait/i)).toBeInTheDocument();
    });

    it('should show error state when horse fetch fails', async () => {
      const error = new Error('Failed to fetch horse');
      mockUseHorse.mockReturnValue({
        data: undefined,
        isLoading: false,
        error,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch horse')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /Back to Horse List/i })).toBeInTheDocument();
    });

    it('should show not found state when horse is null', async () => {
      mockUseHorse.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Horse not found')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /Back to Horse List/i })).toBeInTheDocument();
    });

    it('should render horse details when data is loaded', async () => {
      mockUseHorse.mockReturnValue({
        data: mockHorse,
        isLoading: false,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });
      expect(screen.getByText(/Breed: Arabian/i)).toBeInTheDocument();
      expect(screen.getByText(/Age: 5 years/i)).toBeInTheDocument();
      expect(screen.getByText(/Sex: Stallion/i)).toBeInTheDocument();
      expect(screen.getByText(/Level: 10/i)).toBeInTheDocument();
    });
  });

  describe('Header Display', () => {
    beforeEach(() => {
      mockUseHorse.mockReturnValue({
        data: mockHorse,
        isLoading: false,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });
    });

    it('should display horse name as heading', async () => {
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        const heading = screen.getByRole('heading', { name: 'Thunder' });
        expect(heading).toBeInTheDocument();
      });
    });

    it('should display all horse metadata', async () => {
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText(/Breed: Arabian/i)).toBeInTheDocument();
        expect(screen.getByText(/Age: 5 years/i)).toBeInTheDocument();
        expect(screen.getByText(/Sex: Stallion/i)).toBeInTheDocument();
        expect(screen.getByText(/Level: 10/i)).toBeInTheDocument();
      });
    });

    it('should handle optional fields gracefully', async () => {
      const horseWithoutOptionals = {
        id: 2,
        name: 'Spirit',
      };
      mockUseHorse.mockReturnValue({
        data: horseWithoutOptionals,
        isLoading: false,
        error: null,
      });

      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Spirit')).toBeInTheDocument();
      });
      expect(screen.queryByText(/Breed:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Age:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Sex:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Level:/i)).not.toBeInTheDocument();
    });

    it('should display stat icons', async () => {
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('speed')).toBeInTheDocument();
        expect(screen.getByText('stamina')).toBeInTheDocument();
        expect(screen.getByText('agility')).toBeInTheDocument();
        expect(screen.getByText('strength')).toBeInTheDocument();
        expect(screen.getByText('intelligence')).toBeInTheDocument();
        expect(screen.getByText('health')).toBeInTheDocument();
      });
    });

    it('should render back button with correct navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /Back to Horses/i });
      expect(backButton).toBeInTheDocument();

      await user.click(backButton);
      expect(mockNavigate).toHaveBeenCalledWith('/horses');
    });
  });

  describe('Tab Navigation', () => {
    beforeEach(() => {
      mockUseHorse.mockReturnValue({
        data: mockHorse,
        isLoading: false,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: mockTrainingHistory,
        isLoading: false,
        error: null,
      });
    });

    it('should render all tab buttons', async () => {
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Disciplines' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Genetics' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Training' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Competition' })).toBeInTheDocument();
      });
    });

    it('should have Overview tab selected by default', async () => {
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        const overviewTab = screen.getByRole('tab', { name: 'Overview' });
        expect(overviewTab).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('should switch to Disciplines tab when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const disciplinesTab = screen.getByRole('tab', { name: 'Disciplines' });
      await user.click(disciplinesTab);

      await waitFor(() => {
        expect(disciplinesTab).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('heading', { name: 'Discipline Scores' })).toBeInTheDocument();
      });
    });

    it('should switch to Genetics tab when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const geneticsTab = screen.getByRole('tab', { name: 'Genetics' });
      await user.click(geneticsTab);

      await waitFor(() => {
        expect(geneticsTab).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('heading', { name: 'Genetic Traits' })).toBeInTheDocument();
      });
    });

    it('should switch to Training tab when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const trainingTab = screen.getByRole('tab', { name: 'Training' });
      await user.click(trainingTab);

      await waitFor(() => {
        expect(trainingTab).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('heading', { name: 'Training History' })).toBeInTheDocument();
      });
    });

    it('should switch to Competition tab when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const competitionTab = screen.getByRole('tab', { name: 'Competition' });
      await user.click(competitionTab);

      await waitFor(() => {
        expect(competitionTab).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('heading', { name: 'Competition Results' })).toBeInTheDocument();
      });
    });
  });

  describe('Overview Tab Content', () => {
    beforeEach(() => {
      mockUseHorse.mockReturnValue({
        data: mockHorse,
        isLoading: false,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });
    });

    it('should display overview content by default', async () => {
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Current Status' })).toBeInTheDocument();
        expect(screen.getByText(/Displaying basic horse information/i)).toBeInTheDocument();
      });
    });
  });

  describe('Disciplines Tab Content', () => {
    beforeEach(() => {
      mockUseHorse.mockReturnValue({
        data: mockHorse,
        isLoading: false,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });
    });

    it('should display disciplines placeholder', async () => {
      const user = userEvent.setup();
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'Disciplines' }));

      await waitFor(() => {
        expect(screen.getByText(/Discipline scores will be displayed/i)).toBeInTheDocument();
        expect(screen.getByText(/performance across all 23 disciplines/i)).toBeInTheDocument();
      });
    });
  });

  describe('Genetics Tab Content', () => {
    beforeEach(() => {
      mockUseHorse.mockReturnValue({
        data: mockHorse,
        isLoading: false,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });
    });

    it('should display genetics placeholder', async () => {
      const user = userEvent.setup();
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'Genetics' }));

      await waitFor(() => {
        expect(
          screen.getByText(/Genetic traits and markers will be displayed/i)
        ).toBeInTheDocument();
        expect(screen.getByText(/inherited traits and genetic potential/i)).toBeInTheDocument();
      });
    });
  });

  describe('Training Tab Content', () => {
    it('should show loading state for training history', async () => {
      mockUseHorse.mockReturnValue({
        data: mockHorse,
        isLoading: false,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      const user = userEvent.setup();
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'Training' }));

      await waitFor(() => {
        expect(screen.getByText(/Loading training history/i)).toBeInTheDocument();
      });
    });

    it('should display training history when data exists', async () => {
      mockUseHorse.mockReturnValue({
        data: mockHorse,
        isLoading: false,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: mockTrainingHistory,
        isLoading: false,
        error: null,
      });

      const user = userEvent.setup();
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'Training' }));

      await waitFor(() => {
        expect(screen.getByText('Dressage')).toBeInTheDocument();
        expect(screen.getByText('Show Jumping')).toBeInTheDocument();
        expect(screen.getByText(/Score: 85/i)).toBeInTheDocument();
        expect(screen.getByText(/Score: 92/i)).toBeInTheDocument();
      });
    });

    it('should display empty state when no training history', async () => {
      mockUseHorse.mockReturnValue({
        data: mockHorse,
        isLoading: false,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      const user = userEvent.setup();
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'Training' }));

      await waitFor(() => {
        expect(screen.getByText(/No training history available yet/i)).toBeInTheDocument();
      });
    });

    it('should format training dates correctly', async () => {
      mockUseHorse.mockReturnValue({
        data: mockHorse,
        isLoading: false,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: mockTrainingHistory,
        isLoading: false,
        error: null,
      });

      const user = userEvent.setup();
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'Training' }));

      await waitFor(() => {
        const dateElements = screen.getAllByText(/202/);
        expect(dateElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Competition Tab Content', () => {
    beforeEach(() => {
      mockUseHorse.mockReturnValue({
        data: mockHorse,
        isLoading: false,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });
    });

    it('should display competition placeholder', async () => {
      const user = userEvent.setup();
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'Competition' }));

      await waitFor(() => {
        expect(screen.getByText(/Competition results will be displayed/i)).toBeInTheDocument();
        expect(screen.getByText(/rankings and achievements/i)).toBeInTheDocument();
      });
    });
  });

  describe('Quick Action Buttons', () => {
    beforeEach(() => {
      mockUseHorse.mockReturnValue({
        data: mockHorse,
        isLoading: false,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });
    });

    it('should render all quick action buttons', async () => {
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Train This Horse/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Enter Competition/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /View Breeding Options/i })).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseHorse.mockReturnValue({
        data: mockHorse,
        isLoading: false,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });
    });

    it('should have proper ARIA labels for tabs', async () => {
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        const nav = screen.getByRole('navigation', { name: 'Tabs' });
        expect(nav).toBeInTheDocument();
      });
    });

    it('should have proper ARIA selected states', async () => {
      const user = userEvent.setup();
      renderWithProviders(<HorseDetailView />);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const overviewTab = screen.getByRole('tab', { name: 'Overview' });
      const trainingTab = screen.getByRole('tab', { name: 'Training' });

      expect(overviewTab).toHaveAttribute('aria-selected', 'true');
      expect(trainingTab).toHaveAttribute('aria-selected', 'false');

      await user.click(trainingTab);

      await waitFor(() => {
        expect(overviewTab).toHaveAttribute('aria-selected', 'false');
        expect(trainingTab).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  describe('Props-based Rendering', () => {
    it('should accept horseId as prop instead of URL param', async () => {
      mockUseHorse.mockReturnValue({
        data: mockHorse,
        isLoading: false,
        error: null,
      });
      mockUseHorseTrainingHistory.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <HorseDetailView horseId={42} />
          </BrowserRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      expect(mockUseHorse).toHaveBeenCalledWith(42);
      expect(mockUseHorseTrainingHistory).toHaveBeenCalledWith(42);
    });
  });
});
