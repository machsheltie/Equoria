import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BreedingPairSelector from '../BreedingPairSelector';
import * as useBreedingPredictionHooks from '@/hooks/api/useBreedingPrediction';

// Mock the hooks
vi.mock('@/hooks/api/useBreedingPrediction');

describe('BreedingPairSelector', () => {
  let queryClient: QueryClient;

  const mockStallionData = {
    horseId: 3,
    horseName: 'Thunder Stallion',
    sex: 'Male' as const,
    breedingQuality: 'excellent' as const,
    traitSummary: {
      totalTraits: 6,
      epigeneticTraits: 2,
      rareTraits: 1,
      negativeTraits: 0,
    },
    temperamentInfluence: {
      temperament: 'spirited',
    },
  };

  const mockMareData = {
    horseId: 1,
    horseName: 'Lightning Mare',
    sex: 'Female' as const,
    breedingQuality: 'good' as const,
    traitSummary: {
      totalTraits: 5,
      epigeneticTraits: 1,
      rareTraits: 1,
      negativeTraits: 1,
    },
    temperamentInfluence: {
      temperament: 'gentle',
    },
  };

  const mockInbreedingAnalysis = {
    inbreedingCoefficient: 0.03,
    riskLevel: 'low' as const,
    warnings: [],
    recommendations: ['Acceptable inbreeding level for this pairing'],
  };

  const mockHighInbreedingAnalysis = {
    inbreedingCoefficient: 0.25,
    riskLevel: 'high' as const,
    warnings: ['High inbreeding coefficient detected', 'Risk of genetic defects'],
    recommendations: ['Consider alternative pairing'],
  };

  const mockPredictions = {
    estimatedTraitCount: {
      min: 3,
      max: 7,
      expected: 5,
    },
    confidenceLevel: 'high' as const,
    categoryProbabilities: {
      empathy: 65,
      boldness: 70,
      intelligence: 55,
      physical: 60,
      temperament: 80,
      social: 50,
    },
  };

  const mockUseHorseBreedingData = vi.fn();
  const mockUseInbreedingAnalysis = vi.fn();
  const mockUseGeneticProbability = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.clearAllMocks();

    // Setup default mocks - both horses loading initially
    mockUseHorseBreedingData.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    mockUseInbreedingAnalysis.mockReturnValue({
      data: mockInbreedingAnalysis,
      isLoading: false,
      error: null,
    });

    mockUseGeneticProbability.mockReturnValue({
      data: mockPredictions,
      isLoading: false,
      error: null,
    });

    vi.mocked(useBreedingPredictionHooks.useHorseBreedingData).mockImplementation(
      mockUseHorseBreedingData
    );
    vi.mocked(useBreedingPredictionHooks.useInbreedingAnalysis).mockImplementation(
      mockUseInbreedingAnalysis
    );
    vi.mocked(useBreedingPredictionHooks.useGeneticProbability).mockImplementation(
      mockUseGeneticProbability
    );
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  };

  describe('Component Rendering', () => {
    it('renders breeding pair selector', () => {
      mockUseHorseBreedingData.mockReturnValue({
        data: mockStallionData,
        isLoading: false,
        error: null,
      });

      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      expect(screen.getByText(/breeding pair analysis/i)).toBeInTheDocument();
    });

    it('displays loading state while fetching data', () => {
      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      expect(screen.getByText(/loading breeding data/i)).toBeInTheDocument();
    });

    it('displays error state when data fetch fails', () => {
      mockUseHorseBreedingData.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Failed to fetch breeding data' },
      });

      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      expect(screen.getByText(/failed to fetch breeding data/i)).toBeInTheDocument();
    });
  });

  describe('Horse Display', () => {
    beforeEach(() => {
      // Mock implementation to return different data based on horseId
      mockUseHorseBreedingData.mockImplementation((horseId: number) => {
        if (horseId === 3) {
          return {
            data: mockStallionData,
            isLoading: false,
            error: null,
          };
        }
        if (horseId === 1) {
          return {
            data: mockMareData,
            isLoading: false,
            error: null,
          };
        }
        return {
          data: undefined,
          isLoading: true,
          error: null,
        };
      });
    });

    it('displays stallion information on left side', () => {
      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      expect(screen.getByText('Thunder Stallion')).toBeInTheDocument();
      expect(screen.getByText('Stallion')).toBeInTheDocument();
    });

    it('displays mare information on right side', () => {
      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      expect(screen.getByText('Lightning Mare')).toBeInTheDocument();
      expect(screen.getByText('Mare')).toBeInTheDocument();
    });

    it('displays breeding quality for both horses', () => {
      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      expect(screen.getByText(/excellent/i)).toBeInTheDocument();
      expect(screen.getByText(/good/i)).toBeInTheDocument();
    });

    it('displays trait summary for both horses', () => {
      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      // Stallion: 6 traits total
      expect(screen.getByText(/6.*traits?/i)).toBeInTheDocument();
      // Mare: 5 traits total
      expect(screen.getByText(/5.*traits?/i)).toBeInTheDocument();
    });

    it('displays temperament for both horses', () => {
      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      expect(screen.getByText(/spirited/i)).toBeInTheDocument();
      expect(screen.getByText(/gentle/i)).toBeInTheDocument();
    });
  });

  describe('Offspring Predictions', () => {
    beforeEach(() => {
      mockUseHorseBreedingData.mockImplementation((horseId: number) => {
        if (horseId === 3) return { data: mockStallionData, isLoading: false, error: null };
        if (horseId === 1) return { data: mockMareData, isLoading: false, error: null };
        return { data: undefined, isLoading: true, error: null };
      });
    });

    it('displays predicted offspring trait count', () => {
      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      expect(screen.getByText(/predicted traits/i)).toBeInTheDocument();
      // Find the predictions section and look for the expected count
      const predictedTraitsSection = screen.getByText(/predicted traits/i).closest('div');
      expect(predictedTraitsSection).toHaveTextContent('5');
    });

    it('displays confidence level', () => {
      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      expect(screen.getByText(/high confidence/i)).toBeInTheDocument();
    });

    it('displays category probabilities', () => {
      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      // Should show category names and percentages
      expect(screen.getByText(/boldness/i)).toBeInTheDocument();
      expect(screen.getByText(/70%/)).toBeInTheDocument();
    });

    it('handles low confidence predictions', () => {
      mockUseGeneticProbability.mockReturnValue({
        data: { ...mockPredictions, confidenceLevel: 'low' },
        isLoading: false,
        error: null,
      });

      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      expect(screen.getByText(/low confidence/i)).toBeInTheDocument();
    });
  });

  describe('Inbreeding Warning', () => {
    beforeEach(() => {
      mockUseHorseBreedingData.mockImplementation((horseId: number) => {
        if (horseId === 3) return { data: mockStallionData, isLoading: false, error: null };
        if (horseId === 1) return { data: mockMareData, isLoading: false, error: null };
        return { data: undefined, isLoading: true, error: null };
      });
    });

    it('does not show warning for low inbreeding risk', () => {
      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      expect(screen.queryByText(/inbreeding warning/i)).not.toBeInTheDocument();
    });

    it('shows warning for high inbreeding risk', () => {
      mockUseInbreedingAnalysis.mockReturnValue({
        data: mockHighInbreedingAnalysis,
        isLoading: false,
        error: null,
      });

      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      expect(screen.getByText(/inbreeding warning/i)).toBeInTheDocument();
      expect(screen.getByText(/high inbreeding coefficient detected/i)).toBeInTheDocument();
    });

    it('displays inbreeding coefficient percentage', () => {
      mockUseInbreedingAnalysis.mockReturnValue({
        data: mockHighInbreedingAnalysis,
        isLoading: false,
        error: null,
      });

      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      expect(screen.getByText(/25%/)).toBeInTheDocument(); // 0.25 = 25%
    });

    it('displays recommendations for high inbreeding', () => {
      mockUseInbreedingAnalysis.mockReturnValue({
        data: mockHighInbreedingAnalysis,
        isLoading: false,
        error: null,
      });

      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      expect(screen.getByText(/consider alternative pairing/i)).toBeInTheDocument();
    });
  });

  describe('Comparison View', () => {
    beforeEach(() => {
      mockUseHorseBreedingData.mockImplementation((horseId: number) => {
        if (horseId === 3) return { data: mockStallionData, isLoading: false, error: null };
        if (horseId === 1) return { data: mockMareData, isLoading: false, error: null };
        return { data: undefined, isLoading: true, error: null };
      });
    });

    it('displays horses side-by-side', () => {
      const { container } = renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      // Should have a grid or flex layout with two columns
      const layout = container.querySelector('[class*="grid"]');
      expect(layout).toBeInTheDocument();
    });

    it('highlights compatible temperaments', () => {
      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      // Spirited + Gentle should show compatibility indicator
      expect(screen.getByText(/compatible/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseHorseBreedingData.mockImplementation((horseId: number) => {
        if (horseId === 3) return { data: mockStallionData, isLoading: false, error: null };
        if (horseId === 1) return { data: mockMareData, isLoading: false, error: null };
        return { data: undefined, isLoading: true, error: null };
      });
    });

    it('has accessible headings structure', () => {
      renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('uses semantic HTML for warnings', () => {
      mockUseInbreedingAnalysis.mockReturnValue({
        data: mockHighInbreedingAnalysis,
        isLoading: false,
        error: null,
      });

      const { container } = renderWithProvider(<BreedingPairSelector stallionId={3} mareId={1} />);

      // Warning should have role="alert" or aria-live
      const warning = container.querySelector('[role="alert"]');
      expect(warning).toBeInTheDocument();
    });
  });
});
