/**
 * App.tsx Route Protection Tests (Story 8.1: Authentication End-to-End)
 *
 * Tests that protected routes redirect unauthenticated users to /login
 * and render content for authenticated users.
 *
 * The real AuthProvider, ProtectedRoute and OnboardingGuard run; the server's
 * answer to GET /auth/profile (MSW, at the network boundary) decides who is
 * signed in (Equoria-k3854: this suite used to replace the whole AuthContext
 * module). Only the page bodies are stubbed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { server } from './test/msw/server';

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
vi.mock('./pages/OnboardingPage', () => ({
  default: () => <div data-testid="onboarding-page">Onboarding</div>,
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

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// What the server says about the visitor's session.
function signedOut() {
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () =>
      HttpResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 })
    ),
    http.post(`${base}/api/v1/auth/refresh-token`, () =>
      HttpResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 })
    )
  );
}

function signedIn(userOverrides: Record<string, unknown> = {}) {
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () =>
      HttpResponse.json({
        status: 'success',
        data: {
          user: {
            id: 1,
            username: 'testuser',
            email: 'test@example.com',
            role: 'user',
            emailVerified: true,
            completedOnboarding: true,
            onboardingStep: 10,
            welcomeSeen: true,
            ...userOverrides,
          },
        },
      })
    )
  );
}

function authStillLoading() {
  server.use(
    http.get(`${base}/api/v1/auth/profile`, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    })
  );
}

// App builds its own QueryClient at import time and caches the profile for
// minutes, so each case loads a fresh copy of App (and with it a fresh cache).
async function renderApp(initialPath: string) {
  vi.resetModules();
  const { default: App } = await import('./App');
  // App uses BrowserRouter internally, so set the address through history.
  window.history.pushState({}, '', initialPath);
  return render(<App />);
}

describe('App Route Protection (Story 8.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  // Route components are React.lazy in App.tsx (login/register/forgot/stable/
  // profile/horse-detail/etc.). After render() the Suspense fallback shows
  // first; the lazy import resolves on a microtask. findByTestId polls until
  // the resolved component appears, so we use it instead of getByTestId.
  describe('Public routes — accessible without auth', () => {
    it('renders login page at /login without auth', async () => {
      signedOut();
      await renderApp('/login');
      expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    });

    it('renders register page at /register without auth', async () => {
      signedOut();
      await renderApp('/register');
      expect(await screen.findByTestId('register-page')).toBeInTheDocument();
    });

    it('renders forgot password page at /forgot-password without auth', async () => {
      signedOut();
      await renderApp('/forgot-password');
      expect(await screen.findByTestId('forgot-password-page')).toBeInTheDocument();
    });
  });

  describe('Protected routes — redirect unauthenticated users', () => {
    it('redirects unauthenticated user from /stable to /login', async () => {
      signedOut();
      await renderApp('/stable');
      expect(await screen.findByTestId('login-page')).toBeInTheDocument();
      expect(screen.queryByTestId('stable-view')).not.toBeInTheDocument();
    });

    it('redirects unauthenticated user from /profile to /login', async () => {
      signedOut();
      await renderApp('/profile');
      expect(await screen.findByTestId('login-page')).toBeInTheDocument();
      expect(screen.queryByTestId('profile-page')).not.toBeInTheDocument();
    });

    it('redirects unauthenticated user from /horses/1 to /login', async () => {
      signedOut();
      await renderApp('/horses/1');
      expect(await screen.findByTestId('login-page')).toBeInTheDocument();
      expect(screen.queryByTestId('horse-detail-page')).not.toBeInTheDocument();
    });

    // Equoria-bvddn.36: /onboarding was mounted outside ProtectedRoute, so a
    // logged-out visitor could walk the whole wizard and only fail with a 401
    // on submit.
    it('redirects unauthenticated user from /onboarding to /login', async () => {
      signedOut();
      await renderApp('/onboarding');
      expect(await screen.findByTestId('login-page')).toBeInTheDocument();
      expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
    });
  });

  describe('Protected routes — render content for authenticated users', () => {
    it('renders /stable for authenticated users', async () => {
      signedIn();
      await renderApp('/stable');
      expect(await screen.findByTestId('stable-view')).toBeInTheDocument();
    });

    it('renders /profile for authenticated users', async () => {
      signedIn();
      await renderApp('/profile');
      expect(await screen.findByTestId('profile-page')).toBeInTheDocument();
    });

    it('renders /horses/:id for authenticated users', async () => {
      signedIn();
      await renderApp('/horses/42');
      expect(await screen.findByTestId('horse-detail-page')).toBeInTheDocument();
    });

    // Equoria-bvddn.36: wrapping /onboarding in ProtectedRoute must not break
    // the post-registration flow — a freshly registered, signed-in player
    // (completedOnboarding: false, onboardingStep: 0) still lands on the
    // wizard when OnboardingGuard sends them there.
    it('renders /onboarding for an authenticated freshly-registered user', async () => {
      signedIn({ completedOnboarding: false, onboardingStep: 0 });
      await renderApp('/onboarding');
      expect(await screen.findByTestId('onboarding-page')).toBeInTheDocument();
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('shows loading spinner for protected routes while auth loads', async () => {
      authStillLoading();
      await renderApp('/stable');
      expect(await screen.findByTestId('protected-route-loading')).toBeInTheDocument();
    });
  });
});
