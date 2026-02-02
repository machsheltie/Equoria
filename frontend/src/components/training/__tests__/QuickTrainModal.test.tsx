import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickTrainModal from '../QuickTrainModal';

describe('QuickTrainModal', () => {
  const mockOnClose = vi.fn();
  const mockOnTrain = vi.fn();

  const readyHorses = [
    { id: 1, name: 'Thunder', age: 5, trainingStatus: 'ready' as const },
    { id: 2, name: 'Blaze', age: 6, trainingStatus: 'ready' as const },
    { id: 3, name: 'Spirit', age: 4, trainingStatus: 'ready' as const },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering - Closed', () => {
    it('does not render when isOpen is false', () => {
      render(
        <QuickTrainModal
          isOpen={false}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );
      expect(screen.queryByTestId('quick-train-modal')).not.toBeInTheDocument();
    });
  });

  describe('Rendering - Open', () => {
    it('renders modal when isOpen is true', () => {
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );
      expect(screen.getByTestId('quick-train-modal')).toBeInTheDocument();
    });

    it('renders modal title', () => {
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );
      expect(screen.getByText('Quick Train')).toBeInTheDocument();
    });

    it('renders modal description', () => {
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );
      expect(screen.getByText(/select horses to train simultaneously/i)).toBeInTheDocument();
    });

    it('renders close button', () => {
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );
      expect(screen.getByTestId('close-button')).toBeInTheDocument();
    });

    it('shows horse count', () => {
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );
      expect(screen.getByText(/3 horses ready/i)).toBeInTheDocument();
    });

    it('shows singular form for 1 horse', () => {
      render(
        <QuickTrainModal
          isOpen={true}
          horses={[readyHorses[0]]}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );
      expect(screen.getByText(/1 horse ready/i)).toBeInTheDocument();
    });
  });

  describe('Horse List', () => {
    it('renders all ready horses', () => {
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );
      expect(screen.getByText('Thunder')).toBeInTheDocument();
      expect(screen.getByText('Blaze')).toBeInTheDocument();
      expect(screen.getByText('Spirit')).toBeInTheDocument();
    });

    it('shows checkboxes for each horse', () => {
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );
      const checkboxes = screen.getAllByRole('checkbox', { name: /select/i });
      expect(checkboxes).toHaveLength(4); // 3 horses + select all
    });

    it('shows horse ages', () => {
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );
      expect(screen.getByText(/5 years old/i)).toBeInTheDocument();
      expect(screen.getByText(/6 years old/i)).toBeInTheDocument();
      expect(screen.getByText(/4 years old/i)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no ready horses', () => {
      render(
        <QuickTrainModal isOpen={true} horses={[]} onClose={mockOnClose} onTrain={mockOnTrain} />
      );
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('shows empty state message', () => {
      render(
        <QuickTrainModal isOpen={true} horses={[]} onClose={mockOnClose} onTrain={mockOnTrain} />
      );
      expect(screen.getByText(/no horses ready for training/i)).toBeInTheDocument();
    });

    it('does not show train button in empty state', () => {
      render(
        <QuickTrainModal isOpen={true} horses={[]} onClose={mockOnClose} onTrain={mockOnTrain} />
      );
      expect(screen.queryByTestId('train-selected-button')).not.toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('allows selecting individual horses', async () => {
      const user = userEvent.setup();
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox', { name: /select/i });
      await user.click(checkboxes[1]); // First horse (index 0 is select all)

      expect(checkboxes[1]).toBeChecked();
    });

    it('shows selected count', async () => {
      const user = userEvent.setup();
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox', { name: /select/i });
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    });

    it('select all checkbox selects all horses', async () => {
      const user = userEvent.setup();
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
      await user.click(selectAllCheckbox);

      expect(screen.getByText(/3 selected/i)).toBeInTheDocument();
    });

    it('select all checkbox deselects all horses', async () => {
      const user = userEvent.setup();
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
      await user.click(selectAllCheckbox); // Select all

      // Should show selected count
      expect(screen.getByText(/\(3 selected\)/i)).toBeInTheDocument();

      await user.click(selectAllCheckbox); // Deselect all

      // When nothing is selected, the "(X selected)" count text is hidden
      expect(screen.queryByText(/\(\d+ selected\)/i)).not.toBeInTheDocument();
      // But button still shows "Train Selected (0)"
      expect(screen.getByTestId('train-selected-button')).toHaveTextContent('Train Selected (0)');
    });
  });

  describe('Actions', () => {
    it('calls onClose when close button clicked', async () => {
      const user = userEvent.setup();
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );

      await user.click(screen.getByTestId('close-button'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when cancel button clicked', async () => {
      const user = userEvent.setup();
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );

      await user.click(screen.getByTestId('cancel-button'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('train button is disabled when no horses selected', () => {
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );
      expect(screen.getByTestId('train-selected-button')).toBeDisabled();
    });

    it('train button is enabled when horses selected', async () => {
      const user = userEvent.setup();
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox', { name: /select/i });
      await user.click(checkboxes[1]);

      expect(screen.getByTestId('train-selected-button')).not.toBeDisabled();
    });

    it('calls onTrain with selected horse ids', async () => {
      const user = userEvent.setup();
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox', { name: /select/i });
      await user.click(checkboxes[1]); // Thunder (id: 1)
      await user.click(checkboxes[3]); // Spirit (id: 3)

      await user.click(screen.getByTestId('train-selected-button'));

      expect(mockOnTrain).toHaveBeenCalledWith([1, 3]);
    });
  });

  describe('Accessibility', () => {
    it('has dialog role', () => {
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby', () => {
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
    });

    it('close button has accessible label', () => {
      render(
        <QuickTrainModal
          isOpen={true}
          horses={readyHorses}
          onClose={mockOnClose}
          onTrain={mockOnTrain}
        />
      );
      expect(screen.getByLabelText('Close quick train modal')).toBeInTheDocument();
    });
  });
});
