# Tech-Spec: Story 1.1 - User Registration

**Story ID:** 1-1-user-registration
**Status:** VERIFICATION REQUIRED
**Created:** 2025-12-03
**Author:** Claude Opus 4.5

---

## Executive Summary

**Key Finding:** Story 1.1 has substantial existing implementation (~70% complete). This tech-spec identifies gaps and provides implementation guidance for completion.

### Implementation Status Overview

| Task | Status | Completion |
|------|--------|------------|
| Task 1: Foundation Setup | Partial | 75% |
| Task 2: Auth Hooks | Complete | 100% |
| Task 3: Password Strength Component | Inline | 80% |
| Task 4: Auth Layout Component | Missing | 0% |
| Task 5: Registration Page | Complete | 100% |
| Task 6: Registration Tests | Partial | 40% |
| Task 7: Route Integration | Complete | 100% |

**Overall Completion: ~70%**

---

## Existing Implementation Analysis

### Task 1: Foundation Setup (75% Complete)

#### Implemented Files

**`frontend/src/lib/api-client.ts`** (376 lines)
- Complete API client with `credentials: 'include'`
- Auto-retry on 401 with token refresh
- Rate limiting (429) handling
- Full authApi object: login, register, logout, getProfile, verifyEmail, forgotPassword, resetPassword

**`frontend/src/lib/validations/auth.ts`** (174 lines)
- `registerSchema` - Zod validation with all required fields
- `calculatePasswordStrength()` - Returns weak/medium/strong
- TypeScript types: `RegisterFormData`, `LoginFormData`, etc.

**`frontend/src/hooks/useAuth.ts`** (196 lines)
- `useRegister` mutation hook
- `useLogin`, `useLogout`, `useProfile` hooks
- Proper cache invalidation on success

#### Missing File

**`frontend/src/lib/constants.ts`** - NOT FOUND
- Error messages centralization
- Validation rules constants
- UI text constants

### Task 2: Auth Hooks (100% Complete)

**`frontend/src/hooks/useAuth.ts`**
- `useRegister` - Registration mutation
- `useLogin` - Login mutation
- `useLogout` - Logout mutation
- `useProfile` - Profile query
- `useIsAuthenticated` - Auth status check

**`frontend/src/hooks/__tests__/useAuth.test.tsx`** (423 lines)
- 16 tests covering all hooks
- Security tests (no localStorage/sessionStorage)
- Error handling tests
- Cache management tests

### Task 3: Password Strength Component (80% Complete)

**Current State:** Implemented inline in RegisterPage.tsx (lines 180-220)
- Visual strength meter (weak/medium/strong)
- Real-time updates as user types
- Requirements checklist display

**Missing:** Separate reusable `PasswordStrength.tsx` component
- Not extracted to `components/auth/`
- No dedicated test file

### Task 4: Auth Layout Component (0% Complete)

**Status:** NOT IMPLEMENTED

**Required:**
- Shared layout wrapper for auth pages
- Consistent styling across Login, Register, ForgotPassword, ResetPassword
- Responsive container with centered content

### Task 5: Registration Page (100% Complete)

**`frontend/src/pages/RegisterPage.tsx`** (393 lines)
- Fantasy-themed UI with FantasyInput, FantasyButton
- Form with email, password, confirmPassword, username fields
- Zod validation on submit
- useRegister mutation integration
- Password strength indicator
- Show/hide password toggle
- Error handling (inline + toast)
- Success redirect to /verify-email

### Task 6: Registration Tests (40% Complete)

**Existing:**
- `useAuth.test.tsx` - Hook-level tests (16 tests)

**Missing:**
- `RegisterPage.test.tsx` - Page-level integration tests
- Form rendering tests
- Validation error display tests
- Successful registration flow tests
- Error handling scenario tests

### Task 7: Route Integration (100% Complete)

**`frontend/src/App.tsx`**
- Route: `/register` -> `<RegisterPage />`
- QueryClientProvider wrapper
- AuthProvider context
- BrowserRouter for navigation

---

## Gap Analysis vs Acceptance Criteria

### AC-1: Registration Form Display

