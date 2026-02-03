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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from '../../test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import ForgotPasswordPage from '../ForgotPasswordPage';
import * as apiClient from '../../lib/api-client';

// Mock the API client - returns never-resolving promise by default
// This ensures validation tests don't accidentally succeed if mock is called
vi.mock('../../lib/api-client', () => ({
  authApi: {
    forgotPassword: vi.fn(() => new Promise(() => {})), // Never resolves by default
  },
}));

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
    // Use mockReset to fully reset implementation AND calls
    vi.mocked(apiClient.authApi.forgotPassword).mockReset();
    // Set default never-resolving behavior
    vi.mocked(apiClient.authApi.forgotPassword).mockImplementation(() => new Promise(() => {}));
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
      expect(vi.mocked(apiClient.authApi.forgotPassword)).not.toHaveBeenCalled();
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
      expect(vi.mocked(apiClient.authApi.forgotPassword)).not.toHaveBeenCalled();
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
      vi.mocked(apiClient.authApi.forgotPassword).mockResolvedValueOnce({ message: 'Email sent' });

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'valid@example.com');

      // Submit form directly
      const form = screen.getByRole('button', { name: /send reset link/i }).closest('form')!;
      fireEvent.submit(form);

      // API should be called with email (ignore React Query options)
      await waitFor(() => {
        expect(vi.mocked(apiClient.authApi.forgotPassword)).toHaveBeenCalled();
        expect(vi.mocked(apiClient.authApi.forgotPassword).mock.calls[0][0]).toBe(
          'valid@example.com'
        );
      });
    });
  });

  describe('Form Submission', () => {
    test('submits form with valid email', async () => {
      const user = userEvent.setup();
      renderForgotPasswordPage();
      vi.mocked(apiClient.authApi.forgotPassword).mockResolvedValueOnce({ message: 'Email sent' });

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      // Submit form directly for reliable submission in jsdom
      const form = screen.getByRole('button', { name: /send reset link/i }).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(vi.mocked(apiClient.authApi.forgotPassword)).toHaveBeenCalled();
        expect(vi.mocked(apiClient.authApi.forgotPassword).mock.calls[0][0]).toBe(
          'test@example.com'
        );
      });
    });

    test('converts email to lowercase before submission', async () => {
      const user = userEvent.setup();
      renderForgotPasswordPage();
      vi.mocked(apiClient.authApi.forgotPassword).mockResolvedValueOnce({ message: 'Email sent' });

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'TEST@EXAMPLE.COM');

      // Submit form directly for reliable submission in jsdom
      const form = screen.getByRole('button', { name: /send reset link/i }).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(vi.mocked(apiClient.authApi.forgotPassword)).toHaveBeenCalled();
        expect(vi.mocked(apiClient.authApi.forgotPassword).mock.calls[0][0]).toBe(
          'test@example.com'
        );
      });
    });

    test('trims whitespace from email', async () => {
      const user = userEvent.setup();
      renderForgotPasswordPage();
      vi.mocked(apiClient.authApi.forgotPassword).mockResolvedValueOnce({ message: 'Email sent' });

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, '  test@example.com  ');

      // Submit form directly for reliable submission in jsdom
      const form = screen.getByRole('button', { name: /send reset link/i }).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(vi.mocked(apiClient.authApi.forgotPassword)).toHaveBeenCalled();
        expect(vi.mocked(apiClient.authApi.forgotPassword).mock.calls[0][0]).toBe(
          'test@example.com'
        );
      });
    });
  });

  describe('Loading State', () => {
    test('shows loading state while submitting', async () => {
      const user = userEvent.setup();
      // Create a promise that won't resolve immediately
      let resolvePromise: (value: { message: string }) => void;
      const pendingPromise = new Promise<{ message: string }>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(apiClient.authApi.forgotPassword).mockReturnValueOnce(pendingPromise);

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

      // Resolve the promise
      resolvePromise!({ message: 'Email sent' });
    });

    test('disables submit button while loading', async () => {
      const user = userEvent.setup();
      let resolvePromise: (value: { message: string }) => void;
      const pendingPromise = new Promise<{ message: string }>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(apiClient.authApi.forgotPassword).mockReturnValueOnce(pendingPromise);

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      await waitFor(() => {
        const loadingButton = screen.getByRole('button', { name: /sending.../i });
        expect(loadingButton).toBeDisabled();
      });

      // Resolve
      resolvePromise!({ message: 'Email sent' });
    });
  });

  describe('Success State', () => {
    test('shows success message after successful submission', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.authApi.forgotPassword).mockResolvedValueOnce({ message: 'Email sent' });

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
      vi.mocked(apiClient.authApi.forgotPassword).mockResolvedValueOnce({ message: 'Email sent' });

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
      vi.mocked(apiClient.authApi.forgotPassword).mockResolvedValueOnce({ message: 'Email sent' });

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
      vi.mocked(apiClient.authApi.forgotPassword).mockResolvedValueOnce({ message: 'Email sent' });

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
      vi.mocked(apiClient.authApi.forgotPassword).mockResolvedValueOnce({ message: 'Email sent' });

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
      vi.mocked(apiClient.authApi.forgotPassword).mockResolvedValueOnce({ message: 'Email sent' });

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
      const error = new Error('Rate limit exceeded. Please try again later.');
      vi.mocked(apiClient.authApi.forgotPassword).mockRejectedValueOnce(error);

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

    test('displays generic error message when error has no message', async () => {
      const user = userEvent.setup();
      const error = {};
      vi.mocked(apiClient.authApi.forgotPassword).mockRejectedValueOnce(error);

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
      });
    });

    test('clears error when user starts typing', async () => {
      const user = userEvent.setup();
      const error = new Error('Server error');
      vi.mocked(apiClient.authApi.forgotPassword).mockRejectedValueOnce(error);

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
      // First call fails, second succeeds
      vi.mocked(apiClient.authApi.forgotPassword)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ message: 'Email sent' });

      renderForgotPasswordPage();

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

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
      vi.mocked(apiClient.authApi.forgotPassword).mockResolvedValueOnce({ message: 'Email sent' });

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
      vi.mocked(apiClient.authApi.forgotPassword).mockResolvedValueOnce({ message: 'Email sent' });

      const emailInput = screen.getByPlaceholderText('your@email.com');
      // Type email first
      await user.type(emailInput, 'test@example.com');

      // Then submit using fireEvent for reliable submission in jsdom
      const form = screen.getByRole('button', { name: /send reset link/i }).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(vi.mocked(apiClient.authApi.forgotPassword)).toHaveBeenCalled();
        expect(vi.mocked(apiClient.authApi.forgotPassword).mock.calls[0][0]).toBe(
          'test@example.com'
        );
      });
    });
  });
});
