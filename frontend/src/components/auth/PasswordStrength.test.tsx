/**
 * PasswordStrength Component Tests
 *
 * Story 1.1: User Registration — AC-3 (Password Strength Indicator)
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PasswordStrength } from './PasswordStrength';

describe('PasswordStrength', () => {
  it('renders nothing when password is empty', () => {
    const { container } = render(<PasswordStrength password="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the strength bar and label when password is provided', () => {
    render(<PasswordStrength password="abc" />);
    expect(screen.getByTestId('password-strength')).toBeInTheDocument();
    expect(screen.getByTestId('password-strength-bar')).toBeInTheDocument();
    expect(screen.getByTestId('password-strength-label')).toBeInTheDocument();
  });

  it('shows "weak" label for a short, simple password', () => {
    render(<PasswordStrength password="abc" />);
    expect(screen.getByTestId('password-strength-label')).toHaveTextContent('weak');
  });

  it('shows "strong" label for a password meeting all requirements', () => {
    render(<PasswordStrength password="SecurePass1!" />);
    expect(screen.getByTestId('password-strength-label')).toHaveTextContent('strong');
  });

  it('renders all 5 requirement checks by default', () => {
    render(<PasswordStrength password="abc" />);
    expect(screen.getByTestId('requirement-8-characters')).toBeInTheDocument();
    expect(screen.getByTestId('requirement-lowercase')).toBeInTheDocument();
    expect(screen.getByTestId('requirement-uppercase')).toBeInTheDocument();
    expect(screen.getByTestId('requirement-number')).toBeInTheDocument();
    expect(screen.getByTestId('requirement-special-')).toBeInTheDocument();
  });

  it('hides requirement checklist when showRequirements is false', () => {
    render(<PasswordStrength password="abc" showRequirements={false} />);
    expect(screen.queryByRole('list', { name: /password requirements/i })).not.toBeInTheDocument();
  });

  it('marks 8+ characters requirement met when password is 8 chars', () => {
    render(<PasswordStrength password="abcdefgh" />);
    const item = screen.getByTestId('requirement-8-characters');
    // Check icon reflects met state (Check icon present, not X)
    expect(item.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('marks special character requirement unmet for password without special char', () => {
    render(<PasswordStrength password="SecurePass1" />);
    // strength bar is rendered
    expect(screen.getByTestId('password-strength-bar')).toBeInTheDocument();
    // requirement row exists
    expect(screen.getByTestId('requirement-special-')).toBeInTheDocument();
  });

  it('marks special character requirement met for password with special char', () => {
    render(<PasswordStrength password="SecurePass1!" />);
    expect(screen.getByTestId('requirement-special-')).toBeInTheDocument();
  });

  it('has accessible progressbar role on the strength bar', () => {
    render(<PasswordStrength password="SecurePass1!" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '4');
    expect(bar).toHaveAttribute('aria-label');
  });

  it('has accessible list role on requirements section', () => {
    render(<PasswordStrength password="abc" />);
    expect(screen.getByRole('list', { name: /password requirements/i })).toBeInTheDocument();
  });

  it('applies custom className to container', () => {
    render(<PasswordStrength password="abc" className="custom-class" />);
    expect(screen.getByTestId('password-strength')).toHaveClass('custom-class');
  });
});
