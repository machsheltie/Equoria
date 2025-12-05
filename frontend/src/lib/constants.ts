/**
 * Application Constants
 *
 * Centralized constants for error messages, validation rules,
 * and configuration values used across the application.
 *
 * Story 1.1: User Registration - Task 1 Foundation
 * Story 2.1: Profile Management - Added profileSchema
 */

import { z } from 'zod';

// =============================================================================
// Validation Rules
// =============================================================================

export const VALIDATION_RULES = {
  email: {
    minLength: 1,
    maxLength: 255,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  username: {
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_]+$/,
  },
  password: {
    minLength: 8,
    maxLength: 128,
    requireLowercase: true,
    requireUppercase: true,
    requireNumber: true,
    patterns: {
      lowercase: /[a-z]/,
      uppercase: /[A-Z]/,
      number: /[0-9]/,
      special: /[^a-zA-Z0-9]/,
    },
  },
  firstName: {
    minLength: 1,
    maxLength: 50,
  },
  lastName: {
    minLength: 1,
    maxLength: 50,
  },
  displayName: {
    minLength: 3,
    maxLength: 30,
  },
  bio: {
    maxLength: 500,
  },
} as const;

// =============================================================================
// Error Messages - Validation
// =============================================================================

export const VALIDATION_ERRORS = {
  // Email
  email: {
    required: 'Email is required',
    invalid: 'Please enter a valid email address',
    tooLong: `Email must be at most ${VALIDATION_RULES.email.maxLength} characters`,
  },
  // Username
  username: {
    required: 'Username is required',
    tooShort: `Username must be at least ${VALIDATION_RULES.username.minLength} characters`,
    tooLong: `Username must be at most ${VALIDATION_RULES.username.maxLength} characters`,
    invalidFormat: 'Username can only contain letters, numbers, and underscores',
  },
  // Password
  password: {
    required: 'Password is required',
    tooShort: `Password must be at least ${VALIDATION_RULES.password.minLength} characters`,
    tooLong: `Password must be at most ${VALIDATION_RULES.password.maxLength} characters`,
    missingLowercase: 'Password must contain at least one lowercase letter',
    missingUppercase: 'Password must contain at least one uppercase letter',
    missingNumber: 'Password must contain at least one number',
  },
  // Confirm Password
  confirmPassword: {
    required: 'Please confirm your password',
    mismatch: 'Passwords do not match',
  },
  // First Name
  firstName: {
    required: 'First name is required',
    tooLong: `First name must be at most ${VALIDATION_RULES.firstName.maxLength} characters`,
  },
  // Last Name
  lastName: {
    required: 'Last name is required',
    tooLong: `Last name must be at most ${VALIDATION_RULES.lastName.maxLength} characters`,
  },
  // Display Name
  displayName: {
    required: 'Display name is required',
    tooShort: `Display name must be at least ${VALIDATION_RULES.displayName.minLength} characters`,
    tooLong: `Display name must be at most ${VALIDATION_RULES.displayName.maxLength} characters`,
  },
  // Bio
  bio: {
    tooLong: `Bio must be at most ${VALIDATION_RULES.bio.maxLength} characters`,
  },
} as const;

// =============================================================================
// Error Messages - API
// =============================================================================

export const API_ERRORS = {
  // Authentication
  auth: {
    invalidCredentials: 'Invalid email or password',
    emailExists: 'Email already registered',
    usernameExists: 'Username already taken',
    accountLocked: 'Account temporarily locked. Please try again later.',
    emailNotVerified: 'Please verify your email address',
    tokenExpired: 'Session expired. Please log in again.',
    tokenInvalid: 'Invalid session. Please log in again.',
  },
  // Server
  server: {
    internal: 'An unexpected error occurred. Please try again.',
    unavailable: 'Service temporarily unavailable. Please try again later.',
    maintenance: 'System under maintenance. Please try again later.',
  },
  // Network
  network: {
    offline: 'No internet connection. Please check your network.',
    timeout: 'Request timed out. Please try again.',
    generic: 'Network error. Please check your connection and try again.',
  },
  // Rate Limiting
  rateLimit: {
    exceeded: 'Too many requests. Please wait a moment and try again.',
    authExceeded: 'Too many login attempts. Please try again later.',
  },
} as const;

// =============================================================================
// Success Messages
// =============================================================================

