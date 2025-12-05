# Form Component Patterns Guide

**Version:** 1.0.0
**Last Updated:** 2025-12-05
**Purpose:** Document form implementation patterns for Epic 3 CRUD operations

---

## Table of Contents

1. [Form Setup with React Query](#form-setup-with-react-query)
2. [Zod Validation Integration](#zod-validation-integration)
3. [Validation Error Handling](#validation-error-handling)
4. [Form Submission Patterns](#form-submission-patterns)
5. [Loading States](#loading-states)
6. [Cancel and Reset Patterns](#cancel-and-reset-patterns)
7. [API Integration](#api-integration)
8. [Common Patterns Summary](#common-patterns-summary)

---

## Form Setup with React Query

### Pattern: useState + React Query Mutation

**Overview:**
All forms in Equoria use controlled components with `useState` for form data and React Query's `useMutation` for API calls. This provides optimal UX with automatic loading/error states and cache invalidation.

### Basic Form Structure

```typescript
import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { someSchema, type SomeFormData } from '../lib/validation-schemas';
import { apiClient } from '../lib/api-client';

const SomeFormPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState<SomeFormData>({
    field1: '',
    field2: '',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // React Query mutation
  const { mutate, isPending, isSuccess, isError, error } = useMutation({
    mutationFn: (data: SomeFormData) => apiClient.someApi.submit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['some-data'] });
      // Navigate or show success message
    },
  });

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear validation error when user types
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
    const result = someSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0] as string] = issue.message;
        }
      });
      setValidationErrors(errors);
      return;
    }

    // Submit to API
    mutate(result.data);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
};
```

**Key Points:**
1. **Controlled components** - Use `useState` to manage form data
2. **Validation state** - Separate state for validation errors
3. **React Query mutation** - Handles API calls with automatic loading/error states
4. **Clear on type** - Remove validation errors when user modifies field
5. **Validate before submit** - Run Zod validation before calling API

**From ProfilePage.tsx (Lines 58-112):**
```typescript
const ProfilePage: React.FC = () => {
  const { data: profileData, isLoading, isError, error: profileError } = useProfile();
  const { mutate: updateProfile, isPending, isSuccess, isError: isUpdateError, error: updateError } = useUpdateProfile();

  // Form state
  const [formData, setFormData] = useState<ProfileFormData>({
    username: '',
    bio: '',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Initialize form with user data
  useEffect(() => {
    if (profileData?.user) {
      setFormData({
        username: profileData.user.username || '',
        bio: profileData.user.bio || '',
      });
    }
  }, [profileData]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear validation error when user types
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
    const result = profileSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0] as string] = issue.message;
        }
      });
      setValidationErrors(errors);
      return;
    }

    // Submit to API
    updateProfile(result.data);
  };

  // ... rest of component
};
```

---

## Zod Validation Integration

### Pattern: Schema-First Validation

**Overview:**
All forms use Zod schemas defined in `validation-schemas.ts`. Schemas provide runtime validation, TypeScript types, and consistent error messages.

### Creating Validation Schemas

**Base Field Schemas:**
```typescript
// lib/validation-schemas.ts

import { z } from 'zod';

/**
 * Email validation schema
 * - Required (non-empty)
 * - Valid email format
 * - Automatically lowercased and trimmed
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .toLowerCase()
  .trim();

/**
 * Username validation schema
 * - 3-30 characters
 * - Alphanumeric and underscore only
 * - Automatically trimmed
 */
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(
    /^[a-zA-Z0-9_]+$/,
    'Username can only contain letters, numbers, and underscores'
  )
  .trim();
```

**Form Schemas with Refinements:**
```typescript
/**
 * Registration form validation schema
 * - Includes password confirmation validation
 */
export const registerSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    firstName: firstNameSchema,
    lastName: lastNameSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'], // Error appears on confirmPassword field
  });

/**
 * TypeScript type inference from schema
 */
export type RegisterFormData = z.infer<typeof registerSchema>;
```

**From validation-schemas.ts (Lines 206-218):**

### Using Schemas in Components

```typescript
import { profileSchema, type ProfileFormData } from '../lib/validation-schemas';

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  // Validate with Zod
  const result = profileSchema.safeParse(formData);

  if (!result.success) {
    // Extract errors
    const errors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
      if (issue.path[0]) {
        errors[issue.path[0] as string] = issue.message;
      }
    });
    setValidationErrors(errors);
    return; // Stop submission
  }

  // result.data is now type-safe and validated
  mutate(result.data);
};
```

**Key Points:**
1. **safeParse()** - Returns result object instead of throwing
2. **Extract errors** - Map Zod issues to field names
3. **Type safety** - `result.data` is fully typed
4. **Early return** - Stop submission if validation fails

---

## Validation Error Handling

### Pattern: Per-Field Error Display

**Overview:**
Display validation errors inline below each field. Clear errors automatically when user starts typing.

### Error Display Component Pattern

```typescript
{/* Input Field with Error */}
<div className="space-y-1">
  <label htmlFor="username" className="fantasy-body text-sm text-midnight-ink font-medium">
    Display Name
  </label>
  <FantasyInput
    id="username"
    name="username"
    type="text"
    value={formData.username}
    onChange={handleChange}
    className={validationErrors.username ? 'border-red-500' : ''}
  />
  {validationErrors.username && (
    <p className="text-red-600 text-xs mt-1">{validationErrors.username}</p>
  )}
</div>
```

**From ProfilePage.tsx (Lines 277-296):**
```typescript
{/* Display Name Field */}
<div className="space-y-1">
  <label htmlFor="username" className="fantasy-body text-sm text-midnight-ink font-medium">
    {UI_TEXT.profile.displayNameLabel}
  </label>
  <div className="relative">
    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-aged-bronze" />
    <FantasyInput
      id="username"
      name="username"
      type="text"
      placeholder={UI_TEXT.profile.displayNamePlaceholder}
      value={formData.username}
      onChange={handleChange}
      className="pl-10"
      autoComplete="username"
    />
  </div>
  {validationErrors.username && (
    <p className="text-red-600 text-xs mt-1">{validationErrors.username}</p>
  )}
</div>
```

### Clear on Type Pattern

```typescript
const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  const { name, value } = e.target;

  // Update form data
  setFormData((prev) => ({ ...prev, [name]: value }));

  // Clear validation error for this field
  if (validationErrors[name]) {
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[name]; // Remove error for this field
      return next;
    });
  }
};
```

**Key Points:**
1. **Inline errors** - Display error message directly below field
2. **Conditional styling** - Add red border for invalid fields
3. **Clear on change** - Remove error when user modifies field
4. **Immutable updates** - Create new error object, don't mutate

**From ProfilePage.tsx (Lines 80-91):**

---

## Form Submission Patterns

### Pattern: Validate-Then-Submit

**Overview:**
Always validate client-side before calling API. Use React Query mutation for API calls with automatic loading/error states.

### Complete Submission Flow

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // Step 1: Client-side validation
  const result = someSchema.safeParse(formData);

  if (!result.success) {
    // Extract and display validation errors
    const errors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
      if (issue.path[0]) {
        errors[issue.path[0] as string] = issue.message;
      }
    });
    setValidationErrors(errors);
    return; // Stop here - don't call API
  }

  // Step 2: API submission
  mutate(result.data, {
    onSuccess: (data) => {
      // Success handling
      queryClient.invalidateQueries({ queryKey: ['some-data'] });
      navigate('/success');
    },
    onError: (error) => {
      // Error handling (optional - mutation already tracks error state)
      console.error('Submission failed:', error);
    },
  });
};
```

### Using Mutation States in UI

```typescript
// Button with loading state
<FantasyButton
  type="submit"
  variant="primary"
  disabled={isPending}
>
  {isPending ? 'Saving...' : 'Save Changes'}
</FantasyButton>

// Success message
{isSuccess && (
  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
    <p className="text-green-700 text-sm text-center">
      {SUCCESS_MESSAGES.profile.updated}
    </p>
  </div>
)}

// API Error message
{isError && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
    <p className="text-red-700 text-sm text-center">
      {error?.message || 'Failed to submit. Please try again.'}
    </p>
  </div>
)}
```

**From ProfilePage.tsx (Lines 180-196, 325-346):**

**Key Points:**
1. **Validate first** - Check Zod schema before API call
2. **Use mutation states** - `isPending`, `isSuccess`, `isError` from React Query
3. **Disable during submission** - Prevent multiple submissions
4. **Show feedback** - Display success/error messages
5. **Type safety** - `result.data` is validated and typed

---

## Loading States

### Pattern: Multi-Level Loading States

**Overview:**
Handle loading at multiple levels: initial page load, form submission, and individual field operations.

### Page-Level Loading

```typescript
// Loading state for initial data fetch
if (isLoading) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-aged-bronze border-t-burnished-gold rounded-full animate-spin mx-auto mb-4" />
        <p className="fantasy-body text-aged-bronze">Loading profile...</p>
      </div>
    </div>
  );
}

// Error state for initial data fetch
if (isError) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
        <p className="text-red-700 text-center">
          {profileError?.message || 'Failed to load profile. Please try again.'}
        </p>
      </div>
    </div>
  );
}
```

**From ProfilePage.tsx (Lines 129-151):**

### Form Submission Loading

```typescript
// Button loading state
<FantasyButton
  type="submit"
  variant="primary"
  size="default"
  className="flex-1"
  disabled={isPending} // Disable during submission
