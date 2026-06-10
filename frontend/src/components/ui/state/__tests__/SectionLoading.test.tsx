/**
 * SectionLoading component tests (D-15)
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { SectionLoading } from '../SectionLoading';

describe('SectionLoading', () => {
  it('renders with role="status"', () => {
    render(<SectionLoading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has default aria-live="polite"', () => {
    render(<SectionLoading />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-live', 'polite');
  });

  it('has default aria-label of "Loading"', () => {
    render(<SectionLoading />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('uses custom label for aria-label', () => {
    render(<SectionLoading label="Loading horses" />);
    expect(screen.getByRole('status', { name: 'Loading horses' })).toBeInTheDocument();
  });

  it('renders visually-hidden label text', () => {
    render(<SectionLoading label="Loading stable" />);
    const srOnly = document.querySelector('.sr-only');
    expect(srOnly).toBeInTheDocument();
    expect(srOnly?.textContent).toBe('Loading stable');
  });

  it('applies minHeight style via prop', () => {
    render(<SectionLoading minHeight="200px" />);
    const el = screen.getByRole('status');
    expect(el).toHaveStyle({ minHeight: '200px' });
  });

  it('applies default minHeight of 120px', () => {
    render(<SectionLoading />);
    const el = screen.getByRole('status');
    expect(el).toHaveStyle({ minHeight: '120px' });
  });

  it('applies custom className', () => {
    render(<SectionLoading className="test-class" />);
    expect(screen.getByRole('status')).toHaveClass('test-class');
  });

  it('renders a spinner (aria-hidden)', () => {
    render(<SectionLoading />);
    // The spinner div is aria-hidden; query by attribute
    const spinner = document.querySelector('[aria-hidden="true"]');
    expect(spinner).toBeInTheDocument();
  });
});
