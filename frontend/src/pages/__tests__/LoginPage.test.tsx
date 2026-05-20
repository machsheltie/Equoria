/**
 * LoginPage Component Tests
 *
 * Comprehensive tests for the login page including:
 * - Form rendering and accessibility
 * - Client-side validation with Zod
 * - Form submission and API integration
 * - Error handling scenarios
 * - Security requirements
 *
 * Story 1.2: User Login - AC-1 through AC-5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { TestRouter } from '@/test/utils';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/test/msw/server';
import LoginPage from '../LoginPage';

// Network is exercised through the REAL api-client at the fetch boundary via
// MSW (src/test/msw/server.ts) — NOT vi.mock('@/lib/api-client'). Mocking the
// api-client fakes the backend boundary so the test passes even when the real
// API contract is broken; MSW intercepts the actual HTTP request the real
// api-client makes, so the request shape + response handling are genuinely
// exercised. Per-test responses are registered with server.use() (reset after
// each test by the global afterEach in src/test/setup.ts).
const LOGIN_URL = 'http://localhost:3000/api/v1/auth/login';

// Captures the request body the real api-client POSTs, so "calls API with
// correct data" can assert against it without mocking the api-client itself.
let lastLoginBody: unknown = null;
// Counts how many times the real api-client actually hit /api/v1/auth/login,
// replacing the old vi.fn() call-count assertions.
let loginCallCount = 0;

beforeEach(() => {
  lastLoginBody = null;
  loginCallCount = 0;
});

/** Register a one-shot login handler returning a successful session envelope. */
function mockLoginSuccess() {
  server.use(
    http.post(LOGIN_URL, async ({ request }) => {
      loginCallCount += 1;
      lastLoginBody = await request.json();
      return HttpResponse.json({
        status: 'success',
        data: { user: { id: 1, username: 'johndoe', email: 'john@example.com' } },
      });
    })
  );
}

/** Register a login handler that never resolves (in-flight / loading state). */
function mockLoginPending() {
  server.use(
    http.post(LOGIN_URL, async () => {
      loginCallCount += 1;
      await delay('infinite');
      return HttpResponse.json({ status: 'success', data: { user: { id: 1 } } });
    })
  );
}

/** Register a login handler returning the given error status + message. */
function mockLoginError(status: number, message?: string) {
  server.use(
    http.post(LOGIN_URL, () => {
      loginCallCount += 1;
      return message
        ? HttpResponse.json({ status: 'error', message }, { status })
        : new HttpResponse(null, { status });
    })
  );
}

// Mock useNavigate and useLocation
const mockNavigate = vi.fn();
const mockUseLocation = vi.fn(() => ({ pathname: '/login', state: null }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockUseLocation(),
  };
});

