import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TrainingDashboard from '../TrainingDashboard';

// Mock trainable horses data
const mockHorses = [
  {
    id: 1,
    name: 'Thunder',
    level: 5,
    breed: 'Arabian',
    ageYears: 4,
    bestDisciplines: ['dressage', 'racing'],
    nextEligibleAt: null,
  },
  {
    id: 2,
    name: 'Storm',
    level: 3,
    breed: 'Thoroughbred',
    ageYears: 6,
    bestDisciplines: ['show_jumping'],
    nextEligibleAt: '2025-12-10T00:00:00Z',
  },
];

const mockRefetch = vi.fn();

// Default mock for loading state
const mockUseTrainableHorses = vi.fn(() => ({
  data: null,
  isLoading: true,
  error: null,
  refetch: mockRefetch,
}));

// Mock child components to simplify testing
vi.mock('../TrainingSessionModal', () => ({
  default: function MockTrainingSessionModal({ horse, onClose }: { horse: { name: string }; onClose: () => void }) {
    return (
      <div data-testid="training-modal">
        <span>Training Modal for {horse.name}</span>
        <button onClick={onClose}>Close Modal</button>
      </div>
    );
  },
}));

vi.mock('../TrainingHistoryPanel', () => ({
  default: function MockTrainingHistoryPanel({ horseId }: { horseId?: number }) {
    return <div data-testid="training-history">History Panel for horse {horseId ?? 'none'}</div>;
  },
}));

vi.mock('@/hooks/api/useTraining', () => ({
  useTrainableHorses: () => mockUseTrainableHorses(),
}));