| Requirement | Status | Notes |
|-------------|--------|-------|
| Email field | Pass | Implemented |
| Password field | Pass | Implemented with toggle |
| Confirm password field | Pass | Implemented |
| Display name field | Pass | `username` field |
| Required indicators | Pass | Asterisk on labels |
| Accessibility (ARIA) | VERIFY | Need accessibility audit |

### AC-2: Client-Side Validation

| Requirement | Status | Notes |
|-------------|--------|-------|
| Email format | Pass | Zod `.email()` |
| Password min 8 chars | Pass | Zod `.min(8)` |
| Password uppercase | Pass | Zod regex |
| Password number | Pass | Zod regex |
| Confirm password match | Pass | Zod `.refine()` |
| Display name 3-30 chars | Pass | Zod `.min(3).max(30)` |
| Inline error display | Pass | Implemented |

### AC-3: Password Strength Indicator

| Requirement | Status | Notes |
|-------------|--------|-------|
| Visual indicator | Pass | Color-coded bar |
| Strength levels | Pass | weak/medium/strong |
| Requirements checklist | Pass | Inline display |
| Real-time updates | Pass | onChange handler |

### AC-4: Form Submission

| Requirement | Status | Notes |
|-------------|--------|-------|
| Button disabled when invalid | VERIFY | Need to confirm |
| Spinner during API call | Pass | Loading state |
| Redirect on success | Pass | Navigate to /verify-email |

### AC-5: Error Handling

| Requirement | Status | Notes |
|-------------|--------|-------|
| Duplicate email inline | Pass | Server error mapped |
| Server errors toast | Pass | Toast notification |
| Network errors toast | Pass | Error boundary |

### AC-6: Security Requirements

| Requirement | Status | Notes |
|-------------|--------|-------|
| No console logs | VERIFY | Security audit needed |
| Password type="password" | Pass | Implemented |
| Show/hide toggle | Pass | Eye icon |
| POST method | Pass | API client |

---

## Implementation Plan for Gaps

### Gap 1: Create `lib/constants.ts`

**Priority:** P2 (Medium)
**Effort:** 30 minutes

```typescript
// frontend/src/lib/constants.ts
export const ERROR_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  PASSWORD_MIN_LENGTH: 'Password must be at least 8 characters',
  PASSWORD_UPPERCASE: 'Password must contain at least one uppercase letter',
  PASSWORD_NUMBER: 'Password must contain at least one number',
  PASSWORD_MATCH: 'Passwords do not match',
  DISPLAY_NAME_MIN: 'Display name must be at least 3 characters',
  DISPLAY_NAME_MAX: 'Display name must not exceed 30 characters',
  EMAIL_TAKEN: 'This email is already registered',
  SERVER_ERROR: 'Something went wrong. Please try again later.',
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
} as const;

export const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 8,
  DISPLAY_NAME_MIN: 3,
  DISPLAY_NAME_MAX: 30,
} as const;

export const UI_TEXT = {
  REGISTER_TITLE: 'Create Your Account',
  REGISTER_SUBTITLE: 'Begin your equestrian journey',
  REGISTER_BUTTON: 'Create Account',
  ALREADY_HAVE_ACCOUNT: 'Already have an account?',
  LOGIN_LINK: 'Sign in',
} as const;
```

### Gap 2: Create `AuthLayout.tsx`

**Priority:** P3 (Low)
**Effort:** 1 hour

```typescript
// frontend/src/components/auth/AuthLayout.tsx
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export const AuthLayout = ({ children, title, subtitle }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/">
            <h1 className="text-4xl font-serif text-amber-900">Equoria</h1>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-serif text-amber-900">{title}</h2>
            {subtitle && (
              <p className="text-amber-700 mt-2">{subtitle}</p>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
```

### Gap 3: Extract `PasswordStrength.tsx`

**Priority:** P3 (Low)
**Effort:** 45 minutes