>
  <Save className="w-4 h-4 mr-2" />
  {isPending ? UI_TEXT.profile.savingButton : UI_TEXT.profile.saveButton}
</FantasyButton>

// Cancel button also disabled during submission
<FantasyButton
  type="button"
  variant="secondary"
  size="default"
  className="flex-1"
  onClick={handleCancel}
  disabled={isPending} // Prevent cancel during submission
>
  <X className="w-4 h-4 mr-2" />
  {UI_TEXT.profile.cancelButton}
</FantasyButton>
```

**From ProfilePage.tsx (Lines 325-346):**

### Loading State Checklist

**✅ Always handle these loading states:**
- [ ] Initial data fetch (useQuery loading)
- [ ] Form submission (mutation isPending)
- [ ] Disable submit button during submission
- [ ] Disable cancel button during submission
- [ ] Show loading text on submit button
- [ ] Display spinner or loading indicator

---

## Cancel and Reset Patterns

### Pattern: Reset to Original Values

**Overview:**
Cancel button should reset form to original values (from API), not empty values. This is especially important for edit forms.

### Cancel Handler Implementation

```typescript
// Store original data from API
useEffect(() => {
  if (profileData?.user) {
    setFormData({
      username: profileData.user.username || '',
      bio: profileData.user.bio || '',
    });
  }
}, [profileData]);