describe('TrainingDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading message when data is loading', () => {
      mockUseTrainableHorses.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: mockRefetch,
      });

      render(<TrainingDashboard />);
      expect(screen.getByText(/Loading trainable horses/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when there is an error', () => {
      mockUseTrainableHorses.mockReturnValue({
        data: null,
        isLoading: false,
        error: { message: 'Failed to fetch horses' },
        refetch: mockRefetch,
      });

      render(<TrainingDashboard />);
      expect(screen.getByText(/Failed to fetch horses/i)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty message when no horses available', () => {
      mockUseTrainableHorses.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<TrainingDashboard />);
      expect(screen.getByText(/No trainable horses found/i)).toBeInTheDocument();
    });
  });

  describe('Horse Cards', () => {
    beforeEach(() => {
      mockUseTrainableHorses.mockReturnValue({
        data: mockHorses,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it('renders horse cards with names', () => {
      render(<TrainingDashboard />);
      expect(screen.getByText('Thunder')).toBeInTheDocument();
      expect(screen.getByText('Storm')).toBeInTheDocument();
    });

    it('shows horse levels', () => {
      render(<TrainingDashboard />);
      expect(screen.getByText('Level 5')).toBeInTheDocument();
      expect(screen.getByText('Level 3')).toBeInTheDocument();
    });

    it('shows horse breeds', () => {
      render(<TrainingDashboard />);
      expect(screen.getByText('Arabian')).toBeInTheDocument();
      expect(screen.getByText('Thoroughbred')).toBeInTheDocument();
    });

    it('shows best disciplines', () => {
      render(<TrainingDashboard />);
      expect(screen.getByText(/dressage, racing/)).toBeInTheDocument();
      expect(screen.getByText(/show_jumping/)).toBeInTheDocument();
    });

    it('shows cooldown status for horses on cooldown', () => {
      render(<TrainingDashboard />);
      expect(screen.getByText(/Ready to train/)).toBeInTheDocument();
      expect(screen.getByText(/Cooldown until/)).toBeInTheDocument();
    });

    it('enables Train button for ready horses', () => {
      render(<TrainingDashboard />);
      const trainButtons = screen.getAllByRole('button', { name: /Train/i });
      // Thunder has no cooldown - button should be enabled
      expect(trainButtons[0]).not.toBeDisabled();
    });

    it('disables Train button for horses on cooldown', () => {
      render(<TrainingDashboard />);
      // Get all buttons with "On Cooldown" - filter button has count, horse card button is disabled
      const cooldownButtons = screen.getAllByRole('button', { name: /On Cooldown/i });
      // The horse card button (without count) should be disabled
      const horseCardButton = cooldownButtons.find((btn) => !btn.textContent?.includes('('));
      expect(horseCardButton).toBeDisabled();
    });
  });

  describe('Interactions', () => {
    beforeEach(() => {
      mockUseTrainableHorses.mockReturnValue({
        data: mockHorses,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it('calls refetch when refresh button is clicked', () => {
      render(<TrainingDashboard />);
      const refreshButton = screen.getByRole('button', { name: /Refresh/i });
      fireEvent.click(refreshButton);
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('opens training modal when Train button is clicked', async () => {
      render(<TrainingDashboard />);
      const trainButtons = screen.getAllByRole('button', { name: /Train/i });
      fireEvent.click(trainButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('training-modal')).toBeInTheDocument();
      });
      expect(screen.getByText(/Training Modal for Thunder/)).toBeInTheDocument();
    });

    it('closes training modal when close is clicked', async () => {
      render(<TrainingDashboard />);
      const trainButtons = screen.getAllByRole('button', { name: /Train/i });
      fireEvent.click(trainButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('training-modal')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /Close Modal/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('training-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('Header', () => {
    beforeEach(() => {
      mockUseTrainableHorses.mockReturnValue({
        data: mockHorses,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it('displays dashboard title', () => {
      render(<TrainingDashboard />);
      expect(screen.getByText('Training Dashboard')).toBeInTheDocument();
    });

    it('displays dashboard description', () => {
      render(<TrainingDashboard />);
      expect(screen.getByText(/Track readiness/)).toBeInTheDocument();
    });
  });

  describe('Training History Panel', () => {
    beforeEach(() => {
      mockUseTrainableHorses.mockReturnValue({
        data: mockHorses,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it('renders training history panel', () => {
      render(<TrainingDashboard />);
      expect(screen.getByTestId('training-history')).toBeInTheDocument();
    });

    it('passes selected horse id to history panel', async () => {
      render(<TrainingDashboard />);
      const trainButtons = screen.getAllByRole('button', { name: /Train/i });
      fireEvent.click(trainButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/History Panel for horse 1/)).toBeInTheDocument();
      });
    });
  });

  describe('Eligibility Filter', () => {
    beforeEach(() => {
      mockUseTrainableHorses.mockReturnValue({
        data: mockHorses,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it('renders filter buttons with counts', () => {
      render(<TrainingDashboard />);

      expect(screen.getByRole('button', { name: /All \(2\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Ready \(1\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /On Cooldown \(1\)/i })).toBeInTheDocument();
    });

    it('shows all horses by default', () => {
      render(<TrainingDashboard />);
      expect(screen.getByText('Thunder')).toBeInTheDocument();
      expect(screen.getByText('Storm')).toBeInTheDocument();
    });

    it('filters to show only ready horses when Ready is clicked', async () => {
      render(<TrainingDashboard />);
      const readyButton = screen.getByRole('button', { name: /Ready \(1\)/i });
      fireEvent.click(readyButton);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
        expect(screen.queryByText('Storm')).not.toBeInTheDocument();
      });
    });

    it('filters to show only cooldown horses when On Cooldown is clicked', async () => {
      render(<TrainingDashboard />);
      const cooldownButton = screen.getByRole('button', { name: /On Cooldown \(1\)/i });
      fireEvent.click(cooldownButton);

      await waitFor(() => {
        expect(screen.queryByText('Thunder')).not.toBeInTheDocument();
        expect(screen.getByText('Storm')).toBeInTheDocument();
      });
    });

    it('shows all horses when All is clicked after filtering', async () => {
      render(<TrainingDashboard />);

      // First filter to ready
      const readyButton = screen.getByRole('button', { name: /Ready \(1\)/i });
      fireEvent.click(readyButton);

      await waitFor(() => {
        expect(screen.queryByText('Storm')).not.toBeInTheDocument();
      });

      // Then click All
      const allButton = screen.getByRole('button', { name: /All \(2\)/i });
      fireEvent.click(allButton);

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
        expect(screen.getByText('Storm')).toBeInTheDocument();
      });
    });

    it('shows empty message when filter matches no horses', async () => {
      // All horses on cooldown
      mockUseTrainableHorses.mockReturnValue({
        data: [mockHorses[1]], // Only Storm (on cooldown)
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<TrainingDashboard />);
      const readyButton = screen.getByRole('button', { name: /Ready \(0\)/i });
      fireEvent.click(readyButton);

      await waitFor(() => {
        expect(screen.getByText(/No ready horses found/i)).toBeInTheDocument();
      });
    });

    it('has correct aria attributes for filter group', () => {
      render(<TrainingDashboard />);
      const filterGroup = screen.getByRole('group', { name: /Filter horses by eligibility/i });
      expect(filterGroup).toBeInTheDocument();
    });

    it('has aria-pressed attribute on active filter', () => {
      render(<TrainingDashboard />);
      const allButton = screen.getByRole('button', { name: /All \(2\)/i });
      expect(allButton).toHaveAttribute('aria-pressed', 'true');

      const readyButton = screen.getByRole('button', { name: /Ready \(1\)/i });
      expect(readyButton).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
