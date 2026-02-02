import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrainingDashboardTable from '../TrainingDashboardTable';

describe('TrainingDashboardTable', () => {
  const mockOnTrain = vi.fn();

  const sampleHorses = [
    { id: 1, name: 'Thunder', age: 5, trainingStatus: 'ready' as const },
    {
      id: 2,
      name: 'Lightning',
      age: 4,
      trainingStatus: 'cooldown' as const,
      trainingCooldown: new Date(Date.now() + 1000).toISOString(),
    },
    { id: 3, name: 'Storm', age: 2, trainingStatus: 'ineligible' as const },
    { id: 4, name: 'Blaze', age: 6, trainingStatus: 'ready' as const },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders table container', () => {
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);
      expect(screen.getByTestId('dashboard-table')).toBeInTheDocument();
    });

    it('renders all horses', () => {
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);
      expect(screen.getAllByTestId('horse-card')).toHaveLength(4);
    });

    it('renders horse names', () => {
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);
      expect(screen.getByText('Thunder')).toBeInTheDocument();
      expect(screen.getByText('Lightning')).toBeInTheDocument();
      expect(screen.getByText('Storm')).toBeInTheDocument();
      expect(screen.getByText('Blaze')).toBeInTheDocument();
    });

    it('shows total horse count', () => {
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);
      expect(screen.getByText(/4 horses/i)).toBeInTheDocument();
    });

    it('shows singular form for 1 horse', () => {
      render(<TrainingDashboardTable horses={[sampleHorses[0]]} onTrain={mockOnTrain} />);
      expect(screen.getByText(/1 horse/i)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no horses', () => {
      render(<TrainingDashboardTable horses={[]} onTrain={mockOnTrain} />);
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('shows empty state message', () => {
      render(<TrainingDashboardTable horses={[]} onTrain={mockOnTrain} />);
      expect(screen.getByText(/no horses found/i)).toBeInTheDocument();
    });

    it('shows empty state description', () => {
      render(<TrainingDashboardTable horses={[]} onTrain={mockOnTrain} />);
      expect(screen.getByText(/try adjusting your filters/i)).toBeInTheDocument();
    });

    it('does not show horse cards in empty state', () => {
      render(<TrainingDashboardTable horses={[]} onTrain={mockOnTrain} />);
      expect(screen.queryByTestId('horse-card')).not.toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('renders sort controls', () => {
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);
      expect(screen.getByTestId('sort-controls')).toBeInTheDocument();
    });

    it('shows sort label', () => {
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);
      expect(screen.getByText('Sort by:')).toBeInTheDocument();
    });

    it('renders all sort buttons', () => {
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);
      expect(screen.getByTestId('sort-name')).toBeInTheDocument();
      expect(screen.getByTestId('sort-age')).toBeInTheDocument();
      expect(screen.getByTestId('sort-status')).toBeInTheDocument();
    });

    it('highlights active sort option', () => {
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);
      const nameButton = screen.getByTestId('sort-name');
      expect(nameButton).toHaveClass('bg-blue-600');
    });

    it('sorts by name alphabetically', async () => {
      const user = userEvent.setup();
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);

      await user.click(screen.getByTestId('sort-name'));

      const cards = screen.getAllByTestId('horse-card');
      expect(within(cards[0]).getByText('Blaze')).toBeInTheDocument();
      expect(within(cards[1]).getByText('Lightning')).toBeInTheDocument();
      expect(within(cards[2]).getByText('Storm')).toBeInTheDocument();
      expect(within(cards[3]).getByText('Thunder')).toBeInTheDocument();
    });

    it('sorts by age (oldest first)', async () => {
      const user = userEvent.setup();
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);

      await user.click(screen.getByTestId('sort-age'));

      const cards = screen.getAllByTestId('horse-card');
      expect(within(cards[0]).getByText('Blaze')).toBeInTheDocument(); // age 6
      expect(within(cards[1]).getByText('Thunder')).toBeInTheDocument(); // age 5
    });

    it('sorts by status (ready > cooldown > ineligible)', async () => {
      const user = userEvent.setup();
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);

      await user.click(screen.getByTestId('sort-status'));

      const cards = screen.getAllByTestId('horse-card');
      const firstTwo = cards.slice(0, 2);
      const statuses = firstTwo.map((card) => within(card).getByTestId('status-badge').textContent);

      // Both ready horses should be first
      expect(statuses.every((s) => s === 'Ready')).toBe(true);
    });

    it('updates sort button styling when clicked', async () => {
      const user = userEvent.setup();
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);

      const ageButton = screen.getByTestId('sort-age');
      await user.click(ageButton);

      expect(ageButton).toHaveClass('bg-blue-600');
    });
  });

  describe('Horse Actions', () => {
    it('passes onTrain callback to horse cards', async () => {
      const user = userEvent.setup();
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);

      const trainButtons = screen.getAllByTestId('train-button');
      await user.click(trainButtons[0]);

      expect(mockOnTrain).toHaveBeenCalled();
    });

    it('calls onTrain with correct horse id', async () => {
      const user = userEvent.setup();
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);

      // Default sort is by name, so first card is "Blaze" (id: 4)
      const firstCard = screen.getAllByTestId('horse-card')[0];
      const trainButton = within(firstCard).getByTestId('train-button');
      await user.click(trainButton);

      expect(mockOnTrain).toHaveBeenCalledWith(4);
    });
  });

  describe('Responsive Layout', () => {
    it('uses grid layout for cards', () => {
      const { container } = render(
        <TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />
      );
      const grid = container.querySelector('[data-testid="horses-grid"]');
      expect(grid).toHaveClass('grid');
    });

    it('applies responsive grid columns', () => {
      const { container } = render(
        <TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />
      );
      const grid = container.querySelector('[data-testid="horses-grid"]');
      expect(grid).toHaveClass('md:grid-cols-2');
      expect(grid).toHaveClass('lg:grid-cols-3');
    });
  });

  describe('Accessibility', () => {
    it('has semantic section structure', () => {
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);
      const section = screen.getByTestId('dashboard-table');
      expect(section.tagName).toBe('DIV');
    });

    it('sort buttons have aria-pressed attribute', () => {
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);
      const nameButton = screen.getByTestId('sort-name');
      expect(nameButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('inactive sort buttons have aria-pressed false', () => {
      render(<TrainingDashboardTable horses={sampleHorses} onTrain={mockOnTrain} />);
      const ageButton = screen.getByTestId('sort-age');
      expect(ageButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Custom className', () => {
    it('accepts and applies custom className', () => {
      const { container } = render(
        <TrainingDashboardTable
          horses={sampleHorses}
          onTrain={mockOnTrain}
          className="custom-class"
        />
      );
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
