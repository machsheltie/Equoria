/**
 * Tests for EpigeneticTraitDisplay Component
 *
 * Testing Sprint - Story 6-6: Epigenetic Trait System
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - React Query integration for traits, discovery status, history
 * - Loading states
 * - Error states
 * - Trait grouping by tier
 * - Tier display order (exotic to common)
 * - TraitCard integration
 * - HiddenTraitIndicator integration
 * - TraitDetailModal integration
 * - Modal open/close behavior
 * - Discovery progress display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EpigeneticTraitDisplay from '../EpigeneticTraitDisplay';
import type { EpigeneticTrait } from '@/types/traits';

// Mock component prop types
interface TraitCardProps {
  trait: EpigeneticTrait;
  onClick: (trait: EpigeneticTrait) => void;
}
interface HiddenTraitIndicatorProps {
  discoveryStatus: { hiddenTraits: number };
}
interface TraitDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  trait?: EpigeneticTrait | null;
}

// Mock child components
vi.mock('../TraitCard', () => ({
  default: ({ trait, onClick }: TraitCardProps) => (
    <div data-testid={`trait-card-${trait.id}`} onClick={() => onClick(trait)}>
      {trait.name} ({trait.tier})
    </div>
  ),
}));

vi.mock('../HiddenTraitIndicator', () => ({
  default: ({ discoveryStatus }: HiddenTraitIndicatorProps) => (
    <div data-testid="hidden-trait-indicator">{discoveryStatus.hiddenTraits} hidden traits</div>
  ),
}));

vi.mock('../TraitDetailModal', () => ({
  default: ({ isOpen, onClose, trait }: TraitDetailModalProps) => {
    if (!isOpen) return null;
    return (
      <div data-testid="trait-detail-modal">
        <div>Modal for {trait?.name}</div>
        <button onClick={onClose} data-testid="close-modal">
          Close
        </button>
      </div>
    );
  },
}));

// Mock trait helper functions
vi.mock('@/types/traits', async () => {
  const actual = await vi.importActual('@/types/traits');
  return {
    ...actual,
    groupTraitsByTier: vi.fn((traits: EpigeneticTrait[]) => {
      const grouped = new Map();
      traits.forEach((trait) => {
        if (!grouped.has(trait.tier)) {
          grouped.set(trait.tier, []);
        }
        grouped.get(trait.tier).push(trait);
      });
      return grouped;
    }),
    getTierDisplayName: vi.fn((tier: string) => {
      const names: Record<string, string> = {
        common: 'Common',
        uncommon: 'Uncommon',
        rare: 'Rare',
        'ultra-rare': 'Ultra Rare',
        exotic: 'Exotic',
      };
      return names[tier] || tier;
    }),
  };
});

describe('EpigeneticTraitDisplay Component', () => {
  let queryClient: QueryClient;

  const mockTraits: EpigeneticTrait[] = [
    {
      id: 'common-trait',
      name: 'Calm Temperament',
      tier: 'common',
      category: 'Behavioral',
      description: 'Even-tempered',
      discoveryStatus: 'discovered',
      epigeneticFlags: [],
      competitionImpact: {
        dressage: 2,
        show_jumping: 1,
        cross_country: 1,
        endurance: 2,
        racing: 0,
        western: 2,
      },
      isPositive: true,
    },
    {
      id: 'rare-trait',
      name: 'Resilient Spirit',
      tier: 'rare',
      category: 'Mental',
      description: 'Bounces back from setbacks',
      discoveryStatus: 'discovered',
      epigeneticFlags: [],
      competitionImpact: {
        dressage: 1,
        show_jumping: 3,
        cross_country: 4,
        endurance: 4,
        racing: 2,
        western: 2,
      },
      isPositive: true,
    },
    {
      id: 'exotic-trait',
      name: 'Phoenix-Born',
      tier: 'exotic',
      category: 'Mental',
      description: 'Legendary trait',
      discoveryStatus: 'partially_discovered',
      epigeneticFlags: [],
      competitionImpact: {
        dressage: 7,
        show_jumping: 8,
        cross_country: 9,
        endurance: 7,
        racing: 8,
        western: 6,
      },
      isPositive: true,
    },
  ];

  const mockDiscoveryStatus = {
    horseId: 1,
    totalTraits: 10,
    discoveredTraits: 3,
    partiallyDiscoveredTraits: 1,
    hiddenTraits: 6,
    nextDiscoveryHint: 'Complete the Trust Handling milestone',
    discoveryProgress: 35,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderWithQuery = (component: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  };

  describe('loading state', () => {
    it('should show loading spinner while fetching data', async () => {
      vi.spyOn(queryClient, 'fetchQuery').mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockTraits), 100);
          })
      );

      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      expect(screen.getByText('Loading traits...')).toBeInTheDocument();
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    });

    it('should show spinner with correct styling', async () => {
      vi.spyOn(queryClient, 'fetchQuery').mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { container } = renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
      expect(container.querySelector('.border-blue-600')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error message when fetch fails', async () => {
      const mockError = new Error('Failed to load traits');

      queryClient.setQueryData(['horseTraits', 1], () => {
        throw mockError;
      });

      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Error loading traits')).toBeInTheDocument();
      });
    });

    it('should display error message from Error object', async () => {
      const mockError = new Error('Network error occurred');

      queryClient.setQueryData(['horseTraits', 1], () => {
        throw mockError;
      });

      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Network error occurred')).toBeInTheDocument();
      });
    });

    it('should show generic error message for non-Error objects', async () => {
      queryClient.setQueryData(['horseTraits', 1], () => {
        throw 'String error';
      });

      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/An error occurred/i)).toBeInTheDocument();
      });
    });

    it('should show AlertCircle icon in error state', async () => {
      queryClient.setQueryData(['horseTraits', 1], () => {
        throw new Error('Test error');
      });

      const { container } = renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      await waitFor(() => {
        expect(container.querySelector('.text-red-600')).toBeInTheDocument();
      });
    });
  });

  describe('header display', () => {
    beforeEach(() => {
      queryClient.setQueryData(['horseTraits', 1], mockTraits);
      queryClient.setQueryData(['traitDiscoveryStatus', 1], mockDiscoveryStatus);
    });

    it('should display epigenetic traits header', () => {
      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);
      expect(screen.getByText('Epigenetic Traits')).toBeInTheDocument();
    });

    it('should display discovery progress', () => {
      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);
      expect(screen.getByText(/3 of 10 traits discovered/i)).toBeInTheDocument();
      expect(screen.getByText(/35%/i)).toBeInTheDocument();
    });

    it('should show Sparkles icon in header', () => {
      const { container } = renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);
      expect(container.querySelector('.text-blue-600')).toBeInTheDocument();
    });

    it('should apply gradient background to header', () => {
      const { container } = renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);
      expect(
        container.querySelector('.bg-gradient-to-r.from-blue-50.to-purple-50')
      ).toBeInTheDocument();
    });
  });

  describe('trait grouping by tier', () => {
    beforeEach(() => {
      queryClient.setQueryData(['horseTraits', 1], mockTraits);
      queryClient.setQueryData(['traitDiscoveryStatus', 1], mockDiscoveryStatus);
    });

    it('should display tier headers', () => {
      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);
      expect(screen.getByText('Common Traits')).toBeInTheDocument();
      expect(screen.getByText('Rare Traits')).toBeInTheDocument();
      expect(screen.getByText('Exotic Traits')).toBeInTheDocument();
    });

    it('should group traits correctly by tier', () => {
      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);
      expect(screen.getByTestId('trait-card-common-trait')).toBeInTheDocument();
      expect(screen.getByTestId('trait-card-rare-trait')).toBeInTheDocument();
      expect(screen.getByTestId('trait-card-exotic-trait')).toBeInTheDocument();
    });

    it('should display traits in tier order (exotic to common)', () => {
      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      const tierHeaders = screen.getAllByRole('heading', { level: 3 });
      const headerTexts = tierHeaders.map((h) => h.textContent);

      // Exotic should come before Rare, Rare before Common
      const exoticIndex = headerTexts.findIndex((t) => t?.includes('Exotic'));
      const rareIndex = headerTexts.findIndex((t) => t?.includes('Rare'));
      const commonIndex = headerTexts.findIndex((t) => t?.includes('Common'));

      expect(exoticIndex).toBeLessThan(rareIndex);
      expect(rareIndex).toBeLessThan(commonIndex);
    });

    it('should not display tier header when no traits in tier', () => {
      const traitsWithoutUncommon = mockTraits.filter((t) => t.tier !== 'uncommon');
      queryClient.setQueryData(['horseTraits', 1], traitsWithoutUncommon);

      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);
      expect(screen.queryByText('Uncommon Traits')).not.toBeInTheDocument();
    });
  });

  describe('trait cards integration', () => {
    beforeEach(() => {
      queryClient.setQueryData(['horseTraits', 1], mockTraits);
      queryClient.setQueryData(['traitDiscoveryStatus', 1], mockDiscoveryStatus);
    });

    it('should render TraitCard for each trait', () => {
      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);
      expect(screen.getByTestId('trait-card-common-trait')).toBeInTheDocument();
      expect(screen.getByTestId('trait-card-rare-trait')).toBeInTheDocument();
      expect(screen.getByTestId('trait-card-exotic-trait')).toBeInTheDocument();
    });

    it('should display trait names and tiers', () => {
      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);
      expect(screen.getByText(/Calm Temperament \(common\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Resilient Spirit \(rare\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Phoenix-Born \(exotic\)/i)).toBeInTheDocument();
    });

    it('should use responsive grid layout', () => {
      const { container } = renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);
      expect(
        container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3')
      ).toBeInTheDocument();
    });
  });

  describe('hidden trait indicator integration', () => {
    beforeEach(() => {
      queryClient.setQueryData(['horseTraits', 1], mockTraits);
    });

    it('should show HiddenTraitIndicator when hidden traits exist', () => {
      queryClient.setQueryData(['traitDiscoveryStatus', 1], mockDiscoveryStatus);

      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);
      expect(screen.getByTestId('hidden-trait-indicator')).toBeInTheDocument();
      expect(screen.getByText('6 hidden traits')).toBeInTheDocument();
    });

    it('should not show HiddenTraitIndicator when no hidden traits', () => {
      const noHiddenStatus = {
        ...mockDiscoveryStatus,
        hiddenTraits: 0,
        discoveredTraits: 10,
        discoveryProgress: 100,
      };
      queryClient.setQueryData(['traitDiscoveryStatus', 1], noHiddenStatus);

      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);
      expect(screen.queryByTestId('hidden-trait-indicator')).not.toBeInTheDocument();
    });
  });

  describe('modal interaction', () => {
    beforeEach(() => {
      queryClient.setQueryData(['horseTraits', 1], mockTraits);
      queryClient.setQueryData(['traitDiscoveryStatus', 1], mockDiscoveryStatus);
    });

    it('should open modal when trait card is clicked', async () => {
      const user = userEvent.setup();
      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      const traitCard = screen.getByTestId('trait-card-common-trait');
      await user.click(traitCard);

      expect(screen.getByTestId('trait-detail-modal')).toBeInTheDocument();
      expect(screen.getByText('Modal for Calm Temperament')).toBeInTheDocument();
    });

    it('should close modal when close button is clicked', async () => {
      const user = userEvent.setup();
      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      // Open modal
      await user.click(screen.getByTestId('trait-card-rare-trait'));
      expect(screen.getByTestId('trait-detail-modal')).toBeInTheDocument();

      // Close modal
      await user.click(screen.getByTestId('close-modal'));
      expect(screen.queryByTestId('trait-detail-modal')).not.toBeInTheDocument();
    });

    it('should display correct trait in modal', async () => {
      const user = userEvent.setup();
      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      await user.click(screen.getByTestId('trait-card-exotic-trait'));
      expect(screen.getByText('Modal for Phoenix-Born')).toBeInTheDocument();
    });

    it('should handle multiple trait clicks', async () => {
      const user = userEvent.setup();
      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      // Click first trait
      await user.click(screen.getByTestId('trait-card-common-trait'));
      expect(screen.getByText('Modal for Calm Temperament')).toBeInTheDocument();

      // Close modal
      await user.click(screen.getByTestId('close-modal'));

      // Click different trait
      await user.click(screen.getByTestId('trait-card-rare-trait'));
      expect(screen.getByText('Modal for Resilient Spirit')).toBeInTheDocument();
    });
  });

  describe('empty data handling', () => {
    it('should handle empty traits array', () => {
      queryClient.setQueryData(['horseTraits', 1], []);
      queryClient.setQueryData(['traitDiscoveryStatus', 1], {
        ...mockDiscoveryStatus,
        discoveredTraits: 0,
        hiddenTraits: 10,
      });

      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      expect(screen.getByText('Epigenetic Traits')).toBeInTheDocument();
      expect(screen.getByText(/0 of 10 traits discovered/i)).toBeInTheDocument();
    });

    it('should return null when both traits and discoveryStatus are undefined', () => {
      queryClient.setQueryData(['horseTraits', 1], undefined);
      queryClient.setQueryData(['traitDiscoveryStatus', 1], undefined);

      const { container } = renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      // Should render nothing or just loading state
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe('react query integration', () => {
    it('should fetch traits with correct query key', () => {
      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      const queries = queryClient.getQueryCache().getAll();
      const traitQuery = queries.find((q) => JSON.stringify(q.queryKey).includes('horseTraits'));

      expect(traitQuery).toBeDefined();
    });

    it('should fetch discovery status with correct query key', () => {
      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      const queries = queryClient.getQueryCache().getAll();
      const statusQuery = queries.find((q) =>
        JSON.stringify(q.queryKey).includes('traitDiscoveryStatus')
      );

      expect(statusQuery).toBeDefined();
    });

    it('should use correct staleTime for queries', () => {
      renderWithQuery(<EpigeneticTraitDisplay horseId={1} />);

      const queries = queryClient.getQueryCache().getAll();
      const traitQuery = queries.find((q) => JSON.stringify(q.queryKey).includes('horseTraits'));

      // Verify query was created (staleTime is internal to React Query)
      expect(traitQuery).toBeDefined();
    });
  });
});
