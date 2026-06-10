/**
 * InlineError component tests (D-16)
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// InlineError imports AlertCircle from lucide-react
vi.mock('lucide-react', () => ({
  AlertCircle: (props: any) => <svg data-testid="icon-alert-circle" {...props} />,
}));

import { InlineError } from '../InlineError';

describe('InlineError', () => {
  it('renders with role="alert"', () => {
    render(<InlineError message="Field is required." />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders the error message text', () => {
    render(<InlineError message="Password must be at least 8 characters." />);
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
  });

  it('renders the alert icon (aria-hidden)', () => {
    render(<InlineError message="Error" />);
    const icon = screen.getByTestId('icon-alert-circle');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses --role-danger-text color token', () => {
    render(<InlineError message="Error" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveStyle({ color: 'var(--role-danger-text)' });
  });

  it('applies custom className', () => {
    render(<InlineError message="Error" className="mt-2" />);
    expect(screen.getByRole('alert')).toHaveClass('mt-2');
  });
});