export const SUCCESS_MESSAGES = {
  auth: {
    registered: 'Registration successful! Please check your email to verify your account.',
    loggedIn: 'Welcome back!',
    loggedOut: 'You have been logged out.',
    passwordReset: 'Password reset email sent. Please check your inbox.',
    passwordChanged: 'Password changed successfully.',
    emailVerified: 'Email verified successfully!',
  },
  profile: {
    updated: 'Profile updated successfully.',
  },
} as const;

// =============================================================================
// Password Strength
// =============================================================================

export const PASSWORD_STRENGTH = {
  levels: ['weak', 'weak', 'fair', 'good', 'strong'] as const,
  colors: {
    weak: '#ef4444', // red-500
    fair: '#f59e0b', // amber-500
    good: '#22c55e', // green-500
    strong: '#10b981', // emerald-500
  },
  requirements: [
    { key: 'minLength', label: '8+ characters', check: (pw: string) => pw.length >= 8 },
    { key: 'hasLowercase', label: 'Lowercase', check: (pw: string) => /[a-z]/.test(pw) },
    { key: 'hasUppercase', label: 'Uppercase', check: (pw: string) => /[A-Z]/.test(pw) },
    { key: 'hasNumber', label: 'Number', check: (pw: string) => /[0-9]/.test(pw) },
  ],
} as const;

// =============================================================================
// UI Text
// =============================================================================

export const UI_TEXT = {
  profile: {
    title: 'My Profile',
    subtitle: 'Manage your profile information',
    displayNameLabel: 'Display Name',
    displayNamePlaceholder: 'Enter your display name',
    bioLabel: 'Bio',
    bioPlaceholder: 'Tell us about yourself...',
    avatarLabel: 'Profile Picture',
    saveButton: 'Save Changes',
    savingButton: 'Saving...',
    cancelButton: 'Cancel',
    charactersRemaining: (count: number) => `${count} characters remaining`,
  },
  auth: {
    login: {
      title: 'Welcome Back',
      subtitle: 'Sign in to continue your journey',
      submitButton: 'Sign In',
      loadingButton: 'Signing In...',
      registerPrompt: "Don't have an account?",
      registerLink: 'Create Account',
      forgotPassword: 'Forgot password?',
    },
    register: {
      title: 'Join the Realm',
      subtitle: 'Create your account and begin your journey',
      submitButton: 'Begin Your Journey',
      loadingButton: 'Creating Account...',
      loginPrompt: 'Already have an account?',
      loginLink: 'Sign In',
    },
    forgotPassword: {
      title: 'Reset Password',
      subtitle: 'Enter your email to receive reset instructions',
      submitButton: 'Send Reset Link',
      loadingButton: 'Sending...',
      backToLogin: 'Back to Sign In',
    },
    resetPassword: {
      title: 'Create New Password',
      subtitle: 'Enter your new password below',
      submitButton: 'Reset Password',
      loadingButton: 'Resetting...',
    },
    verifyEmail: {
      title: 'Verify Your Email',
      subtitle: 'Please check your email for the verification link',
      resendButton: 'Resend Email',
      resendLoadingButton: 'Sending...',
    },
  },
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    retry: 'Try Again',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
  },
} as const;

// =============================================================================
// Routes
// =============================================================================

export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  profile: '/profile',
  horses: '/horses',
  training: '/training',
  competitions: '/competitions',
  breeding: '/breeding',
  grooms: '/grooms',
} as const;

// =============================================================================
// API Endpoints
// =============================================================================

export const API_ENDPOINTS = {
  auth: {
    login: '/api/v1/auth/login',
    register: '/api/v1/auth/register',
    logout: '/api/v1/auth/logout',
    refresh: '/api/v1/auth/refresh',
    profile: '/api/v1/auth/me',
    forgotPassword: '/api/v1/auth/forgot-password',
    resetPassword: '/api/v1/auth/reset-password',
    verifyEmail: '/api/v1/auth/verify-email',
    resendVerification: '/api/v1/auth/resend-verification',
  },
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type PasswordStrengthLevel = (typeof PASSWORD_STRENGTH.levels)[number];
export type Route = (typeof ROUTES)[keyof typeof ROUTES];

// =============================================================================
// Zod Validation Schemas
// =============================================================================

// NOTE: All validation schemas have been moved to validation-schemas.ts
// See: frontend/src/lib/validation-schemas.ts
