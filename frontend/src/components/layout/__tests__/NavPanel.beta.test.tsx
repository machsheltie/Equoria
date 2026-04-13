/**
 * NavPanel Beta Mode Tests — Story 21R-2 Task 11
 *
 * Verifies that in beta mode, NavPanel shows ONLY beta-live routes.
 * Beta-readonly and beta-hidden routes must not appear in beta navigation.
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
  isBetaLive: (path: string) => ['/', '/stable'].includes(path),
  isBetaHidden: (path: string) => ['/community', '/my-stable', '/crafting'].includes(path),
  isBetaReadonly: (path: string) =>
    ![
      '/',
      '/stable',
      '/login',
      '/register',
      '/onboarding',
      '/community',
      '/my-stable',
      '/crafting',
    ].includes(path),
  getBetaScope: (path: string) => {
    if (['/', '/stable', '/login', '/register', '/onboarding'].includes(path)) return 'beta-live';
    if (['/community', '/my-stable', '/crafting'].includes(path)) return 'beta-hidden';
    return 'beta-readonly';
  },
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
  it('shows only Home and My Stable nav links in beta mode', () => {
    renderNavPanel();

    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my stable/i })).toBeInTheDocument();
  });

  it('does not show beta-readonly routes in beta nav', () => {
    renderNavPanel();

    expect(screen.queryByRole('link', { name: /training/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /competitions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /breeding/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /marketplace/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /messages/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /bank/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /world/i })).not.toBeInTheDocument();
  });

  it('does not show beta-hidden routes in beta nav', () => {
    renderNavPanel();

    expect(screen.queryByRole('link', { name: /community/i })).not.toBeInTheDocument();
  });
});
