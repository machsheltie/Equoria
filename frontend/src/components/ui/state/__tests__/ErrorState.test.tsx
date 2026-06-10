/**
 * ErrorState component tests (D-16)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock lucide icons used by ErrorCard
vi.mock('lucide-react', () => ({
  AlertTriangle: (props: any) => <svg data-testid="icon-alert-triangle" {...props} />,
  RefreshCw: (props: any) => <svg data-testid="icon-refresh" {...props} />,
  Home: (props: any) => <svg data-testid="icon-home" {...props} />,
}));

import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
  describe('Accessibility', () => {
    it('renders an accessible alert region (role="alert" from ErrorCard)', () => {
      render(<ErrorState />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Default rendering', () => {
    it('renders with default title', () => {
      render(<ErrorState />);
      // ErrorCard default title
      expect(screen.getByText('Unable to Load Data')).toBeInTheDocument();
    });

    it('renders with default message', () => {
      render(<ErrorState />);
      expect(
        screen.getByText('Something went wrong. Please check your connection and try again.')
      ).toBeInTheDocument();
    });
  });

  describe('Custom props', () => {
    it('renders custom title', () => {
      render(<ErrorState title="Competition Not Found" />);
      expect(screen.getByText('Competition Not Found')).toBeInTheDocument();
    });

    it('renders custom message', () => {
      render(<ErrorState message="This competition may have ended." />);
      expect(screen.getByText('This competition may have ended.')).toBeInTheDocument();
    });
  });

  describe('Severity prop', () => {
    it('applies py-8 class for section severity (default)', () => {
      const { container } = render(<ErrorState />);
      expect(container.firstChild).toHaveClass('py-8');
    });

    it('applies py-16 class for page severity', () => {
      const { container } = render(<ErrorState severity="page" />);
      expect(container.firstChild).toHaveClass('py-16');
    });

    it('defaults to section severity when omitted', () => {
      const { container } = render(<ErrorState />);
      expect(container.firstChild).not.toHaveClass('py-16');
      expect(container.firstChild).toHaveClass('py-8');
    });
  });

  describe('Retry action', () => {
    it('renders retry button when retry is provided', () => {
      render(<ErrorState retry={{ label: 'Retry', onClick: vi.fn() }} />);
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('calls retry.onClick when retry button clicked', () => {
      const onRetry = vi.fn();
      render(<ErrorState retry={{ label: 'Retry', onClick: onRetry }} />);
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it('does not render retry button when retry is not provided', () => {
      render(<ErrorState />);
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });
  });

  describe('backLink action', () => {
    it('renders back navigation button when backLink is provided', () => {
      render(<ErrorState backLink={{ label: 'Go Home', onClick: vi.fn() }} />);
      expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
    });

    it('calls backLink.onClick when back button clicked', () => {
      const onBack = vi.fn();
      render(<ErrorState backLink={{ label: 'Go Home', onClick: onBack }} />);
      fireEvent.click(screen.getByRole('button', { name: /go home/i }));
      expect(onBack).toHaveBeenCalledOnce();
    });
  });

  describe('Custom className', () => {
    it('applies custom className to wrapper', () => {
      const { container } = render(<ErrorState className="mt-8" />);
      expect(container.firstChild).toHaveClass('mt-8');
    });
  });
});