// Cancel handler - reset to original values
const handleCancel = () => {
  if (profileData?.user) {
    setFormData({
      username: profileData.user.username || '',
      bio: profileData.user.bio || '',
    });
  }
  setValidationErrors({}); // Clear any validation errors
};
```

**From ProfilePage.tsx (Lines 70-77, 115-123):**

**Key Points:**
1. **Reset to API data** - Not empty values
2. **Clear validation errors** - Remove all error messages
3. **Disabled during submission** - Prevent cancel while submitting
4. **Same as initial load** - Use same initialization logic

### Alternative: Dirty State Tracking

For more complex forms, track if form has been modified:

```typescript
const [isDirty, setIsDirty] = useState(false);

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;
  setFormData((prev) => ({ ...prev, [name]: value }));
  setIsDirty(true); // Mark form as modified

  // Clear validation error
  if (validationErrors[name]) {
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }
};

const handleCancel = () => {
  if (profileData?.user) {
    setFormData({
      username: profileData.user.username || '',
      bio: profileData.user.bio || '',
    });
  }
  setValidationErrors({});
  setIsDirty(false); // Mark form as pristine
};

// Show cancel button only when form is dirty
{isDirty && (
  <FantasyButton
    type="button"
    variant="secondary"
    onClick={handleCancel}
  >
    Cancel
  </FantasyButton>
)}
```

---

## API Integration

### Pattern: React Query Mutation with Cache Invalidation

**Overview:**
Use React Query mutations for all API calls. Automatically invalidate cache after successful mutations.

### Custom Hook Pattern

```typescript
// hooks/useAuth.ts

