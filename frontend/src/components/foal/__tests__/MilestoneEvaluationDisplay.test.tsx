/**
 * Tests for MilestoneEvaluationDisplay Component
 *
 * Testing Sprint Day 3 - Story 6-4: Milestone Evaluation Display
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Component rendering states (loading, error, empty, normal)
 * - Evaluation history display
 * - Modal interaction (open, close, auto-show)
 * - Trait confirmation display
 * - Helper function (getTraitsForEvaluation)
 * - Child component integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MilestoneEvaluationHistory, EpigeneticTrait } from '@/types/foal';

// Mock child components
vi.mock('../EvaluationHistoryItem', () => ({
  default: vi.fn(({ evaluation, onViewDetails }) => (
    <div data-testid={`evaluation-item-${evaluation.milestone}`}>
      <span>{evaluation.milestoneName}</span>
      <button onClick={onViewDetails}>View Details</button>
    </div>
  )),
}));

vi.mock('../EvaluationScoreDisplay', () => ({
  default: vi.fn(({ score, size }) => (
    <div data-testid="evaluation-score-display" data-score={score} data-size={size}>
      Score: {score}
    </div>
  )),
}));

vi.mock('../ScoreBreakdownPanel', () => ({
  default: vi.fn(({ bondModifier, taskConsistency, careQuality, totalScore }) => (
    <div data-testid="score-breakdown-panel">
      <span>Bond: {bondModifier}</span>
      <span>Task: {taskConsistency}</span>
      <span>Care: {careQuality}</span>
      <span>Total: {totalScore}</span>
    </div>
  )),
}));

vi.mock('../TraitConfirmationCard', () => ({
  default: vi.fn(({ trait }) => (
    <div data-testid={`trait-card-${trait.id}`}>
      <span>{trait.name}</span>
    </div>
  )),
}));

vi.mock('../EvaluationExplanation', () => ({
  default: vi.fn(({ score, milestone }) => (
    <div data-testid="evaluation-explanation">
      Explanation for {milestone} with score {score}
    </div>
  )),
}));

// Mock BaseModal
vi.mock('@/components/common/BaseModal', () => ({
  default: vi.fn(({ isOpen, onClose, title, children }) =>
    isOpen ? (
      <div data-testid="base-modal">
        <h1>{title}</h1>
        <button onClick={onClose} data-testid="modal-close">
          Close
        </button>
        {children}
      </div>
    ) : null
  ),
}));

// Mock useQuery
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

import { useQuery } from '@tanstack/react-query';
import MilestoneEvaluationDisplay from '../MilestoneEvaluationDisplay';

describe('MilestoneEvaluationDisplay Component', () => {
  let queryClient: QueryClient;

  const mockEvaluationHistory: MilestoneEvaluationHistory = {
    evaluations: [
      {
        milestone: 'socialization',
        milestoneName: 'Socialization',
        score: 4,
        traitsConfirmed: ['peopleOriented'],
        evaluatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        bondModifier: 2,
        taskConsistency: 2,
        careQuality: 0,
        scoreBreakdown: {
          bondModifier: 2,
          taskConsistency: 2,
          careQuality: 0,
        },
      },
      {
        milestone: 'imprinting',
        milestoneName: 'Imprinting',
        score: 2,
        traitsConfirmed: ['confident'],
        evaluatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        bondModifier: 1,
        taskConsistency: 1,
        careQuality: 0,
        scoreBreakdown: {
          bondModifier: 1,
          taskConsistency: 1,
          careQuality: 0,
        },
      },
    ],
    completedMilestones: ['imprinting', 'socialization'],
    currentMilestone: 'curiosity_play',
  };

  const mockTraitData: { traits: EpigeneticTrait[] } = {
    traits: [
      {
        id: 'peopleOriented',
        name: 'People-Oriented',
        category: 'Social',
        description: 'Bonds quickly with handlers',
        effects: [
          {
            type: 'Training XP Gain',
            value: 15,
            description: '+15% XP gain',
          },
        ],
        isPositive: true,
        tier: 'common',
      },
      {
        id: 'confident',
        name: 'Confident',
        category: 'Temperament',
        description: 'Shows self-assurance',
        effects: [
          {
            type: 'Stress Resistance',
            value: 10,
            description: '-10% stress',
          },
        ],
        isPositive: true,
        tier: 'common',
      },
    ],
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  };

  describe('loading state', () => {
    it('should display loading spinner when history is loading', () => {
      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: null,
          isLoading: true,
          error: null,
        } as never)
        .mockReturnValueOnce({
          data: mockTraitData,
          isLoading: false,
        } as never);

      const { container } = renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should display loading spinner when traits are loading', () => {
      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: mockEvaluationHistory,
          isLoading: false,
          error: null,
        } as never)
        .mockReturnValueOnce({
          data: null,
          isLoading: true,
        } as never);

      const { container } = renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should display loading spinner when both queries are loading', () => {
      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: null,
          isLoading: true,
          error: null,
        } as never)
        .mockReturnValueOnce({
          data: null,
          isLoading: true,
        } as never);

      const { container } = renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should display error message when history query fails', () => {
      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: null,
          isLoading: false,
          error: new Error('Failed to fetch evaluation history'),
        })
        .mockReturnValueOnce({
          data: mockTraitData,
          isLoading: false,
        });

      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);
      expect(screen.getByText('Error loading evaluations')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch evaluation history')).toBeInTheDocument();
    });

    it('should display generic error for non-Error objects', () => {
      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: null,
          isLoading: false,
          error: { message: 'Something went wrong' },
        })
        .mockReturnValueOnce({
          data: mockTraitData,
          isLoading: false,
        });

      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);
      expect(screen.getByText('An error occurred')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should display empty state when no evaluations exist', () => {
      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: { evaluations: [], completedMilestones: [], currentMilestone: null },
          isLoading: false,
          error: null,
        })
        .mockReturnValueOnce({
          data: mockTraitData,
          isLoading: false,
        });

      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);
      expect(screen.getByText('No milestone evaluations yet')).toBeInTheDocument();
      expect(
        screen.getByText(/Evaluations will appear as your foal completes developmental milestones/i)
      ).toBeInTheDocument();
    });

    it('should display empty state when evaluationHistory is null', () => {
      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: null,
          isLoading: false,
          error: null,
        })
        .mockReturnValueOnce({
          data: mockTraitData,
          isLoading: false,
        });

      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);
      expect(screen.getByText('No milestone evaluations yet')).toBeInTheDocument();
    });
  });

  describe('history display', () => {
    beforeEach(() => {
      // Setup default successful queries for these tests
      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: mockEvaluationHistory,
          isLoading: false,
          error: null,
        })
        .mockReturnValueOnce({
          data: mockTraitData,
          isLoading: false,
        });
    });

    it('should display evaluation history header', () => {
      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);
      expect(screen.getByText('Milestone Evaluation History')).toBeInTheDocument();
    });

    it('should render all evaluations in history', () => {
      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);
      expect(screen.getByTestId('evaluation-item-socialization')).toBeInTheDocument();
      expect(screen.getByTestId('evaluation-item-imprinting')).toBeInTheDocument();
    });

    it('should display evaluation names', () => {
      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);
      expect(screen.getByText('Socialization')).toBeInTheDocument();
      expect(screen.getByText('Imprinting')).toBeInTheDocument();
    });

    it('should not show history when showHistory is false', () => {
      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} showHistory={false} />);
      expect(screen.queryByText('Milestone Evaluation History')).not.toBeInTheDocument();
    });

    it('should show history by default', () => {
      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);
      expect(screen.getByText('Milestone Evaluation History')).toBeInTheDocument();
    });
  });

  describe('modal interaction', () => {
    it('should open modal when View Details is clicked', () => {
      vi.mocked(useQuery).mockImplementation((options: { queryKey: string[] }) => {
        if (options.queryKey[0] === 'milestone-evaluations') {
          return {
            data: mockEvaluationHistory,
            isLoading: false,
            error: null,
          } as never;
        }
        return {
          data: mockTraitData,
          isLoading: false,
        } as never;
      });
      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);

      const viewButton = screen.getAllByText('View Details')[0];
      fireEvent.click(viewButton);

      expect(screen.getByTestId('base-modal')).toBeInTheDocument();
      expect(screen.getByText('Milestone Evaluation Results')).toBeInTheDocument();
    });

    it('should display selected evaluation in modal', () => {
      vi.mocked(useQuery).mockImplementation((options: { queryKey: string[] }) => {
        if (options.queryKey[0] === 'milestone-evaluations') {
          return {
            data: mockEvaluationHistory,
            isLoading: false,
            error: null,
          } as never;
        }
        return {
          data: mockTraitData,
          isLoading: false,
        } as never;
      });
      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);

      const viewButton = screen.getAllByText('View Details')[0];
      fireEvent.click(viewButton);

      expect(screen.getByText(/Socialization Complete!/)).toBeInTheDocument();
    });

    it('should close modal when Close button is clicked', () => {
      vi.mocked(useQuery).mockImplementation((options: { queryKey: string[] }) => {
        if (options.queryKey[0] === 'milestone-evaluations') {
          return {
            data: mockEvaluationHistory,
            isLoading: false,
            error: null,
          } as never;
        }
        return {
          data: mockTraitData,
          isLoading: false,
        } as never;
      });
      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);

      const viewButton = screen.getAllByText('View Details')[0];
      fireEvent.click(viewButton);
      expect(screen.getByTestId('base-modal')).toBeInTheDocument();

      const closeButton = screen.getByTestId('modal-close');
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('base-modal')).not.toBeInTheDocument();
    });

    it('should close modal when Continue button is clicked', () => {
      vi.mocked(useQuery).mockImplementation((options: { queryKey: string[] }) => {
        if (options.queryKey[0] === 'milestone-evaluations') {
          return {
            data: mockEvaluationHistory,
            isLoading: false,
            error: null,
          } as never;
        }
        return {
          data: mockTraitData,
          isLoading: false,
        } as never;
      });
      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);

      const viewButton = screen.getAllByText('View Details')[0];
      fireEvent.click(viewButton);

      const continueButton = screen.getByText('Continue');
      fireEvent.click(continueButton);

      expect(screen.queryByTestId('base-modal')).not.toBeInTheDocument();
    });
  });

  describe('modal content', () => {
    const setupAndOpenModal = () => {
      vi.mocked(useQuery).mockImplementation((options: { queryKey: string[] }) => {
        if (options.queryKey[0] === 'milestone-evaluations') {
          return {
            data: mockEvaluationHistory,
            isLoading: false,
            error: null,
          } as never;
        }
        return {
          data: mockTraitData,
          isLoading: false,
        } as never;
      });
      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);
      const viewButton = screen.getAllByText('View Details')[0];
      fireEvent.click(viewButton);
    };

    it('should display evaluation score', () => {
      setupAndOpenModal();
      expect(screen.getByTestId('evaluation-score-display')).toBeInTheDocument();
      expect(screen.getByTestId('evaluation-score-display')).toHaveAttribute('data-score', '4');
      expect(screen.getByTestId('evaluation-score-display')).toHaveAttribute('data-size', 'large');
    });

    it('should display score breakdown panel', () => {
      setupAndOpenModal();
      expect(screen.getByTestId('score-breakdown-panel')).toBeInTheDocument();
      expect(screen.getByText('Bond: 2')).toBeInTheDocument();
      expect(screen.getByText('Task: 2')).toBeInTheDocument();
      expect(screen.getByText('Care: 0')).toBeInTheDocument();
      expect(screen.getByText('Total: 4')).toBeInTheDocument();
    });

    it('should display traits confirmed header', () => {
      setupAndOpenModal();
      expect(screen.getByText('Traits Confirmed')).toBeInTheDocument();
    });

    it('should display trait confirmation cards', () => {
      setupAndOpenModal();
      expect(screen.getByTestId('trait-card-peopleOriented')).toBeInTheDocument();
      expect(screen.getByText('People-Oriented')).toBeInTheDocument();
    });

    it('should display evaluation explanation', () => {
      setupAndOpenModal();
      expect(screen.getByTestId('evaluation-explanation')).toBeInTheDocument();
      expect(screen.getByText(/Explanation for socialization/i)).toBeInTheDocument();
    });

    it('should display formatted evaluation date', () => {
      setupAndOpenModal();
      // Date should be formatted as "Month Day, Year"
      const dateElements = screen.getAllByText(/Completed:/);
      expect(dateElements.length).toBeGreaterThan(0);
    });
  });

  describe('auto-show functionality', () => {
    it('should not auto-show modal by default', () => {
      vi.mocked(useQuery).mockImplementation((options: { queryKey: string[] }) => {
        if (options.queryKey[0] === 'milestone-evaluations') {
          return {
            data: mockEvaluationHistory,
            isLoading: false,
            error: null,
          } as never;
        }
        return {
          data: mockTraitData,
          isLoading: false,
        } as never;
      });
      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);
      expect(screen.queryByTestId('base-modal')).not.toBeInTheDocument();
    });

    it('should auto-show latest evaluation when autoShowLatest is true', () => {
      vi.mocked(useQuery).mockImplementation((options: { queryKey: string[] }) => {
        if (options.queryKey[0] === 'milestone-evaluations') {
          return {
            data: mockEvaluationHistory,
            isLoading: false,
            error: null,
          } as never;
        }
        return {
          data: mockTraitData,
          isLoading: false,
        } as never;
      });
      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} autoShowLatest={true} />);
      expect(screen.getByTestId('base-modal')).toBeInTheDocument();
      expect(screen.getByText(/Socialization Complete!/)).toBeInTheDocument();
    });

    it('should not auto-show when no evaluations exist', () => {
      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: { evaluations: [], completedMilestones: [], currentMilestone: null },
          isLoading: false,
          error: null,
        })
        .mockReturnValueOnce({
          data: mockTraitData,
          isLoading: false,
        });

      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} autoShowLatest={true} />);
      expect(screen.queryByTestId('base-modal')).not.toBeInTheDocument();
    });
  });

  describe('trait filtering', () => {
    it('should only display traits that are confirmed', () => {
      vi.mocked(useQuery).mockImplementation((options: { queryKey: string[] }) => {
        if (options.queryKey[0] === 'milestone-evaluations') {
          return {
            data: mockEvaluationHistory,
            isLoading: false,
            error: null,
          } as never;
        }
        return {
          data: mockTraitData,
          isLoading: false,
        } as never;
      });
      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);

      const viewButton = screen.getAllByText('View Details')[0];
      fireEvent.click(viewButton);

      // Socialization has peopleOriented trait
      expect(screen.getByTestId('trait-card-peopleOriented')).toBeInTheDocument();
      // Should not show confident trait (belongs to imprinting)
      expect(screen.queryByTestId('trait-card-confident')).not.toBeInTheDocument();
    });

    it('should display different traits for different evaluations', () => {
      vi.mocked(useQuery).mockImplementation((options: { queryKey: string[] }) => {
        if (options.queryKey[0] === 'milestone-evaluations') {
          return {
            data: mockEvaluationHistory,
            isLoading: false,
            error: null,
          } as never;
        }
        return {
          data: mockTraitData,
          isLoading: false,
        } as never;
      });
      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);

      // View imprinting evaluation (second one)
      const viewButtons = screen.getAllByText('View Details');
      fireEvent.click(viewButtons[1]);

      // Imprinting has confident trait
      expect(screen.getByTestId('trait-card-confident')).toBeInTheDocument();
      expect(screen.getByText('Confident')).toBeInTheDocument();
    });

    it('should handle evaluations with no traits', () => {
      const noTraitsHistory = {
        ...mockEvaluationHistory,
        evaluations: [
          {
            ...mockEvaluationHistory.evaluations[0],
            traitsConfirmed: [],
          },
        ],
      };

      vi.mocked(useQuery).mockImplementation((options: { queryKey: string[] }) => {
        if (options.queryKey[0] === 'milestone-evaluations') {
          return {
            data: noTraitsHistory,
            isLoading: false,
            error: null,
          } as never;
        }
        return {
          data: mockTraitData,
          isLoading: false,
        } as never;
      });

      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} />);

      const viewButton = screen.getAllByText('View Details')[0];
      fireEvent.click(viewButton);

      expect(screen.queryByText('Traits Confirmed')).not.toBeInTheDocument();
    });
  });

  describe('props handling', () => {
    beforeEach(() => {
      // Setup default successful queries for these tests
      vi.mocked(useQuery)
        .mockReturnValueOnce({
          data: mockEvaluationHistory,
          isLoading: false,
          error: null,
        })
        .mockReturnValueOnce({
          data: mockTraitData,
          isLoading: false,
        });
    });

    it('should use provided foalId in queries', () => {
      renderWithProvider(<MilestoneEvaluationDisplay foalId={42} />);
      // Component should render without errors with different foalId
      expect(screen.getByText('Milestone Evaluation History')).toBeInTheDocument();
    });

    it('should handle milestoneType prop', () => {
      renderWithProvider(<MilestoneEvaluationDisplay foalId={1} milestoneType="socialization" />);
      // Component should render without errors with milestoneType
      expect(screen.getByText('Milestone Evaluation History')).toBeInTheDocument();
    });
  });
});
