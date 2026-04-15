/**
 * LoginPage — Beta Mode Tests
 *
 * Verifies that password recovery remains available when isBetaMode is true.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code (course correction)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { TestRouter } from '@/test/utils';

// ── Mock betaRouteScope with isBetaMode: true ─────────────────────────────────
vi.mock('@/config/betaRouteScope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/betaRouteScope')>();
  return {
    ...actual,
    isBetaMode: true,
  };
});

// Mock API client
vi.mock('../../lib/api-client', () => ({
  authApi: {
    login: vi.fn(),
  },
}));

// Mock react-router-dom navigation hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/login', state: null }),
  };
});

// Import AFTER mocks are registered
const { default: LoginPage } = await import('../LoginPage');

describe('LoginPage — beta mode', () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <TestRouter>{children}</TestRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('shows the /forgot-password link in beta mode', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <LoginPage />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /forgot your password/i })).toHaveAttribute(
      'href',
      '/forgot-password'
    );
  });

  it('still renders the login form in beta mode', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <LoginPage />
      </Wrapper>
    );

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^enter$/i })).toBeInTheDocument();
  });

  it('still renders the register link in beta mode', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <LoginPage />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /create an account/i })).toBeInTheDocument();
  });
});
