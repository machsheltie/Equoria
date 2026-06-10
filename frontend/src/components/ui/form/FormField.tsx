/**
 * FormField — Label + description + error wrapper (Equoria-o5hub.12 / D-13)
 *
 * Approach: render-prop injection (children-as-function) rather than React.cloneElement.
 * Rationale: cloneElement requires the child to be a single React element and silently
 * fails when children are fragments or arrays; render-prop is explicit and type-safe.
 *
 * Usage:
 *   <FormField label="Horse Name" error={errors.name}>
 *     {({ id, 'aria-describedby': ariaDescribedby, 'aria-invalid': ariaInvalid }) => (
 *       <Input id={id} aria-describedby={ariaDescribedby} aria-invalid={ariaInvalid} />
 *     )}
 *   </FormField>
 *
 * All aria wiring is generated and passed into the render prop — consumers do not
 * need to manage IDs manually.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FormFieldChildProps {
  /** Stable generated id for the control */
  id: string;
  /** Points at the error message element when error is present */
  'aria-describedby'?: string;
  /** true when error is present */
  'aria-invalid'?: true;
  /** true when required */
  'aria-required'?: true;
}

export interface FormFieldProps {
  /** Label text rendered in a <label> element */
  label: string;
  /** Overrides the generated id for the child control */
  htmlFor?: string;
  /** Optional description text below the label */
  description?: string;
  /** Marks the field as required — adds aria-required + visual asterisk */
  required?: boolean;
  /** Error message — when provided, renders in danger role color + wires aria-invalid */
  error?: string | null;
  className?: string;
  children: (props: FormFieldChildProps) => React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  description,
  required,
  error,
  className,
  children,
}) => {
  const generatedId = React.useId();
  const controlId = htmlFor ?? generatedId;
  const errorId = `${controlId}-error`;
  const descriptionId = description ? `${controlId}-desc` : undefined;

  const ariaDescribedby =
    [error ? errorId : null, descriptionId].filter(Boolean).join(' ') || undefined;

  const childProps: FormFieldChildProps = {
    id: controlId,
    ...(ariaDescribedby ? { 'aria-describedby': ariaDescribedby } : {}),
    ...(error ? { 'aria-invalid': true as const } : {}),
    ...(required ? { 'aria-required': true as const } : {}),
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* Label row */}
      <label
        htmlFor={controlId}
        className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider"
      >
        {label}
        {required && (
          <>
            {' '}
            <span aria-hidden="true" className="text-[var(--status-danger)]">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        )}
      </label>

      {/* Description */}
      {description && (
        <p id={descriptionId} className="text-xs text-[var(--text-muted)]">
          {description}
        </p>
      )}

      {/* Control slot — render prop */}
      {children(childProps)}

      {/* Error message */}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-role-danger">
          {error}
        </p>
      )}
    </div>
  );
};

FormField.displayName = 'FormField';

export { FormField };
