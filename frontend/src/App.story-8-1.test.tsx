/**
 * App.tsx Route Protection Tests (Story 8.1: Authentication End-to-End)
 *
 * Tests that protected routes redirect unauthenticated users to /login
 * and render content for authenticated users.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './contexts/AuthContext';

// Mock pages (avoid full page rendering)
vi.mock('./pages/StableView', () => ({
  default: () => <div data-testid="stable-view">Stable</div>,
}));
vi.mock('./pages/ProfilePage', () => ({
  default: () => <div data-testid="profile-page">Profile</div>,
}));
vi.mock('./pages/HorseDetailPage', () => ({
  default: () => <div data-testid="horse-detail-page">Horse Detail</div>,
}));
vi.mock('./pages/Index', () => ({ default: () => <div data-testid="index-page">Index</div> }));
vi.mock('./pages/LoginPage', () => ({ default: () => <div data-testid="login-page">Login</div> }));
vi.mock('./pages/RegisterPage', () => ({
  default: () => <div data-testid="register-page">Register</div>,
}));
vi.mock('./pages/VerifyEmailPage', () => ({
  default: () => <div data-testid="verify-email-page">Verify Email</div>,
}));
vi.mock('./pages/ForgotPasswordPage', () => ({
  default: () => <div data-testid="forgot-password-page">Forgot</div>,
}));
vi.mock('./pages/ResetPasswordPage', () => ({
  default: () => <div data-testid="reset-password-page">Reset</div>,
}));
vi.mock('@/components/layout/PageBackground', () => ({
  PageBackground: () => null,
  usePageBackground: () => ({}),
  default: () => null,
}));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock AuthContext
vi.mock('./contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseAuth = vi.mocked(useAuth);

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

// Import App after mocks are set up
import App from './App';

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // We need to use MemoryRouter since App uses BrowserRouter internally
  // Instead we'll test via the App component directly with a history workaround
  window.history.pushState({}, '', initialPath);
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

describe('App Route Protection (Story 8.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Route components are React.lazy in App.tsx (login/register/forgot/stable/
  // profile/horse-detail/etc.). After render() the Suspense fallback shows
  // first; the lazy import resolves on a microtask. findByTestId polls until
  // the resolved component appears, so we use it instead of getByTestId.
  describe('Public routes — accessible without auth', () => {
    it('renders login page at /login without auth', async () => {
      mockUseAuth.mockReturnValue(makeAuthState());
      renderApp('/login');
      expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    });

    it('renders register page at /register without auth', async () => {
      mockUseAuth.mockReturnValue(makeAuthState());
      renderApp('/register');
      expect(await screen.findByTestId('register-page')).toBeInTheDocument();
    });

    it('renders forgot password page at /forgot-password without auth', async () => {
      mockUseAuth.mockReturnValue(makeAuthState());
      renderApp('/forgot-password');
      expect(await screen.findByTestId('forgot-password-page')).toBeInTheDocument();
    });
  });

  describe('Protected routes — redirect unauthenticated users', () => {
    it('redirects unauthenticated user from /stable to /login', async () => {
      mockUseAuth.mockReturnValue(makeAuthState({ isAuthenticated: false }));
      renderApp('/stable');
      expect(await screen.findByTestId('login-page')).toBeInTheDocument();
      expect(screen.queryByTestId('stable-view')).not.toBeInTheDocument();
    });

    it('redirects unauthenticated user from /profile to /login', async () => {
      mockUseAuth.mockReturnValue(makeAuthState({ isAuthenticated: false }));
      renderApp('/profile');
      expect(await screen.findByTestId('login-page')).toBeInTheDocument();
      expect(screen.queryByTestId('profile-page')).not.toBeInTheDocument();
    });

    it('redirects unauthenticated user from /horses/1 to /login', async () => {
      mockUseAuth.mockReturnValue(makeAuthState({ isAuthenticated: false }));
      renderApp('/horses/1');
      expect(await screen.findByTestId('login-page')).toBeInTheDocument();
      expect(screen.queryByTestId('horse-detail-page')).not.toBeInTheDocument();
    });
  });

  describe('Protected routes — render content for authenticated users', () => {
    const authenticatedState = {
      isAuthenticated: true,
      user: { id: 1, username: 'testuser', email: 'test@example.com', role: 'user' },
      isEmailVerified: true,
    };

    it('renders /stable for authenticated users', async () => {
      mockUseAuth.mockReturnValue(makeAuthState(authenticatedState));
      renderApp('/stable');
      expect(await screen.findByTestId('stable-view')).toBeInTheDocument();
    });

    it('renders /profile for authenticated users', async () => {
      mockUseAuth.mockReturnValue(makeAuthState(authenticatedState));
      renderApp('/profile');
      expect(await screen.findByTestId('profile-page')).toBeInTheDocument();
    });

    it('renders /horses/:id for authenticated users', async () => {
      mockUseAuth.mockReturnValue(makeAuthState(authenticatedState));
      renderApp('/horses/42');
      expect(await screen.findByTestId('horse-detail-page')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('shows loading spinner for protected routes while auth loads', () => {
      mockUseAuth.mockReturnValue(makeAuthState({ isLoading: true }));
      renderApp('/stable');
      expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();
    });
  });
});
