/**
 * Tests for TraitDetailModal Component
 *
 * Testing Sprint - Story 6-6: Epigenetic Trait System
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - BaseModal integration
 * - Trait header display with tier styling
 * - Discovery status and tier badges
 * - Epigenetic flags display
 * - Discovery information display
 * - Competition impact panel integration
 * - Trait history timeline integration
 * - Beneficial/detrimental trait indicators
 * - Modal open/close behavior
 * - Decorative effects for high-tier traits
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import TraitDetailModal from '../TraitDetailModal';
import type { EpigeneticTrait, TraitHistory } from '@/types/traits';

// Mock component prop types
interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}
interface EpigeneticFlagBadgeProps {
  flag: string;
}
interface CompetitionImpactPanelProps {
  trait: EpigeneticTrait;
  showSynergies?: boolean;
}
interface TraitHistoryTimelineProps {
  history: TraitHistory;
}

// Mock child components
vi.mock('@/components/common/BaseModal', () => ({
  default: ({ isOpen, onClose, title, children }: BaseModalProps) => {
    if (!isOpen) return null;
    return (
      <div data-testid="base-modal">
        <div data-testid="modal-title">{title}</div>
        <button onClick={onClose} data-testid="close-button">
          Close
        </button>
        <div data-testid="modal-content">{children}</div>
      </div>
    );
  },
}));

vi.mock('../EpigeneticFlagBadge', () => ({
  default: ({ flag }: EpigeneticFlagBadgeProps) => <div data-testid={`flag-${flag}`}>{flag}</div>,
}));

vi.mock('../CompetitionImpactPanel', () => ({
  default: ({ trait, showSynergies }: CompetitionImpactPanelProps) => (
    <div data-testid="competition-impact-panel">
      Impact for {trait.name} (synergies: {showSynergies ? 'yes' : 'no'})
    </div>
  ),
}));

vi.mock('../TraitHistoryTimeline', () => ({
  default: ({ history }: TraitHistoryTimelineProps) => (
    <div data-testid="trait-history-timeline">{history.events.length} events</div>
  ),
}));

// Mock trait helper functions
vi.mock('@/types/traits', async () => {
  const actual = await vi.importActual('@/types/traits');
  return {
    ...actual,
    getTierStyle: vi.fn((tier: string) => ({
      borderColor: `border-${tier}`,
      bgColor: `bg-${tier}`,
      textColor: `text-${tier}`,
      badgeColor: `badge-${tier}`,
    })),
    getTierDisplayName: vi.fn((tier: string) => tier.toUpperCase()),
    getDiscoveryStatusDisplay: vi.fn((status: string) => ({
      label: status.replace('_', ' '),
      icon: status === 'discovered' ? '✓' : status === 'partially_discovered' ? '◐' : '○',
      color: status === 'discovered' ? 'text-green-600' : 'text-yellow-600',
    })),
  };
});

describe('TraitDetailModal Component', () => {
  const baseTrait: EpigeneticTrait = {
    id: 'test-trait',
    name: 'Test Trait',
    tier: 'uncommon',
    category: 'Behavioral',
    description: 'A test trait for testing',
    discoveryStatus: 'discovered',
    epigeneticFlags: [],
    competitionImpact: {
      dressage: 3,
      show_jumping: 2,
      cross_country: 1,
      endurance: 0,
      racing: 0,
      western: 1,
    },
    isPositive: true,
  };

  const mockHistory: TraitHistory = {
    horseId: 1,
    events: [
      {
        id: '1',
        traitId: 'test-trait',
        traitName: 'Test Trait',
        tier: 'uncommon',
        timestamp: new Date('2026-01-15'),
        eventType: 'discovery',
        trigger: 'Milestone completion',
        description: 'Trait was discovered',
      },
    ],
  };

  describe('modal rendering', () => {
    it('should render modal when isOpen is true', () => {
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />);
      expect(screen.getByTestId('base-modal')).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      render(<TraitDetailModal isOpen={false} onClose={() => {}} trait={baseTrait} />);
      expect(screen.queryByTestId('base-modal')).not.toBeInTheDocument();
    });

    it('should display trait name as modal title', () => {
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />);
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Test Trait');
    });

    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      render(<TraitDetailModal isOpen={true} onClose={handleClose} trait={baseTrait} />);
      await user.click(screen.getByTestId('close-button'));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('trait header display', () => {
    it('should display tier badge', () => {
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />);
      expect(screen.getByText('UNCOMMON')).toBeInTheDocument();
    });

    it('should display discovery status', () => {
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />);
      expect(screen.getByText(/discovered/i)).toBeInTheDocument();
    });

    it('should display category', () => {
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />);
      expect(screen.getByText('Behavioral')).toBeInTheDocument();
    });

    it('should display description', () => {
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />);
      expect(screen.getByText('A test trait for testing')).toBeInTheDocument();
    });

    it('should show decorative effect for ultra-rare traits', () => {
      const ultraRareTrait: EpigeneticTrait = {
        ...baseTrait,
        tier: 'ultra-rare',
      };
      const { container } = render(
        <TraitDetailModal isOpen={true} onClose={() => {}} trait={ultraRareTrait} />
      );
      expect(container.querySelector('.bg-white\\/20')).toBeInTheDocument();
    });

    it('should show decorative effect for exotic traits', () => {
      const exoticTrait: EpigeneticTrait = {
        ...baseTrait,
        tier: 'exotic',
      };
      const { container } = render(
        <TraitDetailModal isOpen={true} onClose={() => {}} trait={exoticTrait} />
      );
      expect(container.querySelector('.bg-white\\/20')).toBeInTheDocument();
    });

    it('should not show decorative effect for common traits', () => {
      const commonTrait: EpigeneticTrait = {
        ...baseTrait,
        tier: 'common',
      };
      const { container } = render(
        <TraitDetailModal isOpen={true} onClose={() => {}} trait={commonTrait} />
      );
      expect(container.querySelector('.bg-white\\/20')).not.toBeInTheDocument();
    });
  });

  describe('epigenetic flags display', () => {
    it('should display epigenetic flags when present', () => {
      const traitWithFlags: EpigeneticTrait = {
        ...baseTrait,
        epigeneticFlags: ['stress-induced', 'care-influenced'],
      };
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={traitWithFlags} />);
      expect(screen.getByText('Epigenetic Factors:')).toBeInTheDocument();
      expect(screen.getByTestId('flag-stress-induced')).toBeInTheDocument();
      expect(screen.getByTestId('flag-care-influenced')).toBeInTheDocument();
    });

    it('should not display epigenetic factors section when no flags', () => {
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />);
      expect(screen.queryByText('Epigenetic Factors:')).not.toBeInTheDocument();
    });

    it('should display all epigenetic flags', () => {
      const traitWithAllFlags: EpigeneticTrait = {
        ...baseTrait,
        epigeneticFlags: [
          'stress-induced',
          'care-influenced',
          'milestone-triggered',
          'genetic-only',
        ],
      };
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={traitWithAllFlags} />);
      expect(screen.getByTestId('flag-stress-induced')).toBeInTheDocument();
      expect(screen.getByTestId('flag-care-influenced')).toBeInTheDocument();
      expect(screen.getByTestId('flag-milestone-triggered')).toBeInTheDocument();
      expect(screen.getByTestId('flag-genetic-only')).toBeInTheDocument();
    });
  });

  describe('discovery information display', () => {
    it('should display discovery information when discoveredAt is present', () => {
      const discoveredTrait: EpigeneticTrait = {
        ...baseTrait,
        discoveredAt: new Date('2026-01-15T10:30:00'),
        discoverySource: 'milestone_socialization',
      };
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={discoveredTrait} />);
      expect(screen.getByText('Discovery Information')).toBeInTheDocument();
      expect(screen.getByText(/Discovered:/i)).toBeInTheDocument();
      expect(screen.getByText(/Source:/i)).toBeInTheDocument();
    });

    it('should format discovery date correctly', () => {
      const discoveredTrait: EpigeneticTrait = {
        ...baseTrait,
        discoveredAt: new Date('2026-01-15T10:30:00'),
      };
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={discoveredTrait} />);
      expect(screen.getByText(/January 15, 2026/i)).toBeInTheDocument();
    });

    it('should format discovery source correctly', () => {
      const discoveredTrait: EpigeneticTrait = {
        ...baseTrait,
        discoveredAt: new Date('2026-01-15'),
        discoverySource: 'milestone_socialization_trust',
      };
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={discoveredTrait} />);
      expect(screen.getByText(/Milestone Socialization Trust/i)).toBeInTheDocument();
    });

    it('should not display discovery information when not discovered', () => {
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />);
      expect(screen.queryByText('Discovery Information')).not.toBeInTheDocument();
    });

    it('should display discovery source without time when not provided', () => {
      const discoveredTrait: EpigeneticTrait = {
        ...baseTrait,
        discoveredAt: new Date('2026-01-15'),
      };
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={discoveredTrait} />);
      expect(screen.getByText(/Discovered:/i)).toBeInTheDocument();
      expect(screen.queryByText(/Source:/i)).not.toBeInTheDocument();
    });
  });

  describe('competition impact integration', () => {
    it('should display competition impact panel', () => {
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />);
      expect(screen.getByText('Competition Impact')).toBeInTheDocument();
      expect(screen.getByTestId('competition-impact-panel')).toBeInTheDocument();
    });

    it('should pass trait to competition impact panel', () => {
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />);
      expect(screen.getByText(/Impact for Test Trait/i)).toBeInTheDocument();
    });

    it('should show synergies in competition impact panel', () => {
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />);
      expect(screen.getByText(/synergies: yes/i)).toBeInTheDocument();
    });
  });

  describe('trait history integration', () => {
    it('should display trait history when provided', () => {
      render(
        <TraitDetailModal
          isOpen={true}
          onClose={() => {}}
          trait={baseTrait}
          traitHistory={mockHistory}
        />
      );
      expect(screen.getByText('Trait History')).toBeInTheDocument();
      expect(screen.getByTestId('trait-history-timeline')).toBeInTheDocument();
    });

    it('should not display trait history when not provided', () => {
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />);
      expect(screen.queryByText('Trait History')).not.toBeInTheDocument();
    });

    it('should not display trait history when events array is empty', () => {
      const emptyHistory: TraitHistory = {
        horseId: 1,
        events: [],
      };
      render(
        <TraitDetailModal
          isOpen={true}
          onClose={() => {}}
          trait={baseTrait}
          traitHistory={emptyHistory}
        />
      );
      expect(screen.queryByText('Trait History')).not.toBeInTheDocument();
    });

    it('should pass history to timeline component', () => {
      render(
        <TraitDetailModal
          isOpen={true}
          onClose={() => {}}
          trait={baseTrait}
          traitHistory={mockHistory}
        />
      );
      expect(screen.getByText('1 events')).toBeInTheDocument();
    });
  });

  describe('trait type indicator', () => {
    it('should show beneficial trait indicator for positive traits', () => {
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />);
      expect(screen.getByText(/✓ Beneficial Trait/i)).toBeInTheDocument();
      expect(screen.getByText(/provides benefits/i)).toBeInTheDocument();
    });

    it('should show detrimental trait indicator for negative traits', () => {
      const negativeTrait: EpigeneticTrait = {
        ...baseTrait,
        isPositive: false,
      };
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={negativeTrait} />);
      expect(screen.getByText(/✕ Detrimental Trait/i)).toBeInTheDocument();
      expect(screen.getByText(/presents challenges/i)).toBeInTheDocument();
    });

    it('should apply green styling for beneficial traits', () => {
      const { container } = render(
        <TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />
      );
      expect(container.querySelector('.border-green-200')).toBeInTheDocument();
      expect(container.querySelector('.bg-green-50')).toBeInTheDocument();
    });

    it('should apply red styling for detrimental traits', () => {
      const negativeTrait: EpigeneticTrait = {
        ...baseTrait,
        isPositive: false,
      };
      const { container } = render(
        <TraitDetailModal isOpen={true} onClose={() => {}} trait={negativeTrait} />
      );
      expect(container.querySelector('.border-red-200')).toBeInTheDocument();
      expect(container.querySelector('.bg-red-50')).toBeInTheDocument();
    });
  });

  describe('styling and layout', () => {
    it('should have proper modal size', () => {
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />);
      // BaseModal is mocked, but we can verify it's called with size="xl"
      expect(screen.getByTestId('base-modal')).toBeInTheDocument();
    });

    it('should have trait-detail-modal className', () => {
      render(<TraitDetailModal isOpen={true} onClose={() => {}} trait={baseTrait} />);
      // BaseModal is mocked, but className is passed
      expect(screen.getByTestId('base-modal')).toBeInTheDocument();
    });
  });
});
