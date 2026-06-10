/**
 * PasswordInput — Input + show/hide toggle (Equoria-o5hub.12 / D-13)
 *
 * Matches the LoginPage / RegisterPage pattern: Eye/EyeOff icon button,
 * aria-label toggles, aria-pressed on the toggle button.
 * The container adds relative positioning; the toggle is absolutely placed.
 */
import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input, type InputProps } from './Input';

export type PasswordInputProps = Omit<InputProps, 'type'>;

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          className={cn('pr-10', className)}
          {...props}
        />
        <button
          type="button"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showPassword}
          onClick={() => setShowPassword((v) => !v)}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2',
            'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-[var(--gold-primary)] focus-visible:rounded-sm'
          )}
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