```typescript
// frontend/src/components/auth/PasswordStrength.tsx
import { useMemo } from 'react';
import { calculatePasswordStrength, PasswordStrength as Strength } from '@/lib/validations/auth';

interface PasswordStrengthProps {
  password: string;
}

export const PasswordStrength = ({ password }: PasswordStrengthProps) => {
  const strength = useMemo(() => calculatePasswordStrength(password), [password]);

  const strengthConfig = {
    weak: { color: 'bg-red-500', width: 'w-1/3', label: 'Weak' },
    medium: { color: 'bg-yellow-500', width: 'w-2/3', label: 'Medium' },
    strong: { color: 'bg-green-500', width: 'w-full', label: 'Strong' },
  };

  const config = strengthConfig[strength];

  const requirements = [
    { met: password.length >= 8, text: 'At least 8 characters' },
    { met: /[A-Z]/.test(password), text: 'One uppercase letter' },
    { met: /[a-z]/.test(password), text: 'One lowercase letter' },
    { met: /[0-9]/.test(password), text: 'One number' },
  ];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      {/* Strength Bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${config.color} ${config.width} transition-all duration-300`} />
      </div>
      <p className="text-sm text-amber-700">{config.label}</p>

      {/* Requirements Checklist */}
      <ul className="text-xs space-y-1">
        {requirements.map((req, i) => (
          <li key={i} className={req.met ? 'text-green-600' : 'text-gray-500'}>
            {req.met ? '✓' : '○'} {req.text}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordStrength;
```

### Gap 4: Create `RegisterPage.test.tsx`

**Priority:** P1 (High)
**Effort:** 2 hours

```typescript
// frontend/src/pages/__tests__/RegisterPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import RegisterPage from '../RegisterPage';
import * as authHooks from '@/hooks/useAuth';

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock auth hooks
vi.mock('@/hooks/useAuth', () => ({
  useRegister: vi.fn(),
}));

describe('RegisterPage', () => {
  let queryClient: QueryClient;
  let mockRegister: ReturnType<typeof vi.fn>;

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <RegisterPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockRegister = vi.fn();
    vi.mocked(authHooks.useRegister).mockReturnValue({
      mutate: mockRegister,
      isPending: false,
      isError: false,
      error: null,
    } as any);
    mockNavigate.mockClear();
  });

  describe('AC-1: Registration Form Display', () => {
    it('displays all required form fields', () => {
      renderPage();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/username|display name/i)).toBeInTheDocument();
    });

    it('displays required field indicators', () => {
      renderPage();
      const labels = screen.getAllByText('*');
      expect(labels.length).toBeGreaterThanOrEqual(4);
    });

    it('has accessible form controls', () => {
      renderPage();
      expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create|register|sign up/i })).toBeInTheDocument();
    });
  });

  describe('AC-2: Client-Side Validation', () => {
    it('shows error for invalid email format', async () => {
      renderPage();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/email/i), 'invalid-email');
      await user.click(screen.getByRole('button', { name: /create|register/i }));

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeInTheDocument();
      });
    });

    it('shows error when passwords do not match', async () => {
      renderPage();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/^password$/i), 'Password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'Different123');
      await user.click(screen.getByRole('button', { name: /create|register/i }));

      await waitFor(() => {
        expect(screen.getByText(/match/i)).toBeInTheDocument();
      });
    });

    it('shows error for short password', async () => {
      renderPage();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/^password$/i), 'Short1');
      await user.click(screen.getByRole('button', { name: /create|register/i }));

      await waitFor(() => {
        expect(screen.getByText(/8 characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('AC-3: Password Strength Indicator', () => {
    it('shows password strength indicator when typing', async () => {
      renderPage();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/^password$/i), 'weak');

      await waitFor(() => {
        expect(screen.getByText(/weak/i)).toBeInTheDocument();
      });
    });

    it('updates strength indicator in real-time', async () => {
      renderPage();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/^password$/i), 'StrongPass123!');

      await waitFor(() => {
        expect(screen.getByText(/strong/i)).toBeInTheDocument();
      });
    });
  });

  describe('AC-4: Form Submission', () => {
    it('shows loading state during submission', async () => {
      vi.mocked(authHooks.useRegister).mockReturnValue({
        mutate: mockRegister,
        isPending: true,
        isError: false,
        error: null,
      } as any);

      renderPage();

      expect(screen.getByRole('button', { name: /create|register/i })).toBeDisabled();
    });

    it('calls register mutation with form data', async () => {
      renderPage();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/^password$/i), 'Password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password123');
      await user.click(screen.getByRole('button', { name: /create|register/i }));

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalled();
      });
    });
  });

  describe('AC-5: Error Handling', () => {
    it('displays duplicate email error', async () => {
      vi.mocked(authHooks.useRegister).mockReturnValue({
        mutate: mockRegister,
        isPending: false,
        isError: true,
        error: { message: 'Email already registered' },
      } as any);

      renderPage();

      expect(screen.getByText(/already registered/i)).toBeInTheDocument();
    });
  });

  describe('AC-6: Security Requirements', () => {
    it('uses password input type', () => {
      renderPage();
      expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
    });

    it('has show/hide password toggle', () => {
      renderPage();
      expect(screen.getByRole('button', { name: /show|hide|toggle/i })).toBeInTheDocument();
    });
  });
});
```

---

## Test Coverage Requirements

### Existing Tests (40% Coverage)

| File | Tests | Coverage |
|------|-------|----------|
| useAuth.test.tsx | 16 tests | Hook-level |

### Required Tests (60% Gap)

| File | Tests Needed | Priority |
|------|--------------|----------|
| RegisterPage.test.tsx | 15-20 tests | P1 |
| PasswordStrength.test.tsx | 8-10 tests | P2 |
| AuthLayout.test.tsx | 5-8 tests | P3 |

### Test Categories

1. **Rendering Tests** - Form displays all fields
2. **Accessibility Tests** - ARIA attributes, labels
3. **Validation Tests** - All error scenarios
4. **Integration Tests** - API mutation flow
5. **Error Handling Tests** - All error types
6. **Loading State Tests** - Button disabled, spinner
7. **Security Tests** - Password masking, no logs

---

## Implementation Order

### Phase 1: Testing (P1) - 2 hours
1. Create `RegisterPage.test.tsx` with all AC coverage

### Phase 2: Constants (P2) - 30 minutes
1. Create `lib/constants.ts`
2. Update RegisterPage to use constants

### Phase 3: Component Extraction (P3) - 1.5 hours
1. Create `components/auth/PasswordStrength.tsx`
2. Create `components/auth/PasswordStrength.test.tsx`
3. Create `components/auth/AuthLayout.tsx`
4. Create `components/auth/AuthLayout.test.tsx`
5. Update auth pages to use AuthLayout

### Phase 4: Verification (P1) - 1 hour
1. Accessibility audit with axe-core
2. Security audit (no console logs, proper input types)
3. Manual testing of all AC scenarios

---

## Dependencies

### External Packages (Already Installed)
- `@tanstack/react-query` - Mutations
- `zod` - Validation schemas
- `react-router-dom` - Navigation
- `vitest` - Testing
- `@testing-library/react` - Component testing

### Internal Dependencies
- `frontend/src/lib/api-client.ts` - authApi.register
- `frontend/src/lib/validations/auth.ts` - registerSchema
- `frontend/src/hooks/useAuth.ts` - useRegister hook

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Backend API mismatch | High | Verify API contract with backend team |
| Test flakiness | Medium | Use proper waitFor patterns |
| Accessibility gaps | Medium | Run axe-core audit |
| Security vulnerabilities | High | Security review checklist |

---

## Definition of Done

- [ ] All 6 AC pass manual verification
- [ ] RegisterPage.test.tsx created with 15+ tests
- [ ] lib/constants.ts created and integrated
- [ ] PasswordStrength extracted (optional P3)
- [ ] AuthLayout extracted (optional P3)
- [ ] Accessibility audit passed
- [ ] Security checklist completed
- [ ] Code review approved
- [ ] Sprint status updated to `completed`

---

## References

- Story Definition: `docs/sprint-artifacts/1-1-user-registration.md`
- Architecture: `docs/architecture/ARCH-01-Overview.md`
- API Contract: `backend/docs/swagger.yaml` POST /api/v1/auth/register
- Design Patterns: ADR-001 through ADR-008
