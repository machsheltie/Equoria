/**
 * Validation Schemas (Zod)
 *
 * Centralized validation schemas for all form inputs across the application.
 * All schemas use Zod for runtime validation and TypeScript type inference.
 *
 * Epic 1: Authentication Forms
 * Epic 2: Profile Management
 *
 * Related: VALIDATION_RULES and VALIDATION_ERRORS in constants.ts
 */

import { z } from 'zod';

// =============================================================================
// Base Field Schemas
// =============================================================================

/**
 * Email validation schema
 *
 * Rules:
 * - Required (non-empty)
 * - Valid email format (RFC 5322 compliant)
 * - Automatically lowercased and trimmed
 *
 * @example
 * const result = emailSchema.safeParse('user@example.com');
 * if (result.success) {
 *   console.log(result.data); // 'user@example.com'
 * }
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .toLowerCase()
  .trim();

/**
 * Username validation schema
 *
 * Rules:
 * - 3-30 characters
 * - Alphanumeric and underscore only (a-zA-Z0-9_)
 * - Automatically trimmed
 *
 * @example
 * const result = usernameSchema.safeParse('john_doe123');
 * if (result.success) {
 *   console.log(result.data); // 'john_doe123'
 * }
 */
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
  .trim();

/**
 * Password validation schema (full validation)
 *
 * Rules:
 * - Minimum 8 characters
 * - At least 1 lowercase letter (a-z)
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 number (0-9)
 *
 * Used for: Registration, Password Reset
 *
 * @example
 * const result = passwordSchema.safeParse('SecurePass123');
 * if (result.success) {
 *   console.log('Password meets all requirements');
 * }
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * First name validation schema
 *
 * Rules:
 * - Required (non-empty)
 * - Maximum 50 characters
 * - Automatically trimmed
 *
 * @example
 * const result = firstNameSchema.safeParse('John');
 */
export const firstNameSchema = z
  .string()
  .min(1, 'First name is required')
  .max(50, 'First name must be at most 50 characters')
  .trim();

/**
 * Last name validation schema
 *
 * Rules:
 * - Required (non-empty)
 * - Maximum 50 characters
 * - Automatically trimmed
 *
 * @example
 * const result = lastNameSchema.safeParse('Doe');
 */
export const lastNameSchema = z
  .string()
  .min(1, 'Last name is required')
  .max(50, 'Last name must be at most 50 characters')
  .trim();

/**
 * Display name validation schema
 *
 * Rules:
 * - 3-30 characters
 * - Used for profile display names
 *
 * @example
 * const result = displayNameSchema.safeParse('Johnny');
 */
export const displayNameSchema = z
  .string()
  .min(3, 'Display name must be at least 3 characters')
  .max(30, 'Display name must be at most 30 characters')
  .trim();

/**
 * Bio validation schema
 *
 * Rules:
 * - Optional field
 * - Maximum 500 characters
 * - Can be empty string
 *
 * @example
 * const result = bioSchema.safeParse('I love horses!');
 */
export const bioSchema = z
  .string()
  .max(500, 'Bio must be at most 500 characters')
  .optional()
  .or(z.literal(''));

// =============================================================================
// Form Schemas
// =============================================================================

