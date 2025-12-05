# Testing Patterns Guide

**Version:** 1.0.0
**Last Updated:** 2025-12-05
**Purpose:** Document common testing patterns used in Epic 1 and Epic 2

---

## Table of Contents

1. [Form Submission Testing](#form-submission-testing)
2. [Validation Testing Patterns](#validation-testing-patterns)
3. [API Mocking Patterns](#api-mocking-patterns)
4. [Component Test Setup](#component-test-setup)
5. [Accessibility Testing](#accessibility-testing)

---

## Form Submission Testing

### Pattern: fireEvent.submit vs userEvent.click

**Overview:**
There are two primary ways to test form submission in React Testing Library. Understanding when to use each approach ensures consistent, reliable tests.

### Method 1: fireEvent.submit (Direct Form Submission)

**When to Use:**
- Testing **client-side validation** (Zod schema validation)
- Testing validation errors that appear **before** API calls
- Testing edge cases where the submit button might not be accessible
- Testing form behavior independent of button clicks

**Why This Works:**
- Directly triggers the form's `onSubmit` event handler
- Bypasses any button-related logic (disabled state, loading state)
- Tests the form validation logic in isolation
- More reliable for validation-specific tests

**Code Pattern:**
```typescript
it('shows error for invalid email format', async () => {
  const user = userEvent.setup();
  const TestWrapper = createTestWrapper();
  const { container } = render(
    <TestWrapper>
      <LoginPage />
    </TestWrapper>
  );

  // Fill in fields with invalid data
  await user.type(screen.getByLabelText(/email address/i), 'invalid-email');
  await user.type(screen.getByLabelText(/^password$/i), 'password123');

  // Submit the form directly
  const form = container.querySelector('form');
  fireEvent.submit(form!);

  // Assert validation error appears
  await waitFor(() => {
    expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
  });
});
```

**Key Points:**
1. **Requires `container`** - Must destructure `{ container }` from `render()` result
2. **Query the form element** - Use `container.querySelector('form')` to get the form DOM node
3. **Non-null assertion** - Use `form!` since we know the form exists in our component
4. **Async validation** - Always wrap assertions in `waitFor()` for validation errors

**From LoginPage.test.tsx (Lines 165-185):**
```typescript
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
});
```

**From RegisterPage.test.tsx (Lines 145-169):**
```typescript
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
});
```

---

### Method 2: userEvent.click (Button Click Simulation)

**When to Use:**
- Testing **successful form submission** flow
- Testing **API integration** (form submission triggers API calls)
- Testing button states during submission (disabled, loading text)
- Testing the complete user interaction flow
- Testing navigation after successful submission

**Why This Works:**
- Simulates actual user behavior more closely
- Tests button accessibility and focus
- Tests the complete form submission flow including button state changes
- Better for integration/E2E-style tests

**Code Pattern:**
```typescript
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

  // Click the submit button
  const submitButton = screen.getByRole('button', { name: /enter the realm/i });
  await user.click(submitButton);

  // Assert navigation occurred
  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
```

**Key Points:**
1. **No container needed** - Uses `screen` queries directly
2. **Query button by role and name** - Ensures accessibility
3. **Tests actual user behavior** - Simulates real button clicks
4. **Tests full flow** - Includes validation, API call, and navigation

**From LoginPage.test.tsx (Lines 321-349):**
```typescript
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
```

**From RegisterPage.test.tsx (Lines 501-533):**
```typescript
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
```

---

### Decision Matrix: Which Method to Use?

| Test Scenario | Use fireEvent.submit | Use userEvent.click |
|---------------|---------------------|---------------------|
| Client-side validation errors | ✅ Yes | ❌ No (button may be enabled despite invalid data) |
| Empty field validation | ✅ Yes | ✅ Yes (both work) |
| Password mismatch validation | ✅ Yes | ❌ No (validation happens on submit) |
| Successful form submission | ❌ No (doesn't simulate user flow) | ✅ Yes |
| API integration testing | ❌ No | ✅ Yes |
| Button disabled state during submission | ❌ No (bypasses button) | ✅ Yes |
| Loading text during submission | ❌ No | ✅ Yes |
| Navigation after success | ❌ No | ✅ Yes |
| Error messages from server | ❌ No | ✅ Yes |
| Button accessibility | ❌ No | ✅ Yes |

**Rule of Thumb:**
- **Validation Tests** → Use `fireEvent.submit`
- **Success Flow Tests** → Use `userEvent.click`
- **Error Handling Tests** → Use `userEvent.click`
- **Accessibility Tests** → Use `userEvent.click`

---

### Common Mistakes to Avoid

#### ❌ WRONG: Using userEvent.click for validation-only tests

```typescript
// BAD: Button might be enabled, validation bypassed
it('shows error for invalid email', async () => {
  const user = userEvent.setup();
  render(<LoginPage />);

  await user.type(screen.getByLabelText(/email/i), 'invalid-email');
  await user.type(screen.getByLabelText(/password/i), 'password123');

  // This might work, but tests the wrong thing
  await user.click(screen.getByRole('button', { name: /enter/i }));

  await waitFor(() => {
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
  });
});
```

**Why It's Wrong:**
- Button click might be disabled by validation
- Tests button behavior instead of validation logic
- Inconsistent results across components

#### ✅ CORRECT: Using fireEvent.submit for validation-only tests

```typescript
// GOOD: Directly tests form validation
it('shows error for invalid email', async () => {
  const user = userEvent.setup();
  const { container } = render(<LoginPage />);

  await user.type(screen.getByLabelText(/email/i), 'invalid-email');
  await user.type(screen.getByLabelText(/password/i), 'password123');

  const form = container.querySelector('form');
  fireEvent.submit(form!);

  await waitFor(() => {
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
  });
});
```

---

#### ❌ WRONG: Forgetting to destructure container

```typescript
// BAD: Cannot access container
it('shows error for invalid email', async () => {
  const user = userEvent.setup();
  render(<LoginPage />); // No destructuring

  await user.type(screen.getByLabelText(/email/i), 'invalid-email');
  await user.type(screen.getByLabelText(/password/i), 'password123');

  // ERROR: container is undefined
  const form = container.querySelector('form');
  fireEvent.submit(form!);
});
```

#### ✅ CORRECT: Destructure container from render

```typescript
// GOOD: Destructure container
it('shows error for invalid email', async () => {
  const user = userEvent.setup();
  const { container } = render(<LoginPage />); // Destructure here

  await user.type(screen.getByLabelText(/email/i), 'invalid-email');
  await user.type(screen.getByLabelText(/password/i), 'password123');

  const form = container.querySelector('form');
  fireEvent.submit(form!);
});
```

---

#### ❌ WRONG: Not using waitFor for async validation

```typescript
// BAD: Validation error might not appear immediately
it('shows error for invalid email', async () => {
  const user = userEvent.setup();
  const { container } = render(<LoginPage />);

  await user.type(screen.getByLabelText(/email/i), 'invalid-email');
  await user.type(screen.getByLabelText(/password/i), 'password123');

  const form = container.querySelector('form');
  fireEvent.submit(form!);

  // ERROR: May fail if validation is async
  expect(screen.getByText(/valid email/i)).toBeInTheDocument();
});
```

#### ✅ CORRECT: Always use waitFor for validation errors

```typescript
// GOOD: Wait for async validation
it('shows error for invalid email', async () => {
  const user = userEvent.setup();
  const { container } = render(<LoginPage />);

  await user.type(screen.getByLabelText(/email/i), 'invalid-email');
  await user.type(screen.getByLabelText(/password/i), 'password123');

  const form = container.querySelector('form');
  fireEvent.submit(form!);

  // Correct: Wait for error to appear
  await waitFor(() => {
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
  });
});
```

---

## Validation Testing Patterns

### Pattern: Testing Zod Schema Validation

**Context:**
All forms in Epic 1 use Zod for client-side validation (loginSchema, registerSchema, forgotPasswordSchema, profileSchema). Validation errors appear synchronously after form submission.

### Basic Validation Test Structure

```typescript
describe('AC-X: Client-Side Validation', () => {
  it('shows error for [invalid field]', async () => {
    const user = userEvent.setup();
    const TestWrapper = createTestWrapper();
    const { container } = render(
      <TestWrapper>
        <YourPage />
      </TestWrapper>
    );

    // 1. Fill in fields (valid except the one being tested)
    await user.type(screen.getByLabelText(/field1/i), 'valid-value');
    await user.type(screen.getByLabelText(/field2/i), 'invalid-value');

    // 2. Submit the form directly (bypasses button)
    const form = container.querySelector('form');
    fireEvent.submit(form!);

    // 3. Assert validation error appears
    await waitFor(() => {
      expect(screen.getByText(/expected error message/i)).toBeInTheDocument();
    });
  });
});
```

### Testing "Clear on Type" Behavior

**Pattern:**
Validation errors should disappear when the user starts typing in the invalid field.

```typescript
it('clears validation errors when user types', async () => {
  const user = userEvent.setup();
  const TestWrapper = createTestWrapper();
  const { container } = render(
    <TestWrapper>
      <LoginPage />
    </TestWrapper>
  );

  // 1. Fill in invalid data and trigger error
  const emailInput = screen.getByLabelText(/email address/i);
  await user.type(emailInput, 'invalid-email');
  await user.type(screen.getByLabelText(/^password$/i), 'password123');

  const form = container.querySelector('form');
  fireEvent.submit(form!);

  await waitFor(() => {
    expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
  });

  // 2. Clear and type valid email
  await user.clear(emailInput);
  await user.type(emailInput, 'valid@example.com');

  // 3. Assert error disappears
  await waitFor(() => {
    expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
  });
});
```

**Key Pattern:**
1. Trigger validation error
2. Modify the invalid field
3. Assert error message disappears

**From LoginPage.test.tsx (Lines 233-263)**

---

## API Mocking Patterns

### Pattern: Mocking API Responses with Vitest

**Setup:**
All API calls are mocked at the module level using `vi.mock()`.

```typescript
// Mock the API client at the top of test file
vi.mock('../../lib/api-client', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
  },
}));
```

### Successful API Response

```typescript
it('calls API with correct data', async () => {
  const user = userEvent.setup();
  const TestWrapper = createTestWrapper();

  // Mock successful response
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

  // Fill and submit form
  await user.type(screen.getByLabelText(/email/i), 'john@example.com');
  await user.type(screen.getByLabelText(/password/i), 'SecurePass123');
  await user.click(screen.getByRole('button', { name: /enter/i }));

  // Assert API was called
  await waitFor(() => {
    expect(apiClient.authApi.login).toHaveBeenCalled();
  });

  // Verify call arguments
  const mockCall = vi.mocked(apiClient.authApi.login).mock.calls[0][0];
  expect(mockCall).toMatchObject({
    email: 'john@example.com',
    password: 'SecurePass123',
  });
});
```

### API Error Response

```typescript
it('displays invalid credentials error', async () => {
  const user = userEvent.setup();
  const TestWrapper = createTestWrapper();

  // Mock error response
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
  await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
  await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
  await user.click(screen.getByRole('button', { name: /enter/i }));

  // Assert error message appears
  await waitFor(() => {
    expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
  });
});
```

### Slow API Response (Loading State)

```typescript
it('shows loading text during submission', async () => {
  const user = userEvent.setup();
  const TestWrapper = createTestWrapper();

  // Mock slow response
  vi.mocked(apiClient.authApi.login).mockImplementation(
    () => new Promise((resolve) => setTimeout(resolve, 1000))
  );

  render(
    <TestWrapper>
      <LoginPage />
    </TestWrapper>
  );

  // Fill valid form
  await user.type(screen.getByLabelText(/email/i), 'john@example.com');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /enter the realm/i }));

  // Assert loading text appears
  await waitFor(() => {
    expect(screen.getByText(/entering the realm/i)).toBeInTheDocument();
  });
});
```

---

## Component Test Setup

### Pattern: Test Wrapper with React Query

**Why:** All forms use React Query mutations (useMutation), which requires QueryClientProvider.

```typescript
describe('YourPage', () => {
  let queryClient: QueryClient;

  // Create test wrapper factory
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

  // Tests here...
});
```

**Key Points:**
1. **Create fresh QueryClient per test** - Prevents state leakage
2. **Disable retries** - Makes tests faster and more predictable
3. **Clear mocks in beforeEach** - Ensures clean slate
4. **Clear QueryClient in afterEach** - Prevents memory leaks
5. **Include BrowserRouter** - Required for useNavigate hook

---

## Accessibility Testing

### Pattern: Testing Form Accessibility

```typescript
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

    await user.type(screen.getByLabelText(/email/i), 'invalid-email');
    await user.type(screen.getByLabelText(/password/i), 'password123');

    const form = container.querySelector('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      const errorMessage = screen.getByText(/please enter a valid email address/i);
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toBeVisible();
    });
  });
});
```

---

## Summary Checklist

When writing form tests, use this checklist:

**✅ Client-Side Validation Tests:**
- [ ] Use `fireEvent.submit(form!)` pattern
- [ ] Destructure `{ container }` from render
- [ ] Wrap assertions in `waitFor()`
- [ ] Test each validation rule separately
- [ ] Test "clear on type" behavior

**✅ Successful Submission Tests:**
- [ ] Use `userEvent.click(submitButton)` pattern
- [ ] Mock successful API response
- [ ] Test navigation after success
- [ ] Test button disabled state
- [ ] Test loading text display

**✅ Error Handling Tests:**
- [ ] Use `userEvent.click(submitButton)` pattern
- [ ] Mock API error responses
- [ ] Test different error scenarios (401, 500, network)
- [ ] Test default error message fallback

**✅ Component Setup:**
- [ ] Create QueryClient with `retry: false`
- [ ] Clear mocks in beforeEach
- [ ] Clear QueryClient in afterEach
- [ ] Include all required providers (QueryClient, Router)

**✅ Accessibility:**
- [ ] Test heading hierarchy
- [ ] Test input focusability
- [ ] Test error message visibility
- [ ] Test keyboard navigation

---

## Related Documentation

- [Epic 1 Retrospective](../sprint-artifacts/epic-1-retro-2025-12-05.md) - Complete pattern analysis
- [Epic 2 Retrospective](../sprint-artifacts/epic-2-retro-2025-12-05.md) - Advanced patterns
- [Sprint Status](../sprint-artifacts/sprint-status.yaml) - Action item tracking

---

**Maintained By:** Dev Team
**Next Review:** Before Epic 3 Story 3-1
**Status:** ✅ Complete
