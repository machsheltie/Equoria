/**
 * FormField — label/error/aria wiring tests (Equoria-o5hub.12)
 *
 * Critical assertions: when error is present →
 *   - error text is visible
 *   - child has aria-invalid="true"
 *   - child has aria-describedby pointing at the error element's id
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { FormField } from '../FormField';
import { Input } from '../Input';

function TestField({
  error,
  required,
  description,
}: {
  error?: string;
  required?: boolean;
  description?: string;
}) {
  return (
    <FormField label="Horse Name" error={error} required={required} description={description}>
      {(fieldProps) => <Input data-testid="ctrl" {...fieldProps} />}
    </FormField>
  );
}

describe('FormField', () => {
  it('renders a <label> with the provided label text', () => {
    render(<TestField />);
    expect(screen.getByText('Horse Name')).toBeInTheDocument();
  });

  it('label htmlFor matches the control id', () => {
    render(<TestField />);
    const label = screen.getByText('Horse Name').closest('label');
    const ctrl = screen.getByTestId('ctrl');
    expect(label).toHaveAttribute('for', ctrl.id);
  });

  it('clicking the label focuses the input', async () => {
    const user = userEvent.setup();
    render(<TestField />);
    await user.click(screen.getByText('Horse Name'));
    expect(screen.getByTestId('ctrl')).toHaveFocus();
  });

  it('no error: child does NOT have aria-invalid', () => {
    render(<TestField />);
    expect(screen.getByTestId('ctrl')).not.toHaveAttribute('aria-invalid');
  });

  it('error: error message is visible', () => {
    render(<TestField error="Name is required" />);
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('error: child has aria-invalid=true', () => {
    render(<TestField error="Name is required" />);
    expect(screen.getByTestId('ctrl')).toHaveAttribute('aria-invalid', 'true');
  });

  it('error: child aria-describedby points at the error element id', () => {
    render(<TestField error="Name is required" />);
    const ctrl = screen.getByTestId('ctrl');
    const ariaDescribedby = ctrl.getAttribute('aria-describedby');
    expect(ariaDescribedby).toBeTruthy();
    const errorEl = document.getElementById(ariaDescribedby!);
    expect(errorEl).not.toBeNull();
    expect(errorEl!.textContent).toBe('Name is required');
  });

  it('error: error text has role=alert', () => {
    render(<TestField error="Name is required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
  });

  it('error: error text uses text-role-danger class', () => {
    render(<TestField error="Name is required" />);
    expect(screen.getByRole('alert').className).toContain('text-role-danger');
  });

  it('required: adds visual asterisk', () => {
    render(<TestField required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('required: asterisk has aria-hidden', () => {
    render(<TestField required />);
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('required: child has aria-required=true', () => {
    render(<TestField required />);
    expect(screen.getByTestId('ctrl')).toHaveAttribute('aria-required', 'true');
  });

  it('description: renders description text', () => {
    render(<TestField description="Up to 50 characters" />);
    expect(screen.getByText('Up to 50 characters')).toBeInTheDocument();
  });

  it('description: child aria-describedby points at description element', () => {
    render(<TestField description="Up to 50 characters" />);
    const ctrl = screen.getByTestId('ctrl');
    const describedby = ctrl.getAttribute('aria-describedby');
    expect(describedby).toBeTruthy();
    const descEl = document.getElementById(describedby!);
    expect(descEl).not.toBeNull();
    expect(descEl!.textContent).toBe('Up to 50 characters');
  });

  it('both error and description: aria-describedby includes both ids', () => {
    render(<TestField error="Required" description="Help text" />);
    const ctrl = screen.getByTestId('ctrl');
    const describedby = ctrl.getAttribute('aria-describedby') ?? '';
    const ids = describedby.split(' ');
    expect(ids.length).toBe(2);
    // Both elements should exist in the DOM
    ids.forEach((id) => expect(document.getElementById(id)).not.toBeNull());
  });

  it('no error: no aria-describedby when neither error nor description', () => {
    render(<TestField />);
    expect(screen.getByTestId('ctrl')).not.toHaveAttribute('aria-describedby');
  });

  it('error: clearing error removes aria-invalid', () => {
    const { rerender } = render(<TestField error="bad" />);
    expect(screen.getByTestId('ctrl')).toHaveAttribute('aria-invalid', 'true');
    rerender(<TestField />);
    expect(screen.getByTestId('ctrl')).not.toHaveAttribute('aria-invalid');
  });
});
