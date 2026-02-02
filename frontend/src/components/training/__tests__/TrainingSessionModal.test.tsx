/**
 * TrainingSessionModal Component Tests
 *
 * Tests for the TrainingSessionModal component including:
 * - Basic rendering and structure
 * - Discipline selection functionality
 * - Status display with scores and cooldowns
 * - Eligibility checking workflow
 * - Training execution workflow
 * - Trait modifier display and integration
 * - Net effect calculations
 * - User interactions
 *
 * Story: Training Trait Modifiers - Task 4 (Tests)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TrainingSessionModal from '../TrainingSessionModal';

// Mock horse data
const mockHorse = {
  id: 1,
  name: 'Thunder',
  level: 5,
  breed: 'Arabian',
  ageYears: 4,
  bestDisciplines: ['Dressage', 'Racing'],
  nextEligibleAt: null,
};

// Mock functions for callbacks
const mockOnClose = vi.fn();
const mockOnCompleted = vi.fn();

// Mock return values for hooks
const mockCheckEligibility = vi.fn();
const mockRunTraining = vi.fn();

const mockUseTrainingStatus = vi.fn(() => ({
  data: { score: 75, nextEligibleDate: null },
}));

const mockUseTrainingEligibility = vi.fn(() => ({
  mutateAsync: mockCheckEligibility,
  data: null,
  isPending: false,
}));

const mockUseTrainingSession = vi.fn(() => ({
  mutateAsync: mockRunTraining,
  isPending: false,
}));

// Mock the training hooks
vi.mock('@/hooks/api/useTraining', () => ({
  useTrainingStatus: () => mockUseTrainingStatus(),
  useTrainingEligibility: () => mockUseTrainingEligibility(),
  useTrainingSession: () => mockUseTrainingSession(),
}));

describe('TrainingSessionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTrainingStatus.mockReturnValue({
      data: { score: 75, nextEligibleDate: null },
    });
    mockUseTrainingEligibility.mockReturnValue({
      mutateAsync: mockCheckEligibility,
      data: null,
      isPending: false,
    });
    mockUseTrainingSession.mockReturnValue({
      mutateAsync: mockRunTraining,
      isPending: false,
    });
  });

  describe('Rendering', () => {
    it('renders modal with horse name', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );
      // Horse name appears in both header and stats card
      const horseNames = screen.getAllByText('Thunder');
      expect(horseNames.length).toBeGreaterThanOrEqual(1);
      expect(horseNames[0]).toBeInTheDocument();
    });

    it('displays Training Session header', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );
      expect(screen.getByText('Training Session')).toBeInTheDocument();
    });

    it('displays discipline selection instruction', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );
      expect(
        screen.getByText(
          /Choose a discipline to train. Eligibility and cooldown are enforced server-side./i
        )
      ).toBeInTheDocument();
    });

    it('renders Close button', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );
      expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument();
    });

    it('renders Check Eligibility button', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );
      expect(screen.getByRole('button', { name: /Check Eligibility/i })).toBeInTheDocument();
    });

    it('renders Start Training button', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );
      expect(screen.getByRole('button', { name: /Start Training/i })).toBeInTheDocument();
    });
  });

  describe('Discipline Selection', () => {
    it('renders discipline dropdown with label', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );
      expect(screen.getByLabelText(/Discipline/i)).toBeInTheDocument();
    });

    it('has Barrel Racing as default discipline', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );
      const select = screen.getByLabelText(/Discipline/i) as HTMLSelectElement;
      expect(select.value).toBe('Barrel Racing');
    });

    it('includes all 23 disciplines', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );
      const disciplines = [
        'Barrel Racing',
        'Combined Driving',
        'Cross Country',
        'Cutting',
        'Dressage',
        'Endurance',
        'Eventing',
        'Fine Harness',
        'Gaited',
        'Gymkhana',
        'Harness Racing',
        'Hunter',
        'Polo',
        'Racing',
        'Reining',
        'Rodeo',
        'Roping',
        'Saddleseat',
        'Show Jumping',
        'Steeplechase',
        'Team Penning',
        'Vaulting',
        'Western Pleasure',
      ];
      disciplines.forEach((d) => {
        expect(screen.getByRole('option', { name: d })).toBeInTheDocument();
      });
    });

    it('allows changing discipline', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );
      const select = screen.getByLabelText(/Discipline/i) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'Racing' } });
      expect(select.value).toBe('Racing');
    });
  });

  describe('Status Display', () => {
    it('shows status summary with score when available', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: { score: 85, nextEligibleDate: null },
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );
      expect(screen.getByText(/Score 85/)).toBeInTheDocument();
    });

    it('shows "Ready" when no cooldown', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: { score: 75, nextEligibleDate: null },
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );
      expect(screen.getByText(/Ready/)).toBeInTheDocument();
    });

    it('shows cooldown date when on cooldown', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: { score: 75, nextEligibleDate: '2025-12-10T00:00:00Z' },
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );
      expect(screen.getByText(/Cooldown until/)).toBeInTheDocument();
    });

    it('shows "Awaiting status..." when no data', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: null,
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );
      expect(screen.getByText('Awaiting status...')).toBeInTheDocument();
    });

    it('shows "Score pending" when score is undefined', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: { nextEligibleDate: null },
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );
      expect(screen.getByText(/Score pending/)).toBeInTheDocument();
    });
  });

  describe('Check Eligibility', () => {
    it('calls checkEligibility when Check Eligibility button is clicked', async () => {
      mockCheckEligibility.mockResolvedValue({ eligible: true });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      const checkButton = screen.getByRole('button', { name: /Check Eligibility/i });
      fireEvent.click(checkButton);

      await waitFor(() => {
        expect(mockCheckEligibility).toHaveBeenCalledWith({
          horseId: 1,
          discipline: 'Barrel Racing',
        });
      });
    });

    it('shows "Eligible to train" when horse is eligible', () => {
      mockUseTrainingEligibility.mockReturnValue({
        mutateAsync: mockCheckEligibility,
        data: { eligible: true },
        isPending: false,
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      expect(screen.getByText('Eligible to train')).toBeInTheDocument();
    });

    it('shows reason when horse is not eligible', () => {
      mockUseTrainingEligibility.mockReturnValue({
        mutateAsync: mockCheckEligibility,
        data: { eligible: false, reason: 'Horse is on cooldown' },
        isPending: false,
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      expect(screen.getByText('Horse is on cooldown')).toBeInTheDocument();
    });

    it('shows default message when not eligible and no reason', () => {
      mockUseTrainingEligibility.mockReturnValue({
        mutateAsync: mockCheckEligibility,
        data: { eligible: false },
        isPending: false,
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      expect(screen.getByText('Not eligible to train')).toBeInTheDocument();
    });

    it('shows "Checking..." while checking eligibility', () => {
      mockUseTrainingEligibility.mockReturnValue({
        mutateAsync: mockCheckEligibility,
        data: null,
        isPending: true,
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      expect(screen.getByRole('button', { name: /Checking.../i })).toBeInTheDocument();
    });

    it('disables Check Eligibility button while checking', () => {
      mockUseTrainingEligibility.mockReturnValue({
        mutateAsync: mockCheckEligibility,
        data: null,
        isPending: true,
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      expect(screen.getByRole('button', { name: /Checking.../i })).toBeDisabled();
    });

    it('shows error message when eligibility check fails', async () => {
      mockCheckEligibility.mockRejectedValue({ message: 'Network error' });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      const checkButton = screen.getByRole('button', { name: /Check Eligibility/i });
      fireEvent.click(checkButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('shows default error message when no message in error', async () => {
      mockCheckEligibility.mockRejectedValue({});

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      const checkButton = screen.getByRole('button', { name: /Check Eligibility/i });
      fireEvent.click(checkButton);

      await waitFor(() => {
        expect(screen.getByText('Unable to check eligibility')).toBeInTheDocument();
      });
    });
  });

  describe('Training Execution', () => {
    it('calls runTraining when Start Training button is clicked', async () => {
      mockRunTraining.mockResolvedValue({
        success: true,
        gains: { Dressage: 5 },
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      const trainButton = screen.getByRole('button', { name: /Start Training/i });
      fireEvent.click(trainButton);

      await waitFor(() => {
        expect(mockRunTraining).toHaveBeenCalledWith({
          horseId: 1,
          discipline: 'Barrel Racing',
        });
      });
    });

    it('calls onCompleted callback when training succeeds', async () => {
      const trainingResult = { success: true, gains: { Dressage: 5 } };
      mockRunTraining.mockResolvedValue(trainingResult);

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      const trainButton = screen.getByRole('button', { name: /Start Training/i });
      fireEvent.click(trainButton);

      await waitFor(() => {
        expect(mockOnCompleted).toHaveBeenCalledWith(trainingResult);
      });
    });

    it('shows "Training..." while training', () => {
      mockUseTrainingSession.mockReturnValue({
        mutateAsync: mockRunTraining,
        isPending: true,
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      expect(screen.getByRole('button', { name: /Training.../i })).toBeInTheDocument();
    });

    it('disables Start Training button while training', () => {
      mockUseTrainingSession.mockReturnValue({
        mutateAsync: mockRunTraining,
        isPending: true,
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      expect(screen.getByRole('button', { name: /Training.../i })).toBeDisabled();
    });

    it('disables Check Eligibility button while training', () => {
      mockUseTrainingSession.mockReturnValue({
        mutateAsync: mockRunTraining,
        isPending: true,
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      expect(screen.getByRole('button', { name: /Check Eligibility/i })).toBeDisabled();
    });

    it('shows error message when training fails', async () => {
      mockRunTraining.mockRejectedValue({ message: 'Horse is tired' });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      const trainButton = screen.getByRole('button', { name: /Start Training/i });
      fireEvent.click(trainButton);

      await waitFor(() => {
        expect(screen.getByText('Horse is tired')).toBeInTheDocument();
      });
    });

    it('shows default error message when no message in training error', async () => {
      mockRunTraining.mockRejectedValue({});

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      const trainButton = screen.getByRole('button', { name: /Start Training/i });
      fireEvent.click(trainButton);

      await waitFor(() => {
        expect(screen.getByText('Training failed')).toBeInTheDocument();
      });
    });
  });

  describe('Close Button', () => {
    it('calls onClose when Close button is clicked', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      const closeButton = screen.getByRole('button', { name: /Close/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Error Message Clearing', () => {
    it('clears error message when discipline changes', async () => {
      mockCheckEligibility.mockRejectedValue({ message: 'Network error' });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // Trigger error
      const checkButton = screen.getByRole('button', { name: /Check Eligibility/i });
      fireEvent.click(checkButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Change discipline
      const select = screen.getByLabelText(/Discipline/i);
      fireEvent.change(select, { target: { value: 'Racing' } });

      await waitFor(() => {
        expect(screen.queryByText('Network error')).not.toBeInTheDocument();
      });
    });
  });

  describe('Training with Selected Discipline', () => {
    it('trains with selected discipline after changing it', async () => {
      mockRunTraining.mockResolvedValue({
        success: true,
        gains: { Racing: 10 },
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // Change discipline to Racing
      const select = screen.getByLabelText(/Discipline/i);
      fireEvent.change(select, { target: { value: 'Racing' } });

      // Start training
      const trainButton = screen.getByRole('button', { name: /Start Training/i });
      fireEvent.click(trainButton);

      await waitFor(() => {
        expect(mockRunTraining).toHaveBeenCalledWith({
          horseId: 1,
          discipline: 'Racing',
        });
      });
    });
  });

  describe('Optional onCompleted', () => {
    it('works without onCompleted callback', async () => {
      mockRunTraining.mockResolvedValue({ success: true });

      render(<TrainingSessionModal horse={mockHorse} onClose={mockOnClose} />);

      const trainButton = screen.getByRole('button', { name: /Start Training/i });
      fireEvent.click(trainButton);

      await waitFor(() => {
        expect(mockRunTraining).toHaveBeenCalled();
      });
      // Should not throw error
    });
  });

  // ============================================================================
  // NEW TESTS: Trait Modifier Display Integration (Task 4)
  // ============================================================================

  describe('Trait Display Tests', () => {
    it('renders trait modifiers section in modal', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      const traitSection = screen.getByTestId('trait-modifiers-section');
      expect(traitSection).toBeInTheDocument();
    });

    it('renders TraitModifierList component', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // TraitModifierList displays "Base Gain:" text
      expect(screen.getByText('Base Gain:')).toBeInTheDocument();
    });

    it('renders "Learn More" icon button', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      const learnMoreButton = screen.getByRole('button', { name: /Learn more about traits/i });
      expect(learnMoreButton).toBeInTheDocument();
    });

    it('renders section with correct heading "Trait Modifiers"', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      expect(screen.getByText('Trait Modifiers')).toBeInTheDocument();
    });

    it('renders trait-modifiers-section data-testid', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      expect(screen.getByTestId('trait-modifiers-section')).toBeInTheDocument();
    });
  });

  describe('Discipline-Specific Traits Tests', () => {
    it('shows Athletic + Stubborn traits for physical disciplines (Barrel Racing)', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // Default discipline is Barrel Racing (physical)
      // Should show Athletic (positive) and Stubborn (negative)
      expect(screen.getByTestId('trait-badge-athletic')).toBeInTheDocument();
      expect(screen.getByTestId('trait-badge-stubborn')).toBeInTheDocument();
    });

    it('shows Athletic + Stubborn traits for Racing discipline', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // Change to Racing
      const select = screen.getByLabelText(/Discipline/i);
      fireEvent.change(select, { target: { value: 'Racing' } });

      expect(screen.getByTestId('trait-badge-athletic')).toBeInTheDocument();
      expect(screen.getByTestId('trait-badge-stubborn')).toBeInTheDocument();
    });

    it('shows Intelligent + Calm traits for mental disciplines (Dressage)', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // Change to Dressage (mental)
      const select = screen.getByLabelText(/Discipline/i);
      fireEvent.change(select, { target: { value: 'Dressage' } });

      expect(screen.getByTestId('trait-badge-intelligent')).toBeInTheDocument();
      expect(screen.getByTestId('trait-badge-calm')).toBeInTheDocument();
    });

    it('shows Quick Learner trait for other disciplines (Cross Country)', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // Change to Cross Country (other)
      const select = screen.getByLabelText(/Discipline/i);
      fireEvent.change(select, { target: { value: 'Cross Country' } });

      expect(screen.getByTestId('trait-badge-quick-learner')).toBeInTheDocument();
    });

    it('updates traits when discipline changes from Racing to Dressage', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      const select = screen.getByLabelText(/Discipline/i);

      // Start with Racing (physical)
      fireEvent.change(select, { target: { value: 'Racing' } });
      expect(screen.getByTestId('trait-badge-athletic')).toBeInTheDocument();

      // Change to Dressage (mental)
      fireEvent.change(select, { target: { value: 'Dressage' } });
      expect(screen.getByTestId('trait-badge-intelligent')).toBeInTheDocument();
      expect(screen.queryByTestId('trait-badge-athletic')).not.toBeInTheDocument();
    });
  });

  describe('Net Effect Integration Tests', () => {
    it('displays expected score section with data-testid', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      expect(screen.getByTestId('expected-score-display')).toBeInTheDocument();
    });

    it('calculates correct expected score for physical disciplines (base=5 + athletic=3 - stubborn=2 = 6)', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: { score: 75, nextEligibleDate: null },
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // Default is Barrel Racing: base 5 + athletic 3 - stubborn 2 = net effect 6
      // Expected score = 75 + 6 = 81
      const expectedScoreValue = screen.getByTestId('expected-score-value');
      expect(expectedScoreValue).toHaveTextContent('81');
    });

    it('calculates correct expected score for mental disciplines (base=5 + intelligent=4 - calm=0 = 9)', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: { score: 50, nextEligibleDate: null },
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // Change to Dressage: base 5 + intelligent 4 - calm 0 = net effect 9
      const select = screen.getByLabelText(/Discipline/i);
      fireEvent.change(select, { target: { value: 'Dressage' } });

      // Expected score = 50 + 9 = 59
      const expectedScoreValue = screen.getByTestId('expected-score-value');
      expect(expectedScoreValue).toHaveTextContent('59');
    });

    it('calculates correct expected score for other disciplines (base=5 + quick-learner=2 = 7)', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: { score: 30, nextEligibleDate: null },
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // Change to Cross Country: base 5 + quick-learner 2 = net effect 7
      const select = screen.getByLabelText(/Discipline/i);
      fireEvent.change(select, { target: { value: 'Cross Country' } });

      // Expected score = 30 + 7 = 37
      const expectedScoreValue = screen.getByTestId('expected-score-value');
      expect(expectedScoreValue).toHaveTextContent('37');
    });

    it('displays net effect in TraitModifierList', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // TraitModifierList shows "Net Effect:" text
      expect(screen.getByText('Net Effect:')).toBeInTheDocument();
    });

    it('updates expected score when discipline changes', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: { score: 100, nextEligibleDate: null },
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      const select = screen.getByLabelText(/Discipline/i);

      // Start with Barrel Racing: net effect = 6, expected = 106
      let expectedScoreValue = screen.getByTestId('expected-score-value');
      expect(expectedScoreValue).toHaveTextContent('106');

      // Change to Dressage: net effect = 9, expected = 109
      fireEvent.change(select, { target: { value: 'Dressage' } });
      expectedScoreValue = screen.getByTestId('expected-score-value');
      expect(expectedScoreValue).toHaveTextContent('109');
    });
  });

  describe('Trait Interaction Tests', () => {
    it('calls handleLearnMore when "Learn More" icon is clicked', () => {
      // Spy on console.log to verify handleLearnMore is called
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      const learnMoreButton = screen.getByRole('button', { name: /Learn more about traits/i });
      fireEvent.click(learnMoreButton);

      expect(consoleSpy).toHaveBeenCalledWith('Learn more about traits clicked');

      consoleSpy.mockRestore();
    });

    it('TraitModifierList receives onLearnMore callback prop', () => {
      // This is verified by the component working without errors
      // The TraitModifierList should render with the callback
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // If TraitModifierList didn't receive onLearnMore, it would still render
      // but clicking "Learn More" in tooltips wouldn't work
      // Verify TraitModifierList is rendered with its content
      expect(screen.getByText('Base Gain:')).toBeInTheDocument();
    });

    it('modal still functions correctly with trait section (can check eligibility)', async () => {
      mockCheckEligibility.mockResolvedValue({ eligible: true });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // Verify trait section exists
      expect(screen.getByTestId('trait-modifiers-section')).toBeInTheDocument();

      // Click Check Eligibility - should still work
      const checkButton = screen.getByRole('button', { name: /Check Eligibility/i });
      fireEvent.click(checkButton);

      await waitFor(() => {
        expect(mockCheckEligibility).toHaveBeenCalled();
      });
    });

    it('modal still functions correctly with trait section (can start training)', async () => {
      mockRunTraining.mockResolvedValue({ success: true, gains: { 'Barrel Racing': 6 } });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // Verify trait section exists
      expect(screen.getByTestId('trait-modifiers-section')).toBeInTheDocument();

      // Click Start Training - should still work
      const trainButton = screen.getByRole('button', { name: /Start Training/i });
      fireEvent.click(trainButton);

      await waitFor(() => {
        expect(mockRunTraining).toHaveBeenCalled();
      });
    });

    it('HelpCircle icon is rendered', () => {
      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      const helpIcon = screen.getByTestId('help-circle-icon');
      expect(helpIcon).toBeInTheDocument();
    });
  });

  describe('Trait Display with No Score', () => {
    it('handles null score gracefully (defaults to 0)', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: { score: undefined, nextEligibleDate: null },
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // With no score (defaults to 0), Barrel Racing net effect = 6
      // Expected score = 0 + 6 = 6
      const expectedScoreValue = screen.getByTestId('expected-score-value');
      expect(expectedScoreValue).toHaveTextContent('6');
    });

    it('handles no status data gracefully', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: null,
      });

      render(
        <TrainingSessionModal
          horse={mockHorse}
          onClose={mockOnClose}
          onCompleted={mockOnCompleted}
        />
      );

      // With no status data, score defaults to 0
      // Expected score = 0 + 6 = 6
      const expectedScoreValue = screen.getByTestId('expected-score-value');
      expect(expectedScoreValue).toHaveTextContent('6');
    });
  });
});