/**
 * Login form validation schema
 *
 * Used by: LoginPage
 * Story: 1.2 - User Login
 *
 * Fields:
 * - email: Required, valid email format
 * - password: Required (no complexity validation for login)
 *
 * @example
 * const result = loginSchema.safeParse({
 *   email: 'user@example.com',
 *   password: 'password123'
 * });
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Registration form validation schema
 *
 * Used by: RegisterPage
 * Story: 1.1 - User Registration
 *
 * Fields:
 * - email: Required, valid email format
 * - username: Required, 3-30 chars, alphanumeric + underscore
 * - password: Required, 8+ chars, 1 lowercase, 1 uppercase, 1 number
 * - confirmPassword: Required, must match password
 * - firstName: Required, max 50 chars
 * - lastName: Required, max 50 chars
 *
 * Refinement: Validates password and confirmPassword match
 *
 * @example
 * const result = registerSchema.safeParse({
 *   email: 'user@example.com',
 *   username: 'johndoe',
 *   password: 'SecurePass123',
 *   confirmPassword: 'SecurePass123',
 *   firstName: 'John',
 *   lastName: 'Doe'
 * });
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
    path: ['confirmPassword'],
  });

/**
 * Forgot password form validation schema
 *
 * Used by: ForgotPasswordPage
 * Story: 1.3 - Password Reset
 *
 * Fields:
 * - email: Required, valid email format
 *
 * @example
 * const result = forgotPasswordSchema.safeParse({
 *   email: 'user@example.com'
 * });
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Reset password form validation schema
 *
 * Used by: ResetPasswordPage
 * Story: 1.3 - Password Reset
 *
 * Fields:
 * - password: Required, 8+ chars, 1 lowercase, 1 uppercase, 1 number
 * - confirmPassword: Required, must match password
 *
 * Refinement: Validates password and confirmPassword match
 *
 * @example
 * const result = resetPasswordSchema.safeParse({
 *   password: 'NewSecurePass123',
 *   confirmPassword: 'NewSecurePass123'
 * });
 */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Profile update form validation schema
 *
 * Used by: ProfilePage
 * Story: 2.1 - Profile Management
 *
 * Fields:
 * - username: Required, 3-30 chars (used as display name)
 * - bio: Optional, max 500 chars
 *
 * Note: This schema uses username for the display name field
 *
 * @example
 * const result = profileSchema.safeParse({
 *   username: 'JohnDoe',
 *   bio: 'I love horses!'
 * });
 */
export const profileSchema = z.object({
  username: displayNameSchema,
  bio: bioSchema,
});

/**
 * Full profile update schema (all fields optional)
 *
 * Used by: Future profile edit endpoints
 *
 * Fields:
 * - username: Optional, 3-30 chars, alphanumeric + underscore
 * - firstName: Optional, max 50 chars
 * - lastName: Optional, max 50 chars
 *
 * @example
 * const result = updateProfileSchema.safeParse({
 *   username: 'johndoe',
 *   firstName: 'John'
 * });
 */
export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  firstName: firstNameSchema.optional(),
  lastName: lastNameSchema.optional(),
});

// =============================================================================
// TypeScript Type Exports
// =============================================================================

/**
 * TypeScript type for login form data
 */
export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * TypeScript type for registration form data
 */
export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * TypeScript type for forgot password form data
 */
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * TypeScript type for reset password form data
 */
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

/**
 * TypeScript type for profile form data (Epic 2)
 */
export type ProfileFormData = z.infer<typeof profileSchema>;

/**
 * TypeScript type for full profile update data
 */
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate password strength based on complexity
 *
 * Scoring:
 * - 0-1: Weak (red)
 * - 2: Fair (amber)
 * - 3: Good (green)
 * - 4: Strong (emerald)
 *
 * Criteria:
 * - Length >= 8 chars: +1 point
 * - Length >= 12 chars: +1 point
 * - Mixed case (uppercase + lowercase): +1 point
 * - Contains number: +1 point
 * - Contains special character: +1 point
 *
 * @param password - The password to evaluate
 * @returns Object with score (0-4), label, and color
 *
 * @example
 * const strength = calculatePasswordStrength('SecurePass123!');
 * console.log(strength); // { score: 4, label: 'strong', color: '#10b981' }
 */
export function calculatePasswordStrength(password: string): {
  score: number;
  label: 'weak' | 'fair' | 'good' | 'strong';
  color: string;
} {
  let score = 0;

  // Length checks
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  // Character type checks
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Normalize to 0-4
  score = Math.min(4, score);

  // Labels and colors
  const labels: Array<'weak' | 'fair' | 'good' | 'strong'> = [
    'weak',
    'weak',
    'fair',
    'good',
    'strong',
  ];
  const colors = [
    '#ef4444', // red-500 (weak)
    '#ef4444', // red-500 (weak)
    '#f59e0b', // amber-500 (fair)
    '#22c55e', // green-500 (good)
    '#10b981', // emerald-500 (strong)
  ];

  return {
    score,
    label: labels[score],
    color: colors[score],
  };
}