describe('LoginPage', () => {
  let queryClient: QueryClient;

  // Test wrapper with required providers
  const createTestWrapper = () => {
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
    // Reset location mock to the default (no redirect state) before each test
    mockUseLocation.mockReturnValue({ pathname: '/login', state: null });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  describe('AC-1: Login Form Display', () => {
    it('renders all required form fields', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Check all required fields are present
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    });

    it('displays submit button with correct text', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /^enter$/i })).toBeInTheDocument();
    });

    it('displays page title and description', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
      expect(screen.getByText(/enter your credentials/i)).toBeInTheDocument();
    });

    it('provides link to register page', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const registerLink = screen.getByRole('link', { name: /create an account/i });
      expect(registerLink).toBeInTheDocument();
      expect(registerLink).toHaveAttribute('href', '/register');
    });

    it('provides link to forgot password page', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const forgotPasswordLink = screen.getByRole('link', { name: /forgot your password/i });
      expect(forgotPasswordLink).toBeInTheDocument();
      expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
    });

    it('has proper accessibility labels on form fields', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // All inputs should have associated labels
      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveAttribute('id', 'email');
      expect(emailInput).toHaveAttribute('name', 'email');
      expect(emailInput).toHaveAttribute('type', 'email');

      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toHaveAttribute('id', 'password');
      expect(passwordInput).toHaveAttribute('name', 'password');
    });

    it('displays Equoria branding', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Equoria appears in h1 header
      expect(screen.getByRole('heading', { level: 1, name: /equoria/i })).toBeInTheDocument();
    });
  });

  describe('AC-2: Client-Side Validation', () => {
    it('shows error for invalid email format', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      const { container } = render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill in fields with invalid email
      await user.type(screen.getByLabelText(/email address/i), 'invalid-email');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      // Submit the form directly
      const form = container.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('shows error for empty email', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      const { container } = render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill only the password field, leave email empty
      await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123');

      // Submit form
      const form = container.querySelector('form');
      fireEvent.submit(form!);

      // When email is empty, validation error should appear
      // Note: The exact message depends on whether min(1) or email() validation fires first
      await waitFor(() => {
        // Check for email-related validation error (could be "Email is required" or "Please enter a valid email")
        const emailError =
          screen.queryByText(/email is required/i) ||
          screen.queryByText(/please enter a valid email/i);
        expect(emailError).toBeInTheDocument();
      });
    });

    it('shows error for empty password', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Only fill email, leave password empty
      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /^enter$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });

    it('clears validation errors when user types', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      const { container } = render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill in invalid email
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'invalid-email');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      // Submit form directly
      const form = container.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });

      // Clear and type valid email
      await user.clear(emailInput);
      await user.type(emailInput, 'valid@example.com');

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('AC-3: Form Submission', () => {
    it('disables submit button while submission is in progress', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      // Slow (never-resolving) API response so the in-flight state is observable
      mockLoginPending();

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      const submitButton = screen.getByRole('button', { name: /^enter$/i });
      await user.click(submitButton);

      // Button should be disabled during submission
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });

    it('shows loading text during submission', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      mockLoginPending();

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      const submitButton = screen.getByRole('button', { name: /^enter$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/entering…/i)).toBeInTheDocument();
      });
    });

    it('navigates to / on successful login when no from state', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      // default state already set in beforeEach; explicit here for clarity
      mockLoginSuccess();

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      const submitButton = screen.getByRole('button', { name: /^enter$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      });
    });

    it('navigates to location.state.from on successful login when guard redirected here', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      // Set for ALL calls during this test (re-renders on typing also call useLocation)
      mockUseLocation.mockReturnValue({ pathname: '/login', state: { from: '/stable' } });
      mockLoginSuccess();

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      const submitButton = screen.getByRole('button', { name: /^enter$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/stable', { replace: true });
      });
    });

    it('calls API with correct data', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      mockLoginSuccess();

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');

      const submitButton = screen.getByRole('button', { name: /^enter$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(lastLoginBody).not.toBeNull();
      });

      // Verify the body the real api-client POSTed to /api/v1/auth/login
      expect(lastLoginBody).toMatchObject({
        email: 'john@example.com',
        password: 'SecurePass123',
      });
    });
  });

  describe('AC-4: Error Handling', () => {
    it('displays invalid credentials error', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      mockLoginError(401, 'Invalid email or password');

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'wrongpassword');

      await user.click(screen.getByRole('button', { name: /^enter$/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });
    });

    it('displays server error message', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      mockLoginError(500, 'Internal server error');

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      await user.click(screen.getByRole('button', { name: /^enter$/i }));

      await waitFor(() => {
        expect(screen.getByText(/internal server error|login failed/i)).toBeInTheDocument();
      });
    });

    it('displays generic error for network failures', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      // Simulate a real transport-level network failure (no HTTP response).
      // The real api-client surfaces the underlying fetch error message; the
      // component renders it in the error alert. We assert the alert is shown
      // (a non-empty error message), which is the user-facing contract — the
      // exact transport wording is environment-dependent and not the point.
      server.use(http.post(LOGIN_URL, () => HttpResponse.error()));

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      await user.click(screen.getByRole('button', { name: /^enter$/i }));

      // The api-client surfaces the transport failure as a non-empty message;
      // since it is non-empty, the component shows it verbatim (not the
      // literal fallback). Assert the error paragraph appears with content.
      await waitFor(() => {
        const alert = document.querySelector('p.text-red-400.text-center');
        expect(alert).toBeTruthy();
        expect((alert?.textContent ?? '').trim().length).toBeGreaterThan(0);
      });
    });

    it('displays a generic error message when the server sends no message body', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      // Error status with an empty message body. With the REAL api-client, a
      // message-less error response is coerced to the api-client's own
      // "An error occurred" default (see fetchWithAuth non-2xx handling), which
      // the component then renders. (The old vi.mock test asserted the
      // component's "Login failed" fallback, but that fallback is only reached
      // when error.message is falsy — unreachable through the real api-client,
      // which always supplies a non-empty message. Asserting it here would have
      // verified a branch the real backend boundary cannot produce.)
      server.use(
        http.post(LOGIN_URL, () => {
          loginCallCount += 1;
          return HttpResponse.json({ status: 'error', message: '' }, { status: 500 });
        })
      );

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      await user.click(screen.getByRole('button', { name: /^enter$/i }));

      await waitFor(() => {
        expect(screen.getByText(/an error occurred|login failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('AC-5: Security Requirements', () => {
    it('uses password type for password field', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('allows toggling password visibility', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Find and click toggle button
      const toggleButton = screen.getByRole('button', { name: /show password/i });
      await user.click(toggleButton);

      expect(passwordInput).toHaveAttribute('type', 'text');

      // Toggle back
      const hideButton = screen.getByRole('button', { name: /hide password/i });
      await user.click(hideButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('has autocomplete attributes for browser autofill', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/email address/i)).toHaveAttribute('autocomplete', 'email');
      expect(screen.getByLabelText(/^password$/i)).toHaveAttribute(
        'autocomplete',
        'current-password'
      );
    });

    it('form does not use GET method (no credentials in URL)', () => {
      const TestWrapper = createTestWrapper();
      const { container } = render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const form = container.querySelector('form');
      // Form should not have GET method
      expect(form).not.toHaveAttribute('method', 'get');
    });
  });

  describe('Form Interaction', () => {
    it('prevents form submission when validation fails', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Submit empty form
      const submitButton = screen.getByRole('button', { name: /^enter$/i });
      await user.click(submitButton);

      // API should not be called
      expect(loginCallCount).toBe(0);
    });

    it('handles rapid form submissions', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      // Slow (pending) handler increments loginCallCount on each real request.
      mockLoginPending();

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      const submitButton = screen.getByRole('button', { name: /^enter$/i });

      // First click triggers mutate(); useLogin sets isPending=true and the
      // button's `disabled` attribute is applied on the next React render.
      await user.click(submitButton);

      // Wait for the disabled state to land in the DOM before the rapid
      // follow-up clicks. Asserting this between clicks is the deterministic
      // disabled-state guard — relying on userEvent.click() to observe
      // pointer-events:none on subsequent rapid clicks races React's render
      // flush and produced flaky callCount=2 results (Equoria-axw4 / s23m,
      // sibling of Equoria-n2cl).
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });

      // Now that the disabled state is committed, additional clicks must be
      // swallowed by HTMLButtonElement's native disabled behavior.
      await user.click(submitButton);
      await user.click(submitButton);

      // Should only submit once due to disabled state
      await waitFor(() => {
        expect(loginCallCount).toBe(1);
      });
    });

    it('does not submit when clicking show/hide password button', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      // Click toggle button
      const toggleButton = screen.getByRole('button', { name: /show password/i });
      await user.click(toggleButton);

      // API should not be called
      expect(loginCallCount).toBe(0);
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const h1 = screen.getByRole('heading', { level: 1 });
      const h2 = screen.getByRole('heading', { level: 2 });

      expect(h1).toBeInTheDocument();
      expect(h2).toBeInTheDocument();
    });

    it('all form inputs are focusable', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const inputs = [
        screen.getByLabelText(/email address/i),
        screen.getByLabelText(/^password$/i),
      ];

      inputs.forEach((input) => {
        input.focus();
        expect(document.activeElement).toBe(input);
      });
    });

    it('error messages are visible and accessible', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      const { container } = render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill in invalid email
      await user.type(screen.getByLabelText(/email address/i), 'invalid-email');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      // Submit form directly
      const form = container.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        const errorMessage = screen.getByText(/please enter a valid email address/i);
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toBeVisible();
      });
    });

    it('submit button is keyboard accessible', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /^enter$/i });
      submitButton.focus();
      expect(document.activeElement).toBe(submitButton);
    });

    it('links are keyboard accessible', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const forgotPasswordLink = screen.getByRole('link', { name: /forgot your password/i });
      const registerLink = screen.getByRole('link', { name: /create an account/i });

      forgotPasswordLink.focus();
      expect(document.activeElement).toBe(forgotPasswordLink);

      registerLink.focus();
      expect(document.activeElement).toBe(registerLink);
    });
  });
});
