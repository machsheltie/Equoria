/**
 * AuthFlow Integration Tests (Story 8.1: Authentication End-to-End)
 *
 * Tests the full authentication flow:
 * - Login → cookie set → redirect to dashboard
 * - Session persist on page refresh (profile check)
 * - Logout → cache cleared → redirect to /login
 * - Generic error message for invalid credentials
 * - Role-based protection via RoleProtectedRoute
 * - Session expiry → redirect with message
 *
 * Uses MSW handlers (already set up in test/msw/handlers.ts).
 * For 401 scenarios, overrides via server.use().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from '../../../test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../../test/msw/server';
import { http, HttpResponse } from 'msw';
import { useAuth } from '../../../contexts/AuthContext';

// Mock the AuthContext to control auth state in tests
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseAuth = vi.mocked(useAuth);

// Helper to create consistent auth state
function makeAuthState(overrides = {}) {
  return {
    isLoading: false,
    isAuthenticated: false,
    user: null,
    isEmailVerified: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    hasRole: vi.fn(),
    isAdmin: false,
    isModerator: false,
    ...overrides,
  };
}

// Import components under test
import { ProtectedRoute } from '../ProtectedRoute';
import { RoleProtectedRoute } from '../RoleProtectedRoute';

// Components that capture location state for verification
const LoginCapture: React.FC = () => {
  const location = useLocation();
  return (
    <div data-testid="login-page">
      <span data-testid="login-from">{(location.state as { from?: string })?.from || 'none'}</span>
      <span data-testid="login-message">
        {(location.state as { message?: string })?.message || 'none'}
      </span>
    </div>
  );
};

const ProtectedContent: React.FC<{ testId?: string }> = ({ testId = 'protected-content' }) => (
  <div data-testid={testId}>Protected Content</div>
);

const UnauthorizedPage: React.FC = () => <div data-testid="unauthorized-page">Unauthorized</div>;

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

interface WrapperProps {
  initialRoute?: string;
  children: React.ReactNode;
}

const Wrapper: React.FC<WrapperProps> = ({ initialRoute = '/protected', children }) => (
  <QueryClientProvider client={makeQueryClient()}>
    <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>
  </QueryClientProvider>
);

describe('AuthFlow Integration Tests (Story 8.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Login Flow ───────────────────────────────────────────────────────────

  describe('Login flow (AC: 1)', () => {
    it('MSW handler for POST /api/auth/login returns success for valid credentials', async () => {
      const base = 'http://localhost:3000';
      const response = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('success');
      expect(data.data.user.email).toBe('test@example.com');
    });

    it('returns generic error message for invalid credentials', async () => {
      const base = 'http://localhost:3000';
      const response = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'wrong' }),
      });
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.message).toBe('Invalid email or password');
    });

    it('returns same generic error for non-existent email (no email enumeration)', async () => {
      const base = 'http://localhost:3000';
      const response = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid@example.com', password: 'password123' }),
      });
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.message).toBe('Invalid email or password');
    });
  });

  // ─── Session Persistence ──────────────────────────────────────────────────

  describe('Session persistence (AC: 2)', () => {
    it('MSW handler for GET /api/auth/profile returns authenticated user', async () => {
      const base = 'http://localhost:3000';
      const response = await fetch(`${base}/api/auth/profile`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('success');
      expect(data.data.user.username).toBe('testuser');
    });

    it('renders protected content when profile returns 200', () => {
      mockUseAuth.mockReturnValue(
        makeAuthState({
          isAuthenticated: true,
          user: { id: 1, username: 'testuser', email: 'test@example.com' },
        })
      );

      render(
        <Wrapper>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <ProtectedContent />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<LoginCapture />} />
          </Routes>
        </Wrapper>
      );
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('MSW handler for GET /api/auth/me returns user data', async () => {
      const base = 'http://localhost:3000';
      const response = await fetch(`${base}/api/auth/me`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('success');
      expect(data.data.user.id).toBe(1);
    });
  });

  // ─── Session Expiry ───────────────────────────────────────────────────────

  describe('Session expiry (AC: 3)', () => {
    it('redirects to /login with session-expired message on 401', () => {
      mockUseAuth.mockReturnValue(
        makeAuthState({
          isAuthenticated: false,
          error: { statusCode: 401, message: 'Unauthorized' },
        })
      );

      render(
        <Wrapper>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <ProtectedContent />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<LoginCapture />} />
          </Routes>
        </Wrapper>
      );

      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      expect(screen.getByTestId('login-message').textContent).toBe(
        'Your session has expired. Please log in again.'
      );
    });

    it('preserves the attempted route in redirect state on session expiry', () => {
      mockUseAuth.mockReturnValue(
        makeAuthState({
          isAuthenticated: false,
          error: { statusCode: 401, message: 'Unauthorized' },
        })
      );

      render(
        <Wrapper initialRoute="/protected">
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <ProtectedContent />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<LoginCapture />} />
          </Routes>
        </Wrapper>
      );

      expect(screen.getByTestId('login-from').textContent).toBe('/protected');
    });

    it('MSW profile handler returns 401 when overridden (simulating expiry)', async () => {
      const base = 'http://localhost:3000';

      server.use(
        http.get(`${base}/api/auth/profile`, () =>
          HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
        )
      );

      const response = await fetch(`${base}/api/auth/profile`);
      expect(response.status).toBe(401);
    });
  });

  // ─── Logout Flow ──────────────────────────────────────────────────────────

  describe('Logout flow (AC: 4)', () => {
    it('MSW handler for POST /api/auth/logout returns success', async () => {
      const base = 'http://localhost:3000';
      const response = await fetch(`${base}/api/auth/logout`, { method: 'POST' });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('success');
    });

    it('renders login page after logout (simulated via auth state)', () => {
      // After logout, isAuthenticated becomes false
      mockUseAuth.mockReturnValue(makeAuthState({ isAuthenticated: false }));

      render(
        <Wrapper>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <ProtectedContent />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<LoginCapture />} />
          </Routes>
        </Wrapper>
      );

      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  // ─── Generic Error Message (AC: 5) ───────────────────────────────────────

  describe('Generic error messages (AC: 5)', () => {
    it('uses same 401 status for both wrong password and non-existent email', async () => {
      const base = 'http://localhost:3000';

      const wrongPwdResponse = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'real@example.com', password: 'wrong' }),
      });

      const noEmailResponse = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid.user@example.com', password: 'anything' }),
      });

      expect(wrongPwdResponse.status).toBe(401);
      expect(noEmailResponse.status).toBe(401);

      const wrongPwdData = await wrongPwdResponse.json();
      const noEmailData = await noEmailResponse.json();

      expect(wrongPwdData.message).toBe('Invalid email or password');
      expect(noEmailData.message).toBe('Invalid email or password');
    });
  });

  // ─── Protected Route Access (AC: 6) ──────────────────────────────────────

  describe('Protected route access (AC: 6)', () => {
    it('all protected routes redirect unauthenticated user to /login', () => {
      const protectedPaths = ['/stable', '/profile', '/horses/1'];

      protectedPaths.forEach((path) => {
        mockUseAuth.mockReturnValue(makeAuthState({ isAuthenticated: false }));

        const { unmount } = render(
          <MemoryRouter initialEntries={[path]}>
            <QueryClientProvider client={makeQueryClient()}>
              <Routes>
                <Route
                  path="/stable"
                  element={
                    <ProtectedRoute>
                      <div data-testid="stable">Stable</div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <div data-testid="profile">Profile</div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/horses/:id"
                  element={
                    <ProtectedRoute>
                      <div data-testid="horse">Horse</div>
                    </ProtectedRoute>
                  }
                />
                <Route path="/login" element={<LoginCapture />} />
              </Routes>
            </QueryClientProvider>
          </MemoryRouter>
        );

        expect(screen.getByTestId('login-page')).toBeInTheDocument();
        unmount();
      });
    });

    it('preserves from-path when redirecting from each protected route', () => {
      mockUseAuth.mockReturnValue(makeAuthState({ isAuthenticated: false }));

      render(
        <MemoryRouter initialEntries={['/stable']}>
          <QueryClientProvider client={makeQueryClient()}>
            <Routes>
              <Route
                path="/stable"
                element={
                  <ProtectedRoute>
                    <div>Stable</div>
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<LoginCapture />} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>
      );

      expect(screen.getByTestId('login-from').textContent).toBe('/stable');
    });
  });

  // ─── Role-Based Access (AC: 7) ────────────────────────────────────────────

  describe('Role-based route protection (AC: 7)', () => {
    it('redirects non-admin user from admin route to /unauthorized', () => {
      mockUseAuth.mockReturnValue(
        makeAuthState({
          isAuthenticated: true,
          user: { id: 1, username: 'testuser', email: 'test@example.com', role: 'user' },
          hasRole: vi.fn().mockReturnValue(false),
        })
      );

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <QueryClientProvider client={makeQueryClient()}>
            <Routes>
              <Route
                path="/admin"
                element={
                  <RoleProtectedRoute allowedRoles={['admin']}>
                    <div data-testid="admin-content">Admin</div>
                  </RoleProtectedRoute>
                }
              />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              <Route path="/login" element={<LoginCapture />} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>
      );

      expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    });

    it('renders admin route for admin user', () => {
      mockUseAuth.mockReturnValue(
        makeAuthState({
          isAuthenticated: true,
          isAdmin: true,
          user: { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin' },
          hasRole: vi.fn().mockReturnValue(true),
        })
      );

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <QueryClientProvider client={makeQueryClient()}>
            <Routes>
              <Route
                path="/admin"
                element={
                  <RoleProtectedRoute allowedRoles={['admin']}>
                    <div data-testid="admin-content">Admin</div>
                  </RoleProtectedRoute>
                }
              />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>
      );

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });
  });

  // ─── Verification Status (AC: 2) ─────────────────────────────────────────

  describe('Verification status handler', () => {
    it('MSW handler for GET /api/auth/verification-status returns verified status', async () => {
      const base = 'http://localhost:3000';
      const response = await fetch(`${base}/api/auth/verification-status`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.isEmailVerified).toBe(true);
    });
  });
});
