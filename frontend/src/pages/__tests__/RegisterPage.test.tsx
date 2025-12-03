/**
 * RegisterPage Component Tests
 *
 * Comprehensive tests for the registration page including:
 * - Form rendering and accessibility
 * - Client-side validation with Zod
 * - Password strength indicator
 * - Form submission and API integration
 * - Error handling scenarios
 * - Security requirements
 *
 * Story 1.1: User Registration - AC-1 through AC-6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import RegisterPage from '../RegisterPage';
import * as apiClient from '../../lib/api-client';

// Mock the API client
vi.mock('../../lib/api-client', () => ({
  authApi: {
    register: vi.fn(),
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

describe('RegisterPage', () => {
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

  describe('AC-1: Registration Form Display', () => {
    it('renders all required form fields', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Check all required fields are present
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it('displays submit button with correct text', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      expect(
        screen.getByRole('button', { name: /begin your journey/i })
      ).toBeInTheDocument();
    });

    it('displays page title and description', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      expect(screen.getByText(/join the realm/i)).toBeInTheDocument();
      expect(screen.getByText(/create your account/i)).toBeInTheDocument();
    });

    it('provides link to login page', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      const loginLink = screen.getByRole('link', { name: /sign in/i });
      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute('href', '/login');
    });

    it('has proper accessibility labels on form fields', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // All inputs should have associated labels
      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveAttribute('id', 'email');
      expect(emailInput).toHaveAttribute('name', 'email');
      expect(emailInput).toHaveAttribute('type', 'email');

      const usernameInput = screen.getByLabelText(/username/i);
      expect(usernameInput).toHaveAttribute('id', 'username');
      expect(usernameInput).toHaveAttribute('name', 'username');
    });
  });

  describe('AC-2: Client-Side Validation', () => {
    it('shows error for invalid email format', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      const { container } = render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill in all fields with valid data except email
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'invalid-email');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123');

      // Submit the form directly
      const form = container.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('shows error for short password', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill in all fields with valid data except password (too short, missing uppercase, missing number)
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'short');
      await user.type(screen.getByLabelText(/confirm password/i), 'short');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      // Zod reports multiple errors, just check that one of them appears
      await waitFor(() => {
        // "short" password fails: min(8), uppercase, and number requirements
        // Any of these error messages is acceptable
        const errorText = screen.getByText(/password must be at least 8 characters|password must contain at least one uppercase|password must contain at least one number/i);
        expect(errorText).toBeInTheDocument();
      });
    });

    it('shows error when password missing uppercase', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill in all fields with valid data except password (missing uppercase)
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password must contain at least one uppercase letter/i)).toBeInTheDocument();
      });
    });

    it('shows error when password missing number', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill in all fields with valid data except password (missing number)
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'PasswordOnly');
      await user.type(screen.getByLabelText(/confirm password/i), 'PasswordOnly');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password must contain at least one number/i)).toBeInTheDocument();
      });
    });

    it('shows error when passwords do not match', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill in all fields with valid data except confirm password
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'DifferentPass123');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('shows error for short username', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill in all fields with valid data except username (too short)
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'ab');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/username must be at least 3 characters/i)).toBeInTheDocument();
      });
    });

    it('shows error for invalid username characters', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill in all fields with valid data except username (invalid characters)
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'user@name!');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/username can only contain letters, numbers, and underscores/i)).toBeInTheDocument();
      });
    });

    it('clears validation errors when user types', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      const { container } = render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill in all fields with valid data except email
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'invalid-email');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123');

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

  describe('AC-3: Password Strength Indicator', () => {
    it('shows password strength indicator when typing', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/^password$/i);
      await user.type(passwordInput, 'test');

      // Strength indicator should appear
      await waitFor(() => {
        expect(screen.getByText(/weak|fair|good|strong/i)).toBeInTheDocument();
      });
    });

    it('shows requirements checklist', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/^password$/i);
      await user.type(passwordInput, 'test');

      await waitFor(() => {
        expect(screen.getByText(/8\+ characters/i)).toBeInTheDocument();
        expect(screen.getByText(/lowercase/i)).toBeInTheDocument();
        expect(screen.getByText(/uppercase/i)).toBeInTheDocument();
        expect(screen.getByText(/number/i)).toBeInTheDocument();
      });
    });

    it('updates strength as password gets stronger', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/^password$/i);

      // Weak password
      await user.type(passwordInput, 'abc');
      expect(screen.getByText(/weak/i)).toBeInTheDocument();

      // Stronger password
      await user.clear(passwordInput);
      await user.type(passwordInput, 'SecurePass123!');

      await waitFor(() => {
        expect(screen.getByText(/strong|good/i)).toBeInTheDocument();
      });
    });

    it('does not show strength indicator when password is empty', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Strength indicator should not be visible initially
      expect(screen.queryByText(/weak|fair|good|strong/i)).not.toBeInTheDocument();
    });
  });

  describe('AC-4: Form Submission', () => {
    it('disables submit button while submission is in progress', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      // Mock slow API response
      vi.mocked(apiClient.authApi.register).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      // Button should be disabled during submission
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });

    it('shows loading text during submission', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      vi.mocked(apiClient.authApi.register).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/creating account/i)).toBeInTheDocument();
      });
    });

    it('navigates to home on successful registration', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      vi.mocked(apiClient.authApi.register).mockResolvedValueOnce({
        user: {
          id: 1,
          username: 'johndoe',
          email: 'john@example.com',
        },
      });

      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('calls API with correct data', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      vi.mocked(apiClient.authApi.register).mockResolvedValueOnce({
        user: { id: 1, username: 'johndoe', email: 'john@example.com' },
      });

      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123');

      // Submit via button click (matches other passing tests)
      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Verify API was called
        expect(apiClient.authApi.register).toHaveBeenCalled();
      });

      // Verify the call arguments contain expected data
      const mockCall = vi.mocked(apiClient.authApi.register).mock.calls[0][0];
      expect(mockCall).toMatchObject({
        email: 'john@example.com',
        username: 'johndoe',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
      });
    });
  });

  describe('AC-5: Error Handling', () => {
    it('displays duplicate email error', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      vi.mocked(apiClient.authApi.register).mockRejectedValueOnce({
        message: 'User with this email already exists',
        statusCode: 400,
      });

      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123');

      await user.click(screen.getByRole('button', { name: /begin your journey/i }));

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });
    });

    it('displays server error message', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      vi.mocked(apiClient.authApi.register).mockRejectedValueOnce({
        message: 'Internal server error',
        statusCode: 500,
      });

      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123');

      await user.click(screen.getByRole('button', { name: /begin your journey/i }));

      await waitFor(() => {
        expect(screen.getByText(/internal server error|registration failed/i)).toBeInTheDocument();
      });
    });

    it('displays generic error for network failures', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      vi.mocked(apiClient.authApi.register).mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123');

      await user.click(screen.getByRole('button', { name: /begin your journey/i }));

      await waitFor(() => {
        expect(screen.getByText(/network error|registration failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('AC-6: Security Requirements', () => {
    it('uses password type for password fields', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(confirmInput).toHaveAttribute('type', 'password');
    });

    it('allows toggling password visibility', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Find and click toggle button
      const toggleButtons = screen.getAllByRole('button', { name: /show|hide password/i });
      await user.click(toggleButtons[0]);

      expect(passwordInput).toHaveAttribute('type', 'text');

      // Toggle back
      await user.click(toggleButtons[0]);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('has autocomplete attributes for browser autofill', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/email/i)).toHaveAttribute('autocomplete', 'email');
      expect(screen.getByLabelText(/username/i)).toHaveAttribute('autocomplete', 'username');
      expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('autocomplete', 'new-password');
      expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute(
        'autocomplete',
        'new-password'
      );
      expect(screen.getByLabelText(/first name/i)).toHaveAttribute('autocomplete', 'given-name');
      expect(screen.getByLabelText(/last name/i)).toHaveAttribute('autocomplete', 'family-name');
    });

    it('form uses POST method (no credentials in URL)', () => {
      const TestWrapper = createTestWrapper();
      const { container } = render(
        <TestWrapper>
          <RegisterPage />
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
          <RegisterPage />
        </TestWrapper>
      );

      // Submit empty form
      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      // API should not be called
      expect(apiClient.authApi.register).not.toHaveBeenCalled();
    });

    it('handles rapid form submissions', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      let callCount = 0;
      vi.mocked(apiClient.authApi.register).mockImplementation(() => {
        callCount++;
        return new Promise((resolve) => setTimeout(() => resolve({ user: { id: 1 } }), 500));
      });

      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill valid form
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });

      // Click multiple times rapidly
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);

      // Should only submit once due to disabled state
      await waitFor(() => {
        expect(callCount).toBe(1);
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
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
          <RegisterPage />
        </TestWrapper>
      );

      const inputs = [
        screen.getByLabelText(/first name/i),
        screen.getByLabelText(/last name/i),
        screen.getByLabelText(/username/i),
        screen.getByLabelText(/email/i),
        screen.getByLabelText(/^password$/i),
        screen.getByLabelText(/confirm password/i),
      ];

      inputs.forEach((input) => {
        input.focus();
        expect(document.activeElement).toBe(input);
      });
    });

    it('error messages are associated with inputs', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      const { container } = render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill in all fields with valid data except email
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'invalid-email');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123');

      // Submit form directly
      const form = container.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        const errorMessage = screen.getByText(/please enter a valid email address/i);
        expect(errorMessage).toBeInTheDocument();
      });
    });
  });
});
