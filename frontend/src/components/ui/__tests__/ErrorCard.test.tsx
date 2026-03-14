/**
 * ErrorCard Component Tests
 *
 * Tests default rendering, custom props, retry/goHome buttons, and accessibility.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  AlertTriangle: (props: any) => <svg data-testid="icon-alert" {...props} />,
  RefreshCw: (props: any) => <svg data-testid="icon-refresh" {...props} />,
  Home: (props: any) => <svg data-testid="icon-home" {...props} />,
}));

import { ErrorCard } from '../ErrorCard';

describe('ErrorCard', () => {
  describe('Default rendering', () => {
    it('renders with default title and message', () => {
      render(<ErrorCard />);
      expect(screen.getByText('Unable to Load Data')).toBeInTheDocument();
      expect(
        screen.getByText('Something went wrong. Please check your connection and try again.')
      ).toBeInTheDocument();
    });

    it('renders with role="alert" for accessibility', () => {
      render(<ErrorCard />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders the alert icon', () => {
      render(<ErrorCard />);
      expect(screen.getByTestId('icon-alert')).toBeInTheDocument();
    });

    it('does not render action buttons when no callbacks provided', () => {
      render(<ErrorCard />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Custom props', () => {
    it('renders custom title', () => {
      render(<ErrorCard title="Connection Failed" />);
      expect(screen.getByText('Connection Failed')).toBeInTheDocument();
      expect(screen.queryByText('Unable to Load Data')).not.toBeInTheDocument();
    });

    it('renders custom message', () => {
      render(<ErrorCard message="The server is unreachable." />);
      expect(screen.getByText('The server is unreachable.')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<ErrorCard className="my-class" />);
      expect(container.firstChild).toHaveClass('my-class');
    });
  });

  describe('Retry button', () => {
    it('renders retry button when onRetry is provided', () => {
      render(<ErrorCard onRetry={() => {}} />);
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', () => {
      const onRetry = vi.fn();
      render(<ErrorCard onRetry={onRetry} />);
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
      expect(onRetry).toHaveBeenCalledOnce();
    });
  });

  describe('Go Home button', () => {
    it('renders go home button when onGoHome is provided', () => {
      render(<ErrorCard onGoHome={() => {}} />);
      expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
    });

    it('calls onGoHome when go home button is clicked', () => {
      const onGoHome = vi.fn();
      render(<ErrorCard onGoHome={onGoHome} />);
      fireEvent.click(screen.getByRole('button', { name: /go home/i }));
      expect(onGoHome).toHaveBeenCalledOnce();
    });
  });

  describe('Both buttons', () => {
    it('renders both retry and go home buttons together', () => {
      render(<ErrorCard onRetry={() => {}} onGoHome={() => {}} />);
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
    });
  });
});
