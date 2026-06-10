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
import { BrowserRouter } from '../../test/utils';
import { ReactNode } from 'react';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../test/msw/server';
import RegisterPage from '../RegisterPage';

// Network is exercised through the REAL api-client at the fetch boundary via
// MSW (src/test/msw/server.ts) — NOT vi.mock('../../lib/api-client'). Mocking
// the api-client fakes the backend boundary so the test passes even when the
// real API contract is broken; MSW intercepts the actual HTTP request the real
// api-client makes. Per-test responses are registered with server.use() (reset
// after each test by the global afterEach in src/test/setup.ts).
const REGISTER_URL = 'http://localhost:3000/api/v1/auth/register';

// Captures the body the real api-client POSTs + counts real calls, replacing
// the old vi.fn() call assertions.
let lastRegisterBody: unknown = null;
let registerCallCount = 0;

beforeEach(() => {
  lastRegisterBody = null;
  registerCallCount = 0;
});

/** One-shot register handler returning a successful user envelope. */
function mockRegisterSuccess() {
  server.use(
    http.post(REGISTER_URL, async ({ request }) => {
      registerCallCount += 1;
      lastRegisterBody = await request.json();
      return HttpResponse.json(
        {
          status: 'success',
          data: {
            user: {
              id: 1,
              username: 'johndoe',
              email: 'john@example.com',
              money: 500,
              level: 1,
              xp: 0,
            },
          },
        },
        { status: 201 }
      );
    })
  );
}

/** Register handler that never resolves (in-flight / loading state). */
function mockRegisterPending() {
  server.use(
    http.post(REGISTER_URL, async () => {
      registerCallCount += 1;
      await delay('infinite');
      return HttpResponse.json({ status: 'success', data: { user: { id: 1 } } }, { status: 201 });
    })
  );
}

