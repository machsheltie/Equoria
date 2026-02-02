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
import { BrowserRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import LoginPage from '../LoginPage';
import * as apiClient from '../../lib/api-client';

// Mock the API client
vi.mock('../../lib/api-client', () => ({
  authApi: {
    login: vi.fn(),
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
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
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
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

      expect(screen.getByRole('button', { name: /enter the realm/i })).toBeInTheDocument();
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

      const submitButton = screen.getByRole('button', { name: /enter the realm/i });
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

      // Mock slow API response
      vi.mocked(apiClient.authApi.login).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      const submitButton = screen.getByRole('button', { name: /enter the realm/i });
      await user.click(submitButton);

      // Button should be disabled during submission
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });

    it('shows loading text during submission', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      vi.mocked(apiClient.authApi.login).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      const submitButton = screen.getByRole('button', { name: /enter the realm/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/entering the realm/i)).toBeInTheDocument();
      });
    });

    it('navigates to home on successful login', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      vi.mocked(apiClient.authApi.login).mockResolvedValueOnce({
        user: {
          id: 1,
          username: 'johndoe',
          email: 'john@example.com',
        },
      });

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      const submitButton = screen.getByRole('button', { name: /enter the realm/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('calls API with correct data', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      vi.mocked(apiClient.authApi.login).mockResolvedValueOnce({
        user: { id: 1, username: 'johndoe', email: 'john@example.com' },
      });

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');

      const submitButton = screen.getByRole('button', { name: /enter the realm/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(apiClient.authApi.login).toHaveBeenCalled();
      });

      // Verify the call arguments contain expected data
      const mockCall = vi.mocked(apiClient.authApi.login).mock.calls[0][0];
      expect(mockCall).toMatchObject({
        email: 'john@example.com',
        password: 'SecurePass123',
      });
    });
  });

  describe('AC-4: Error Handling', () => {
    it('displays invalid credentials error', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      vi.mocked(apiClient.authApi.login).mockRejectedValueOnce({
        message: 'Invalid email or password',
        statusCode: 401,
      });

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'wrongpassword');

      await user.click(screen.getByRole('button', { name: /enter the realm/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });
    });

    it('displays server error message', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      vi.mocked(apiClient.authApi.login).mockRejectedValueOnce({
        message: 'Internal server error',
        statusCode: 500,
      });

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      await user.click(screen.getByRole('button', { name: /enter the realm/i }));

      await waitFor(() => {
        expect(screen.getByText(/internal server error|login failed/i)).toBeInTheDocument();
      });
    });

    it('displays generic error for network failures', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      vi.mocked(apiClient.authApi.login).mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      await user.click(screen.getByRole('button', { name: /enter the realm/i }));

      await waitFor(() => {
        expect(screen.getByText(/network error|login failed/i)).toBeInTheDocument();
      });
    });

    it('displays default error message when error has no message', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      vi.mocked(apiClient.authApi.login).mockRejectedValueOnce({});

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      await user.click(screen.getByRole('button', { name: /enter the realm/i }));

      await waitFor(() => {
        expect(screen.getByText(/login failed/i)).toBeInTheDocument();
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
      const submitButton = screen.getByRole('button', { name: /enter the realm/i });
      await user.click(submitButton);

      // API should not be called
      expect(apiClient.authApi.login).not.toHaveBeenCalled();
    });

    it('handles rapid form submissions', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      let callCount = 0;
      vi.mocked(apiClient.authApi.login).mockImplementation(() => {
        callCount++;
        return new Promise((resolve) => setTimeout(() => resolve({ user: { id: 1 } }), 500));
      });

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');

      const submitButton = screen.getByRole('button', { name: /enter the realm/i });

      // Click multiple times rapidly
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);

      // Should only submit once due to disabled state
      await waitFor(() => {
        expect(callCount).toBe(1);
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
      expect(apiClient.authApi.login).not.toHaveBeenCalled();
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

      const submitButton = screen.getByRole('button', { name: /enter the realm/i });
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
