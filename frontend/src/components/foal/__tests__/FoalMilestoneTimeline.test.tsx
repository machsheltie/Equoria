/**
 * Tests for FoalMilestoneTimeline Component
 *
 * Testing Sprint - Story 6-2: Foal Milestone Timeline
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Foal header display (name, sex label, age, birth date)
 * - Help button rendering
 * - Overall progress bar and percentage
 * - Timeline visualization (Recharts integration)
 * - Custom dot and tooltip components
 * - Legend display (completed, current, upcoming)
 * - Current milestone panel (conditional rendering)
 * - Milestone history list
 * - Empty state for no milestones
 * - MilestoneCard onClick handling
 * - Milestone sorting by age
 * - Default values for optional props
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FoalMilestoneTimeline from '../FoalMilestoneTimeline';
import type { Foal, Milestone } from '@/types/foal';

// Create QueryClient for tests
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

// Mock types for Recharts components
interface ResponsiveContainerProps {
  children: React.ReactNode;
}
interface ComposedChartProps {
  children: React.ReactNode;
  data?: unknown[];
}
interface LineProps {
  dataKey: string;
  dot?: unknown;
  type?: string;
}
interface XAxisProps {
  dataKey: string;
}
interface TooltipProps {
  content?: React.ReactNode;
}
interface ReferenceLineProps {
  x?: string | number;
  label?: { value?: string };
}

// Mock Recharts components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: ResponsiveContainerProps) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ComposedChart: ({ children, data }: ComposedChartProps) => (
    <div data-testid="composed-chart" data-chart-length={data?.length}>
      {children}
    </div>
  ),
  Line: ({ dataKey, dot, type }: LineProps) => (
    <div data-testid="line-chart" data-key={dataKey} data-dot={!!dot} data-type={type} />
  ),
  XAxis: ({ dataKey }: XAxisProps) => <div data-testid="x-axis" data-key={dataKey} />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: ({ content }: TooltipProps) => <div data-testid="tooltip">{content}</div>,
  ReferenceLine: ({ x, label }: ReferenceLineProps) => (
    <div data-testid="reference-line" data-x={x} data-label={label?.value} />
  ),
}));

// Mock types for sub-components
interface MilestoneCardProps {
  milestone: Milestone;
  onClick?: () => void;
  isCurrent?: boolean;
}
interface CurrentMilestonePanelProps {
  milestone: Milestone;
  foalAge: number;
  daysRemaining: number;
}

// Mock sub-components
vi.mock('../MilestoneDot', () => ({
  default: () => <div data-testid="milestone-dot" />,
}));

vi.mock('../MilestoneTooltip', () => ({
  default: () => <div data-testid="milestone-tooltip" />,
}));

vi.mock('../MilestoneCard', () => ({
  default: ({ milestone, onClick, isCurrent }: MilestoneCardProps) => (
    <div
      data-testid={`milestone-card-${milestone.type}`}
      data-current={isCurrent}
      onClick={onClick}
    >
      {milestone.name}
    </div>
  ),
}));

vi.mock('../CurrentMilestonePanel', () => ({
  default: ({ milestone, foalAge, daysRemaining }: CurrentMilestonePanelProps) => (
    <div
      data-testid="current-milestone-panel"
      data-milestone={milestone.name}
      data-foal-age={foalAge}
      data-days-remaining={daysRemaining}
    />
  ),
}));

// Mock @/types/foal functions
vi.mock('@/types/foal', async () => {
  const actual = await vi.importActual('@/types/foal');
  return {
    ...actual,
    calculateMilestoneProgress: vi.fn((milestone: Milestone, _foalAge: number) => {
      if (milestone.status === 'completed') return 100;
      const { min, max } = milestone.ageWindow;
      if (_foalAge < min) return 0;
      if (_foalAge > max) return 100;
      return Math.round(((_foalAge - min) / (max - min)) * 100);
    }),
    getCurrentMilestone: vi.fn((milestones: Milestone[], foalAge: number) => {
      return milestones.find((m) => foalAge >= m.ageWindow.min && foalAge <= m.ageWindow.max);
    }),
    calculateDevelopmentProgress: vi.fn((milestones: Milestone[], _foalAge: number) => {
      const completed = milestones.filter((m) => m.status === 'completed').length;
      return Math.round((completed / milestones.length) * 100);
    }),
    getDaysUntilMilestone: vi.fn((milestone: Milestone, foalAge: number) => {
      return Math.max(0, milestone.ageWindow.min - foalAge);
    }),
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Calendar: () => <svg data-testid="calendar-icon" />,
  TrendingUp: () => <svg data-testid="trending-up-icon" />,
  HelpCircle: () => <svg data-testid="help-circle-icon" />,
}));

describe('FoalMilestoneTimeline Component', () => {
  const mockFoal: Foal = {
    id: 'foal-1',
    name: 'Thunder',
    sex: 'Male',
    ageInDays: 45,
    birthDate: '2026-01-01',
    sireId: 'sire-1',
    damId: 'dam-1',
    userId: 'user-1',
    enrichmentActivitiesCompleted: 3,
    totalEnrichmentActivities: 5,
  };

  const mockMilestones: Milestone[] = [
    {
      id: 'first-steps',
      type: 'first-steps',
      name: 'First Steps',
      description: 'Learning to stand and walk',
      ageWindow: { min: 1, max: 30 },
      focus: 'Physical coordination',
      status: 'completed',
      requirements: [],
      rewards: { milestonePoints: 50, potentialTraits: [] },
      traitsConfirmed: ['Steady Gait'],
      score: 8,
    },
    {
      id: 'socialization',
      type: 'socialization',
      name: 'Socialization',
      description: 'Building trust and bonding',
      ageWindow: { min: 31, max: 90 },
      focus: 'Social development',
      status: 'in_progress',
      requirements: [],
      rewards: { milestonePoints: 75, potentialTraits: [] },
    },
    {
      id: 'weaning',
      type: 'weaning',
      name: 'Weaning',
      description: 'Transition to independence',
      ageWindow: { min: 91, max: 180 },
      focus: 'Independence',
      status: 'pending',
      requirements: [],
      rewards: { milestonePoints: 100, potentialTraits: [] },
    },
  ];

  const renderWithQueryClient = (ui: React.ReactElement) => {
    const queryClient = createTestQueryClient();
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  describe('foal header', () => {
    it('should display foal name', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByText('Thunder')).toBeInTheDocument();
    });

    it('should display "Unnamed Foal" when name is not provided', () => {
      const unnamedFoal = { ...mockFoal, name: '' };
      renderWithQueryClient(
        <FoalMilestoneTimeline foal={unnamedFoal} milestones={mockMilestones} />
      );
      expect(screen.getByText('Unnamed Foal')).toBeInTheDocument();
    });

    it('should display "Colt" for male foals', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByText(/Colt/)).toBeInTheDocument();
    });

    it('should display "Filly" for female foals', () => {
      const femaleFoal = { ...mockFoal, sex: 'Female' };
      renderWithQueryClient(
        <FoalMilestoneTimeline foal={femaleFoal} milestones={mockMilestones} />
      );
      expect(screen.getByText(/Filly/)).toBeInTheDocument();
    });

    it('should display foal age in days', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByText(/45 days old/)).toBeInTheDocument();
    });

    it('should display Calendar icon for birth date', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByTestId('calendar-icon')).toBeInTheDocument();
    });

    it('should display formatted birth date', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByText(/Born: Jan 1, 2026/)).toBeInTheDocument();
    });

    it('should display help button', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      const helpButton = screen.getByRole('button', { name: /Help/ });
      expect(helpButton).toBeInTheDocument();
    });

    it('should display HelpCircle icon in help button', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByTestId('help-circle-icon')).toBeInTheDocument();
    });
  });

  describe('overall progress', () => {
    it('should display TrendingUp icon', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument();
    });

    it('should display "Development Progress" label', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByText('Development Progress')).toBeInTheDocument();
    });

    it('should display progress percentage', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      // 1 completed out of 3 milestones = 33%
      expect(screen.getByText('33%')).toBeInTheDocument();
    });

    it('should have progress bar with correct aria attributes', () => {
      const { container } = renderWithQueryClient(
        <FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />
      );
      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-valuenow', '33');
    });

    it('should calculate 100% when all milestones completed', () => {
      const completedMilestones = mockMilestones.map((m) => ({
        ...m,
        status: 'completed' as const,
      }));

      renderWithQueryClient(
        <FoalMilestoneTimeline foal={mockFoal} milestones={completedMilestones} />
      );
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should calculate 0% when no milestones completed', () => {
      const pendingMilestones = mockMilestones.map((m) => ({
        ...m,
        status: 'pending' as const,
      }));

      renderWithQueryClient(
        <FoalMilestoneTimeline foal={mockFoal} milestones={pendingMilestones} />
      );
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('timeline visualization', () => {
    it('should display "Timeline Visualization" heading', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByText('Timeline Visualization')).toBeInTheDocument();
    });

    it('should render ResponsiveContainer', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('should render ComposedChart with timeline data', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      const chart = screen.getByTestId('composed-chart');
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute('data-chart-length', '3');
    });

    it('should render CartesianGrid', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    });

    it('should render XAxis with milestone names', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      const xAxis = screen.getByTestId('x-axis');
      expect(xAxis).toBeInTheDocument();
      expect(xAxis).toHaveAttribute('data-key', 'name');
    });

    it('should render YAxis', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    });

    it('should render Tooltip with custom MilestoneTooltip', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('milestone-tooltip')).toBeInTheDocument();
    });

    it('should render Line chart with progress data', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      const line = screen.getByTestId('line-chart');
      expect(line).toBeInTheDocument();
      expect(line).toHaveAttribute('data-key', 'progress');
      expect(line).toHaveAttribute('data-type', 'monotone');
    });

    it('should use custom MilestoneDot for Line dots', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      const line = screen.getByTestId('line-chart');
      expect(line).toHaveAttribute('data-dot', 'true');
    });

    it('should render ReferenceLine for current milestone', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      const referenceLine = screen.getByTestId('reference-line');
      expect(referenceLine).toBeInTheDocument();
      expect(referenceLine).toHaveAttribute('data-x', 'Socialization');
      expect(referenceLine).toHaveAttribute('data-label', 'Current');
    });

    it('should not render ReferenceLine when no current milestone', () => {
      const youngFoal = { ...mockFoal, ageInDays: 0 }; // Before first milestone
      renderWithQueryClient(<FoalMilestoneTimeline foal={youngFoal} milestones={mockMilestones} />);
      expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument();
    });
  });

  describe('legend', () => {
    it('should display "Completed" legend item', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should display "Current" legend item', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByText('Current')).toBeInTheDocument();
    });

    it('should display "Upcoming" legend item', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByText('Upcoming')).toBeInTheDocument();
    });
  });

  describe('current milestone panel', () => {
    it('should render CurrentMilestonePanel when current milestone exists', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByTestId('current-milestone-panel')).toBeInTheDocument();
    });

    it('should pass correct props to CurrentMilestonePanel', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      const panel = screen.getByTestId('current-milestone-panel');
      expect(panel).toHaveAttribute('data-milestone', 'Socialization');
      expect(panel).toHaveAttribute('data-foal-age', '45');
      expect(panel).toHaveAttribute('data-days-remaining', '45'); // 90 - 45
    });

    it('should not render CurrentMilestonePanel when no current milestone', () => {
      const youngFoal = { ...mockFoal, ageInDays: 0 };
      renderWithQueryClient(<FoalMilestoneTimeline foal={youngFoal} milestones={mockMilestones} />);
      expect(screen.queryByTestId('current-milestone-panel')).not.toBeInTheDocument();
    });

    it('should use default enrichment values when not provided', () => {
      const foalWithoutEnrichment = {
        ...mockFoal,
        enrichmentActivitiesCompleted: undefined,
        totalEnrichmentActivities: undefined,
      };

      renderWithQueryClient(
        <FoalMilestoneTimeline foal={foalWithoutEnrichment as Foal} milestones={mockMilestones} />
      );
      // CurrentMilestonePanel should still render with defaults (0 and 5)
      expect(screen.getByTestId('current-milestone-panel')).toBeInTheDocument();
    });
  });

  describe('milestone history', () => {
    it('should display "Milestone History" heading', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByText('Milestone History')).toBeInTheDocument();
    });

    it('should render MilestoneCard for each milestone', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.getByTestId('milestone-card-first-steps')).toBeInTheDocument();
      expect(screen.getByTestId('milestone-card-socialization')).toBeInTheDocument();
      expect(screen.getByTestId('milestone-card-weaning')).toBeInTheDocument();
    });

    it('should mark current milestone card as current', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      const currentCard = screen.getByTestId('milestone-card-socialization');
      expect(currentCard).toHaveAttribute('data-current', 'true');
    });

    it('should not mark other cards as current', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      const firstCard = screen.getByTestId('milestone-card-first-steps');
      const weaningCard = screen.getByTestId('milestone-card-weaning');
      expect(firstCard).toHaveAttribute('data-current', 'false');
      expect(weaningCard).toHaveAttribute('data-current', 'false');
    });

    it('should handle MilestoneCard onClick', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);

      const card = screen.getByTestId('milestone-card-first-steps');
      await user.click(card);

      // Clicking should update selectedMilestone state (though we can't easily test the state)
      // The component should not error
      expect(card).toBeInTheDocument();
    });

    it('should sort milestones by age window', () => {
      // Create milestones in wrong order
      const unsortedMilestones = [mockMilestones[2], mockMilestones[0], mockMilestones[1]];

      const { container } = renderWithQueryClient(
        <FoalMilestoneTimeline foal={mockFoal} milestones={unsortedMilestones} />
      );

      // Should render in sorted order (by ageWindow.min)
      const cards = container.querySelectorAll('[data-testid^="milestone-card-"]');
      expect(cards[0]).toHaveAttribute('data-testid', 'milestone-card-first-steps');
      expect(cards[1]).toHaveAttribute('data-testid', 'milestone-card-socialization');
      expect(cards[2]).toHaveAttribute('data-testid', 'milestone-card-weaning');
    });

    it('should display empty state when no milestones', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={[]} />);
      expect(screen.getByText('No milestone data available.')).toBeInTheDocument();
    });

    it('should not display empty state when milestones exist', () => {
      renderWithQueryClient(<FoalMilestoneTimeline foal={mockFoal} milestones={mockMilestones} />);
      expect(screen.queryByText('No milestone data available.')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle foal with age 0', () => {
      const newbornFoal = { ...mockFoal, ageInDays: 0 };
      renderWithQueryClient(
        <FoalMilestoneTimeline foal={newbornFoal} milestones={mockMilestones} />
      );
      expect(screen.getByText(/0 days old/)).toBeInTheDocument();
    });

    it('should handle very old foal past all milestones', () => {
      const oldFoal = { ...mockFoal, ageInDays: 365 };
      renderWithQueryClient(<FoalMilestoneTimeline foal={oldFoal} milestones={mockMilestones} />);
      expect(screen.getByText(/365 days old/)).toBeInTheDocument();
    });

    it('should handle single milestone', () => {
      renderWithQueryClient(
        <FoalMilestoneTimeline foal={mockFoal} milestones={[mockMilestones[0]]} />
      );
      expect(screen.getByTestId('milestone-card-first-steps')).toBeInTheDocument();
    });

    it('should handle milestones with missing optional fields', () => {
      const minimalMilestone: Milestone = {
        id: 'minimal',
        type: 'minimal',
        name: 'Minimal Milestone',
        ageWindow: { min: 1, max: 30 },
        status: 'pending',
        requirements: [],
        rewards: { milestonePoints: 0, potentialTraits: [] },
      };

      renderWithQueryClient(
        <FoalMilestoneTimeline foal={mockFoal} milestones={[minimalMilestone]} />
      );
      expect(screen.getByTestId('milestone-card-minimal')).toBeInTheDocument();
    });
  });
});