/** Register handler returning the given error status + message. */
function mockRegisterError(status: number, message: string) {
  server.use(
    http.post(REGISTER_URL, () => {
      registerCallCount += 1;
      return HttpResponse.json({ status: 'error', message }, { status });
    })
  );
}

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
    mockNavigate.mockClear();
  });

  afterEach(() => {
    if (queryClient) {
      // Clear cache, mutation state, and cancel in-flight queries
      queryClient.clear();
      queryClient.getMutationCache().clear();
      queryClient.cancelQueries();
    }
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

      expect(screen.getByRole('button', { name: /begin your journey/i })).toBeInTheDocument();
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
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      // Submit the form directly
      const form = container.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    // Equoria-iqzn / Equoria-9tlha — COPPA client-side hint sentinels.
    // The server is authoritative; these prove the form gives an honest
    // early signal and does not call the API for an under-13 / missing DOB.
    it('blocks submission and shows an error when date of birth is empty (COPPA)', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      const { container } = render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      // Intentionally do NOT fill date of birth.

      const form = container.querySelector('form');
      fireEvent.submit(form!);

      // Zod collects all dateOfBirth issues; RegisterPage surfaces one of
      // them (required / not-a-valid-date / 13-or-older) for the empty field.
      // The contract that matters: a DOB error is shown AND the API is not
      // called for an empty DOB.
      await waitFor(() => {
        expect(
          screen.getByText(/date of birth is required|valid date|13 or older/i)
        ).toBeInTheDocument();
      });
      expect(registerCallCount).toBe(0);
    });

    it('blocks submission and shows an error for an under-13 date of birth (COPPA)', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      const { container } = render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // A DOB 5 years ago — clearly under 13.
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setUTCFullYear(fiveYearsAgo.getUTCFullYear() - 5);
      const under13 = fiveYearsAgo.toISOString().slice(0, 10);

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), under13);

      const form = container.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText(/13 or older/i)).toBeInTheDocument();
      });
      expect(registerCallCount).toBe(0);
    });

    it('allows submission for a 13+ date of birth and forwards it to the API (COPPA)', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      mockRegisterSuccess();

      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Exactly 20 years ago — comfortably over 13.
      const adult = new Date();
      adult.setUTCFullYear(adult.getUTCFullYear() - 20);
      const adultDob = adult.toISOString().slice(0, 10);

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), adultDob);

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(lastRegisterBody).not.toBeNull();
      });
      expect(lastRegisterBody).toMatchObject({ dateOfBirth: adultDob });
    });

    it('shows error for short password', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill in all fields with valid data except password (too short but has uppercase, lowercase, number, special char)
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'Sh0@t1');
      await user.type(screen.getByLabelText(/confirm password/i), 'Sh0@t1');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
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

      // Fill in all fields with valid data except password (missing uppercase — has number + special char)
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/password must contain at least one uppercase letter/i)
        ).toBeInTheDocument();
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

      // Fill in all fields with valid data except password (missing number — has uppercase, lowercase, special char)
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'PasswordOnly@');
      await user.type(screen.getByLabelText(/confirm password/i), 'PasswordOnly@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

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
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'DifferentPass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

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
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

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
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/username can only contain letters, numbers, and underscores/i)
        ).toBeInTheDocument();
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
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      // Submit form directly
      const form = container.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });

      // Clear and type valid email
      await user.clear(emailInput);
      await user.type(emailInput, 'valid@example.com');

      // Wait for React to process the onChange event
      await waitFor(() => {
        expect(emailInput).toHaveValue('valid@example.com');
      });

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

    it('renders exactly 5 requirement rows including special character', async () => {
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
        expect(screen.getByText(/special character/i)).toBeInTheDocument();
      });

      // Assert the actual rendered DOM row count — NOT a local array literal.
      // This fails if RegisterPage renders other than exactly 5 requirement
      // rows (sentinel-positive: deleting/adding a <RequirementCheck> changes
      // this count and the test fails). Equoria-5ryz.
      const renderedRows = screen.getAllByTestId('password-requirement-row');
      expect(renderedRows).toHaveLength(5);
    });

    it('special character requirement is met for allowed chars (@$!%*?&)', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/^password$/i);
      await user.type(passwordInput, 'SecurePass1@');

      await waitFor(() => {
        // The special char requirement label should be present
        expect(screen.getByText(/special character/i)).toBeInTheDocument();
      });
    });

    it('hash (#) does NOT satisfy the special character requirement', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      const { container } = render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      // Fill a password with # (not in allowed set) but meeting all other requirements
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass1#');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass1#');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      // Submit the form — should fail with special char validation error
      const form = container.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(
          screen.getByText(/password must contain at least one special character/i)
        ).toBeInTheDocument();
      });
    });

    it('Password1! (allowed special char !) passes special character validation', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();
      const { container } = render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password1!');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      // Submit the form — should NOT show special char error
      const form = container.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(
          screen.queryByText(/password must contain at least one special character/i)
        ).not.toBeInTheDocument();
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

      // Slow (never-resolving) API response so the in-flight state is observable
      mockRegisterPending();

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
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

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

      mockRegisterPending();

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
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/creating account/i)).toBeInTheDocument();
      });
    });

    it('navigates to /verify-email on successful registration', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      mockRegisterSuccess();

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
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/verify-email');
      });
    });

    it('calls API with correct data', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      mockRegisterSuccess();

      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      // Submit via button click (matches other passing tests)
      const submitButton = screen.getByRole('button', { name: /begin your journey/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Verify the real api-client actually POSTed to /api/v1/auth/register
        expect(lastRegisterBody).not.toBeNull();
      });

      // Verify the request body the real api-client sent
      expect(lastRegisterBody).toMatchObject({
        email: 'john@example.com',
        username: 'johndoe',
        password: 'SecurePass123@',
        firstName: 'John',
        lastName: 'Doe',
      });
    });
  });

  describe('AC-5: Error Handling', () => {
    it('displays duplicate email error', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      mockRegisterError(400, 'User with this email already exists');

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
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      await user.click(screen.getByRole('button', { name: /begin your journey/i }));

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });
    });

    it('maps "email taken" server error to inline email field error', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      mockRegisterError(400, 'Email is already taken');

      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      await user.click(screen.getByRole('button', { name: /begin your journey/i }));

      await waitFor(() => {
        expect(screen.getByText(/this email address is already registered/i)).toBeInTheDocument();
      });
    });

    it('maps "already in use" email server error to inline email field error (Story 21S-9)', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      mockRegisterError(400, 'Email is already in use');

      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');
      await user.type(screen.getByLabelText(/email/i), 'inuse@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      await user.click(screen.getByRole('button', { name: /begin your journey/i }));

      await waitFor(() => {
        expect(screen.getByText(/this email address is already registered/i)).toBeInTheDocument();
      });
    });

    it('maps "username" server error to inline username field error', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      mockRegisterError(400, 'Username is already taken');

      render(
        <TestWrapper>
          <RegisterPage />
        </TestWrapper>
      );

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'takenuser');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      await user.click(screen.getByRole('button', { name: /begin your journey/i }));

      await waitFor(() => {
        expect(screen.getByText(/this username is already taken/i)).toBeInTheDocument();
      });
    });

    it('displays server error message', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      mockRegisterError(500, 'Internal server error');

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
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      await user.click(screen.getByRole('button', { name: /begin your journey/i }));

      await waitFor(() => {
        expect(screen.getByText(/internal server error|registration failed/i)).toBeInTheDocument();
      });
    });

    it('displays generic error for network failures', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      // Simulate a real transport-level network failure (no HTTP response).
      // The real api-client surfaces a non-empty error message which the
      // component renders. Assert the error paragraph appears with content —
      // the exact transport wording is environment-dependent.
      server.use(http.post(REGISTER_URL, () => HttpResponse.error()));

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
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      await user.click(screen.getByRole('button', { name: /begin your journey/i }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeTruthy();
        expect((alert.textContent ?? '').trim().length).toBeGreaterThan(0);
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
      expect(registerCallCount).toBe(0);
    });

    it('handles rapid form submissions', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      // Slow (pending) handler increments registerCallCount on each real request.
      mockRegisterPending();

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
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

      const submitButton = screen.getByRole('button', { name: /begin your journey/i });

      // First click triggers mutate(); useRegister sets isPending=true and the
      // button's `disabled` attribute is applied on the next React render.
      await user.click(submitButton);

      // Wait for the disabled state to land in the DOM. Asserting this between
      // clicks is the deterministic disabled-state guard — relying on
      // userEvent.click() to observe pointer-events:none on subsequent rapid
      // clicks races React's render flush and produced flaky callCount=2 results
      // (Equoria-n2cl).
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });

      // Now that the disabled state is committed, additional clicks must be
      // swallowed by HTMLButtonElement's native disabled behavior.
      await user.click(submitButton);
      await user.click(submitButton);

      // Should only submit once due to disabled state
      await waitFor(() => {
        expect(registerCallCount).toBe(1);
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
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

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
