/**
 * XPProgressBar Component Tests
 *
 * Comprehensive tests for the XP Progress Bar component including:
 * - Current level display
 * - Progress bar visualization
 * - XP information display
 * - Loading and error states
 * - Tooltip with XP breakdown
 *
 * Story 3-4: XP & Progression Display - Task 1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import XPProgressBar from '../XPProgressBar';
import * as useHorseXPHook from '@/hooks/api/useHorseXP';
import type { HorseXP } from '@/lib/api-client';

// Mock the hook
vi.mock('@/hooks/api/useHorseXP');

describe('XPProgressBar', () => {
  let queryClient: QueryClient;

  const mockXPData: HorseXP = {
    horseId: 1,
    horseName: 'Thunder',
    currentXP: 250,
    availableStatPoints: 2,
    nextStatPointAt: 300,
    xpToNextStatPoint: 50,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.clearAllMocks();

    // Default mock: successful data fetch
    vi.mocked(useHorseXPHook.useHorseXP).mockReturnValue({
      data: mockXPData,
      isLoading: false,
      error: null,
      isError: false,
      refetch: vi.fn(),
    } as any);
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  };

  describe('Level Display (AC-1)', () => {
    it('should display "Level 3" for 250 XP (2 stat points earned)', () => {
      renderWithProvider(<XPProgressBar horseId={1} />);
      expect(screen.getByText(/level 3/i)).toBeInTheDocument();
    });

    it('should display "Level 1" for 50 XP (0 stat points earned)', () => {
      vi.mocked(useHorseXPHook.useHorseXP).mockReturnValue({
        data: { ...mockXPData, currentXP: 50, availableStatPoints: 0, nextStatPointAt: 100, xpToNextStatPoint: 50 },
        isLoading: false,
        error: null,
      } as any);

      renderWithProvider(<XPProgressBar horseId={1} />);
      expect(screen.getByText(/level 1/i)).toBeInTheDocument();
    });

    it('should display "Level 10" for 950 XP (9 stat points earned)', () => {
      vi.mocked(useHorseXPHook.useHorseXP).mockReturnValue({
        data: { ...mockXPData, currentXP: 950, availableStatPoints: 9, nextStatPointAt: 1000, xpToNextStatPoint: 50 },
        isLoading: false,
        error: null,
      } as any);

      renderWithProvider(<XPProgressBar horseId={1} />);
      expect(screen.getByText(/level 10/i)).toBeInTheDocument();
    });

    it('should calculate level as (availableStatPoints + 1)', () => {
      vi.mocked(useHorseXPHook.useHorseXP).mockReturnValue({
        data: { ...mockXPData, currentXP: 450, availableStatPoints: 4, nextStatPointAt: 500 },
        isLoading: false,
        error: null,
      } as any);

      renderWithProvider(<XPProgressBar horseId={1} />);
      expect(screen.getByText(/level 5/i)).toBeInTheDocument();
    });
  });

  describe('XP Progress Display (AC-2)', () => {
    it('should display current XP amount', () => {
      renderWithProvider(<XPProgressBar horseId={1} />);
      expect(screen.getByText(/250/)).toBeInTheDocument();
    });

    it('should display next stat point at milestone', () => {
      renderWithProvider(<XPProgressBar horseId={1} />);
      expect(screen.getByText(/300/)).toBeInTheDocument();
    });

    it('should display XP progress format "250 / 300 XP"', () => {
      renderWithProvider(<XPProgressBar horseId={1} />);
      expect(screen.getByText(/250\s*\/\s*300\s*xp/i)).toBeInTheDocument();
    });

    it('should display XP to next stat point', () => {
      renderWithProvider(<XPProgressBar horseId={1} />);
      expect(screen.getByText(/50\s*xp\s*to\s*level\s*4/i)).toBeInTheDocument();
    });
  });

  describe('Progress Bar (AC-3)', () => {
    it('should render a progress bar', () => {
      renderWithProvider(<XPProgressBar horseId={1} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('should show 50% progress for 250/300 XP within level', () => {
      // 250 XP = 2 stat points (200 XP) + 50 XP toward next
      // Progress within level = 50 / 100 = 50%
      renderWithProvider(<XPProgressBar horseId={1} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    });

    it('should show 0% progress for 0 XP', () => {
      vi.mocked(useHorseXPHook.useHorseXP).mockReturnValue({
        data: { ...mockXPData, currentXP: 0, availableStatPoints: 0, nextStatPointAt: 100, xpToNextStatPoint: 100 },
        isLoading: false,
        error: null,
      } as any);

      renderWithProvider(<XPProgressBar horseId={1} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('should show 0% progress when just reached stat point (200 XP = 2 stat points)', () => {
      vi.mocked(useHorseXPHook.useHorseXP).mockReturnValue({
        data: { ...mockXPData, currentXP: 200, availableStatPoints: 2, nextStatPointAt: 300, xpToNextStatPoint: 100 },
        isLoading: false,
        error: null,
      } as any);

      renderWithProvider(<XPProgressBar horseId={1} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('should show 99% progress for 299 XP (one away from stat point)', () => {
      vi.mocked(useHorseXPHook.useHorseXP).mockReturnValue({
        data: { ...mockXPData, currentXP: 299, availableStatPoints: 2, nextStatPointAt: 300, xpToNextStatPoint: 1 },
        isLoading: false,
        error: null,
      } as any);

      renderWithProvider(<XPProgressBar horseId={1} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '99');
    });

    it('should have min=0 and max=100 on progress bar', () => {
      renderWithProvider(<XPProgressBar horseId={1} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should have visual progress bar fill matching percentage', () => {
      renderWithProvider(<XPProgressBar horseId={1} />);
      const progressFill = screen.getByTestId('progress-fill');
      expect(progressFill).toHaveStyle({ width: '50%' });
    });
  });

  describe('Tooltip (AC-4)', () => {
    it('should show tooltip on hover', async () => {
      const user = userEvent.setup();
      renderWithProvider(<XPProgressBar horseId={1} />);

      const progressBar = screen.getByRole('progressbar');
      await user.hover(progressBar);

      await waitFor(() => {
        expect(screen.getByText(/xp breakdown/i)).toBeInTheDocument();
      });
    });

    it('should display current XP in tooltip', async () => {
      const user = userEvent.setup();
      renderWithProvider(<XPProgressBar horseId={1} />);

      await user.hover(screen.getByRole('progressbar'));

      await waitFor(() => {
        expect(screen.getByText(/current xp/i)).toBeInTheDocument();
        expect(screen.getByText('250')).toBeInTheDocument();
      });
    });

    it('should display stat points earned in tooltip', async () => {
      const user = userEvent.setup();
      renderWithProvider(<XPProgressBar horseId={1} />);

      await user.hover(screen.getByRole('progressbar'));

      await waitFor(() => {
        expect(screen.getByText(/stat points earned/i)).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('should display XP to next stat point in tooltip', async () => {
      const user = userEvent.setup();
      renderWithProvider(<XPProgressBar horseId={1} />);

      await user.hover(screen.getByRole('progressbar'));

      await waitFor(() => {
        expect(screen.getByText(/next stat point/i)).toBeInTheDocument();
        // Check for "50 XP" specifically in the tooltip (with emerald color class)
        const tooltipXP = screen.getAllByText(/50\s*xp/i).find(el =>
          el.className.includes('text-emerald-600')
        );
        expect(tooltipXP).toBeInTheDocument();
      });
    });

    it('should hide tooltip on mouse leave', async () => {
      const user = userEvent.setup();
      renderWithProvider(<XPProgressBar horseId={1} />);

      const progressBar = screen.getByRole('progressbar');
      await user.hover(progressBar);

      await waitFor(() => {
        expect(screen.getByText(/xp breakdown/i)).toBeInTheDocument();
      });

      await user.unhover(progressBar);

      await waitFor(() => {
        expect(screen.queryByText(/xp breakdown/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Level Milestones (AC-5)', () => {
    it('should display milestone markers for levels 5, 10, 15', () => {
      renderWithProvider(<XPProgressBar horseId={1} />);

      // Should show milestone markers
      const milestones = screen.getAllByTestId(/milestone-/);
      expect(milestones.length).toBeGreaterThan(0);
    });

    it('should highlight milestone when level matches', () => {
      vi.mocked(useHorseXPHook.useHorseXP).mockReturnValue({
        data: { ...mockXPData, currentXP: 500, availableStatPoints: 5, nextStatPointAt: 600 },
        isLoading: false,
        error: null,
      } as any);

      renderWithProvider(<XPProgressBar horseId={1} />);
      const milestone5 = screen.getByTestId('milestone-5');
      expect(milestone5).toHaveClass('milestone-reached');
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton when data is loading', () => {
      vi.mocked(useHorseXPHook.useHorseXP).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      renderWithProvider(<XPProgressBar horseId={1} />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should not show progress bar when loading', () => {
      vi.mocked(useHorseXPHook.useHorseXP).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      renderWithProvider(<XPProgressBar horseId={1} />);
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when fetch fails', () => {
      vi.mocked(useHorseXPHook.useHorseXP).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Failed to fetch XP data', statusCode: 500 } as any,
        isError: true,
      } as any);

      renderWithProvider(<XPProgressBar horseId={1} />);
      expect(screen.getByText(/failed to fetch xp data/i)).toBeInTheDocument();
    });

    it('should not show progress bar when error', () => {
      vi.mocked(useHorseXPHook.useHorseXP).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Error', statusCode: 500 } as any,
        isError: true,
      } as any);

      renderWithProvider(<XPProgressBar horseId={1} />);
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle 0 XP correctly', () => {
      vi.mocked(useHorseXPHook.useHorseXP).mockReturnValue({
        data: { ...mockXPData, currentXP: 0, availableStatPoints: 0, nextStatPointAt: 100, xpToNextStatPoint: 100 },
        isLoading: false,
        error: null,
      } as any);

      renderWithProvider(<XPProgressBar horseId={1} />);
      expect(screen.getByText(/level 1/i)).toBeInTheDocument();
      expect(screen.getByText(/0\s*\/\s*100\s*xp/i)).toBeInTheDocument();
    });

    it('should handle very high XP (10,000 XP = level 100)', () => {
      vi.mocked(useHorseXPHook.useHorseXP).mockReturnValue({
        data: { ...mockXPData, currentXP: 10000, availableStatPoints: 100, nextStatPointAt: 10100, xpToNextStatPoint: 100 },
        isLoading: false,
        error: null,
      } as any);

      renderWithProvider(<XPProgressBar horseId={1} />);
      expect(screen.getByText(/level 101/i)).toBeInTheDocument();
    });

    it('should handle missing horse name gracefully', () => {
      vi.mocked(useHorseXPHook.useHorseXP).mockReturnValue({
        data: { ...mockXPData, horseName: '' },
        isLoading: false,
        error: null,
      } as any);

      renderWithProvider(<XPProgressBar horseId={1} />);
      // Should still render level info - look for the specific level heading
      expect(screen.getByRole('heading', { name: /level 3/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on progress bar', () => {
      renderWithProvider(<XPProgressBar horseId={1} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label', expect.stringContaining('Level 3'));
    });

    it('should have descriptive aria-label with XP info', () => {
      renderWithProvider(<XPProgressBar horseId={1} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute(
        'aria-label',
        expect.stringContaining('250 of 300 XP')
      );
    });

    it('should be keyboard accessible for tooltip', async () => {
      const user = userEvent.setup();
      renderWithProvider(<XPProgressBar horseId={1} />);

      const progressBar = screen.getByRole('progressbar');
      await user.tab(); // Focus on progress bar
      progressBar.focus();

      // Tooltip should appear on focus
      await waitFor(() => {
        expect(screen.getByText(/xp breakdown/i)).toBeInTheDocument();
      });
    });
  });
});
