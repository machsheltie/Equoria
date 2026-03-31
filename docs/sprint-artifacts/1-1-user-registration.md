# Story 1.1: User Registration

Status: done

## Story

As a **new player**,
I want to **register an account with email and password**,
so that **I can start playing Equoria and manage my stable**.

## Acceptance Criteria

1. **AC-1: Registration Form Display**

   - Registration page displays email, username, password, confirm password, first name, and last name fields
   - All fields are required with clear visual indicators
   - Form is accessible (proper labels, ARIA attributes)

2. **AC-2: Client-Side Validation**

   - Email field validates format (valid email pattern)
   - Username: 3-30 characters, alphanumeric + underscore only
   - Password validates: minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special character (@$!%\*?&)
   - Confirm password must match password
   - First name / Last name: 1-50 characters each
   - Validation errors appear inline under each field

3. **AC-3: Password Strength Indicator**

   - Visual indicator shows password strength (weak/fair/good/strong)
   - Requirements checklist shows which criteria are met/unmet (5 criteria: length, lowercase, uppercase, number, special char)
   - Indicator updates in real-time as user types

4. **AC-4: Form Submission**

   - Submit button disabled while form is invalid or submission in progress
   - Spinner shown on button during API call
   - Successful registration redirects to email verification page

5. **AC-5: Error Handling**

   - Duplicate email shows inline error: "Email already registered"
   - Server errors display toast notification
   - Network errors display toast with retry guidance

6. **AC-6: Security Requirements**
   - No sensitive data in console logs
   - Password fields use `type="password"` with show/hide toggle
   - Form uses POST method (no GET with credentials in URL)

## Tasks / Subtasks

- [x] **Task 1: Foundation Setup** (AC: Foundation)

  - [x] Create `lib/api-client.ts` - centralized fetch client with `credentials: 'include'` (note: named api-client.ts not api.ts)
  - [x] Create `lib/validation-schemas.ts` - Zod validation schemas (note: named validation-schemas.ts not schemas.ts)
  - [x] Create `lib/constants.ts` - error messages, validation rules
  - [x] Types co-located in hooks/useAuth.ts and schema files (no separate types/auth.ts needed)

- [x] **Task 2: Auth Hooks** (AC: 4, 5)

  - [x] Created `hooks/useAuth.ts` with useRegister, useLogin, useLogout, useProfile mutations (note: in hooks/ not hooks/api/)
  - [x] Created `hooks/__tests__/useAuth.test.tsx` with MSW mocking
  - [x] Exported from `hooks/api/index.ts`

- [x] **Task 3: Password Strength Component** (AC: 3)

  - [x] Create `components/auth/PasswordStrength.tsx`
  - [x] Create `components/auth/PasswordStrength.test.tsx`
  - [x] Implements strength calculation (weak/fair/good/strong)
  - [x] Requirements checklist: 8+ chars, lowercase, uppercase, number, special char (@$!%\*?&)

- [x] **Task 4: Auth Layout Component** (AC: 1)

  - [x] Create `components/auth/AuthLayout.tsx` - shared layout for auth pages
  - [x] Create `components/auth/AuthLayout.test.tsx`
  - [x] Exported from `components/auth/index.ts`

- [x] **Task 5: Registration Page** (AC: 1, 2, 4, 5, 6)

  - [x] Create `pages/RegisterPage.tsx`
  - [x] Implements form with useState for form data and errors
  - [x] Integrates Zod validation on submit (registerSchema)
  - [x] Connected useRegister mutation
  - [x] Handle success redirect to email verification
  - [x] Handle all error scenarios

- [x] **Task 6: Registration Tests** (AC: All)

  - [x] Create `pages/__tests__/RegisterPage.test.tsx`
  - [x] Tests form rendering and accessibility
  - [x] Tests validation error display
  - [x] Tests successful registration flow
  - [x] Tests error handling scenarios
  - [x] Tests password strength indicator integration

- [x] **Task 7: Route Integration** (AC: 1)
  - [x] Added `/register` route to App.tsx (lazy-loaded)

## Dev Notes

### Architecture Patterns (from ADD)

**State Management (ADR-001):**

- Use React Query's `useMutation` for registration API call
- No client-side store needed - server is source of truth

**Form Handling (ADR-002):**

- `useState` for form data: `{ email, username, password, confirmPassword, firstName, lastName }`
- `useState` for errors: `Record<string, string>`
- Zod schema for validation before API call

**Auth Storage (ADR-003):**

- HttpOnly cookies handled by backend
- Frontend just calls API with `credentials: 'include'`

**API Client (ADR-004):**

- MUST use `authApi` from `lib/api-client.ts`
- NEVER use raw `fetch()`

**Error Display (ADR-005):**

- Validation errors: Inline under fields
- API 400 errors: Can be field-specific (inline) or general (toast)
- API 5xx errors: Toast notification

**Loading States (ADR-006):**

- Button: Spinner + disabled during `isPending`

### API Endpoint

```
POST /api/auth/register
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "username": "PlayerOne",
  "password": "SecurePass123!",
  "firstName": "Player",
  "lastName": "One"
}

Response (201):
{
  "status": "success",
  "message": "User registered successfully. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "username": "PlayerOne",
      "firstName": "Player",
      "lastName": "One",
      "money": 1500,
      "level": 1,
      "xp": 0,
      "emailVerified": false,
      "isNewUser": true
    },
    "emailVerificationSent": true
  }
}

Response (400 - Validation Error):
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "email": "Email already registered",
    "password": "Password does not meet requirements"
  }
}

Response (500 - Server Error):
{
  "status": "error",
  "message": "Internal server error"
}
```

### Zod Schema

