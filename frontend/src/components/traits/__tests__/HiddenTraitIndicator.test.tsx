/**
 * Tests for HiddenTraitIndicator Component
 *
 * Testing Sprint - Story 6-6: Epigenetic Trait System
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - All traits discovered state
 * - Hidden traits display
 * - Progress bar rendering and calculation
 * - Discovery hint display
 * - Generic encouragement display
 * - Mystery trait cards (up to 6 visible, overflow handling)
 * - Props handling (showProgress, showHint)
 * - Integration with calculateDiscoveryProgress helper
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HiddenTraitIndicator from '../HiddenTraitIndicator';
import type { TraitDiscoveryStatus } from '@/types/traits';

// Mock the traits type helper
vi.mock('@/types/traits', async () => {
  const actual = await vi.importActual('@/types/traits');
  return {
    ...actual,
    calculateDiscoveryProgress: vi.fn((status: TraitDiscoveryStatus) => {
      const total = status.totalTraits;
      const discovered = status.discoveredTraits + status.partiallyDiscoveredTraits * 0.5;
      return Math.round((discovered / total) * 100);
    }),
  };
});

describe('HiddenTraitIndicator Component', () => {
  describe('all traits discovered state', () => {
    const allDiscoveredStatus: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 10,
      discoveredTraits: 10,
      partiallyDiscoveredTraits: 0,
      hiddenTraits: 0,
      discoveryProgress: 100,
    };

    it('should show success state when all traits are discovered', () => {
      render(<HiddenTraitIndicator discoveryStatus={allDiscoveredStatus} />);
      expect(screen.getByText('All Traits Discovered!')).toBeInTheDocument();
      expect(
        screen.getByText(/You have discovered all traits for this horse/i)
      ).toBeInTheDocument();
    });

    it('should show Sparkles icon for all discovered state', () => {
      const { container } = render(<HiddenTraitIndicator discoveryStatus={allDiscoveredStatus} />);
      // Sparkles icon should be present
      expect(container.querySelector('.text-green-600')).toBeInTheDocument();
    });

    it('should not show hidden traits UI when all discovered', () => {
      render(<HiddenTraitIndicator discoveryStatus={allDiscoveredStatus} />);
      expect(screen.queryByText('Hidden Traits')).not.toBeInTheDocument();
      expect(screen.queryByText(/yet to be discovered/i)).not.toBeInTheDocument();
    });
  });

  describe('hidden traits display', () => {
    const hiddenTraitsStatus: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 10,
      discoveredTraits: 5,
      partiallyDiscoveredTraits: 2,
      hiddenTraits: 3,
      discoveryProgress: 60,
    };

    it('should display hidden traits header', () => {
      render(<HiddenTraitIndicator discoveryStatus={hiddenTraitsStatus} />);
      expect(screen.getByText('Hidden Traits')).toBeInTheDocument();
    });

    it('should show correct count of hidden traits (singular)', () => {
      const singleHidden: TraitDiscoveryStatus = {
        ...hiddenTraitsStatus,
        hiddenTraits: 1,
      };
      render(<HiddenTraitIndicator discoveryStatus={singleHidden} />);
      expect(screen.getByText('1 trait yet to be discovered')).toBeInTheDocument();
    });

    it('should show correct count of hidden traits (plural)', () => {
      render(<HiddenTraitIndicator discoveryStatus={hiddenTraitsStatus} />);
      expect(screen.getByText('3 traits yet to be discovered')).toBeInTheDocument();
    });

    it('should show Lock icon for hidden traits', () => {
      const { container } = render(<HiddenTraitIndicator discoveryStatus={hiddenTraitsStatus} />);
      expect(container.querySelector('.text-slate-600')).toBeInTheDocument();
    });
  });

  describe('progress bar rendering', () => {
    const progressStatus: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 10,
      discoveredTraits: 6,
      partiallyDiscoveredTraits: 2,
      hiddenTraits: 2,
      discoveryProgress: 70,
    };

    it('should show progress bar by default', () => {
      render(<HiddenTraitIndicator discoveryStatus={progressStatus} />);
      expect(screen.getByText('Discovery Progress')).toBeInTheDocument();
    });

    it('should display correct progress percentage', () => {
      render(<HiddenTraitIndicator discoveryStatus={progressStatus} />);
      expect(screen.getByText('70%')).toBeInTheDocument();
    });

    it('should show discovered count', () => {
      render(<HiddenTraitIndicator discoveryStatus={progressStatus} />);
      expect(screen.getByText('6 discovered')).toBeInTheDocument();
    });

    it('should show hidden count', () => {
      render(<HiddenTraitIndicator discoveryStatus={progressStatus} />);
      expect(screen.getByText('2 hidden')).toBeInTheDocument();
    });

    it('should show partially discovered count when present', () => {
      render(<HiddenTraitIndicator discoveryStatus={progressStatus} />);
      expect(screen.getByText('2 partial')).toBeInTheDocument();
    });

    it('should not show partial count when zero', () => {
      const noPartial: TraitDiscoveryStatus = {
        ...progressStatus,
        partiallyDiscoveredTraits: 0,
      };
      render(<HiddenTraitIndicator discoveryStatus={noPartial} />);
      expect(screen.queryByText(/partial/i)).not.toBeInTheDocument();
    });

    it('should hide progress bar when showProgress is false', () => {
      render(<HiddenTraitIndicator discoveryStatus={progressStatus} showProgress={false} />);
      expect(screen.queryByText('Discovery Progress')).not.toBeInTheDocument();
    });

    it('should render progress bar with correct width', () => {
      const { container } = render(<HiddenTraitIndicator discoveryStatus={progressStatus} />);
      const progressBar = container.querySelector('[style*="width: 70%"]');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('discovery hint display', () => {
    const hintStatus: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 10,
      discoveredTraits: 7,
      partiallyDiscoveredTraits: 1,
      hiddenTraits: 2,
      nextDiscoveryHint: 'Complete the socialization milestone to unlock the next trait',
      discoveryProgress: 75,
    };

    it('should show discovery hint when provided', () => {
      render(<HiddenTraitIndicator discoveryStatus={hintStatus} />);
      expect(screen.getByText('Discovery Hint')).toBeInTheDocument();
      expect(screen.getByText(/Complete the socialization milestone/i)).toBeInTheDocument();
    });

    it('should show HelpCircle icon with hint', () => {
      const { container } = render(<HiddenTraitIndicator discoveryStatus={hintStatus} />);
      expect(container.querySelector('.text-blue-600')).toBeInTheDocument();
    });

    it('should hide hint when showHint is false', () => {
      render(<HiddenTraitIndicator discoveryStatus={hintStatus} showHint={false} />);
      expect(screen.queryByText('Discovery Hint')).not.toBeInTheDocument();
    });
  });

  describe('generic encouragement display', () => {
    const noHintStatus: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 10,
      discoveredTraits: 3,
      partiallyDiscoveredTraits: 0,
      hiddenTraits: 7,
      discoveryProgress: 30,
    };

    it('should show generic encouragement when no hint provided', () => {
      render(<HiddenTraitIndicator discoveryStatus={noHintStatus} />);
      expect(screen.getByText('How to Discover Traits')).toBeInTheDocument();
    });

    it('should show all discovery methods', () => {
      render(<HiddenTraitIndicator discoveryStatus={noHintStatus} />);
      expect(screen.getByText(/Complete developmental milestones/i)).toBeInTheDocument();
      expect(screen.getByText(/Engage in enrichment activities/i)).toBeInTheDocument();
      expect(screen.getByText(/Maintain consistent care quality/i)).toBeInTheDocument();
      expect(screen.getByText(/Compete in various disciplines/i)).toBeInTheDocument();
    });

    it('should hide generic encouragement when showHint is false', () => {
      render(<HiddenTraitIndicator discoveryStatus={noHintStatus} showHint={false} />);
      expect(screen.queryByText('How to Discover Traits')).not.toBeInTheDocument();
    });

    it('should not show generic encouragement when hint is provided', () => {
      const withHint: TraitDiscoveryStatus = {
        ...noHintStatus,
        nextDiscoveryHint: 'Complete a milestone',
      };
      render(<HiddenTraitIndicator discoveryStatus={withHint} />);
      expect(screen.queryByText('How to Discover Traits')).not.toBeInTheDocument();
      expect(screen.getByText('Discovery Hint')).toBeInTheDocument();
    });
  });

  describe('mystery trait cards', () => {
    it('should show correct number of mystery cards (1 hidden)', () => {
      const oneHidden: TraitDiscoveryStatus = {
        horseId: 1,
        totalTraits: 10,
        discoveredTraits: 9,
        partiallyDiscoveredTraits: 0,
        hiddenTraits: 1,
        discoveryProgress: 90,
      };
      const { container } = render(<HiddenTraitIndicator discoveryStatus={oneHidden} />);
      const mysteryCards = container.querySelectorAll('.border-dashed');
      expect(mysteryCards).toHaveLength(1);
    });

    it('should show correct number of mystery cards (3 hidden)', () => {
      const threeHidden: TraitDiscoveryStatus = {
        horseId: 1,
        totalTraits: 10,
        discoveredTraits: 7,
        partiallyDiscoveredTraits: 0,
        hiddenTraits: 3,
        discoveryProgress: 70,
      };
      const { container } = render(<HiddenTraitIndicator discoveryStatus={threeHidden} />);
      const mysteryCards = container.querySelectorAll('.border-dashed');
      expect(mysteryCards).toHaveLength(3);
    });

    it('should show maximum 6 mystery cards when 6 hidden', () => {
      const sixHidden: TraitDiscoveryStatus = {
        horseId: 1,
        totalTraits: 10,
        discoveredTraits: 4,
        partiallyDiscoveredTraits: 0,
        hiddenTraits: 6,
        discoveryProgress: 40,
      };
      const { container } = render(<HiddenTraitIndicator discoveryStatus={sixHidden} />);
      const mysteryCards = container.querySelectorAll('.border-dashed');
      expect(mysteryCards).toHaveLength(6);
    });

    it('should show 6 cards + overflow indicator when more than 6 hidden', () => {
      const eightHidden: TraitDiscoveryStatus = {
        horseId: 1,
        totalTraits: 10,
        discoveredTraits: 2,
        partiallyDiscoveredTraits: 0,
        hiddenTraits: 8,
        discoveryProgress: 20,
      };
      const { container } = render(<HiddenTraitIndicator discoveryStatus={eightHidden} />);
      const mysteryCards = container.querySelectorAll('.border-dashed');
      expect(mysteryCards).toHaveLength(7); // 6 cards + 1 overflow card
      expect(screen.getByText('+2')).toBeInTheDocument(); // 8 - 6 = 2
    });

    it('should show question mark in mystery cards', () => {
      const threeHidden: TraitDiscoveryStatus = {
        horseId: 1,
        totalTraits: 10,
        discoveredTraits: 7,
        partiallyDiscoveredTraits: 0,
        hiddenTraits: 3,
        discoveryProgress: 70,
      };
      render(<HiddenTraitIndicator discoveryStatus={threeHidden} />);
      const questionMarks = screen.getAllByText('?');
      expect(questionMarks).toHaveLength(3);
    });

    it('should show correct overflow count for 10 hidden traits', () => {
      const tenHidden: TraitDiscoveryStatus = {
        horseId: 1,
        totalTraits: 10,
        discoveredTraits: 0,
        partiallyDiscoveredTraits: 0,
        hiddenTraits: 10,
        discoveryProgress: 0,
      };
      render(<HiddenTraitIndicator discoveryStatus={tenHidden} />);
      expect(screen.getByText('+4')).toBeInTheDocument(); // 10 - 6 = 4
    });
  });

  describe('props combination', () => {
    const status: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 10,
      discoveredTraits: 5,
      partiallyDiscoveredTraits: 2,
      hiddenTraits: 3,
      nextDiscoveryHint: 'Complete milestone X',
      discoveryProgress: 60,
    };

    it('should show all elements when all props are true', () => {
      render(<HiddenTraitIndicator discoveryStatus={status} showProgress={true} showHint={true} />);
      expect(screen.getByText('Discovery Progress')).toBeInTheDocument();
      expect(screen.getByText('Discovery Hint')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('should hide progress and hint when both props are false', () => {
      render(
        <HiddenTraitIndicator discoveryStatus={status} showProgress={false} showHint={false} />
      );
      expect(screen.queryByText('Discovery Progress')).not.toBeInTheDocument();
      expect(screen.queryByText('Discovery Hint')).not.toBeInTheDocument();
      expect(screen.getByText('Hidden Traits')).toBeInTheDocument(); // Header still shows
    });
  });

  describe('styling and layout', () => {
    const status: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 10,
      discoveredTraits: 5,
      partiallyDiscoveredTraits: 1,
      hiddenTraits: 4,
      discoveryProgress: 55,
    };

    it('should apply gradient background to main container', () => {
      const { container } = render(<HiddenTraitIndicator discoveryStatus={status} />);
      expect(
        container.querySelector('.bg-gradient-to-br.from-slate-50.to-gray-50')
      ).toBeInTheDocument();
    });

    it('should apply gradient to progress bar', () => {
      const { container } = render(<HiddenTraitIndicator discoveryStatus={status} />);
      expect(
        container.querySelector('.bg-gradient-to-r.from-blue-500.to-purple-500')
      ).toBeInTheDocument();
    });

    it('should have grid layout for mystery cards', () => {
      const { container } = render(<HiddenTraitIndicator discoveryStatus={status} />);
      expect(container.querySelector('.grid.grid-cols-3')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle 0% progress', () => {
      const zeroProgress: TraitDiscoveryStatus = {
        horseId: 1,
        totalTraits: 10,
        discoveredTraits: 0,
        partiallyDiscoveredTraits: 0,
        hiddenTraits: 10,
        discoveryProgress: 0,
      };
      render(<HiddenTraitIndicator discoveryStatus={zeroProgress} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle near-complete progress (99%)', () => {
      const nearComplete: TraitDiscoveryStatus = {
        horseId: 1,
        totalTraits: 100,
        discoveredTraits: 99,
        partiallyDiscoveredTraits: 0,
        hiddenTraits: 1,
        discoveryProgress: 99,
      };
      render(<HiddenTraitIndicator discoveryStatus={nearComplete} />);
      expect(screen.getByText('99%')).toBeInTheDocument();
    });

    it('should handle large number of hidden traits', () => {
      const manyHidden: TraitDiscoveryStatus = {
        horseId: 1,
        totalTraits: 50,
        discoveredTraits: 10,
        partiallyDiscoveredTraits: 0,
        hiddenTraits: 40,
        discoveryProgress: 20,
      };
      render(<HiddenTraitIndicator discoveryStatus={manyHidden} />);
      expect(screen.getByText('40 traits yet to be discovered')).toBeInTheDocument();
      expect(screen.getByText('+34')).toBeInTheDocument(); // 40 - 6 = 34
    });
  });
});
