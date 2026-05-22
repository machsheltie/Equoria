/**
 * Enhanced Genetics Tab Integration Tests
 *
 * Tests for the comprehensive genetics tab features including:
 * - useHorseGenetics hooks integration (epigenetic insights, interactions, timeline)
 * - Filtering by type, rarity, and source
 * - Sorting by name, rarity, strength, and discovery date
 * - TraitCard grid display for genetic and epigenetic traits
 * - Trait interactions display
 * - Loading and error states
 * - Empty states when no traits match filters
 *
 * Following TDD approach with realistic mock data
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, MockAuthProvider } from '../../test/utils';
import { vi } from 'vitest';
import HorseDetailPage from '../HorseDetailPage';
import * as useHorseGeneticsModule from '../../hooks/useHorseGenetics';

// Mock the genetics hooks
vi.mock('../../hooks/useHorseGenetics', () => ({
  useHorseEpigeneticInsights: vi.fn(),
  useHorseTraitInteractions: vi.fn(),
  useHorseTraitTimeline: vi.fn(),
}));

// Mock TraitCard component to simplify testing
vi.mock('../../components/TraitCard', () => ({
  default: ({ trait }: { trait: { name: string; type: string; rarity: string } }) => (
    <div
      data-testid={`trait-card-${trait.name}`}
      data-trait-type={trait.type}
      data-trait-rarity={trait.rarity}
    >
      {trait.name} ({trait.type}, {trait.rarity})
    </div>
  ),
}));

// Mock react-router-dom useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '123' }),
  };
});

// Mock horse data with comprehensive traits
const mockHorse = {
  id: 123,
  name: 'Thunder',
  breed: 'Thoroughbred',
  age: 5,
  gender: 'Stallion',
  dateOfBirth: '2020-03-15',
  healthStatus: 'Excellent',
  stats: {
    speed: 85,
    stamina: 80,
    agility: 75,
    strength: 82,
    intelligence: 78,
    health: 95,
  },
  disciplineScores: {
    'Western Pleasure': 85,
    Dressage: 70,
  },
  traits: ['Fast Learner', 'Even Tempered'],
  parentIds: {
    sireId: 10,
    damId: 11,
  },
};

// Mock epigenetic data with diverse traits.
// Equoria-e1ccb: the live epigenetic-insights endpoint produces ONLY
// epigenetic-typed traits (traitAnalysis.traits = horse.epigeneticFlags), so
// every fixture trait is `type: 'epigenetic'`. The previous fixture marked some
// as `type: 'genetic'`, which the real mapper never emits — the honest fix
// removed the always-empty "Genetic Traits" section + "Genetic" filter option.
const mockEpigeneticData = {
  traits: [
    {
      name: 'Speed Boost',
      type: 'epigenetic' as const,
      description: 'Increases base speed',
      source: 'sire' as const,
      rarity: 'common' as const,
      strength: 75,
      impact: { stats: { speed: 10 }, disciplines: {} },
    },
    {
      name: 'Endurance Master',
      type: 'epigenetic' as const,
      description: 'Improves stamina recovery',
      discoveryDate: '2025-01-15',
      isActive: true,
      rarity: 'rare' as const,
      strength: 85,
      source: 'dam' as const,
      impact: { stats: { stamina: 15 }, disciplines: {} },
    },
    {
      name: 'Divine Grace',
      type: 'epigenetic' as const,
      description: 'Legendary trait',
      source: 'mutation' as const,
      rarity: 'legendary' as const,
      strength: 95,
      impact: { stats: { speed: 20, stamina: 20 }, disciplines: {} },
    },
    {
      name: 'Steady Temperament',
      type: 'epigenetic' as const,
      description: 'Calm under pressure',
      discoveryDate: '2025-01-10',
      isActive: false,
      rarity: 'common' as const,
      strength: 60,
      source: 'sire' as const,
      impact: { stats: { intelligence: 8 }, disciplines: {} },
    },
  ],
};

// Mock trait interactions data
const mockInteractionsData = {
  interactions: [
    {
      trait1: 'Speed Boost',
      trait2: 'Endurance Master',
      effect: 'Enhanced stamina during sprints',
      strength: 80,
    },
    {
      trait1: 'Divine Grace',
      trait2: 'Steady Temperament',
      effect: 'Exceptional performance consistency',
      strength: 90,
    },
  ],
};

// Mock timeline data
const mockTimelineData = {
  timeline: [
    {
      id: 1,
      traitName: 'Endurance Master',
      eventType: 'discovered' as const,
      timestamp: '2025-01-15T10:00:00Z',
      description: 'Discovered through intense training',
      source: 'training' as const,
    },
  ],
};

// Test wrapper with required providers
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/horses/:id" element={children} />
          </Routes>
        </BrowserRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
};

describe('Enhanced Genetics Tab Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Mock successful horse fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: mockHorse }),
      } as Response)
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    test('displays loading spinner when genetics data is loading', async () => {
      // Mock hooks to return loading state
      vi.mocked(useHorseGeneticsModule.useHorseEpigeneticInsights).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitInteractions).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitTimeline).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      // Wait for horse data to load
      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Click Genetics tab
      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText(/loading genetics data/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    test('displays error message when epigenetic insights fetch fails', async () => {
      // Mock hooks with error
      vi.mocked(useHorseGeneticsModule.useHorseEpigeneticInsights).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch epigenetic insights'),
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitInteractions).mockReturnValue({
        data: mockInteractionsData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitTimeline).mockReturnValue({
        data: mockTimelineData,
        isLoading: false,
        error: null,
      } as any);

      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Click Genetics tab
      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/error loading genetics data/i)).toBeInTheDocument();
        expect(screen.getByText(/failed to fetch epigenetic insights/i)).toBeInTheDocument();
      });
    });

    test('displays error message when interactions fetch fails', async () => {
      vi.mocked(useHorseGeneticsModule.useHorseEpigeneticInsights).mockReturnValue({
        data: mockEpigeneticData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitInteractions).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch trait interactions'),
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitTimeline).mockReturnValue({
        data: mockTimelineData,
        isLoading: false,
        error: null,
      } as any);

      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      await waitFor(() => {
        expect(screen.getByText(/error loading genetics data/i)).toBeInTheDocument();
        expect(screen.getByText(/failed to fetch trait interactions/i)).toBeInTheDocument();
      });
    });
  });

  describe('Trait Display', () => {
    beforeEach(() => {
      // Mock successful genetics data fetch
      vi.mocked(useHorseGeneticsModule.useHorseEpigeneticInsights).mockReturnValue({
        data: mockEpigeneticData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitInteractions).mockReturnValue({
        data: mockInteractionsData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitTimeline).mockReturnValue({
        data: mockTimelineData,
        isLoading: false,
        error: null,
      } as any);
    });

    test('displays all live traits in the single epigenetic section', async () => {
      // Equoria-e1ccb: live data is epigenetic-only, so there is no separate
      // "Genetic Traits" section. All 4 traits render under "Epigenetic Traits".
      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Click Genetics tab
      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      // Wait for traits to load
      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        const geneticHeading = headings.find(
          (h) => h.textContent?.includes('Genetic Traits') && !h.textContent?.includes('Epigenetic')
        );
        const epigeneticHeading = headings.find((h) =>
          h.textContent?.includes('Epigenetic Traits')
        );

        // No standalone genetic section is rendered.
        expect(geneticHeading).toBeUndefined();
        expect(epigeneticHeading).toBeInTheDocument();
        expect(epigeneticHeading?.textContent).toContain('(4)');
      });

      // Verify trait cards are rendered
      expect(screen.getByTestId('trait-card-Speed Boost')).toBeInTheDocument();
      expect(screen.getByTestId('trait-card-Divine Grace')).toBeInTheDocument();
      expect(screen.getByTestId('trait-card-Endurance Master')).toBeInTheDocument();
      expect(screen.getByTestId('trait-card-Steady Temperament')).toBeInTheDocument();
    });

    test('does not offer a "Genetic" type filter option', async () => {
      // Equoria-e1ccb: the always-empty Genetic option was removed from the
      // Type filter; only All Types + Epigenetic remain.
      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Genetics'));

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        expect(
          headings.find((h) => h.textContent?.includes('Epigenetic Traits'))
        ).toBeInTheDocument();
      });

      const typeFilter = screen.getAllByRole('combobox')[0];
      const optionValues = Array.from(typeFilter.querySelectorAll('option')).map(
        (o) => (o as HTMLOptionElement).value
      );
      expect(optionValues).toEqual(['all', 'epigenetic']);
      expect(optionValues).not.toContain('genetic');
    });

    test('displays trait interactions section', async () => {
      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        const interactionsHeading = headings.find((h) =>
          h.textContent?.includes('Trait Interactions')
        );
        expect(interactionsHeading).toBeInTheDocument();
        expect(interactionsHeading?.textContent).toContain('(2)');
      });

      // Verify interaction cards
      expect(screen.getByText(/speed boost \+ endurance master/i)).toBeInTheDocument();
      expect(screen.getByText(/enhanced stamina during sprints/i)).toBeInTheDocument();
      expect(screen.getByText(/divine grace \+ steady temperament/i)).toBeInTheDocument();
      expect(screen.getByText(/exceptional performance consistency/i)).toBeInTheDocument();
    });
  });

  describe('Type Filtering', () => {
    beforeEach(() => {
      vi.mocked(useHorseGeneticsModule.useHorseEpigeneticInsights).mockReturnValue({
        data: mockEpigeneticData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitInteractions).mockReturnValue({
        data: mockInteractionsData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitTimeline).mockReturnValue({
        data: mockTimelineData,
        isLoading: false,
        error: null,
      } as any);
    });

    test('type filter "All Types" shows every (epigenetic) trait', async () => {
      // Equoria-e1ccb: the "genetic only" filter case is gone (no genetic data
      // / option). "All Types" must surface all 4 live epigenetic traits.
      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        expect(
          headings.find((h) => h.textContent?.includes('Epigenetic Traits'))
        ).toBeInTheDocument();
      });

      // Default type filter is "all" — all 4 trait cards visible.
      expect(screen.getByTestId('trait-card-Speed Boost')).toBeInTheDocument();
      expect(screen.getByTestId('trait-card-Divine Grace')).toBeInTheDocument();
      expect(screen.getByTestId('trait-card-Endurance Master')).toBeInTheDocument();
      expect(screen.getByTestId('trait-card-Steady Temperament')).toBeInTheDocument();
    });

    test('filters traits by type: epigenetic only', async () => {
      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        expect(
          headings.find((h) => h.textContent?.includes('Epigenetic Traits'))
        ).toBeInTheDocument();
      });

      // Change type filter to "epigenetic"
      const filters = screen.getAllByRole('combobox');
      const typeFilter = filters[0]; // First filter is Type
      fireEvent.change(typeFilter, { target: { value: 'epigenetic' } });

      // Equoria-e1ccb: all live traits are epigenetic, so the epigenetic filter
      // keeps every card and there is never a Genetic Traits heading.
      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        const geneticHeading = headings.find(
          (h) => h.textContent?.includes('Genetic Traits') && !h.textContent?.includes('Epigenetic')
        );
        const epigeneticHeading = headings.find((h) =>
          h.textContent?.includes('Epigenetic Traits')
        );

        expect(geneticHeading).toBeUndefined();
        expect(epigeneticHeading).toBeInTheDocument();
        expect(epigeneticHeading?.textContent).toContain('(4)');
      });

      // All 4 epigenetic trait cards remain visible.
      expect(screen.getByTestId('trait-card-Speed Boost')).toBeInTheDocument();
      expect(screen.getByTestId('trait-card-Divine Grace')).toBeInTheDocument();
      expect(screen.getByTestId('trait-card-Endurance Master')).toBeInTheDocument();
      expect(screen.getByTestId('trait-card-Steady Temperament')).toBeInTheDocument();
    });
  });

  describe('Rarity Filtering', () => {
    beforeEach(() => {
      vi.mocked(useHorseGeneticsModule.useHorseEpigeneticInsights).mockReturnValue({
        data: mockEpigeneticData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitInteractions).mockReturnValue({
        data: mockInteractionsData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitTimeline).mockReturnValue({
        data: mockTimelineData,
        isLoading: false,
        error: null,
      } as any);
    });

    test('filters traits by rarity: common only', async () => {
      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        const epigeneticHeading = headings.find((h) =>
          h.textContent?.includes('Epigenetic Traits')
        );
        expect(epigeneticHeading).toBeInTheDocument();
      });

      // Change rarity filter to "common"
      const filters = screen.getAllByRole('combobox');
      const rarityFilter = filters[1]; // Second filter is Rarity
      fireEvent.change(rarityFilter, { target: { value: 'common' } });

      // Should only show common traits (2: Speed Boost, Steady Temperament)
      await waitFor(() => {
        expect(screen.getByTestId('trait-card-Speed Boost')).toBeInTheDocument();
        expect(screen.getByTestId('trait-card-Steady Temperament')).toBeInTheDocument();
        expect(screen.queryByTestId('trait-card-Endurance Master')).not.toBeInTheDocument();
        expect(screen.queryByTestId('trait-card-Divine Grace')).not.toBeInTheDocument();
      });
    });

    test('filters traits by rarity: legendary only', async () => {
      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        const epigeneticHeading = headings.find((h) =>
          h.textContent?.includes('Epigenetic Traits')
        );
        expect(epigeneticHeading).toBeInTheDocument();
      });

      // Change rarity filter to "legendary"
      const filters = screen.getAllByRole('combobox');
      const rarityFilter = filters[1]; // Second filter is Rarity
      fireEvent.change(rarityFilter, { target: { value: 'legendary' } });

      // Should only show legendary trait (1: Divine Grace)
      await waitFor(() => {
        expect(screen.queryByTestId('trait-card-Speed Boost')).not.toBeInTheDocument();
        expect(screen.queryByTestId('trait-card-Steady Temperament')).not.toBeInTheDocument();
        expect(screen.queryByTestId('trait-card-Endurance Master')).not.toBeInTheDocument();
        expect(screen.getByTestId('trait-card-Divine Grace')).toBeInTheDocument();
      });
    });
  });

  describe('Source Filtering', () => {
    beforeEach(() => {
      vi.mocked(useHorseGeneticsModule.useHorseEpigeneticInsights).mockReturnValue({
        data: mockEpigeneticData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitInteractions).mockReturnValue({
        data: mockInteractionsData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitTimeline).mockReturnValue({
        data: mockTimelineData,
        isLoading: false,
        error: null,
      } as any);
    });

    test('filters traits by source: sire only', async () => {
      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        const epigeneticHeading = headings.find((h) =>
          h.textContent?.includes('Epigenetic Traits')
        );
        expect(epigeneticHeading).toBeInTheDocument();
      });

      // Change source filter to "sire"
      const filters = screen.getAllByRole('combobox');
      const sourceFilter = filters[2]; // Third filter is Source
      fireEvent.change(sourceFilter, { target: { value: 'sire' } });

      // Should only show traits from sire (2: Speed Boost, Steady Temperament)
      await waitFor(() => {
        expect(screen.getByTestId('trait-card-Speed Boost')).toBeInTheDocument();
        expect(screen.getByTestId('trait-card-Steady Temperament')).toBeInTheDocument();
        expect(screen.queryByTestId('trait-card-Endurance Master')).not.toBeInTheDocument();
        expect(screen.queryByTestId('trait-card-Divine Grace')).not.toBeInTheDocument();
      });
    });

    test('filters traits by source: mutation only', async () => {
      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        const epigeneticHeading = headings.find((h) =>
          h.textContent?.includes('Epigenetic Traits')
        );
        expect(epigeneticHeading).toBeInTheDocument();
      });

      // Change source filter to "mutation"
      const filters = screen.getAllByRole('combobox');
      const sourceFilter = filters[2]; // Third filter is Source
      fireEvent.change(sourceFilter, { target: { value: 'mutation' } });

      // Should only show mutation trait (1: Divine Grace)
      await waitFor(() => {
        expect(screen.queryByTestId('trait-card-Speed Boost')).not.toBeInTheDocument();
        expect(screen.queryByTestId('trait-card-Steady Temperament')).not.toBeInTheDocument();
        expect(screen.queryByTestId('trait-card-Endurance Master')).not.toBeInTheDocument();
        expect(screen.getByTestId('trait-card-Divine Grace')).toBeInTheDocument();
      });
    });
  });

  describe('Combined Filtering', () => {
    beforeEach(() => {
      vi.mocked(useHorseGeneticsModule.useHorseEpigeneticInsights).mockReturnValue({
        data: mockEpigeneticData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitInteractions).mockReturnValue({
        data: mockInteractionsData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitTimeline).mockReturnValue({
        data: mockTimelineData,
        isLoading: false,
        error: null,
      } as any);
    });

    test('applies multiple filters: epigenetic + rare', async () => {
      // Equoria-e1ccb: genetic+common is no longer expressible (no genetic
      // data/option). epigenetic+rare uniquely matches Endurance Master.
      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        const epigeneticHeading = headings.find((h) =>
          h.textContent?.includes('Epigenetic Traits')
        );
        expect(epigeneticHeading).toBeInTheDocument();
      });

      // Apply type filter: epigenetic
      const filters = screen.getAllByRole('combobox');
      const typeFilter = filters[0]; // First filter is Type
      fireEvent.change(typeFilter, { target: { value: 'epigenetic' } });

      // Apply rarity filter: rare
      const rarityFilter = filters[1]; // Second filter is Rarity
      fireEvent.change(rarityFilter, { target: { value: 'rare' } });

      // Should only show Endurance Master (epigenetic + rare)
      await waitFor(() => {
        expect(screen.getByTestId('trait-card-Endurance Master')).toBeInTheDocument();
        expect(screen.queryByTestId('trait-card-Speed Boost')).not.toBeInTheDocument();
        expect(screen.queryByTestId('trait-card-Divine Grace')).not.toBeInTheDocument();
        expect(screen.queryByTestId('trait-card-Steady Temperament')).not.toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    beforeEach(() => {
      vi.mocked(useHorseGeneticsModule.useHorseEpigeneticInsights).mockReturnValue({
        data: mockEpigeneticData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitInteractions).mockReturnValue({
        data: mockInteractionsData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitTimeline).mockReturnValue({
        data: mockTimelineData,
        isLoading: false,
        error: null,
      } as any);
    });

    test('sorts traits by name (A-Z)', async () => {
      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        const epigeneticHeading = headings.find((h) =>
          h.textContent?.includes('Epigenetic Traits')
        );
        expect(epigeneticHeading).toBeInTheDocument();
      });

      // Change sort to name
      const filters = screen.getAllByRole('combobox');
      const sortFilter = filters[3]; // Fourth filter is Sort By
      fireEvent.change(sortFilter, { target: { value: 'name' } });

      // Verify traits appear in alphabetical order.
      // Equoria-e1ccb: single epigenetic section now, so this is a pure A-Z
      // ordering (previously split across genetic/epigenetic sections).
      await waitFor(() => {
        const traitCards = screen.getAllByTestId(/trait-card-/);
        const traitNames = traitCards.map((card) => card.textContent?.split(' (')[0]);
        expect(traitNames).toEqual([
          'Divine Grace',
          'Endurance Master',
          'Speed Boost',
          'Steady Temperament',
        ]);
      });
    });

    test('sorts traits by strength (high to low)', async () => {
      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        const epigeneticHeading = headings.find((h) =>
          h.textContent?.includes('Epigenetic Traits')
        );
        expect(epigeneticHeading).toBeInTheDocument();
      });

      // Change sort to strength
      const filters = screen.getAllByRole('combobox');
      const sortFilter = filters[3]; // Fourth filter is Sort By
      fireEvent.change(sortFilter, { target: { value: 'strength' } });

      // Verify traits appear in strength order (95, 85, 75, 60).
      // Equoria-e1ccb: single epigenetic section now, so this is a pure
      // descending-strength ordering across all traits.
      await waitFor(() => {
        const traitCards = screen.getAllByTestId(/trait-card-/);
        const traitNames = traitCards.map((card) => card.textContent?.split(' (')[0]);
        expect(traitNames).toEqual([
          'Divine Grace', // 95
          'Endurance Master', // 85
          'Speed Boost', // 75
          'Steady Temperament', // 60
        ]);
      });
    });
  });

  describe('Empty States', () => {
    beforeEach(() => {
      vi.mocked(useHorseGeneticsModule.useHorseEpigeneticInsights).mockReturnValue({
        data: mockEpigeneticData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitInteractions).mockReturnValue({
        data: mockInteractionsData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitTimeline).mockReturnValue({
        data: mockTimelineData,
        isLoading: false,
        error: null,
      } as any);
    });

    test('displays "no traits match" when filters return no results', async () => {
      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        const epigeneticHeading = headings.find((h) =>
          h.textContent?.includes('Epigenetic Traits')
        );
        expect(epigeneticHeading).toBeInTheDocument();
      });

      // Apply filters that won't match any traits. Equoria-e1ccb: all traits
      // are epigenetic now, so epigenetic+legendary WOULD match Divine Grace.
      // Use legendary + source=dam instead — Divine Grace is legendary but
      // mutation-sourced, so the combo matches nothing.
      const filters = screen.getAllByRole('combobox');
      const rarityFilter = filters[1]; // Second filter is Rarity
      fireEvent.change(rarityFilter, { target: { value: 'legendary' } });

      const sourceFilter = filters[2]; // Third filter is Source
      fireEvent.change(sourceFilter, { target: { value: 'dam' } });

      // Should show empty state message
      await waitFor(() => {
        expect(screen.getByText(/no traits match the current filters/i)).toBeInTheDocument();
        expect(screen.queryByTestId(/trait-card-/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Filters & Sorting UI', () => {
    beforeEach(() => {
      vi.mocked(useHorseGeneticsModule.useHorseEpigeneticInsights).mockReturnValue({
        data: mockEpigeneticData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitInteractions).mockReturnValue({
        data: mockInteractionsData,
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useHorseGeneticsModule.useHorseTraitTimeline).mockReturnValue({
        data: mockTimelineData,
        isLoading: false,
        error: null,
      } as any);
    });

    test('renders all filter and sort controls', async () => {
      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        const epigeneticHeading = headings.find((h) =>
          h.textContent?.includes('Epigenetic Traits')
        );
        expect(epigeneticHeading).toBeInTheDocument();
      });

      // Verify all controls are present
      const filters = screen.getAllByRole('combobox');
      expect(filters).toHaveLength(4); // Type, Rarity, Source, Sort By
      expect(filters[0]).toBeInTheDocument(); // Type filter
      expect(filters[1]).toBeInTheDocument(); // Rarity filter
      expect(filters[2]).toBeInTheDocument(); // Source filter
      expect(filters[3]).toBeInTheDocument(); // Sort By filter

      // Verify section header
      expect(screen.getByText(/filters & sorting/i)).toBeInTheDocument();
    });

    test('filter controls have correct default values', async () => {
      const TestWrapper = createTestWrapper();
      window.history.pushState({}, 'Test', '/horses/123');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const geneticsTab = screen.getByText('Genetics');
      fireEvent.click(geneticsTab);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 3 });
        const epigeneticHeading = headings.find((h) =>
          h.textContent?.includes('Epigenetic Traits')
        );
        expect(epigeneticHeading).toBeInTheDocument();
      });

      // Verify default values
      const filters = screen.getAllByRole('combobox');
      expect(filters[0]).toHaveValue('all'); // Type filter default
      expect(filters[1]).toHaveValue('all'); // Rarity filter default
      expect(filters[2]).toHaveValue('all'); // Source filter default
      expect(filters[3]).toHaveValue('name'); // Sort By filter default
    });
  });
});
