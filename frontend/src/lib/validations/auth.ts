/**
 * Auth Validation Schemas — Re-export shim
 *
 * All schemas and utilities have moved to lib/validation-schemas.ts.
 * This file is kept as a compatibility shim; do not add new exports here.
 *
 * @deprecated Import directly from 'lib/validation-schemas' instead.
 */
export {
  emailSchema,
  usernameSchema,
  passwordSchema,
  firstNameSchema,
  lastNameSchema,
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  calculatePasswordStrength,
  type LoginFormData,
  type RegisterFormData,
  type ForgotPasswordFormData,
  type ResetPasswordFormData,
  type UpdateProfileFormData,
} from '../validation-schemas';
