/**
 * Password Strength Indicator Component
 *
 * Displays password strength with visual bar and requirement checklist.
 * Used in registration and password reset forms.
 *
 * Story 1.1: User Registration - Task 2 Component Extraction
 */

import React, { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { calculatePasswordStrength } from '../../lib/validations/auth';

// =============================================================================
// Types
// =============================================================================

export interface PasswordStrengthProps {
  /** The password to evaluate */
  password: string;
  /** Optional className for the container */
  className?: string;
  /** Whether to show the requirements checklist */
  showRequirements?: boolean;
}

export interface PasswordRequirements {
  minLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
}

// =============================================================================
// Helper Components
// =============================================================================

interface RequirementCheckProps {
  met: boolean;
  label: string;
}

/**
 * Individual requirement check item
 */
const RequirementCheck: React.FC<RequirementCheckProps> = ({ met, label }) => (
  <div className="flex items-center gap-2 text-xs" data-testid={`requirement-${label.toLowerCase().replace(/\s+/g, '-').replace(/\+/g, '')}`}>
    {met ? (
      <Check className="w-3 h-3 text-forest-green" aria-hidden="true" />
    ) : (
      <X className="w-3 h-3 text-red-500" aria-hidden="true" />
    )}
    <span className={met ? 'text-forest-green' : 'text-aged-bronze'}>{label}</span>
  </div>
);

// =============================================================================
// Main Component
// =============================================================================

/**
 * Password Strength Indicator
 *
 * Displays:
 * - Visual strength bar (0-100% based on score 0-4)
 * - Strength label (weak/fair/good/strong)
 * - Requirements checklist (optional)
 *
 * @example
 * ```tsx
 * <PasswordStrength password={password} showRequirements />
 * ```
 */
export const PasswordStrength: React.FC<PasswordStrengthProps> = ({
  password,
  className = '',
  showRequirements = true,
}) => {
  // Calculate password strength
  const strength = useMemo(() => calculatePasswordStrength(password), [password]);

  // Calculate requirements status
  const requirements = useMemo<PasswordRequirements>(() => ({
    minLength: password.length >= 8,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  }), [password]);

  // Don't render if no password
  if (!password) {
    return null;
  }

  return (
    <div className={`space-y-2 pt-2 ${className}`} data-testid="password-strength">
      {/* Strength Bar */}
      <div className="flex items-center gap-2" role="group" aria-label="Password strength indicator">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300 rounded-full"
            style={{
              width: `${(strength.score / 4) * 100}%`,
              backgroundColor: strength.color,
            }}
            role="progressbar"
            aria-valuenow={strength.score}
            aria-valuemin={0}
            aria-valuemax={4}
            aria-label={`Password strength: ${strength.label}`}
            data-testid="password-strength-bar"
          />
        </div>
        <span
          className="text-xs font-medium capitalize"
          style={{ color: strength.color }}
          data-testid="password-strength-label"
        >
          {strength.label}
        </span>
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="grid grid-cols-2 gap-1" role="list" aria-label="Password requirements">
          <RequirementCheck met={requirements.minLength} label="8+ characters" />
          <RequirementCheck met={requirements.hasLowercase} label="Lowercase" />
          <RequirementCheck met={requirements.hasUppercase} label="Uppercase" />
          <RequirementCheck met={requirements.hasNumber} label="Number" />
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default PasswordStrength;