/**
 * Hook for updating user profile
 * Invalidates profile cache on success
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: ProfileFormData) => authApi.updateProfile(data),
    onSuccess: (response) => {
      // Invalidate profile cache to refetch
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      // Update user in auth cache if needed
      queryClient.setQueryData(['user'], response.user);

      // Navigate or show success message
      // (handled in component with isSuccess state)
    },
    onError: (error) => {
      // Error handling
      console.error('Profile update failed:', error);
    },
  });
};
```

### Using the Hook in Components

```typescript
const ProfilePage: React.FC = () => {
  // Use the custom hook
  const { mutate: updateProfile, isPending, isSuccess, isError, error } = useUpdateProfile();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const result = profileSchema.safeParse(formData);
    if (!result.success) {
      setValidationErrors(/* ... */);
      return;
    }

    // Submit with validated data
    updateProfile(result.data);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Show success message */}
      {isSuccess && (
        <div className="bg-green-50">
          Profile updated successfully!
        </div>
      )}

      {/* Show API error */}
      {isError && (
        <div className="bg-red-50">
          {error?.message || 'Failed to update profile'}
        </div>
      )}

      {/* Form fields */}
    </form>
  );
};
```

**Key Points:**
1. **Custom hooks** - Encapsulate API calls and cache logic
2. **Cache invalidation** - Refetch related queries after mutation
3. **Optimistic updates** - Update cache immediately for better UX (optional)
4. **Error handling** - Display API errors to user

---

## Common Patterns Summary

### Complete Form Component Template

```typescript
import React, { useState, useEffect } from 'react';
import { User, Save, X } from 'lucide-react';
import { someSchema, type SomeFormData } from '../lib/validation-schemas';
import { useSomeData, useUpdateSomeData } from '../hooks/useSomeData';
import { UI_TEXT, SUCCESS_MESSAGES } from '../lib/constants';

