/**
 * Auth Validation Schemas (Zod)
 *
 * Validates authentication form inputs.
 * Rules match backend validation (backend/routes/authRoutes.mjs).
 *
 * Backend validation rules:
 * - email: valid email format
 * - username: 3-30 chars, alphanumeric + underscore only
 * - password: min 8 chars, at least 1 lowercase, 1 uppercase, 1 number
 * - firstName: 1-50 chars
 * - lastName: 1-50 chars
 */

import { z } from 'zod';

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .toLowerCase()
  .trim();

/**
 * Username validation schema
 * Must be 3-30 chars, alphanumeric and underscore only
 */
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
  .trim();

/**
 * Password validation schema
 * Must be at least 8 chars with 1 lowercase, 1 uppercase, 1 number
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * First name validation schema
 */
export const firstNameSchema = z
  .string()
  .min(1, 'First name is required')
  .max(50, 'First name must be at most 50 characters')
  .trim();

/**
 * Last name validation schema
 */
export const lastNameSchema = z
  .string()
  .min(1, 'Last name is required')
  .max(50, 'Last name must be at most 50 characters')
  .trim();

/**
 * Login form schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Registration form schema
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
 * Forgot password form schema
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Reset password form schema
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
 * Profile update schema (all fields optional)
 */
export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  firstName: firstNameSchema.optional(),
  lastName: lastNameSchema.optional(),
});

/**
 * TypeScript types inferred from schemas
 */
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

/**
 * Password strength calculator
 * Returns a score from 0-4 based on password complexity
 */
export function calculatePasswordStrength(password: string): {
  score: number;
  label: 'weak' | 'fair' | 'good' | 'strong';
  color: string;
} {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Normalize to 0-4
  score = Math.min(4, score);

  const labels: Array<'weak' | 'fair' | 'good' | 'strong'> = [
    'weak',
    'weak',
    'fair',
    'good',
    'strong',
  ];
  const colors = [
    '#ef4444', // red
    '#ef4444', // red
    '#f59e0b', // amber
    '#22c55e', // green
    '#10b981', // emerald
  ];

  return {
    score,
    label: labels[score],
    color: colors[score],
  };
}
