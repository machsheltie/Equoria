/**
 * NavPanel — full-exposure regression test (post-22-8)
 *
 * Confirms all 14 navigation items render unconditionally. Beta-mode
 * filtering has been removed — all routes are `beta-live` and must be
 * reachable by testers.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NavPanel } from '../NavPanel';

function renderNavPanel(props = {}) {
  return render(
    <MemoryRouter>
      <NavPanel isOpen={true} onClose={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

describe('NavPanel — full exposure', () => {
  it('shows every primary nav link regardless of environment', () => {
    renderNavPanel();

    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my stable/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /training/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /competitions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /breeding/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /marketplace/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /messages/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /bank/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /world/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /community/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /riders/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /leaderboards/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
  });
});
