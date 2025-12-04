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
  bestDisciplines: ['dressage', 'racing'],
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
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );
      expect(screen.getByText('Thunder')).toBeInTheDocument();
    });

    it('displays Training Session header', () => {
      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );
      expect(screen.getByText('Training Session')).toBeInTheDocument();
    });

    it('displays discipline selection instruction', () => {
      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );
      expect(
        screen.getByText(/Choose a discipline to train. Eligibility and cooldown are enforced server-side./i)
      ).toBeInTheDocument();
    });

    it('renders Close button', () => {
      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );
      expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument();
    });

    it('renders Check Eligibility button', () => {
      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );
      expect(screen.getByRole('button', { name: /Check Eligibility/i })).toBeInTheDocument();
    });

    it('renders Start Training button', () => {
      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );
      expect(screen.getByRole('button', { name: /Start Training/i })).toBeInTheDocument();
    });
  });

  describe('Discipline Selection', () => {
    it('renders discipline dropdown with label', () => {
      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );
      expect(screen.getByLabelText(/Discipline/i)).toBeInTheDocument();
    });

    it('has dressage as default discipline', () => {
      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );
      const select = screen.getByLabelText(/Discipline/i) as HTMLSelectElement;
      expect(select.value).toBe('dressage');
    });

    it('includes all 8 disciplines', () => {
      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );
      const disciplines = [
        'dressage',
        'show jumping',
        'eventing',
        'racing',
        'cross country',
        'endurance',
        'reining',
        'vaulting',
      ];
      disciplines.forEach((d) => {
        expect(screen.getByRole('option', { name: d })).toBeInTheDocument();
      });
    });

    it('allows changing discipline', () => {
      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );
      const select = screen.getByLabelText(/Discipline/i) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'racing' } });
      expect(select.value).toBe('racing');
    });
  });

  describe('Status Display', () => {
    it('shows status summary with score when available', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: { score: 85, nextEligibleDate: null },
      });

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );
      expect(screen.getByText(/Score 85/)).toBeInTheDocument();
    });

    it('shows "Ready" when no cooldown', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: { score: 75, nextEligibleDate: null },
      });

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );
      expect(screen.getByText(/Ready/)).toBeInTheDocument();
    });

    it('shows cooldown date when on cooldown', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: { score: 75, nextEligibleDate: '2025-12-10T00:00:00Z' },
      });

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );
      expect(screen.getByText(/Cooldown until/)).toBeInTheDocument();
    });

    it('shows "Awaiting status…" when no data', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: null,
      });

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );
      expect(screen.getByText('Awaiting status…')).toBeInTheDocument();
    });

    it('shows "Score pending" when score is undefined', () => {
      mockUseTrainingStatus.mockReturnValue({
        data: { nextEligibleDate: null },
      });

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );
      expect(screen.getByText(/Score pending/)).toBeInTheDocument();
    });
  });

  describe('Check Eligibility', () => {
    it('calls checkEligibility when Check Eligibility button is clicked', async () => {
      mockCheckEligibility.mockResolvedValue({ eligible: true });

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );

      const checkButton = screen.getByRole('button', { name: /Check Eligibility/i });
      fireEvent.click(checkButton);

      await waitFor(() => {
        expect(mockCheckEligibility).toHaveBeenCalledWith({
          horseId: 1,
          discipline: 'dressage',
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
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
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
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
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
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );

      expect(screen.getByText('Not eligible to train')).toBeInTheDocument();
    });

    it('shows "Checking…" while checking eligibility', () => {
      mockUseTrainingEligibility.mockReturnValue({
        mutateAsync: mockCheckEligibility,
        data: null,
        isPending: true,
      });

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );

      expect(screen.getByRole('button', { name: /Checking…/i })).toBeInTheDocument();
    });

    it('disables Check Eligibility button while checking', () => {
      mockUseTrainingEligibility.mockReturnValue({
        mutateAsync: mockCheckEligibility,
        data: null,
        isPending: true,
      });

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );

      expect(screen.getByRole('button', { name: /Checking…/i })).toBeDisabled();
    });

    it('shows error message when eligibility check fails', async () => {
      mockCheckEligibility.mockRejectedValue({ message: 'Network error' });

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
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
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
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
        gains: { dressage: 5 },
      });

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );

      const trainButton = screen.getByRole('button', { name: /Start Training/i });
      fireEvent.click(trainButton);

      await waitFor(() => {
        expect(mockRunTraining).toHaveBeenCalledWith({
          horseId: 1,
          discipline: 'dressage',
        });
      });
    });

    it('calls onCompleted callback when training succeeds', async () => {
      const trainingResult = { success: true, gains: { dressage: 5 } };
      mockRunTraining.mockResolvedValue(trainingResult);

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );

      const trainButton = screen.getByRole('button', { name: /Start Training/i });
      fireEvent.click(trainButton);

      await waitFor(() => {
        expect(mockOnCompleted).toHaveBeenCalledWith(trainingResult);
      });
    });

    it('shows "Training…" while training', () => {
      mockUseTrainingSession.mockReturnValue({
        mutateAsync: mockRunTraining,
        isPending: true,
      });

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );

      expect(screen.getByRole('button', { name: /Training…/i })).toBeInTheDocument();
    });

    it('disables Start Training button while training', () => {
      mockUseTrainingSession.mockReturnValue({
        mutateAsync: mockRunTraining,
        isPending: true,
      });

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );

      expect(screen.getByRole('button', { name: /Training…/i })).toBeDisabled();
    });

    it('disables Check Eligibility button while training', () => {
      mockUseTrainingSession.mockReturnValue({
        mutateAsync: mockRunTraining,
        isPending: true,
      });

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );

      expect(screen.getByRole('button', { name: /Check Eligibility/i })).toBeDisabled();
    });

    it('shows error message when training fails', async () => {
      mockRunTraining.mockRejectedValue({ message: 'Horse is tired' });

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
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
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
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
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
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
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );

      // Trigger error
      const checkButton = screen.getByRole('button', { name: /Check Eligibility/i });
      fireEvent.click(checkButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Change discipline
      const select = screen.getByLabelText(/Discipline/i);
      fireEvent.change(select, { target: { value: 'racing' } });

      await waitFor(() => {
        expect(screen.queryByText('Network error')).not.toBeInTheDocument();
      });
    });
  });

  describe('Training with Selected Discipline', () => {
    it('trains with selected discipline after changing it', async () => {
      mockRunTraining.mockResolvedValue({
        success: true,
        gains: { racing: 10 },
      });

      render(
        <TrainingSessionModal horse={mockHorse} onClose={mockOnClose} onCompleted={mockOnCompleted} />
      );

      // Change discipline to racing
      const select = screen.getByLabelText(/Discipline/i);
      fireEvent.change(select, { target: { value: 'racing' } });

      // Start training
      const trainButton = screen.getByRole('button', { name: /Start Training/i });
      fireEvent.click(trainButton);

      await waitFor(() => {
        expect(mockRunTraining).toHaveBeenCalledWith({
          horseId: 1,
          discipline: 'racing',
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
});
