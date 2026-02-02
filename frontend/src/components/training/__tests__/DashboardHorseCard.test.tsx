import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardHorseCard from '../DashboardHorseCard';

describe('DashboardHorseCard', () => {
  const mockOnTrain = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering - Ready Status', () => {
    const readyHorse = {
      id: 1,
      name: 'Thunder',
      age: 5,
      trainingStatus: 'ready' as const,
    };

    it('renders horse name', () => {
      render(<DashboardHorseCard horse={readyHorse} onTrain={mockOnTrain} />);
      expect(screen.getByText('Thunder')).toBeInTheDocument();
    });

    it('renders horse age', () => {
      render(<DashboardHorseCard horse={readyHorse} onTrain={mockOnTrain} />);
      expect(screen.getByText('5 years old')).toBeInTheDocument();
    });

    it('renders singular year for age 1', () => {
      render(<DashboardHorseCard horse={{ ...readyHorse, age: 1 }} onTrain={mockOnTrain} />);
      expect(screen.getByText('1 year old')).toBeInTheDocument();
    });

    it('shows ready status badge', () => {
      render(<DashboardHorseCard horse={readyHorse} onTrain={mockOnTrain} />);
      expect(screen.getByTestId('status-badge')).toHaveTextContent('Ready');
    });

    it('shows train button when ready', () => {
      render(<DashboardHorseCard horse={readyHorse} onTrain={mockOnTrain} />);
      expect(screen.getByTestId('train-button')).toBeInTheDocument();
    });

    it('calls onTrain when train button clicked', async () => {
      const user = userEvent.setup();
      render(<DashboardHorseCard horse={readyHorse} onTrain={mockOnTrain} />);

      await user.click(screen.getByTestId('train-button'));
      expect(mockOnTrain).toHaveBeenCalledWith(readyHorse.id);
    });
  });

  describe('Rendering - Cooldown Status', () => {
    const cooldownHorse = {
      id: 2,
      name: 'Lightning',
      age: 4,
      trainingStatus: 'cooldown' as const,
      trainingCooldown: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
    };

    it('shows cooldown status badge', () => {
      render(<DashboardHorseCard horse={cooldownHorse} onTrain={mockOnTrain} />);
      expect(screen.getByTestId('status-badge')).toHaveTextContent('Cooldown');
    });

    it('shows cooldown countdown when on cooldown', () => {
      render(<DashboardHorseCard horse={cooldownHorse} onTrain={mockOnTrain} />);
      expect(screen.getByTestId('cooldown-countdown')).toBeInTheDocument();
    });

    it('does not show train button when on cooldown', () => {
      render(<DashboardHorseCard horse={cooldownHorse} onTrain={mockOnTrain} />);
      expect(screen.queryByTestId('train-button')).not.toBeInTheDocument();
    });
  });

  describe('Rendering - Ineligible Status', () => {
    const ineligibleHorse = {
      id: 3,
      name: 'Storm',
      age: 2,
      trainingStatus: 'ineligible' as const,
      ineligibilityReason: 'Too young to train (minimum age 3)',
    };

    it('shows ineligible status badge', () => {
      render(<DashboardHorseCard horse={ineligibleHorse} onTrain={mockOnTrain} />);
      expect(screen.getByTestId('status-badge')).toHaveTextContent('Ineligible');
    });

    it('shows ineligibility reason', () => {
      render(<DashboardHorseCard horse={ineligibleHorse} onTrain={mockOnTrain} />);
      expect(screen.getByText('Too young to train (minimum age 3)')).toBeInTheDocument();
    });

    it('does not show train button when ineligible', () => {
      render(<DashboardHorseCard horse={ineligibleHorse} onTrain={mockOnTrain} />);
      expect(screen.queryByTestId('train-button')).not.toBeInTheDocument();
    });

    it('shows default reason if none provided', () => {
      render(
        <DashboardHorseCard
          horse={{ ...ineligibleHorse, ineligibilityReason: undefined }}
          onTrain={mockOnTrain}
        />
      );
      expect(screen.getByText('Not eligible for training')).toBeInTheDocument();
    });
  });

  describe('Visual Styling', () => {
    it('applies ready styling for ready status', () => {
      const readyHorse = { id: 1, name: 'Thunder', age: 5, trainingStatus: 'ready' as const };
      render(<DashboardHorseCard horse={readyHorse} onTrain={mockOnTrain} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveClass('bg-green-100');
      expect(badge).toHaveClass('text-green-800');
    });

    it('applies cooldown styling for cooldown status', () => {
      const cooldownHorse = {
        id: 2,
        name: 'Lightning',
        age: 4,
        trainingStatus: 'cooldown' as const,
        trainingCooldown: new Date(Date.now() + 1000).toISOString(),
      };
      render(<DashboardHorseCard horse={cooldownHorse} onTrain={mockOnTrain} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveClass('bg-amber-100');
      expect(badge).toHaveClass('text-amber-800');
    });

    it('applies ineligible styling for ineligible status', () => {
      const ineligibleHorse = {
        id: 3,
        name: 'Storm',
        age: 2,
        trainingStatus: 'ineligible' as const,
      };
      render(<DashboardHorseCard horse={ineligibleHorse} onTrain={mockOnTrain} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveClass('bg-slate-100');
      expect(badge).toHaveClass('text-slate-700');
    });
  });

  describe('Accessibility', () => {
    it('has semantic card structure', () => {
      const horse = { id: 1, name: 'Thunder', age: 5, trainingStatus: 'ready' as const };
      render(<DashboardHorseCard horse={horse} onTrain={mockOnTrain} />);

      expect(screen.getByTestId('horse-card')).toBeInTheDocument();
    });

    it('train button has descriptive aria-label', () => {
      const horse = { id: 1, name: 'Thunder', age: 5, trainingStatus: 'ready' as const };
      render(<DashboardHorseCard horse={horse} onTrain={mockOnTrain} />);

      expect(screen.getByLabelText('Train Thunder')).toBeInTheDocument();
    });

    it('status badge has proper role', () => {
      const horse = { id: 1, name: 'Thunder', age: 5, trainingStatus: 'ready' as const };
      render(<DashboardHorseCard horse={horse} onTrain={mockOnTrain} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveAttribute('role', 'status');
    });
  });

  describe('Custom className', () => {
    it('accepts and applies custom className', () => {
      const horse = { id: 1, name: 'Thunder', age: 5, trainingStatus: 'ready' as const };
      const { container } = render(
        <DashboardHorseCard horse={horse} onTrain={mockOnTrain} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
