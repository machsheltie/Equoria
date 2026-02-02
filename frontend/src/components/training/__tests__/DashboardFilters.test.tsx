import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardFilters, { StatusFilter } from '../DashboardFilters';

describe('DashboardFilters', () => {
  const mockOnStatusFilterChange = vi.fn();
  const mockOnSearchChange = vi.fn();

  const defaultProps = {
    statusFilter: 'all' as StatusFilter,
    searchQuery: '',
    onStatusFilterChange: mockOnStatusFilterChange,
    onSearchChange: mockOnSearchChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders filter buttons', () => {
      render(<DashboardFilters {...defaultProps} />);

      expect(screen.getByTestId('filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('filter-ready')).toBeInTheDocument();
      expect(screen.getByTestId('filter-cooldown')).toBeInTheDocument();
      expect(screen.getByTestId('filter-ineligible')).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(<DashboardFilters {...defaultProps} />);

      expect(screen.getByTestId('search-input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search horses...')).toBeInTheDocument();
    });
  });

  describe('Filter Buttons', () => {
    it('highlights active filter', () => {
      render(<DashboardFilters {...defaultProps} statusFilter="ready" />);

      const readyButton = screen.getByTestId('filter-ready');
      expect(readyButton).toHaveClass('bg-blue-600');
    });

    it('calls onStatusFilterChange when filter clicked', async () => {
      const user = userEvent.setup();
      render(<DashboardFilters {...defaultProps} />);

      await user.click(screen.getByTestId('filter-ready'));

      expect(mockOnStatusFilterChange).toHaveBeenCalledWith('ready');
    });

    it('can switch between filters', async () => {
      const user = userEvent.setup();
      render(<DashboardFilters {...defaultProps} />);

      await user.click(screen.getByTestId('filter-cooldown'));
      expect(mockOnStatusFilterChange).toHaveBeenCalledWith('cooldown');

      await user.click(screen.getByTestId('filter-ineligible'));
      expect(mockOnStatusFilterChange).toHaveBeenCalledWith('ineligible');
    });
  });

  describe('Search Input', () => {
    it('displays current search query', () => {
      render(<DashboardFilters {...defaultProps} searchQuery="Thunder" />);

      expect(screen.getByTestId('search-input')).toHaveValue('Thunder');
    });

    it('calls onSearchChange when typing', async () => {
      const user = userEvent.setup();
      render(<DashboardFilters {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      await user.type(input, 'Storm');

      expect(mockOnSearchChange).toHaveBeenCalled();
    });

    it('has proper aria-label', () => {
      render(<DashboardFilters {...defaultProps} />);

      expect(screen.getByLabelText('Search horses by name')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('filter buttons have aria-pressed attribute', () => {
      render(<DashboardFilters {...defaultProps} statusFilter="ready" />);

      const readyButton = screen.getByTestId('filter-ready');
      expect(readyButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('icons are hidden from screen readers', () => {
      const { container } = render(<DashboardFilters {...defaultProps} />);

      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThanOrEqual(2);
    });
  });
});
