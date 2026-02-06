/**
 * BaseModal Component Tests
 *
 * Comprehensive test suite for the BaseModal component, ensuring:
 * - Portal rendering
 * - Focus management (trap and restore)
 * - Keyboard handling (Escape key)
 * - Body scroll lock
 * - Backdrop clicks
 * - ARIA attributes
 * - Customization options
 *
 * Action Item: AI-5-1 - Extract BaseModal Component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BaseModal from '../BaseModal';

describe('BaseModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    children: <p>Modal content</p>,
  };

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Reset body overflow
    document.body.style.overflow = '';
  });

  afterEach(() => {
    // Clean up any remaining modals
    document.body.style.overflow = '';
  });

  describe('Rendering', () => {
    it('should render modal when isOpen is true', () => {
      render(<BaseModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      render(<BaseModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render via portal to document.body', () => {
      render(<BaseModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal.parentElement?.parentElement).toBe(document.body);
    });

    it('should render with custom data-testid', () => {
      render(<BaseModal {...defaultProps} data-testid="custom-modal" />);

      expect(screen.getByTestId('custom-modal')).toBeInTheDocument();
      expect(screen.getByTestId('custom-modal-backdrop')).toBeInTheDocument();
      expect(screen.getByTestId('custom-modal-close-button')).toBeInTheDocument();
    });
  });

  describe('ARIA Attributes', () => {
    it('should have proper ARIA attributes', () => {
      render(<BaseModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'base-modal-title');
    });

    it('should use custom aria-describedby if provided', () => {
      render(<BaseModal {...defaultProps} aria-describedby="custom-description" />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-describedby', 'custom-description');
    });

    it('should have accessible close button', () => {
      render(<BaseModal {...defaultProps} />);

      const closeButton = screen.getByLabelText('Close modal');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Modal Sizes', () => {
    it('should apply small size class', () => {
      render(<BaseModal {...defaultProps} size="sm" />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveClass('max-w-md');
    });

    it('should apply medium size class (default)', () => {
      render(<BaseModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveClass('max-w-2xl');
    });

    it('should apply large size class', () => {
      render(<BaseModal {...defaultProps} size="lg" />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveClass('max-w-4xl');
    });

    it('should apply extra-large size class', () => {
      render(<BaseModal {...defaultProps} size="xl" />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveClass('max-w-6xl');
    });

    it('should apply full size class', () => {
      render(<BaseModal {...defaultProps} size="full" />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveClass('max-w-[95vw]');
    });
  });

  describe('Footer Rendering', () => {
    it('should render footer when provided', () => {
      const footer = (
        <>
          <button>Cancel</button>
          <button>Submit</button>
        </>
      );

      render(<BaseModal {...defaultProps} footer={footer} />);

      expect(screen.getByTestId('base-modal-footer')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });

    it('should not render footer when not provided', () => {
      render(<BaseModal {...defaultProps} />);

      expect(screen.queryByTestId('base-modal-footer')).not.toBeInTheDocument();
    });
  });

  describe('Close Button', () => {
    it('should show close button by default', () => {
      render(<BaseModal {...defaultProps} />);

      expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
    });

    it('should hide close button when showCloseButton is false', () => {
      render(<BaseModal {...defaultProps} showCloseButton={false} />);

      expect(screen.queryByLabelText('Close modal')).not.toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<BaseModal {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByLabelText('Close modal'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should disable close button when isSubmitting is true', () => {
      render(<BaseModal {...defaultProps} isSubmitting={true} />);

      const closeButton = screen.getByLabelText('Close modal');
      expect(closeButton).toBeDisabled();
    });
  });

  describe('Keyboard Handling', () => {
    it('should close modal when Escape key is pressed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<BaseModal {...defaultProps} onClose={onClose} />);

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not close on Escape when closeOnEscape is false', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<BaseModal {...defaultProps} onClose={onClose} closeOnEscape={false} />);

      await user.keyboard('{Escape}');

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should not close on Escape when isSubmitting is true', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<BaseModal {...defaultProps} onClose={onClose} isSubmitting={true} />);

      await user.keyboard('{Escape}');

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Backdrop Clicks', () => {
    it('should close modal when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<BaseModal {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByTestId('base-modal-backdrop'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when modal content is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<BaseModal {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole('dialog'));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should not close on backdrop click when closeOnBackdropClick is false', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<BaseModal {...defaultProps} onClose={onClose} closeOnBackdropClick={false} />);

      await user.click(screen.getByTestId('base-modal-backdrop'));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should not close on backdrop click when isSubmitting is true', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<BaseModal {...defaultProps} onClose={onClose} isSubmitting={true} />);

      await user.click(screen.getByTestId('base-modal-backdrop'));

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Body Scroll Lock', () => {
    it('should lock body scroll when modal opens', () => {
      render(<BaseModal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scroll when modal closes', () => {
      const { rerender } = render(<BaseModal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');

      rerender(<BaseModal {...defaultProps} isOpen={false} />);

      expect(document.body.style.overflow).toBe('');
    });

    it('should restore body scroll when component unmounts', () => {
      const { unmount } = render(<BaseModal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Focus Management', () => {
    it('should focus modal container when opened', async () => {
      render(<BaseModal {...defaultProps} />);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(modal).toHaveFocus();
      });
    });

    it('should store previously focused element', () => {
      const button = document.createElement('button');
      button.textContent = 'Trigger Button';
      document.body.appendChild(button);
      button.focus();

      expect(document.activeElement).toBe(button);

      render(<BaseModal {...defaultProps} />);

      // Modal should now have focus
      expect(document.activeElement).not.toBe(button);

      document.body.removeChild(button);
    });

    it('should restore focus to previous element when closed', async () => {
      const button = document.createElement('button');
      button.textContent = 'Trigger Button';
      document.body.appendChild(button);
      button.focus();

      const { rerender } = render(<BaseModal {...defaultProps} />);

      // Close modal
      rerender(<BaseModal {...defaultProps} isOpen={false} />);

      await waitFor(() => {
        expect(document.activeElement).toBe(button);
      });

      document.body.removeChild(button);
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className to modal container', () => {
      render(<BaseModal {...defaultProps} className="custom-modal-class" />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveClass('custom-modal-class');
    });

    it('should preserve base classes when custom className is added', () => {
      render(<BaseModal {...defaultProps} className="custom-class" />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveClass('bg-white');
      expect(modal).toHaveClass('rounded-lg');
      expect(modal).toHaveClass('shadow-xl');
      expect(modal).toHaveClass('custom-class');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid open/close toggling', () => {
      const { rerender } = render(<BaseModal {...defaultProps} isOpen={false} />);

      // Rapidly toggle
      rerender(<BaseModal {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');

      rerender(<BaseModal {...defaultProps} isOpen={false} />);
      expect(document.body.style.overflow).toBe('');

      rerender(<BaseModal {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should handle missing previousActiveElement gracefully', () => {
      // Simulate no active element
      (document.activeElement as HTMLElement | null)?.blur();

      const { rerender } = render(<BaseModal {...defaultProps} />);

      // Close modal - should not throw error
      expect(() => {
        rerender(<BaseModal {...defaultProps} isOpen={false} />);
      }).not.toThrow();
    });

    it('should handle complex children content', () => {
      const complexChildren = (
        <div>
          <h3>Section 1</h3>
          <p>Paragraph 1</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
          <button>Action Button</button>
        </div>
      );

      render(<BaseModal {...defaultProps}>{complexChildren}</BaseModal>);

      expect(screen.getByText('Section 1')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 1')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument();
    });
  });

  describe('Multiple Modals', () => {
    it('should handle multiple modals rendered simultaneously', () => {
      render(
        <>
          <BaseModal {...defaultProps} title="Modal 1" data-testid="modal-1">
            <p>First modal</p>
          </BaseModal>
          <BaseModal {...defaultProps} title="Modal 2" data-testid="modal-2">
            <p>Second modal</p>
          </BaseModal>
        </>
      );

      expect(screen.getByTestId('modal-1')).toBeInTheDocument();
      expect(screen.getByTestId('modal-2')).toBeInTheDocument();
      expect(screen.getByText('Modal 1')).toBeInTheDocument();
      expect(screen.getByText('Modal 2')).toBeInTheDocument();
    });
  });
});
