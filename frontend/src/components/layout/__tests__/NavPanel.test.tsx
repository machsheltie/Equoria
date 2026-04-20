/**
 * NavPanel — beta-agnostic navigation (Story 22-8 refresh)
 *
 * All routes are exposed unconditionally. Tests verify the full nav set
 * renders without any beta-mode filter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NavPanel } from '../NavPanel';

const renderPanel = (isOpen = true) =>
  render(
    <MemoryRouter>
      <NavPanel isOpen={isOpen} onClose={vi.fn()} />
    </MemoryRouter>
  );

describe('NavPanel — full navigation exposure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows /community link', () => {
    renderPanel();
    expect(screen.getByRole('link', { name: /community/i })).toBeInTheDocument();
  });

  it('shows /stable link', () => {
    renderPanel();
    expect(screen.getByRole('link', { name: /my stable/i })).toBeInTheDocument();
  });

  it('shows /training link', () => {
    renderPanel();
    expect(screen.getByRole('link', { name: /training/i })).toBeInTheDocument();
  });

  it('shows /bank link', () => {
    renderPanel();
    expect(screen.getByRole('link', { name: /bank/i })).toBeInTheDocument();
  });

  it('renders null when isOpen is false', () => {
    renderPanel(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
