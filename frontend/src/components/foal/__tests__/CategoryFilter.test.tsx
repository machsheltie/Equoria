/**
 * Tests for CategoryFilter Component
 *
 * Testing Sprint - Story 6-3: Enrichment Activity UI
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Mobile dropdown view
 * - Desktop tabs view
 * - Category selection and change handling
 * - Count display (when showCounts is true)
 * - All 5 enrichment categories
 * - Selected state styling
 * - Icons for each category
 * - Accessibility attributes
 * - Responsive behavior
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import CategoryFilter from '../CategoryFilter';
import type { EnrichmentCategory } from '@/types/foal';

describe('CategoryFilter Component', () => {
  const mockOnCategoryChange = vi.fn();

  const defaultProps = {
    selectedCategory: 'all' as EnrichmentCategory | 'all',
    onCategoryChange: mockOnCategoryChange,
  };

  const categoryCounts = {
    all: 10,
    trust: 3,
    desensitization: 2,
    exposure: 3,
    habituation: 2,
  };

  beforeEach(() => {
    mockOnCategoryChange.mockClear();
  });

  describe('mobile dropdown view', () => {
    it('should render select dropdown for mobile', () => {
      render(<CategoryFilter {...defaultProps} />);
      const select = screen.getByLabelText('Select category');
      expect(select).toBeInTheDocument();
      expect(select.tagName).toBe('SELECT');
    });

    it('should display all category options in dropdown', () => {
      render(<CategoryFilter {...defaultProps} />);
      expect(screen.getByRole('option', { name: /All Activities/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Trust/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Desensitization/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Exposure/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Habituation/i })).toBeInTheDocument();
    });

    it('should show selected category in dropdown', () => {
      render(<CategoryFilter {...defaultProps} selectedCategory="trust" />);
      const select = screen.getByLabelText('Select category') as HTMLSelectElement;
      expect(select.value).toBe('trust');
    });

    it('should call onCategoryChange when dropdown selection changes', async () => {
      const user = userEvent.setup();
      render(<CategoryFilter {...defaultProps} />);

      const select = screen.getByLabelText('Select category');
      await user.selectOptions(select, 'trust');

      expect(mockOnCategoryChange).toHaveBeenCalledWith('trust');
      expect(mockOnCategoryChange).toHaveBeenCalledTimes(1);
    });

    it('should display counts in dropdown when showCounts is true', () => {
      render(
        <CategoryFilter {...defaultProps} showCounts={true} categoryCounts={categoryCounts} />
      );
      expect(screen.getByRole('option', { name: /All Activities \(10\)/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Trust \(3\)/i })).toBeInTheDocument();
    });

    it('should not display counts when showCounts is false', () => {
      render(
        <CategoryFilter {...defaultProps} showCounts={false} categoryCounts={categoryCounts} />
      );
      expect(
        screen.queryByRole('option', { name: /All Activities \(10\)/i })
      ).not.toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'All Activities' })).toBeInTheDocument();
    });
  });

  describe('desktop tabs view', () => {
    it('should render tab buttons for desktop', () => {
      const { container } = render(<CategoryFilter {...defaultProps} />);
      const tabContainer = container.querySelector('.sm\\:flex.sm\\:items-center');
      expect(tabContainer).toBeInTheDocument();
    });

    it('should display all category tabs', () => {
      render(<CategoryFilter {...defaultProps} />);
      const buttons = screen.getAllByRole('button');

      // Should have 5 buttons (All, Trust, Desensitization, Exposure, Habituation)
      expect(buttons.length).toBe(5);
      expect(screen.getByRole('button', { name: /Filter by All Activities/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Filter by Trust/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Filter by Desensitization/i })
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Filter by Exposure/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Filter by Habituation/i })).toBeInTheDocument();
    });

    it('should call onCategoryChange when tab is clicked', async () => {
      const user = userEvent.setup();
      render(<CategoryFilter {...defaultProps} />);

      const trustButton = screen.getByRole('button', { name: /Filter by Trust/i });
      await user.click(trustButton);

      expect(mockOnCategoryChange).toHaveBeenCalledWith('trust');
      expect(mockOnCategoryChange).toHaveBeenCalledTimes(1);
    });

    it('should mark selected tab with aria-pressed', () => {
      render(<CategoryFilter {...defaultProps} selectedCategory="exposure" />);
      const exposureButton = screen.getByRole('button', { name: /Filter by Exposure/i });
      expect(exposureButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should not mark unselected tabs with aria-pressed', () => {
      render(<CategoryFilter {...defaultProps} selectedCategory="trust" />);
      const exposureButton = screen.getByRole('button', { name: /Filter by Exposure/i });
      expect(exposureButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should display counts in tabs when showCounts is true', () => {
      render(
        <CategoryFilter {...defaultProps} showCounts={true} categoryCounts={categoryCounts} />
      );
      expect(screen.getByText('10')).toBeInTheDocument(); // All count
      expect(screen.getByText('3')).toBeInTheDocument(); // Trust count
    });

    it('should not display counts when showCounts is false', () => {
      render(
        <CategoryFilter {...defaultProps} showCounts={false} categoryCounts={categoryCounts} />
      );
      // Count badges should not be present
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button.textContent).not.toMatch(/\(\d+\)/);
      });
    });
  });

  describe('category icons', () => {
    it('should display Sparkles icon for All Activities', () => {
      const { container } = render(<CategoryFilter {...defaultProps} selectedCategory="all" />);
      expect(container.querySelector('.text-slate-600')).toBeInTheDocument();
    });

    it('should display Heart icon for Trust', () => {
      const { container } = render(<CategoryFilter {...defaultProps} selectedCategory="trust" />);
      expect(container.querySelector('.text-blue-600')).toBeInTheDocument();
    });

    it('should display Shield icon for Desensitization', () => {
      const { container } = render(
        <CategoryFilter {...defaultProps} selectedCategory="desensitization" />
      );
      expect(container.querySelector('.text-purple-600')).toBeInTheDocument();
    });

    it('should display Compass icon for Exposure', () => {
      const { container } = render(
        <CategoryFilter {...defaultProps} selectedCategory="exposure" />
      );
      expect(container.querySelector('.text-emerald-600')).toBeInTheDocument();
    });

    it('should display Clock icon for Habituation', () => {
      const { container } = render(
        <CategoryFilter {...defaultProps} selectedCategory="habituation" />
      );
      expect(container.querySelector('.text-amber-600')).toBeInTheDocument();
    });
  });

  describe('selected state styling', () => {
    it('should apply selected styling to active category', () => {
      render(<CategoryFilter {...defaultProps} selectedCategory="trust" />);
      const trustButton = screen.getByRole('button', { name: /Filter by Trust/i });
      expect(trustButton.className).toContain('ring-2');
    });

    it('should apply opacity to unselected categories', () => {
      render(<CategoryFilter {...defaultProps} selectedCategory="trust" />);
      const exposureButton = screen.getByRole('button', { name: /Filter by Exposure/i });
      expect(exposureButton.className).toContain('opacity-60');
    });

    it('should not apply ring to unselected categories', () => {
      render(<CategoryFilter {...defaultProps} selectedCategory="trust" />);
      const exposureButton = screen.getByRole('button', { name: /Filter by Exposure/i });
      expect(exposureButton.className).not.toContain('ring-2');
    });
  });

  describe('category switching', () => {
    it('should handle switching between categories', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<CategoryFilter {...defaultProps} selectedCategory="all" />);

      // Click trust
      await user.click(screen.getByRole('button', { name: /Filter by Trust/i }));
      expect(mockOnCategoryChange).toHaveBeenCalledWith('trust');

      // Update to trust
      rerender(<CategoryFilter {...defaultProps} selectedCategory="trust" />);
      expect(screen.getByRole('button', { name: /Filter by Trust/i })).toHaveAttribute(
        'aria-pressed',
        'true'
      );

      // Click exposure
      await user.click(screen.getByRole('button', { name: /Filter by Exposure/i }));
      expect(mockOnCategoryChange).toHaveBeenCalledWith('exposure');
    });

    it('should allow selecting all after selecting specific category', async () => {
      const user = userEvent.setup();
      render(<CategoryFilter {...defaultProps} selectedCategory="trust" />);

      await user.click(screen.getByRole('button', { name: /Filter by All Activities/i }));
      expect(mockOnCategoryChange).toHaveBeenCalledWith('all');
    });
  });

  describe('count display', () => {
    it('should display zero counts', () => {
      const zeroCounts = {
        all: 0,
        trust: 0,
        desensitization: 0,
        exposure: 0,
        habituation: 0,
      };
      render(<CategoryFilter {...defaultProps} showCounts={true} categoryCounts={zeroCounts} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle undefined counts gracefully', () => {
      render(<CategoryFilter {...defaultProps} showCounts={true} />);
      const buttons = screen.getAllByRole('button');
      // Should still render buttons even without counts
      expect(buttons.length).toBe(5);
    });

    it('should display large counts', () => {
      const largeCounts = {
        all: 999,
        trust: 150,
        desensitization: 200,
        exposure: 300,
        habituation: 100,
      };
      render(<CategoryFilter {...defaultProps} showCounts={true} categoryCounts={largeCounts} />);
      expect(screen.getByText('999')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have sr-only label for mobile select', () => {
      render(<CategoryFilter {...defaultProps} />);
      const label = screen.getByText('Select category');
      expect(label.className).toContain('sr-only');
    });

    it('should have descriptive aria-labels for desktop buttons', () => {
      render(<CategoryFilter {...defaultProps} />);
      expect(screen.getByLabelText('Filter by All Activities')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by Trust')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by Desensitization')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by Exposure')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by Habituation')).toBeInTheDocument();
    });

    it('should use aria-pressed for tab state', () => {
      render(<CategoryFilter {...defaultProps} selectedCategory="trust" />);
      const trustButton = screen.getByRole('button', { name: /Filter by Trust/i });
      expect(trustButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('responsive behavior', () => {
    it('should hide mobile dropdown on desktop', () => {
      const { container } = render(<CategoryFilter {...defaultProps} />);
      const mobileDropdown = container.querySelector('.block.sm\\:hidden');
      expect(mobileDropdown).toBeInTheDocument();
    });

    it('should hide desktop tabs on mobile', () => {
      const { container } = render(<CategoryFilter {...defaultProps} />);
      const desktopTabs = container.querySelector('.hidden.sm\\:flex');
      expect(desktopTabs).toBeInTheDocument();
    });
  });

  describe('hover effects', () => {
    it('should apply hover classes to unselected tabs', () => {
      render(<CategoryFilter {...defaultProps} selectedCategory="all" />);
      const trustButton = screen.getByRole('button', { name: /Filter by Trust/i });
      expect(trustButton.className).toContain('hover:opacity-100');
      expect(trustButton.className).toContain('hover:bg-blue-100');
    });
  });
});
