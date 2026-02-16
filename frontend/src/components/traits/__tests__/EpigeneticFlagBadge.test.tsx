/**
 * Tests for EpigeneticFlagBadge Component
 *
 * Testing Sprint - Story 6-6: Epigenetic Trait System
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - All 4 epigenetic flag types rendering
 * - Size variants (small, medium, large)
 * - Label visibility control
 * - Tooltip visibility and hover interaction
 * - Color coding and icons for each flag type
 * - Integration with getEpigeneticFlagDisplay helper
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import EpigeneticFlagBadge from '../EpigeneticFlagBadge';
import type { EpigeneticFlag } from '@/types/traits';

// Mock the traits type helper
vi.mock('@/types/traits', async () => {
  const actual = await vi.importActual('@/types/traits');
  return {
    ...actual,
    getEpigeneticFlagDisplay: vi.fn((flag: EpigeneticFlag) => {
      const displays = {
        'stress-induced': {
          label: 'Stress-Induced',
          icon: '⚡',
          color: 'bg-orange-100 border-orange-300 text-orange-800',
          tooltip: 'This trait developed in response to stress events during early development',
        },
        'care-influenced': {
          label: 'Care-Influenced',
          icon: '💚',
          color: 'bg-green-100 border-green-300 text-green-800',
          tooltip: 'This trait was shaped by the quality of care and enrichment activities',
        },
        'milestone-triggered': {
          label: 'Milestone-Triggered',
          icon: '🎯',
          color: 'bg-blue-100 border-blue-300 text-blue-800',
          tooltip: 'This trait was unlocked by completing a specific developmental milestone',
        },
        'genetic-only': {
          label: 'Genetic',
          icon: '🧬',
          color: 'bg-purple-100 border-purple-300 text-purple-800',
          tooltip:
            'This trait is purely inherited from the parents with no environmental influence',
        },
      };
      return displays[flag];
    }),
  };
});

describe('EpigeneticFlagBadge Component', () => {
  describe('flag type rendering', () => {
    it('should render stress-induced flag with correct styling', () => {
      render(<EpigeneticFlagBadge flag="stress-induced" />);
      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('Stress-Induced')).toBeInTheDocument();
    });

    it('should render care-influenced flag with correct styling', () => {
      render(<EpigeneticFlagBadge flag="care-influenced" />);
      expect(screen.getByText('💚')).toBeInTheDocument();
      expect(screen.getByText('Care-Influenced')).toBeInTheDocument();
    });

    it('should render milestone-triggered flag with correct styling', () => {
      render(<EpigeneticFlagBadge flag="milestone-triggered" />);
      expect(screen.getByText('🎯')).toBeInTheDocument();
      expect(screen.getByText('Milestone-Triggered')).toBeInTheDocument();
    });

    it('should render genetic-only flag with correct styling', () => {
      render(<EpigeneticFlagBadge flag="genetic-only" />);
      expect(screen.getByText('🧬')).toBeInTheDocument();
      expect(screen.getByText('Genetic')).toBeInTheDocument();
    });
  });

  describe('size variants', () => {
    it('should render small size with appropriate classes', () => {
      const { container } = render(<EpigeneticFlagBadge flag="care-influenced" size="small" />);
      const badge = container.querySelector('.px-2.py-0\\.5.text-xs');
      expect(badge).toBeInTheDocument();
    });

    it('should render medium size by default', () => {
      const { container } = render(<EpigeneticFlagBadge flag="care-influenced" />);
      const badge = container.querySelector('.px-3.py-1.text-sm');
      expect(badge).toBeInTheDocument();
    });

    it('should render large size with appropriate classes', () => {
      const { container } = render(<EpigeneticFlagBadge flag="care-influenced" size="large" />);
      const badge = container.querySelector('.px-4.py-2.text-base');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('label visibility', () => {
    it('should show label by default', () => {
      render(<EpigeneticFlagBadge flag="stress-induced" />);
      expect(screen.getByText('Stress-Induced')).toBeInTheDocument();
    });

    it('should hide label when showLabel is false', () => {
      render(<EpigeneticFlagBadge flag="stress-induced" showLabel={false} />);
      expect(screen.queryByText('Stress-Induced')).not.toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument(); // Icon still shows
    });

    it('should show label when showLabel is true', () => {
      render(<EpigeneticFlagBadge flag="milestone-triggered" showLabel={true} />);
      expect(screen.getByText('Milestone-Triggered')).toBeInTheDocument();
    });
  });

  describe('tooltip interaction', () => {
    it('should not show tooltip initially', () => {
      render(<EpigeneticFlagBadge flag="genetic-only" />);
      const tooltip = screen.queryByText(/This trait is purely inherited from the parents/i);
      expect(tooltip).not.toBeInTheDocument();
    });

    it('should show tooltip on hover when showTooltip is true', async () => {
      const user = userEvent.setup();
      const { container } = render(<EpigeneticFlagBadge flag="genetic-only" />);
      const badge = container.querySelector('.relative.inline-block');

      if (!badge) throw new Error('Badge not found');
      await user.hover(badge);

      expect(
        screen.getByText(/This trait is purely inherited from the parents/i)
      ).toBeInTheDocument();
    });

    it('should hide tooltip on mouse leave', async () => {
      const user = userEvent.setup();
      const { container } = render(<EpigeneticFlagBadge flag="care-influenced" />);
      const badge = container.querySelector('.relative.inline-block');

      if (!badge) throw new Error('Badge not found');
      await user.hover(badge);
      expect(screen.getByText(/This trait was shaped by the quality of care/i)).toBeInTheDocument();

      await user.unhover(badge);
      expect(
        screen.queryByText(/This trait was shaped by the quality of care/i)
      ).not.toBeInTheDocument();
    });

    it('should not show tooltip when showTooltip is false', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <EpigeneticFlagBadge flag="stress-induced" showTooltip={false} />
      );
      const badge = container.querySelector('.relative.inline-block');

      if (!badge) throw new Error('Badge not found');
      await user.hover(badge);

      expect(
        screen.queryByText(/This trait developed in response to stress/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('tooltip content', () => {
    it('should display correct tooltip for stress-induced flag', async () => {
      const user = userEvent.setup();
      const { container } = render(<EpigeneticFlagBadge flag="stress-induced" />);
      const badge = container.querySelector('.relative.inline-block');

      if (!badge) throw new Error('Badge not found');
      await user.hover(badge);

      expect(
        screen.getByText(/This trait developed in response to stress events/i)
      ).toBeInTheDocument();
    });

    it('should display correct tooltip for care-influenced flag', async () => {
      const user = userEvent.setup();
      const { container } = render(<EpigeneticFlagBadge flag="care-influenced" />);
      const badge = container.querySelector('.relative.inline-block');

      if (!badge) throw new Error('Badge not found');
      await user.hover(badge);

      expect(screen.getByText(/This trait was shaped by the quality of care/i)).toBeInTheDocument();
    });

    it('should display correct tooltip for milestone-triggered flag', async () => {
      const user = userEvent.setup();
      const { container } = render(<EpigeneticFlagBadge flag="milestone-triggered" />);
      const badge = container.querySelector('.relative.inline-block');

      if (!badge) throw new Error('Badge not found');
      await user.hover(badge);

      expect(
        screen.getByText(/This trait was unlocked by completing a specific/i)
      ).toBeInTheDocument();
    });
  });

  describe('props combination', () => {
    it('should handle all props together correctly', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <EpigeneticFlagBadge
          flag="milestone-triggered"
          size="large"
          showLabel={true}
          showTooltip={true}
        />
      );

      // Check size
      expect(container.querySelector('.px-4.py-2.text-base')).toBeInTheDocument();

      // Check label
      expect(screen.getByText('Milestone-Triggered')).toBeInTheDocument();

      // Check tooltip on hover
      const badge = container.querySelector('.relative.inline-block');
      if (!badge) throw new Error('Badge not found');
      await user.hover(badge);
      expect(screen.getByText(/This trait was unlocked by completing/i)).toBeInTheDocument();
    });

    it('should handle minimal props (icon only, no tooltip)', () => {
      render(<EpigeneticFlagBadge flag="genetic-only" showLabel={false} showTooltip={false} />);

      // Only icon should be visible
      expect(screen.getByText('🧬')).toBeInTheDocument();
      expect(screen.queryByText('Genetic')).not.toBeInTheDocument();
    });
  });

  describe('styling and layout', () => {
    it('should apply correct color classes for each flag type', () => {
      const { container: container1 } = render(<EpigeneticFlagBadge flag="stress-induced" />);
      expect(container1.querySelector('.bg-orange-100.border-orange-300')).toBeInTheDocument();

      const { container: container2 } = render(<EpigeneticFlagBadge flag="care-influenced" />);
      expect(container2.querySelector('.bg-green-100.border-green-300')).toBeInTheDocument();

      const { container: container3 } = render(<EpigeneticFlagBadge flag="milestone-triggered" />);
      expect(container3.querySelector('.bg-blue-100.border-blue-300')).toBeInTheDocument();

      const { container: container4 } = render(<EpigeneticFlagBadge flag="genetic-only" />);
      expect(container4.querySelector('.bg-purple-100.border-purple-300')).toBeInTheDocument();
    });

    it('should have inline-flex layout for icon and label', () => {
      const { container } = render(<EpigeneticFlagBadge flag="care-influenced" />);
      const badge = container.querySelector('.inline-flex.items-center.gap-1\\.5');
      expect(badge).toBeInTheDocument();
    });

    it('should position tooltip absolutely above badge', async () => {
      const user = userEvent.setup();
      const { container } = render(<EpigeneticFlagBadge flag="stress-induced" />);
      const badge = container.querySelector('.relative.inline-block');

      if (!badge) throw new Error('Badge not found');
      await user.hover(badge);

      const tooltip = container.querySelector('.absolute.z-50.bottom-full');
      expect(tooltip).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should render as inline element for screen readers', () => {
      const { container } = render(<EpigeneticFlagBadge flag="genetic-only" />);
      const wrapper = container.querySelector('.relative.inline-block');
      expect(wrapper).toBeInTheDocument();
    });

    it('should have visible text for all sizes', () => {
      const { rerender } = render(<EpigeneticFlagBadge flag="milestone-triggered" size="small" />);
      expect(screen.getByText('Milestone-Triggered')).toBeInTheDocument();

      rerender(<EpigeneticFlagBadge flag="milestone-triggered" size="medium" />);
      expect(screen.getByText('Milestone-Triggered')).toBeInTheDocument();

      rerender(<EpigeneticFlagBadge flag="milestone-triggered" size="large" />);
      expect(screen.getByText('Milestone-Triggered')).toBeInTheDocument();
    });
  });
});
