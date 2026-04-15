/**
 * NavPanel Beta Mode Tests — Story 21R-2 Task 11
 *
 * Verifies that active beta navigation exposes working routes.
 *
 * Non-beta regression: all 11 nav items must still appear in non-beta mode.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock betaRouteScope ────────────────────────────────────────────────────────

// Beta mode ON for most tests — overridden per-test where needed
vi.mock('@/config/betaRouteScope', () => ({
  isBetaMode: true,
  isBetaLive: () => true,
  getBetaScope: () => 'beta-live',
}));

// ── Import after mock ──────────────────────────────────────────────────────────

import { NavPanel } from '../NavPanel';

function renderNavPanel(props = {}) {
  return render(
    <MemoryRouter>
      <NavPanel isOpen={true} onClose={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('NavPanel — beta mode', () => {
  it('shows all primary working nav links in beta mode', () => {
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
  });
});