const SomeFormPage: React.FC = () => {
  // 1. Fetch existing data
  const { data, isLoading, isError, error: fetchError } = useSomeData();

  // 2. Mutation for updates
  const { mutate, isPending, isSuccess, isError: isUpdateError, error: updateError } = useUpdateSomeData();

  // 3. Form state
  const [formData, setFormData] = useState<SomeFormData>({
    field1: '',
    field2: '',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // 4. Initialize form with API data
  useEffect(() => {
    if (data) {
      setFormData({
        field1: data.field1 || '',
        field2: data.field2 || '',
      });
    }
  }, [data]);

  // 5. Handle input change (with error clearing)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // 6. Handle form submission (validate-then-submit)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = someSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0] as string] = issue.message;
        }
      });
      setValidationErrors(errors);
      return;
    }

    mutate(result.data);
  };

  // 7. Handle cancel (reset to original)
  const handleCancel = () => {
    if (data) {
      setFormData({
        field1: data.field1 || '',
        field2: data.field2 || '',
      });
    }
    setValidationErrors({});
  };

  // 8. Loading state
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // 9. Error state
  if (isError) {
    return <div>Error: {fetchError?.message}</div>;
  }

  // 10. Render form
  return (
    <form onSubmit={handleSubmit}>
      {/* Success message */}
      {isSuccess && (
        <div className="bg-green-50">
          {SUCCESS_MESSAGES.someEntity.updated}
        </div>
      )}

      {/* API Error */}
      {isUpdateError && (
        <div className="bg-red-50">
          {updateError?.message || 'Failed to update'}
        </div>
      )}

      {/* Form fields */}
      <div className="space-y-1">
        <label htmlFor="field1">Field 1</label>
        <input
          id="field1"
          name="field1"
          value={formData.field1}
          onChange={handleChange}
        />
        {validationErrors.field1 && (
          <p className="text-red-600 text-xs">{validationErrors.field1}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
        >
          <Save className="w-4 h-4" />
          {isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
};

export default SomeFormPage;
```

---

## Decision Matrix: Form Patterns

| Requirement | Pattern | Implementation |
|-------------|---------|----------------|
| Controlled form inputs | `useState` for formData | `value={formData.field}` `onChange={handleChange}` |
| Type-safe validation | Zod schema in `validation-schemas.ts` | `schema.safeParse(formData)` |
| Inline error display | Per-field error messages | `{validationErrors.field && <p>{error}</p>}` |
| Clear error on type | Remove error in handleChange | `delete errors[name]` |
| API submission | React Query mutation | `useMutation({ mutationFn: apiCall })` |
| Loading state | Mutation `isPending` | `disabled={isPending}` |
| Success message | Mutation `isSuccess` | `{isSuccess && <SuccessMessage />}` |
| API error message | Mutation `isError`, `error` | `{isError && <ErrorMessage error={error} />}` |
| Cancel/Reset | Reset to original API data | `setFormData(originalData)` |
| Cache updates | Query invalidation | `queryClient.invalidateQueries()` |

---

## Best Practices Checklist

**✅ Form Setup:**
- [ ] Use controlled components with `useState`
- [ ] Separate state for form data and validation errors
- [ ] Initialize form data with `useEffect` when API data loads
- [ ] Use TypeScript types from Zod schemas (`z.infer<typeof schema>`)

**✅ Validation:**
- [ ] Define all validation rules in `validation-schemas.ts`
- [ ] Use `safeParse()` to validate before submission
- [ ] Map Zod errors to field-specific error messages
- [ ] Clear validation errors when user modifies field

**✅ Submission:**
- [ ] Validate client-side before calling API
- [ ] Use React Query mutation for API calls
- [ ] Disable submit button during submission
- [ ] Show loading text on button
- [ ] Display success/error messages

**✅ User Experience:**
- [ ] Handle initial page loading state
- [ ] Display inline validation errors
- [ ] Show API error messages
- [ ] Disable all buttons during submission
- [ ] Provide cancel/reset functionality

**✅ API Integration:**
- [ ] Create custom hooks for mutations
- [ ] Invalidate cache after successful mutation
- [ ] Handle both validation errors and API errors
- [ ] Use TypeScript for type safety

---

## Common Mistakes to Avoid

### ❌ WRONG: Not clearing errors on input change

```typescript
// BAD: Errors persist even after user fixes them
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;
  setFormData((prev) => ({ ...prev, [name]: value }));
  // Missing error clearing logic
};
```

### ✅ CORRECT: Clear errors when user types

```typescript
// GOOD: Errors disappear as user fixes them
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;
  setFormData((prev) => ({ ...prev, [name]: value }));

  if (validationErrors[name]) {
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }
};
```

---

### ❌ WRONG: Calling API without validation

```typescript
// BAD: No client-side validation
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  mutate(formData); // Sends invalid data to API
};
```

### ✅ CORRECT: Validate before API call

```typescript
// GOOD: Validate first, then submit
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  const result = someSchema.safeParse(formData);
  if (!result.success) {
    setValidationErrors(/* extract errors */);
    return; // Stop here
  }

  mutate(result.data); // Only submit valid data
};
```

---

### ❌ WRONG: Not disabling buttons during submission

```typescript
// BAD: User can submit multiple times
<button type="submit">
  Save
</button>
```

### ✅ CORRECT: Disable during submission

```typescript
// GOOD: Prevent multiple submissions
<button
  type="submit"
  disabled={isPending}
>
  {isPending ? 'Saving...' : 'Save'}
</button>
```

---

### ❌ WRONG: Resetting to empty values on cancel

```typescript
// BAD: Loses original data
const handleCancel = () => {
  setFormData({ field1: '', field2: '' });
};
```

### ✅ CORRECT: Reset to original API data

```typescript
// GOOD: Restores original values
const handleCancel = () => {
  if (originalData) {
    setFormData({
      field1: originalData.field1 || '',
      field2: originalData.field2 || '',
    });
  }
  setValidationErrors({});
};
```

---

## Related Documentation

- [validation-schemas.ts](../frontend/src/lib/validation-schemas.ts) - All Zod validation schemas
- [testing-patterns.md](./testing-patterns.md) - Form testing patterns
- [Epic 1 Retrospective](../sprint-artifacts/epic-1-retro-2025-12-05.md) - Lessons learned from authentication forms
- [Epic 2 Retrospective](../sprint-artifacts/epic-2-retro-2025-12-05.md) - Advanced form patterns
- [Sprint Status](../sprint-artifacts/sprint-status.yaml) - Action item tracking

---

**Maintained By:** Dev Team
**For Epic:** Epic 3 CRUD Operations
**Next Review:** After Story 3-1 (Horse List View)
**Status:** ✅ Complete
