# Story 1.1: User Registration

Status: ready-for-dev

## Story

As a **new player**,
I want to **register an account with email and password**,
so that **I can start playing Equoria and manage my stable**.

## Acceptance Criteria

1. **AC-1: Registration Form Display**
   - Registration page displays email, password, confirm password, and display name fields
   - All fields are required with clear visual indicators
   - Form is accessible (proper labels, ARIA attributes)

2. **AC-2: Client-Side Validation**
   - Email field validates format (valid email pattern)
   - Password validates: minimum 8 characters, at least 1 uppercase, at least 1 number
   - Confirm password must match password
   - Display name: 3-30 characters
   - Validation errors appear inline under each field

3. **AC-3: Password Strength Indicator**
   - Visual indicator shows password strength (weak/medium/strong)
   - Requirements checklist shows which criteria are met/unmet
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

- [ ] **Task 1: Foundation Setup** (AC: Foundation)
  - [x] Create `lib/api.ts` - centralized fetch client with `credentials: 'include'`
  - [x] Create `lib/schemas.ts` - Zod validation schemas
  - [x] Create `types/auth.ts` - TypeScript type definitions
  - [ ] Create `lib/constants.ts` - error messages, validation rules

- [ ] **Task 2: Auth Hooks** (AC: 4, 5)
  - [ ] Create `hooks/api/useAuth.ts` with `useRegister` mutation hook
  - [ ] Create `hooks/api/useAuth.test.ts` with MSW mocking
  - [ ] Export from `hooks/api/index.ts`

- [ ] **Task 3: Password Strength Component** (AC: 3)
  - [ ] Create `components/auth/PasswordStrength.tsx`
  - [ ] Create `components/auth/PasswordStrength.test.tsx`
  - [ ] Implement strength calculation (weak/medium/strong)
  - [ ] Add requirements checklist UI

- [ ] **Task 4: Auth Layout Component** (AC: 1)
  - [ ] Create `components/auth/AuthLayout.tsx` - shared layout for auth pages
  - [ ] Create `components/auth/AuthLayout.test.tsx`
  - [ ] Export from `components/auth/index.ts`

- [ ] **Task 5: Registration Page** (AC: 1, 2, 4, 5, 6)
  - [ ] Create `pages/RegisterPage.tsx`
  - [ ] Implement form with useState for form data and errors
  - [ ] Integrate Zod validation on submit
  - [ ] Connect useRegister mutation
  - [ ] Handle success redirect to email verification
  - [ ] Handle all error scenarios

- [ ] **Task 6: Registration Tests** (AC: All)
  - [ ] Create `pages/RegisterPage.test.tsx`
  - [ ] Test form rendering and accessibility
  - [ ] Test validation error display
  - [ ] Test successful registration flow
  - [ ] Test error handling scenarios
  - [ ] Test password strength indicator integration

- [ ] **Task 7: Route Integration** (AC: 1)
  - [ ] Add `/register` route to App.tsx
  - [ ] Add navigation links from LoginPage (if exists)

## Dev Notes

### Architecture Patterns (from ADD)

**State Management (ADR-001):**
- Use React Query's `useMutation` for registration API call
- No client-side store needed - server is source of truth

**Form Handling (ADR-002):**
- `useState` for form data: `{ email, password, confirmPassword, displayName }`
- `useState` for errors: `Record<string, string>`
- Zod schema for validation before API call

**Auth Storage (ADR-003):**
- HttpOnly cookies handled by backend
- Frontend just calls API with `credentials: 'include'`

**API Client (ADR-004):**
- MUST use `apiRequest()` from `lib/api.ts`
- NEVER use raw `fetch()`

**Error Display (ADR-005):**
- Validation errors: Inline under fields
- API 400 errors: Can be field-specific (inline) or general (toast)
- API 5xx errors: Toast notification

**Loading States (ADR-006):**
- Button: Spinner + disabled during `isPending`

### API Endpoint

```
POST /api/v1/auth/register
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "displayName": "PlayerOne"
}

Response (201):
{
  "status": "success",
  "message": "Registration successful. Please verify your email.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "displayName": "PlayerOne",
      "emailVerified": false
    }
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
// lib/schemas.ts
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  displayName: z
    .string()
    .min(3, 'Display name must be at least 3 characters')
    .max(30, 'Display name must not exceed 30 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type RegisterInput = z.infer<typeof registerSchema>;
```

### Component Implementation Pattern

```typescript
// pages/RegisterPage.tsx
const RegisterPage = () => {
  const [formData, setFormData] = useState<RegisterInput>({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
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

**To Create:**
- `frontend/src/lib/constants.ts`
- `frontend/src/hooks/api/useAuth.ts`
- `frontend/src/hooks/api/useAuth.test.ts`
- `frontend/src/hooks/api/index.ts`
- `frontend/src/components/auth/AuthLayout.tsx`
- `frontend/src/components/auth/AuthLayout.test.tsx`
- `frontend/src/components/auth/PasswordStrength.tsx`
- `frontend/src/components/auth/PasswordStrength.test.tsx`
- `frontend/src/components/auth/index.ts`
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/pages/RegisterPage.test.tsx`
- `frontend/src/test/mocks/handlers.ts` (if not exists)

**To Modify:**
- `frontend/src/App.tsx` - Add /register route
- `frontend/src/lib/api.ts` - Verify credentials: 'include' (if exists)
- `frontend/src/lib/schemas.ts` - Add registerSchema (if exists)
- `frontend/src/types/auth.ts` - Add types (if exists)
