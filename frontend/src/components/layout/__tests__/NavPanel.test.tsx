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
    // D-27 (Equoria-o5hub.20 / DECISIONS.md §10): nav label is "Stable"
    expect(screen.getByRole('link', { name: /^stable$/i })).toBeInTheDocument();
  });

  it('shows /inventory link', () => {
    // A13 (feed-system redesign 2026-04-29) swapped Training off the main
    // nav and promoted Inventory; Training remains a route-only registration
    // accessible by direct URL but no longer appears in NavPanel.
    renderPanel();
    expect(screen.getByRole('link', { name: /inventory/i })).toBeInTheDocument();
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
