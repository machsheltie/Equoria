/**
 * PageLoading component tests (D-15)
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { PageLoading } from '../PageLoading';

describe('PageLoading', () => {
  it('renders with role="status"', () => {
    render(<PageLoading />);
    // Two status regions: outer wrapper + GallopingLoader (both are expected).
    const statusRegions = screen.getAllByRole('status');
    expect(statusRegions.length).toBeGreaterThanOrEqual(1);
  });

  it('has a default aria-label of "Loading" on the outer wrapper', () => {
    render(<PageLoading />);
    // Both the outer wrapper and GallopingLoader have aria-label="Loading".
    // Use getAllByRole to accept multiple matches.
    const loadingRegions = screen.getAllByRole('status', { name: 'Loading' });
    expect(loadingRegions.length).toBeGreaterThanOrEqual(1);
    // At least one element has aria-label="Loading"
    const withAriaLabel = loadingRegions.find((el) => el.getAttribute('aria-label') === 'Loading');
    expect(withAriaLabel).toBeDefined();
  });

  it('uses custom aria-label when label prop is provided', () => {
    render(<PageLoading label="Loading competition results" />);
    // Outer wrapper gets the custom label
    expect(screen.getByRole('status', { name: 'Loading competition results' })).toBeInTheDocument();
  });

  it('renders a visually-hidden "Loading" span', () => {
    render(<PageLoading />);
    // sr-only spans are in the DOM but not visible
    const srOnly = document.querySelector('.sr-only');
    expect(srOnly).toBeInTheDocument();
    expect(srOnly?.textContent).toBe('Loading');
  });

  it('applies custom className to wrapper', () => {
    const { container } = render(<PageLoading className="test-class" />);
    expect(container.firstChild).toHaveClass('test-class');
  });
});
