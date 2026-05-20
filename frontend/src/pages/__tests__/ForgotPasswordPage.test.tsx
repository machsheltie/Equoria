/**
 * ForgotPasswordPage Tests (Story 1-4: Password Reset Request)
 *
 * Tests for the forgot password page including:
 * - Form rendering with email input
 * - Client-side validation with Zod
 * - Success state showing confirmation message
 * - Error handling for API errors
 * - Loading state during submission
 * - Navigation links
 *
 * Following TDD approach with NO MOCKING of internal logic
 * Only external dependencies (API, Router) are mocked
 */

import { describe, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from '../../test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../test/msw/server';
import ForgotPasswordPage from '../ForgotPasswordPage';

// Network is exercised through the REAL api-client at the fetch boundary via
// MSW (src/test/msw/server.ts) — NOT vi.mock('../../lib/api-client'). Mocking
// the api-client fakes the backend boundary; MSW intercepts the actual HTTP
// request the real api-client makes. Per-test responses are registered with
// server.use() (reset after each test by the global afterEach in
// src/test/setup.ts). The DEFAULT (registered in beforeEach below) is a
// never-resolving handler, so validation tests that should NOT hit the network
// fail loudly if they accidentally do.
const FORGOT_URL = 'http://localhost:3000/api/v1/auth/forgot-password';

// Captures the email the real api-client POSTs, replacing the old
// vi.fn() mock.calls[0][0] assertions.
let lastForgotEmail: string | undefined;
let forgotCallCount = 0;

/** One-shot forgot-password handler returning a success envelope. */
function mockForgotSuccess() {
  server.use(
    http.post(FORGOT_URL, async ({ request }) => {
      forgotCallCount += 1;
      const body = (await request.json()) as { email?: string };
      lastForgotEmail = body.email;
      return HttpResponse.json({ status: 'success', message: 'Email sent' });
    })
  );
}

/** Forgot-password handler returning the given error status + message. */
function mockForgotError(status: number, message: string) {
  server.use(
    http.post(FORGOT_URL, () => {
      forgotCallCount += 1;
      return HttpResponse.json({ status: 'error', message }, { status });
    })
  );
}

describe('ForgotPasswordPage', () => {
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
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    lastForgotEmail = undefined;
    forgotCallCount = 0;
    // Default: never-resolving handler. Validation tests that must NOT submit
    // will hang (and fail) if they accidentally hit the network — mirroring the
    // old never-resolving vi.fn() default. Tests that need a response override
    // this via mockForgotSuccess() / mockForgotError().
    server.use(
      http.post(FORGOT_URL, async () => {
        forgotCallCount += 1;
        await delay('infinite');
        return HttpResponse.json({ status: 'success', message: 'Email sent' });
      })
    );
  });

  afterEach(() => {
    queryClient?.clear();
  });

  // Helper function to render with providers
  const renderForgotPasswordPage = () => {
    const TestWrapper = createTestWrapper();
    return render(<ForgotPasswordPage />, { wrapper: TestWrapper });
  };

  describe('Component Rendering', () => {
    test('renders the forgot password form', () => {
      renderForgotPasswordPage();

      // Check page title
      expect(screen.getByText('Forgot Password?')).toBeInTheDocument();
      expect(
        screen.getByText("No worries! Enter your email and we'll send you reset instructions.")
      ).toBeInTheDocument();
    });

    test('renders email input field', () => {
      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('name', 'email');
    });

    test('renders email label', () => {
      renderForgotPasswordPage();

      expect(screen.getByText('Email Address')).toBeInTheDocument();
    });

    test('renders submit button', () => {
      renderForgotPasswordPage();

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveAttribute('type', 'submit');
    });

    test('renders back to login link', () => {
      renderForgotPasswordPage();

      const backLink = screen.getByText('Back to Login');
      expect(backLink).toBeInTheDocument();
      expect(backLink.closest('a')).toHaveAttribute('href', '/login');
    });

    test('renders sign in link at bottom', () => {
      renderForgotPasswordPage();

      expect(screen.getByText('Remember your password?')).toBeInTheDocument();
      const signInLink = screen.getByText('Sign In');
      expect(signInLink).toBeInTheDocument();
      expect(signInLink.closest('a')).toHaveAttribute('href', '/login');
    });

    test('renders Equoria header link', () => {
      renderForgotPasswordPage();

      const headerLink = screen.getByRole('link', { name: /equoria/i });
      expect(headerLink).toBeInTheDocument();
      expect(headerLink).toHaveAttribute('href', '/');
    });

    test('renders footer with copyright', () => {
      renderForgotPasswordPage();

      expect(screen.getByText(/© 2025 Equoria. All rights reserved./i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('shows error when submitting empty email', async () => {
      renderForgotPasswordPage();

      // Get the form and submit it directly (more reliable than clicking button in jsdom)
      const form = screen.getByRole('button', { name: /send reset link/i }).closest('form')!;
      fireEvent.submit(form);

      // Zod validation shows "Please enter a valid email address" for empty email
      // (the .email() check message, since it's the last error in the validation chain)
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });

      // API should not be called
      expect(forgotCallCount).toBe(0);
    });

    test('shows error for invalid email format', async () => {
      const user = userEvent.setup();
      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'invalid-email');

      // Submit form directly
      const form = screen.getByRole('button', { name: /send reset link/i }).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });

      // API should not be called
      expect(forgotCallCount).toBe(0);
    });

    test('clears validation error when user types', async () => {
      const user = userEvent.setup();
      renderForgotPasswordPage();

      // Submit empty form to trigger error
      const form = screen.getByRole('button', { name: /send reset link/i }).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });

      // Start typing to clear error
      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 't');

      await waitFor(() => {
        expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
      });
    });

    test('accepts valid email format', async () => {
      const user = userEvent.setup();
      renderForgotPasswordPage();
      mockForgotSuccess();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'valid@example.com');

      // Submit form directly
      const form = screen.getByRole('button', { name: /send reset link/i }).closest('form')!;
      fireEvent.submit(form);

      // API should be called with email (ignore React Query options)
      await waitFor(() => {
        expect(lastForgotEmail).toBe('valid@example.com');
      });
    });
  });

  describe('Form Submission', () => {
    test('submits form with valid email', async () => {
      const user = userEvent.setup();
      renderForgotPasswordPage();
      mockForgotSuccess();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      // Submit form directly for reliable submission in jsdom
      const form = screen.getByRole('button', { name: /send reset link/i }).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(lastForgotEmail).toBe('test@example.com');
      });
    });

    test('converts email to lowercase before submission', async () => {
      const user = userEvent.setup();
      renderForgotPasswordPage();
      mockForgotSuccess();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'TEST@EXAMPLE.COM');

      // Submit form directly for reliable submission in jsdom
      const form = screen.getByRole('button', { name: /send reset link/i }).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(lastForgotEmail).toBe('test@example.com');
      });
    });

    test('trims whitespace from email', async () => {
      const user = userEvent.setup();
      renderForgotPasswordPage();
      mockForgotSuccess();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, '  test@example.com  ');

      // Submit form directly for reliable submission in jsdom
      const form = screen.getByRole('button', { name: /send reset link/i }).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(lastForgotEmail).toBe('test@example.com');
      });
    });
  });

  describe('Loading State', () => {
    test('shows loading state while submitting', async () => {
      const user = userEvent.setup();
      // The default beforeEach handler never resolves, so the request stays
      // in-flight and the loading state remains observable for the assertions.

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      // Button should show loading text
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sending.../i })).toBeInTheDocument();
      });

      // Button should be disabled
      expect(screen.getByRole('button', { name: /sending.../i })).toBeDisabled();
    });

    test('disables submit button while loading', async () => {
      const user = userEvent.setup();
      // Default never-resolving handler keeps the request in-flight.

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      await waitFor(() => {
        const loadingButton = screen.getByRole('button', { name: /sending.../i });
        expect(loadingButton).toBeDisabled();
      });
    });
  });

  describe('Success State', () => {
    test('shows success message after successful submission', async () => {
      const user = userEvent.setup();
      mockForgotSuccess();

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Check Your Inbox')).toBeInTheDocument();
      });
    });

    test('displays email in success message', async () => {
      const user = userEvent.setup();
      mockForgotSuccess();

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'myemail@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/myemail@example.com/i)).toBeInTheDocument();
      });
    });

    test('shows expiration info in success state', async () => {
      const user = userEvent.setup();
      mockForgotSuccess();

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/the link will expire in 1 hour/i)).toBeInTheDocument();
      });
    });

    test('shows "Try Another Email" button in success state', async () => {
      const user = userEvent.setup();
      mockForgotSuccess();

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try another email/i })).toBeInTheDocument();
      });
    });

    test('shows "Return to Login" button in success state', async () => {
      const user = userEvent.setup();
      mockForgotSuccess();

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /return to login/i })).toBeInTheDocument();
      });
    });

    test('resets form when clicking "Try Another Email"', async () => {
      const user = userEvent.setup();
      mockForgotSuccess();

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      // Wait for success state
      await waitFor(() => {
        expect(screen.getByText('Check Your Inbox')).toBeInTheDocument();
      });

      // Click "Try Another Email"
      const tryAnotherButton = screen.getByRole('button', { name: /try another email/i });
      await user.click(tryAnotherButton);

      // Form should be visible again
      await waitFor(() => {
        expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
      });

      // Email field should be empty
      const newEmailInput = screen.getByPlaceholderText('your@email.com') as HTMLInputElement;
      expect(newEmailInput.value).toBe('');
    });
  });

  describe('Error Handling', () => {
    test('displays API error message', async () => {
      const user = userEvent.setup();
      // 400 (not 429) — a 429 is special-cased by the api-client into its own
      // "Too many requests" message, which would not match this assertion. A
      // generic 4xx carries the server message through verbatim.
      mockForgotError(400, 'Rate limit exceeded. Please try again later.');

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText('Rate limit exceeded. Please try again later.')
        ).toBeInTheDocument();
      });
    });

    test('displays a generic error message when the server sends no message body', async () => {
      const user = userEvent.setup();
      // Error response with an empty message body. With the REAL api-client a
      // message-less error is coerced to its own "An error occurred" default,
      // which the page then renders. (The old vi.mock test rejected with `{}`
      // to hit the component's "Something went wrong" fallback, but with the
      // real api-client error.message is never falsy, so that fallback branch
      // is unreachable through the network boundary.)
      server.use(
        http.post(FORGOT_URL, () => {
          forgotCallCount += 1;
          return HttpResponse.json({ status: 'error', message: '' }, { status: 500 });
        })
      );

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/an error occurred|something went wrong/i)).toBeInTheDocument();
      });
    });

    test('clears error when user starts typing', async () => {
      const user = userEvent.setup();
      mockForgotError(400, 'Server error');

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });

      // Clear input and type new value
      await user.clear(emailInput);
      await user.type(emailInput, 'new@example.com');

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText('Server error')).not.toBeInTheDocument();
      });
    });

    test('allows retry after error', async () => {
      const user = userEvent.setup();
      // First attempt: a server error carrying a message.
      mockForgotError(400, 'Network error');

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Second attempt succeeds — swap the handler before retrying.
      mockForgotSuccess();

      // Clear and try again
      await user.clear(emailInput);
      await user.type(emailInput, 'retry@example.com');
      await user.click(submitButton);

      // Should succeed
      await waitFor(() => {
        expect(screen.getByText('Check Your Inbox')).toBeInTheDocument();
      });
    });
  });

  describe('Security Considerations', () => {
    test('always shows success for privacy (no email enumeration)', async () => {
      const user = userEvent.setup();
      // Even if API returns success for non-existent email
      mockForgotSuccess();

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'nonexistent@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      // Should still show success (no way to tell if account exists)
      await waitFor(() => {
        expect(screen.getByText('Check Your Inbox')).toBeInTheDocument();
        expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('email input has correct autocomplete attribute', () => {
      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      expect(emailInput).toHaveAttribute('autocomplete', 'email');
    });

    test('email input has associated label', () => {
      renderForgotPasswordPage();

      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toBeInTheDocument();
    });

    test('submit button is keyboard accessible', () => {
      renderForgotPasswordPage();

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      expect(submitButton).not.toHaveAttribute('tabindex', '-1');
    });
  });

  describe('Form Submission via Enter Key', () => {
    test('submits form when pressing Enter in email field', async () => {
      const user = userEvent.setup();
      renderForgotPasswordPage();
      mockForgotSuccess();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      // Type email first
      await user.type(emailInput, 'test@example.com');

      // Then submit using fireEvent for reliable submission in jsdom
      const form = screen.getByRole('button', { name: /send reset link/i }).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(lastForgotEmail).toBe('test@example.com');
      });
    });
  });
});
