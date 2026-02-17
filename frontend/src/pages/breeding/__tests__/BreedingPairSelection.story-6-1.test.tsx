/**
 * BreedingPairSelection Integration Tests
 *
 * Story 6-1: Breeding Pair Selection
 * Integration tests for the complete breeding pair selection flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import BreedingPairSelection from '../BreedingPairSelection';
import * as apiClient from '@/lib/api-client';

// Mock the auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-123' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  horsesApi: {
    list: vi.fn(),
  },
  breedingApi: {
    getBreedingCompatibility: vi.fn(),
    breedFoal: vi.fn(),
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('BreedingPairSelection - Story 6-1 Integration', () => {
  let queryClient: QueryClient;

  const mockHorses = [
    {
      id: 1,
      name: 'Thunder',
      age: 5,
      ageYears: 5,
      sex: 'Male',
      gender: 'male',
      breed: 'Thoroughbred',
      breedName: 'Thoroughbred',
      healthStatus: 'Healthy',
      dateOfBirth: '2019-01-01',
      level: 10,
      stats: { speed: 85, stamina: 80, agility: 75, strength: 78, intelligence: 70, health: 90 },
      disciplineScores: {},
      traits: [],
    },
    {
      id: 2,
      name: 'Lightning',
      age: 4,
      ageYears: 4,
      sex: 'Female',
      gender: 'female',
      breed: 'Arabian',
      breedName: 'Arabian',
      healthStatus: 'Healthy',
      dateOfBirth: '2020-01-01',
      level: 8,
      stats: { speed: 80, stamina: 85, agility: 82, strength: 70, intelligence: 75, health: 88 },
      disciplineScores: {},
      traits: [],
    },
    {
      id: 3,
      name: 'Storm',
      age: 2,
      ageYears: 2,
      sex: 'Male',
      gender: 'male',
      breed: 'Quarter Horse',
      breedName: 'Quarter Horse',
      healthStatus: 'Healthy',
      dateOfBirth: '2022-01-01',
      level: 3,
      stats: { speed: 60, stamina: 65, agility: 70, strength: 68, intelligence: 55, health: 85 },
      disciplineScores: {},
      traits: [],
    },
  ];

  const mockCompatibility = {
    overallScore: 85,
    temperamentCompatibility: 88,
    traitSynergy: 90,
    geneticDiversity: 78,
    recommendations: ['Excellent match', 'Strong genetic diversity'],
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.clearAllMocks();
    mockNavigate.mockClear();

    // Setup default mocks
    vi.mocked(apiClient.horsesApi.list).mockResolvedValue(mockHorses as any);
    vi.mocked(apiClient.breedingApi.getBreedingCompatibility).mockResolvedValue(mockCompatibility);
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BreedingPairSelection userId="test-user-123" />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('Initial Load', () => {
    it('should display loading state initially', () => {
      vi.mocked(apiClient.horsesApi.list).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderComponent();

      expect(screen.getByText(/Loading horses/i)).toBeInTheDocument();
    });

    it('should load and display horses', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
        expect(screen.getByText('Lightning')).toBeInTheDocument();
      });
    });

    it('should display page title and description', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Breeding Pair Selection')).toBeInTheDocument();
        expect(
          screen.getByText(/Select a sire and dam from your horses to initiate breeding/i)
        ).toBeInTheDocument();
      });
    });

    it('should display both horse selectors', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Select Sire')).toBeInTheDocument();
        expect(screen.getByText('Select Dam')).toBeInTheDocument();
      });
    });
  });

  describe('Horse Selection Flow', () => {
    it('should allow selecting a sire', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const thunderButton = screen.getByLabelText('Select Thunder');
      await user.click(thunderButton);

      await waitFor(() => {
        expect(screen.getByText('✓ Selected')).toBeInTheDocument();
      });
    });

    it('should allow selecting a dam', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Lightning')).toBeInTheDocument();
      });

      const lightningButton = screen.getByLabelText('Select Lightning');
      await user.click(lightningButton);

      await waitFor(() => {
        expect(screen.getByText('✓ Selected')).toBeInTheDocument();
      });
    });

    it('should fetch compatibility when both horses selected', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Select sire
      const thunderButton = screen.getByLabelText('Select Thunder');
      await user.click(thunderButton);

      // Select dam
      const lightningButton = screen.getByLabelText('Select Lightning');
      await user.click(lightningButton);

      // Wait for compatibility to load
      await waitFor(() => {
        expect(apiClient.breedingApi.getBreedingCompatibility).toHaveBeenCalledWith({
          stallionId: 1,
          mareId: 2,
        });
      });
    });

    it('should display compatibility analysis after selection', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Select Thunder'));
      await user.click(screen.getByLabelText('Select Lightning'));

      await waitFor(() => {
        expect(screen.getByText(/Compatibility Analysis/i)).toBeInTheDocument();
      });
    });
  });

  describe('Breeding Initiation', () => {
    it('should enable Initiate Breeding button when both horses selected', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const initiateButton = screen.getByRole('button', { name: /Initiate Breeding/i });
      expect(initiateButton).toBeDisabled();

      await user.click(screen.getByLabelText('Select Thunder'));
      await user.click(screen.getByLabelText('Select Lightning'));

      await waitFor(() => {
        expect(initiateButton).not.toBeDisabled();
      });
    });

    it('should open confirmation modal when Initiate Breeding clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Select Thunder'));
      await user.click(screen.getByLabelText('Select Lightning'));

      await waitFor(() => {
        const initiateButton = screen.getByRole('button', { name: /Initiate Breeding/i });
        expect(initiateButton).not.toBeDisabled();
      });

      const initiateButton = screen.getByRole('button', { name: /Initiate Breeding/i });
      await user.click(initiateButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Breeding')).toBeInTheDocument();
      });
    });

    it('should call breeding API when confirmed', async () => {
      const user = userEvent.setup();
      const mockFoal = {
        foal: {
          id: 123,
          name: 'Baby Horse',
          sireId: 1,
          damId: 2,
          dateOfBirth: '2024-02-06',
          ageInDays: 0,
          sex: 'Male' as const,
          userId: 'test-user-123',
        },
        message: 'Breeding successful!',
      };

      vi.mocked(apiClient.breedingApi.breedFoal).mockResolvedValue(mockFoal as any);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Select Thunder'));
      await user.click(screen.getByLabelText('Select Lightning'));

      await waitFor(() => {
        const initiateButton = screen.getByRole('button', { name: /Initiate Breeding/i });
        expect(initiateButton).not.toBeDisabled();
      });

      await user.click(screen.getByRole('button', { name: /Initiate Breeding/i }));

      await waitFor(() => {
        expect(screen.getByText('Confirm Breeding')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /Confirm Breeding/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(apiClient.breedingApi.breedFoal).toHaveBeenCalledWith({
          sireId: 1,
          damId: 2,
          userId: 'test-user-123',
        });
      });
    });

    it('should navigate to foal page after successful breeding', async () => {
      const user = userEvent.setup();
      const mockFoal = {
        foal: {
          id: 123,
          name: 'Baby Horse',
          sireId: 1,
          damId: 2,
          dateOfBirth: '2024-02-06',
          ageInDays: 0,
          sex: 'Male' as const,
          userId: 'test-user-123',
        },
        message: 'Breeding successful!',
      };

      vi.mocked(apiClient.breedingApi.breedFoal).mockResolvedValue(mockFoal as any);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Select Thunder'));
      await user.click(screen.getByLabelText('Select Lightning'));

      await waitFor(() => {
        const initiateButton = screen.getByRole('button', { name: /Initiate Breeding/i });
        expect(initiateButton).not.toBeDisabled();
      });

      await user.click(screen.getByRole('button', { name: /Initiate Breeding/i }));

      await waitFor(() => {
        expect(screen.getByText('Confirm Breeding')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /Confirm Breeding/i });
      await user.click(confirmButton);

      // Wait for navigation (with 2s delay in component)
      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith('/foals/123');
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Error Handling', () => {
    it('should display error when horses fail to load', async () => {
      vi.mocked(apiClient.horsesApi.list).mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Failed to load horses/i)).toBeInTheDocument();
      });
    });

    it('should display error message when breeding fails', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.breedingApi.breedFoal).mockRejectedValue(new Error('Insufficient funds'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Select Thunder'));
      await user.click(screen.getByLabelText('Select Lightning'));

      await waitFor(() => {
        const initiateButton = screen.getByRole('button', { name: /Initiate Breeding/i });
        expect(initiateButton).not.toBeDisabled();
      });

      await user.click(screen.getByRole('button', { name: /Initiate Breeding/i }));

      await waitFor(() => {
        expect(screen.getByText('Confirm Breeding')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /Confirm Breeding/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Insufficient funds/i)).toBeInTheDocument();
      });
    });
  });

  describe('Stud Fee Display', () => {
    it('should display calculated stud fee', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Stud Fee')).toBeInTheDocument();
      });

      // Default calculation for no selection should be $0
      expect(screen.getByText('$0')).toBeInTheDocument();
    });

    it('should update stud fee when sire is selected', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Select Thunder'));

      await waitFor(() => {
        // Thunder has level 10, so fee = 500 * 10 = 5000
        expect(screen.getByText('$5,000')).toBeInTheDocument();
      });
    });
  });
});