```typescript
// lib/validation-schemas.ts
export const registerSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema, // 3-30 chars, alphanumeric + underscore
    password: passwordSchema, // 8+ chars, lower/upper/number/special(@$!%*?&)
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    firstName: firstNameSchema, // 1-50 chars
    lastName: lastNameSchema, // 1-50 chars
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;
```

> **Note:** Auth types are co-located — `RegisterFormData` is inferred from the schema above.
> No separate `types/auth.ts` file exists; `User`, `LoginCredentials`, `RegisterData` interfaces
> live in `hooks/useAuth.ts`.

### Component Implementation Pattern

```typescript
// pages/RegisterPage.tsx
const RegisterPage = () => {
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const { mutate: register, isPending } = useRegister({
    onSuccess: () => {
      navigate('/verify-email');
    },
    onError: (error: ApiError) => {
      if (error.status === 400 && error.errors) {
        setErrors(error.errors);
      } else {
        toast.error(error.message || 'Registration failed');
      }
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = registerSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors(
        Object.fromEntries(
          Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0] || ''])
        )
      );
      return;
    }

    register(result.data);
  };

  return (
    <AuthLayout title="Create Account">
      <form onSubmit={handleSubmit}>
        {/* Form fields with inline errors */}
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner /> : 'Register'}
        </Button>
      </form>
    </AuthLayout>
  );
};
```

### Project Structure Notes

**Files to Create:**

```
frontend/src/
├── lib/
│   ├── api.ts              # Centralized fetch (if not exists)
│   ├── schemas.ts          # Zod schemas (if not exists)
│   └── constants.ts        # Error messages, validation rules
├── types/
│   └── auth.ts             # Auth types (if not exists)
├── hooks/api/
│   ├── useAuth.ts          # Auth hooks
│   ├── useAuth.test.ts     # Hook tests
│   └── index.ts            # Barrel export
├── components/auth/
│   ├── AuthLayout.tsx      # Shared auth layout
│   ├── AuthLayout.test.tsx
│   ├── PasswordStrength.tsx
│   ├── PasswordStrength.test.tsx
│   └── index.ts            # Barrel export
├── pages/
│   ├── RegisterPage.tsx
│   └── RegisterPage.test.tsx
└── test/
    └── mocks/
        └── handlers.ts     # MSW handlers (if not exists)
```

**Alignment with Architecture:**

- Feature-based organization (ADR-007)
- Colocated tests (ADR-008)
- Barrel exports for clean imports

### Testing Standards

**Test Categories:**

1. **Rendering Tests:** Form displays all required fields
2. **Accessibility Tests:** Proper labels, ARIA attributes
3. **Validation Tests:** All validation rules fire correctly
4. **Integration Tests:** API mutation works with MSW
5. **Error Handling Tests:** All error scenarios covered
6. **Loading State Tests:** Button disabled, spinner shown

**Test Example:**

```typescript
// pages/RegisterPage.test.tsx
describe('RegisterPage', () => {
  it('displays validation errors for invalid input', async () => {
    render(<RegisterPage />, { wrapper: TestWrapper });

    await userEvent.type(screen.getByLabelText(/email/i), 'invalid');
    await userEvent.click(screen.getByRole('button', { name: /register/i }));

    expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    render(<RegisterPage />, { wrapper: TestWrapper });

    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'SecurePass1');
    await userEvent.type(screen.getByLabelText(/confirm/i), 'SecurePass1');
    await userEvent.type(screen.getByLabelText(/display name/i), 'TestPlayer');
    await userEvent.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/verify-email');
    });
  });
});
```

### References

- [Source: docs/architecture.md#ADR-001] - React Query for state management
- [Source: docs/architecture.md#ADR-002] - useState + Zod for forms
- [Source: docs/architecture.md#ADR-004] - Centralized API client
- [Source: docs/architecture.md#ADR-005] - Error display patterns
- [Source: docs/architecture.md#ADR-006] - Loading state patterns
- [Source: docs/architecture.md#ADR-007] - Feature-based file organization
- [Source: docs/architecture.md#ADR-008] - Colocated tests
- [Source: docs/epics.md#Story-1.1] - Original story definition
- [Source: docs/product/PRD-02-Core-Features.md] - FR-U1 User Registration requirement

## Dev Agent Record

### Context Reference

- docs/architecture.md - Complete ADD with 8 ADRs
- docs/epics.md - Epic 1, Story 1.1 definition
- docs/sprint-artifacts/sprint-status.yaml - Sprint tracking

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

_(To be added during implementation)_

### Completion Notes List

_(To be added during implementation)_

### File List

**Created:**

- `frontend/src/lib/constants.ts`
- `frontend/src/lib/api-client.ts` (was lib/api.ts in spec)
- `frontend/src/lib/validation-schemas.ts` (was lib/schemas.ts in spec)
- `frontend/src/hooks/useAuth.ts` (was hooks/api/useAuth.ts in spec)
- `frontend/src/hooks/__tests__/useAuth.test.tsx` (was hooks/api/useAuth.test.ts in spec)
- `frontend/src/hooks/api/index.ts`
- `frontend/src/components/auth/AuthLayout.tsx`
- `frontend/src/components/auth/AuthLayout.test.tsx`
- `frontend/src/components/auth/PasswordStrength.tsx`
- `frontend/src/components/auth/PasswordStrength.test.tsx`
- `frontend/src/components/auth/index.ts`
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/pages/__tests__/RegisterPage.test.tsx` (was pages/RegisterPage.test.tsx in spec)
- `frontend/src/test/msw/handlers.ts` (was test/mocks/handlers.ts in spec)

**Modified:**

- `frontend/src/App.tsx` - Added /register route (lazy-loaded)
