/**
 * AuthLayout Component Tests
 *
 * Story 1.1: User Registration — AC-1 (Registration Form Display / Auth Layout)
 * Equoria-o5hub.16: Auth pilot migration — shared-shell assertions added.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import {
  AuthLayout,
  AuthHeader,
  AuthFooter,
  AuthCardHeader,
  AuthError,
  AuthFooterLink,
} from './AuthLayout';

// AuthLayout now renders PageBackground + usePageBackground internally.
// Stub the module so tests don't need real canvas/image infrastructure.
vi.mock('@/components/layout/PageBackground', () => ({
  PageBackground: () => null,
  usePageBackground: () => ({}),
}));

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

// =============================================================================
// Shared-shell assertions — Equoria-o5hub.16
// =============================================================================

describe('AuthLayout shared shell (Equoria-o5hub.16)', () => {
  it('renders exactly one h1 wordmark', () => {
    render(
      <AuthLayout title="T" subtitle="S">
        <div />
      </AuthLayout>,
      { wrapper }
    );
    const wordmarks = screen.getAllByRole('heading', { level: 1, name: /equoria/i });
    expect(wordmarks).toHaveLength(1);
  });

  it('renders the wordmark as h1 (not a link)', () => {
    render(
      <AuthLayout title="T" subtitle="S">
        <div />
      </AuthLayout>,
      { wrapper }
    );
    const wordmark = screen.getByRole('heading', { level: 1, name: /equoria/i });
    // Must not be wrapped in an anchor
    expect(wordmark.tagName).toBe('H1');
    expect(wordmark.closest('a')).toBeNull();
  });

  it('renders exactly one copyright footer', () => {
    render(
      <AuthLayout title="T" subtitle="S">
        <div />
      </AuthLayout>,
      { wrapper }
    );
    const footers = screen.getAllByText(/equoria\. all rights reserved/i);
    expect(footers).toHaveLength(1);
  });

  it('footer year is dynamic — matches current calendar year', () => {
    // Equoria-o5hub.16: no hardcoded © 2025; AuthFooter computes new Date().getFullYear().
    render(
      <AuthLayout title="T" subtitle="S">
        <div />
      </AuthLayout>,
      { wrapper }
    );
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${year} Equoria\\.`, 'i'))).toBeInTheDocument();
  });

  it('does not render AuthCardHeader when title is omitted', () => {
    render(
      <AuthLayout>
        <p>content only</p>
      </AuthLayout>,
      { wrapper }
    );
    // When no title prop, the card should not contain an h2
    const headings = screen.queryAllByRole('heading', { level: 2 });
    expect(headings).toHaveLength(0);
    expect(screen.getByText('content only')).toBeInTheDocument();
  });

  it('renders AuthCardHeader h2 when title is provided', () => {
    render(
      <AuthLayout title="Welcome Back" subtitle="Sign in to continue">
        <div />
      </AuthLayout>,
      { wrapper }
    );
    const h2 = screen.getByRole('heading', { level: 2, name: /welcome back/i });
    expect(h2).toBeInTheDocument();
  });
});
