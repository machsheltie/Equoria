import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickTrainButton from '../QuickTrainButton';

describe('QuickTrainButton', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders button', () => {
      render(<QuickTrainButton onClick={mockOnClick} />);
      expect(screen.getByTestId('quick-train-button')).toBeInTheDocument();
    });

    it('shows button text', () => {
      render(<QuickTrainButton onClick={mockOnClick} />);
      expect(screen.getByText('Quick Train')).toBeInTheDocument();
    });

    it('shows icon', () => {
      const { container } = render(<QuickTrainButton onClick={mockOnClick} />);
      const icon = container.querySelector('svg[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup();
      render(<QuickTrainButton onClick={mockOnClick} />);

      await user.click(screen.getByTestId('quick-train-button'));
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', async () => {
      const user = userEvent.setup();
      render(<QuickTrainButton onClick={mockOnClick} disabled />);

      await user.click(screen.getByTestId('quick-train-button'));
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('States', () => {
    it('applies disabled styling when disabled', () => {
      render(<QuickTrainButton onClick={mockOnClick} disabled />);
      const button = screen.getByTestId('quick-train-button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:opacity-50');
    });

    it('shows loading spinner when loading', () => {
      render(<QuickTrainButton onClick={mockOnClick} loading />);
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('changes text when loading', () => {
      render(<QuickTrainButton onClick={mockOnClick} loading />);
      expect(screen.getByText('Training...')).toBeInTheDocument();
    });

    it('is disabled when loading', () => {
      render(<QuickTrainButton onClick={mockOnClick} loading />);
      expect(screen.getByTestId('quick-train-button')).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has button role', () => {
      render(<QuickTrainButton onClick={mockOnClick} />);
      const button = screen.getByTestId('quick-train-button');
      expect(button.tagName).toBe('BUTTON');
    });

    it('has descriptive aria-label', () => {
      render(<QuickTrainButton onClick={mockOnClick} />);
      expect(screen.getByLabelText('Quick train available horses')).toBeInTheDocument();
    });

    it('has aria-busy when loading', () => {
      render(<QuickTrainButton onClick={mockOnClick} loading />);
      expect(screen.getByTestId('quick-train-button')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Custom className', () => {
    it('accepts and applies custom className', () => {
      render(<QuickTrainButton onClick={mockOnClick} className="custom-class" />);
      expect(screen.getByTestId('quick-train-button')).toHaveClass('custom-class');
    });
  });
});
