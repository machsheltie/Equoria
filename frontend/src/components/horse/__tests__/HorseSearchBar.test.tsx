/**
 * Tests for HorseSearchBar Component
 *
 * Tests cover:
 * - Basic rendering and interaction
 * - Debouncing behavior (300ms default)
 * - Clear button visibility and functionality
 * - Keyboard support (Escape, Enter)
 * - Loading states and disabled behavior
 * - Accessibility (ARIA labels, roles, screen readers)
 * - Auto-focus functionality
 * - Value synchronization (controlled component)
 * - Custom placeholder and debounce settings
 *
 * Story 3-6: Horse Search & Filter - Task 3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HorseSearchBar from '../HorseSearchBar';

describe('HorseSearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render search input with default placeholder', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox', { name: /search horses/i });
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'Search horses by name, breed, or traits...');
    });

    it('should render with custom placeholder', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} placeholder="Find your horse..." />);

      const input = screen.getByPlaceholderText('Find your horse...');
      expect(input).toBeInTheDocument();
    });

    it('should render search icon', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} />);

      // Search icon should be visible
      const container = screen.getByRole('textbox').parentElement;
      expect(container).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const mockOnChange = vi.fn();
      const { container } = render(
        <HorseSearchBar value="" onChange={mockOnChange} className="custom-class" />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });

    it('should render with initial value', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="Thunder" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('Thunder');
    });
  });

  describe('User Input', () => {
    it('should update local state on input change', async () => {
      const mockOnChange = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<HorseSearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Arabian');

      expect(input).toHaveValue('Arabian');
    });

    it('should NOT call onChange immediately (debouncing)', async () => {
      const mockOnChange = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<HorseSearchBar value="" onChange={mockOnChange} debounceMs={300} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      // Should not call onChange yet
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should call onChange after debounce delay', async () => {
      const mockOnChange = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<HorseSearchBar value="" onChange={mockOnChange} debounceMs={300} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      // Fast-forward time by 300ms
      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('Test');
      });
    });

    it('should use custom debounce delay', async () => {
      const mockOnChange = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<HorseSearchBar value="" onChange={mockOnChange} debounceMs={500} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      // Should not call at 300ms
      vi.advanceTimersByTime(300);
      expect(mockOnChange).not.toHaveBeenCalled();

      // Should call at 500ms
      vi.advanceTimersByTime(200);
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('Test');
      });
    });

    it('should reset debounce timer on each keystroke', async () => {
      const mockOnChange = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<HorseSearchBar value="" onChange={mockOnChange} debounceMs={300} />);

      const input = screen.getByRole('textbox');

      // Type 'T'
      await user.type(input, 'T');
      vi.advanceTimersByTime(200);

      // Type 'e' (resets timer)
      await user.type(input, 'e');
      vi.advanceTimersByTime(200);

      // Should not have called yet
      expect(mockOnChange).not.toHaveBeenCalled();

      // Wait remaining 100ms
      vi.advanceTimersByTime(100);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('Te');
      });
    });

    it('should sync local value with prop changes', () => {
      const mockOnChange = vi.fn();
      const { rerender } = render(<HorseSearchBar value="Initial" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('Initial');

      // Parent changes value
      rerender(<HorseSearchBar value="Updated" onChange={mockOnChange} />);

      expect(input).toHaveValue('Updated');
    });
  });

  describe('Clear Button', () => {
    it('should show clear button when input has value', async () => {
      const mockOnChange = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<HorseSearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      expect(clearButton).toBeInTheDocument();
    });

    it('should NOT show clear button when input is empty', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} />);

      const clearButton = screen.queryByRole('button', { name: /clear search/i });
      expect(clearButton).not.toBeInTheDocument();
    });

    it('should clear input when clear button is clicked', async () => {
      const mockOnChange = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<HorseSearchBar value="Test" onChange={mockOnChange} />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      await user.click(clearButton);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
      expect(mockOnChange).toHaveBeenCalledWith('');
    });

    it('should focus input after clearing', async () => {
      const mockOnChange = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<HorseSearchBar value="Test" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      const clearButton = screen.getByRole('button', { name: /clear search/i });

      await user.click(clearButton);

      expect(input).toHaveFocus();
    });

    it('should disable clear button when loading', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="Test" onChange={mockOnChange} isLoading={true} />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      expect(clearButton).toBeDisabled();
    });
  });

  describe('Keyboard Support', () => {
    it('should clear input on Escape key', async () => {
      const mockOnChange = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<HorseSearchBar value="Test" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      input.focus();

      await user.keyboard('{Escape}');

      expect(input).toHaveValue('');
      expect(mockOnChange).toHaveBeenCalledWith('');
    });

    it('should call onSubmit on Enter key', async () => {
      const mockOnChange = vi.fn();
      const mockOnSubmit = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<HorseSearchBar value="Test" onChange={mockOnChange} onSubmit={mockOnSubmit} />);

      const input = screen.getByRole('textbox');
      input.focus();

      await user.keyboard('{Enter}');

      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('should flush debounce on Enter key', async () => {
      const mockOnChange = vi.fn();
      const mockOnSubmit = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(
        <HorseSearchBar value="" onChange={mockOnChange} onSubmit={mockOnSubmit} debounceMs={300} />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      // Don't wait for debounce - press Enter immediately
      await user.keyboard('{Enter}');

      // onChange should be called immediately (flushed)
      expect(mockOnChange).toHaveBeenCalledWith('Test');
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('should work without onSubmit callback', async () => {
      const mockOnChange = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<HorseSearchBar value="Test" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      input.focus();

      // Should not throw error
      await user.keyboard('{Enter}');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should disable input when loading', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} isLoading={true} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('should show loading indicator for screen readers', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} isLoading={true} />);

      const loadingText = screen.getByText('Searching...');
      expect(loadingText).toBeInTheDocument();
      expect(loadingText).toHaveClass('sr-only');
    });

    it('should change search icon color when loading', () => {
      const mockOnChange = vi.fn();
      const { container } = render(
        <HorseSearchBar value="" onChange={mockOnChange} isLoading={true} />
      );

      const input = container.querySelector('input');
      expect(input).toHaveClass('bg-blue-50');
    });

    it('should NOT show loading when not loading', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} isLoading={false} />);

      const loadingText = screen.queryByText('Searching...');
      expect(loadingText).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByLabelText('Search horses');
      expect(input).toBeInTheDocument();
    });

    it('should have aria-label for screen readers', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label', 'Search horses by name, breed, or traits');
    });

    it('should associate clear button with input via aria-describedby', async () => {
      const mockOnChange = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<HorseSearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      expect(input).toHaveAttribute('aria-describedby', 'search-clear-button');
    });

    it('should NOT have aria-describedby when empty', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      expect(input).not.toHaveAttribute('aria-describedby');
    });

    it('should have role="status" on loading indicator', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} isLoading={true} />);

      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Searching...');
    });

    it('should have aria-live="polite" on loading indicator', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} isLoading={true} />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('should hide search icon from screen readers', () => {
      const mockOnChange = vi.fn();
      const { container } = render(<HorseSearchBar value="" onChange={mockOnChange} />);

      const iconContainer = container.querySelector('[aria-hidden="true"]');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('Auto Focus', () => {
    it('should auto-focus input when autoFocus is true', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} autoFocus={true} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveFocus();
    });

    it('should NOT auto-focus when autoFocus is false', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} autoFocus={false} />);

      const input = screen.getByRole('textbox');
      expect(input).not.toHaveFocus();
    });

    it('should NOT auto-focus by default', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      expect(input).not.toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string value', () => {
      const mockOnChange = vi.fn();
      render(<HorseSearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });

    it('should handle whitespace-only input', async () => {
      const mockOnChange = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<HorseSearchBar value="" onChange={mockOnChange} debounceMs={300} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '   ');

      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('   ');
      });
    });

    it('should handle rapid clear and type', async () => {
      const mockOnChange = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<HorseSearchBar value="Test" onChange={mockOnChange} />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      await user.click(clearButton);

      const input = screen.getByRole('textbox');
      await user.type(input, 'New');

      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenLastCalledWith('New');
      });
    });

    it('should cleanup debounce timer on unmount', async () => {
      const mockOnChange = vi.fn();
      const user = userEvent.setup({ delay: null });
      const { unmount } = render(
        <HorseSearchBar value="" onChange={mockOnChange} debounceMs={300} />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      // Unmount before debounce completes
      unmount();
      vi.advanceTimersByTime(300);

      // Should not call onChange after unmount
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should handle multiple rapid value prop changes', () => {
      const mockOnChange = vi.fn();
      const { rerender } = render(<HorseSearchBar value="Value1" onChange={mockOnChange} />);

      rerender(<HorseSearchBar value="Value2" onChange={mockOnChange} />);
      rerender(<HorseSearchBar value="Value3" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('Value3');
    });
  });

  describe('Integration', () => {
    it('should work with typical search flow', async () => {
      const mockOnChange = vi.fn();
      const mockOnSubmit = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(
        <HorseSearchBar value="" onChange={mockOnChange} onSubmit={mockOnSubmit} debounceMs={300} />
      );

      // Type search term
      const input = screen.getByRole('textbox');
      await user.type(input, 'Arabian');

      // Wait for debounce
      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('Arabian');
      });

      // Press Enter to submit
      await user.keyboard('{Enter}');
      expect(mockOnSubmit).toHaveBeenCalled();

      // Clear search
      const clearButton = screen.getByRole('button', { name: /clear search/i });
      await user.click(clearButton);

      expect(input).toHaveValue('');
      expect(input).toHaveFocus();
    });

    it('should handle loading state during search', async () => {
      const mockOnChange = vi.fn();
      const user = userEvent.setup({ delay: null });
      const { rerender } = render(
        <HorseSearchBar value="" onChange={mockOnChange} isLoading={false} />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      // Simulate loading state
      rerender(<HorseSearchBar value="Test" onChange={mockOnChange} isLoading={true} />);

      expect(input).toBeDisabled();
      expect(screen.getByText('Searching...')).toBeInTheDocument();

      // Simulate loading complete
      rerender(<HorseSearchBar value="Test" onChange={mockOnChange} isLoading={false} />);

      expect(input).not.toBeDisabled();
      expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    });
  });
});
