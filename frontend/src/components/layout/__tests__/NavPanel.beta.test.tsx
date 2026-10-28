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
import { MemoryRouter } from 'react-router';
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
    // D-27 (Equoria-o5hub.20 / DECISIONS.md §10): nav label is "Stable"
    expect(screen.getByRole('link', { name: /^stable$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /inventory/i })).toBeInTheDocument();
    // Owner ruling 2026-10-28 (q249, Equoria-m5ml8): Compete holds Ridden Shows and
    // Conformation Shows. Old contract: one Competitions link.
    expect(screen.getByRole('link', { name: 'Ridden Shows' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Conformation Shows' })).toBeInTheDocument();
    // Owner ruling 2026-10-26 (q89, Equoria-q4uem.9): the Breeding Hall is gone; breeding
    // happens on a stallion's page. Old contract: Breeding was a nav link.
    expect(screen.queryByRole('link', { name: /breeding/i })).not.toBeInTheDocument();
    // q249 adds Horse Marketplace beside Marketplace, so the name is matched exactly.
    expect(screen.getByRole('link', { name: 'Marketplace' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /messages/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /bank/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /world/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /community/i })).toBeInTheDocument();
    // Owner ruling 2026-10-28 (q249, Equoria-m5ml8): Grooms, Riders and Trainers are
    // listed under Marketplace, all for hire. Old contract (q96): no Riders link.
    expect(screen.getByRole('link', { name: 'Riders' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /leaderboards/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
  });
});
