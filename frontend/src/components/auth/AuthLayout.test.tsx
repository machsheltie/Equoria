/**
 * AuthLayout Component Tests
 *
 * Story 1.1: User Registration — AC-1 (Registration Form Display / Auth Layout)
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import {
  AuthLayout,
  AuthHeader,
  AuthFooter,
  AuthCardHeader,
  AuthError,
  AuthFooterLink,
} from './AuthLayout';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('AuthLayout', () => {
  it('renders children inside the layout', () => {
    render(
      <AuthLayout title="Test Title" subtitle="Test subtitle">
        <p>Test content</p>
      </AuthLayout>,
      { wrapper }
    );
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders title and subtitle', () => {
    render(
      <AuthLayout title="Welcome Back" subtitle="Sign in to continue">
        <div />
      </AuthLayout>,
      { wrapper }
    );
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByText('Sign in to continue')).toBeInTheDocument();
  });

  it('applies default testId "auth-layout" to container', () => {
    render(
      <AuthLayout title="T" subtitle="S">
        <div />
      </AuthLayout>,
      { wrapper }
    );
    expect(screen.getByTestId('auth-layout')).toBeInTheDocument();
  });

  it('applies custom testId to container', () => {
    render(
      <AuthLayout title="T" subtitle="S" testId="custom-id">
        <div />
      </AuthLayout>,
      { wrapper }
    );
    expect(screen.getByTestId('custom-id')).toBeInTheDocument();
  });

  it('renders Equoria header', () => {
    render(
      <AuthLayout title="T" subtitle="S">
        <div />
      </AuthLayout>,
      { wrapper }
    );
    expect(screen.getByText('Equoria')).toBeInTheDocument();
  });

  it('renders copyright footer', () => {
    render(
      <AuthLayout title="T" subtitle="S">
        <div />
      </AuthLayout>,
      { wrapper }
    );
    expect(screen.getByText(/equoria\. all rights reserved/i)).toBeInTheDocument();
  });
});

describe('AuthHeader', () => {
  it('renders Equoria branding', () => {
    render(<AuthHeader />);
    expect(screen.getByText('Equoria')).toBeInTheDocument();
  });
});

describe('AuthFooter', () => {
  it('renders copyright text', () => {
    render(<AuthFooter />);
    expect(screen.getByText(/equoria\. all rights reserved/i)).toBeInTheDocument();
  });
});

describe('AuthCardHeader', () => {
  it('renders title and subtitle', () => {
    render(<AuthCardHeader title="My Title" subtitle="My Subtitle" />);
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My Subtitle')).toBeInTheDocument();
  });

  it('renders custom icon when provided', () => {
    render(<AuthCardHeader title="T" subtitle="S" icon={<span data-testid="custom-icon" />} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});

describe('AuthError', () => {
  it('renders nothing when error is null', () => {
    const { container } = render(<AuthError error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders error message when error is provided', () => {
    render(<AuthError error={new Error('Something went wrong')} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders fallback message when error has no message', () => {
    const emptyError = new Error('');
    emptyError.message = '';
    render(<AuthError error={emptyError} fallbackMessage="Custom fallback" />);
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
  });
});

describe('AuthFooterLink', () => {
  it('renders prompt text and link', () => {
    render(
      <MemoryRouter>
        <AuthFooterLink prompt="Already have an account?" linkText="Sign In" linkTo="/login" />
      </MemoryRouter>
    );
    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Sign In' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/login');
  });
});
