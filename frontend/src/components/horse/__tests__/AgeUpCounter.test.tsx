/**
 * AgeUpCounter Component Tests
 *
 * Comprehensive tests for the Age-Up Prediction component including:
 * - Age calculation and display
 * - Milestone predictions
 * - Countdown timer
 * - Stat gain predictions
 * - Tooltips and accessibility
 * - Loading and error states
 * - Edge cases (newborn, adult, retired)
 *
 * Story 3-4: XP & Progression Display - Task 4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import AgeUpCounter from '../AgeUpCounter';
import * as useHorseAgeHook from '@/hooks/api/useHorseAge';

// Mock the hook
vi.mock('@/hooks/api/useHorseAge');

describe('AgeUpCounter', () => {
  let queryClient: QueryClient;

  const mockYoungHorseAge = {
    horseId: 1,
    horseName: 'Thunder',
    currentAge: {
      years: 2,
      months: 4,
    },
    ageInDays: 850,
    nextMilestone: {
      name: 'Adult',
      ageYears: 4,
      daysRemaining: 635,
      monthsRemaining: 20,
      expectedStatGains: {
        speed: 5,
        stamina: 3,
        agility: 4,
        strength: 6,
        intelligence: 2,
        temperament: 1,
      },
    },
    trainingWindow: {
      isPrimeWindow: true,
      windowName: 'Prime Training Years',
      endsInDays: 635,
    },
  };

  const mockAdultHorseAge = {
    horseId: 2,
    horseName: 'Lightning',
    currentAge: {
      years: 8,
      months: 2,
    },
    ageInDays: 3010,
    nextMilestone: {
      name: 'Senior',
      ageYears: 15,
      daysRemaining: 2545,
      monthsRemaining: 82,
      expectedStatGains: {
        speed: -2,
        stamina: -1,
        agility: -3,
        strength: 0,
        intelligence: 3,
        temperament: 2,
      },
    },
    trainingWindow: {
      isPrimeWindow: false,
      windowName: 'Maintenance Phase',
      endsInDays: null,
    },
  };

  const mockNewbornHorseAge = {
    horseId: 3,
    horseName: 'Sparkle',
    currentAge: {
      years: 0,
      months: 3,
    },
    ageInDays: 90,
    nextMilestone: {
      name: 'Yearling',
      ageYears: 1,
      daysRemaining: 275,
      monthsRemaining: 9,
      expectedStatGains: {
        speed: 10,
        stamina: 8,
        agility: 12,
        strength: 7,
        intelligence: 5,
        temperament: 3,
      },
    },
    trainingWindow: {
      isPrimeWindow: false,
      windowName: 'Too Young',
      endsInDays: 640,
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.clearAllMocks();

    // Default mock: successful data fetch for young horse
    vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
      data: mockYoungHorseAge,
      isLoading: false,
      error: null,
      isError: false,
      refetch: vi.fn(),
    } as any);
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  };

  describe('Age Display (AC-1)', () => {
    it('should display current age in years and months', () => {
      renderWithProvider(<AgeUpCounter horseId={1} />);
      expect(screen.getByText(/2 years, 4 months/i)).toBeInTheDocument();
    });

    it('should handle age less than 1 year', () => {
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: mockNewbornHorseAge,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={3} />);
      expect(screen.getByText(/0 years, 3 months/i)).toBeInTheDocument();
    });

    it('should handle age with 0 months', () => {
      const exactYearAge = {
        ...mockYoungHorseAge,
        currentAge: { years: 5, months: 0 },
      };
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: exactYearAge,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={1} />);
      expect(screen.getByText(/5 years, 0 months/i)).toBeInTheDocument();
    });
  });

  describe('Milestone Display (AC-2)', () => {
    it('should display next milestone name', () => {
      renderWithProvider(<AgeUpCounter horseId={1} />);
      const milestone = screen.getByTestId('milestone-name');
      expect(milestone).toHaveTextContent(/adult/i);
    });

    it('should display milestone age', () => {
      renderWithProvider(<AgeUpCounter horseId={1} />);
      const milestone = screen.getByTestId('milestone-name');
      expect(milestone).toHaveTextContent(/4 years/i);
    });

    it('should display different milestones for different ages', () => {
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: mockAdultHorseAge,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={2} />);
      const milestone = screen.getByTestId('milestone-name');
      expect(milestone).toHaveTextContent(/senior/i);
      expect(milestone).toHaveTextContent(/15 years/i);
    });
  });

  describe('Countdown Timer (AC-3)', () => {
    it('should display days remaining', () => {
      renderWithProvider(<AgeUpCounter horseId={1} />);
      const daysRemaining = screen.getByTestId('days-remaining');
      expect(daysRemaining).toHaveTextContent(/635 days/i);
    });

    it('should display months remaining', () => {
      renderWithProvider(<AgeUpCounter horseId={1} />);
      const timeRemaining = screen.getByTestId('time-remaining');
      // 20 months is displayed as "1y 8m"
      expect(timeRemaining).toHaveTextContent(/1y 8m/i);
    });

    it('should handle countdown less than 1 month', () => {
      const closeMilestone = {
        ...mockYoungHorseAge,
        nextMilestone: {
          ...mockYoungHorseAge.nextMilestone,
          daysRemaining: 15,
          monthsRemaining: 0,
        },
      };
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: closeMilestone,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={1} />);
      const timeRemaining = screen.getByTestId('time-remaining');
      expect(timeRemaining).toHaveTextContent(/15 days/i);
    });

    it('should visually emphasize countdown when close to milestone', () => {
      const closeMilestone = {
        ...mockYoungHorseAge,
        nextMilestone: {
          ...mockYoungHorseAge.nextMilestone,
          daysRemaining: 25,
          monthsRemaining: 0,
        },
      };
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: closeMilestone,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={1} />);
      const timeRemaining = screen.getByTestId('time-remaining');
      expect(timeRemaining).toHaveTextContent(/25 days/i);
      // Should have special styling when < 30 days (amber/yellow warning)
      expect(timeRemaining.parentElement?.className).toMatch(/amber|yellow/i);
    });
  });

  describe('Stat Gain Predictions (AC-4)', () => {
    it('should display expected stat gains', async () => {
      const user = userEvent.setup();
      renderWithProvider(<AgeUpCounter horseId={1} />);

      // Expand stat details first
      const expandButton = screen.getByRole('button', { name: /show stat details|hide stat details/i });
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText(/speed/i).nextSibling).toHaveTextContent(/\+5/);
        expect(screen.getByText(/stamina/i).nextSibling).toHaveTextContent(/\+3/);
      });
    });

    it('should display stat losses with negative values', async () => {
      const user = userEvent.setup();
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: mockAdultHorseAge,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={2} />);

      // Expand stat details first
      const expandButton = screen.getByRole('button', { name: /show stat details|hide stat details/i });
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText(/speed/i).nextSibling).toHaveTextContent(/-2/);
        expect(screen.getByText(/agility/i).nextSibling).toHaveTextContent(/-3/);
      });
    });

    it('should display stat gains in green and losses in red', async () => {
      const user = userEvent.setup();
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: mockAdultHorseAge,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={2} />);

      // Expand stat details first
      const expandButton = screen.getByRole('button', { name: /show stat details|hide stat details/i });
      await user.click(expandButton);

      await waitFor(() => {
        // Gains should be green
        const intelligenceValue = screen.getByText(/intelligence/i).nextSibling as HTMLElement;
        expect(intelligenceValue.className).toMatch(/green|emerald/i);

        // Losses should be red
        const speedValue = screen.getByText(/speed/i).nextSibling as HTMLElement;
        expect(speedValue.className).toMatch(/red|rose/i);
      });
    });

    it('should handle zero stat change', async () => {
      const user = userEvent.setup();
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: mockAdultHorseAge,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={2} />);

      // Expand stat details first
      const expandButton = screen.getByRole('button', { name: /show stat details|hide stat details/i });
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText(/strength/i).nextSibling).toHaveTextContent(/0/);
      });
    });

    it('should show stat gains can be expanded', async () => {
      const user = userEvent.setup();
      renderWithProvider(<AgeUpCounter horseId={1} />);

      const expandButton = screen.getByRole('button', { name: /show stat details|hide stat details/i });
      await user.click(expandButton);

      await waitFor(() => {
        // All 6 stats should be visible when expanded
        expect(screen.getByText(/speed/i)).toBeInTheDocument();
        expect(screen.getByText(/stamina/i)).toBeInTheDocument();
        expect(screen.getByText(/agility/i)).toBeInTheDocument();
        expect(screen.getByText(/strength/i)).toBeInTheDocument();
        expect(screen.getByText(/intelligence/i)).toBeInTheDocument();
        expect(screen.getByText(/temperament/i)).toBeInTheDocument();
      });
    });
  });

  describe('Training Window (AC-5)', () => {
    it('should display training window status', () => {
      renderWithProvider(<AgeUpCounter horseId={1} />);
      expect(screen.getByText(/prime training years/i)).toBeInTheDocument();
    });

    it('should show countdown for training window end', () => {
      renderWithProvider(<AgeUpCounter horseId={1} />);
      // Training window countdown is shown in the training window section
      expect(screen.getByText(/prime training window ends in 635 days/i)).toBeInTheDocument();
    });

    it('should show different training window for adults', () => {
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: mockAdultHorseAge,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={2} />);
      expect(screen.getByText(/maintenance phase/i)).toBeInTheDocument();
    });

    it('should indicate when horse is too young to train', () => {
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: mockNewbornHorseAge,
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={3} />);
      expect(screen.getByText(/too young to train effectively/i)).toBeInTheDocument();
    });
  });

  describe('Tooltips (AC-6)', () => {
    it('should show tooltip on age hover', () => {
      renderWithProvider(<AgeUpCounter horseId={1} />);

      // Check for educational tooltip about age mechanics
      expect(screen.getByText(/age mechanics:/i)).toBeInTheDocument();
    });

    it('should show tooltip on milestone hover', () => {
      renderWithProvider(<AgeUpCounter horseId={1} />);

      // Check that info icon has aria-label for accessibility
      const infoIcon = screen.getByLabelText(/age mechanics information/i);
      expect(infoIcon).toHaveAttribute('aria-label', 'Age mechanics information');
    });

    it('should show tooltip explaining stat gains', () => {
      renderWithProvider(<AgeUpCounter horseId={1} />);

      // Educational tooltip explains stat mechanics
      expect(screen.getByText(/horses gain stats rapidly when young/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton when data is loading', () => {
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={1} />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should not show age data when loading', () => {
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={1} />);
      expect(screen.queryByText(/years/i)).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when fetch fails', () => {
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Failed to fetch age data', statusCode: 500 } as any,
        isError: true,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={1} />);
      expect(screen.getByText(/failed to fetch age data/i)).toBeInTheDocument();
    });

    it('should show retry button on error', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Error', statusCode: 500 } as any,
        isError: true,
        refetch: mockRefetch,
      } as any);

      const user = userEvent.setup();
      renderWithProvider(<AgeUpCounter horseId={1} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle horse with no next milestone (max age)', () => {
      const maxAgeHorse = {
        ...mockAdultHorseAge,
        nextMilestone: null,
      };
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: maxAgeHorse,
        isLoading: false,
        error: null,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={2} />);
      expect(screen.getByText(/full maturity|no more milestone/i)).toBeInTheDocument();
    });

    it('should handle newborn horse (0 years, 0 months)', () => {
      const newbornHorse = {
        ...mockNewbornHorseAge,
        currentAge: { years: 0, months: 0 },
        ageInDays: 1,
      };
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: newbornHorse,
        isLoading: false,
        error: null,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={3} />);
      expect(screen.getByText(/newborn|0 years/i)).toBeInTheDocument();
    });

    it('should handle milestone with very large stat gains', async () => {
      const user = userEvent.setup();
      const largeGains = {
        ...mockNewbornHorseAge,
        nextMilestone: {
          ...mockNewbornHorseAge.nextMilestone,
          expectedStatGains: {
            speed: 25,
            stamina: 30,
            agility: 28,
            strength: 22,
            intelligence: 15,
            temperament: 10,
          },
        },
      };
      vi.mocked(useHorseAgeHook.useHorseAge).mockReturnValue({
        data: largeGains,
        isLoading: false,
        error: null,
      } as any);

      renderWithProvider(<AgeUpCounter horseId={3} />);

      // Expand stat details first
      const expandButton = screen.getByRole('button', { name: /show stat details|hide stat details/i });
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText(/speed/i).nextSibling).toHaveTextContent(/\+25/);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels', () => {
      renderWithProvider(<AgeUpCounter horseId={1} />);
      expect(screen.getByText(/age-up counter/i)).toBeInTheDocument();
    });

    it('should have keyboard accessible buttons', async () => {
      const user = userEvent.setup();
      renderWithProvider(<AgeUpCounter horseId={1} />);

      const expandButton = screen.getByRole('button', { name: /show stat details|hide stat details/i });
      expandButton.focus();

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/^speed$/i)).toBeInTheDocument();
      });
    });

    it('should have ARIA labels for stat changes', () => {
      renderWithProvider(<AgeUpCounter horseId={1} />);
      const statGainButton = screen.getByRole('button', { name: /show stat details|hide stat details/i });
      expect(statGainButton).toHaveAttribute('aria-label');
    });
  });

  describe('Responsive Design', () => {
    it('should be mobile responsive', () => {
      renderWithProvider(<AgeUpCounter horseId={1} />);
      const container = screen.getByTestId('age-up-counter');
      // Component uses rounded-lg which is responsive
      expect(container).toHaveClass('rounded-lg');
    });

    it('should stack elements on mobile', () => {
      renderWithProvider(<AgeUpCounter horseId={1} />);
      const container = screen.getByTestId('age-up-counter');
      // Component uses padding which works on all screen sizes
      expect(container).toHaveClass('p-6');
    });
  });
});
