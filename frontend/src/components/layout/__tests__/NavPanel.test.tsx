/**
 * NavPanel Beta Mode Tests
 *
 * Verifies active beta navigation exposes working routes.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock the beta route scope so we can control isBetaMode ────────────────────
vi.mock('@/config/betaRouteScope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/betaRouteScope')>();
  return {
    ...actual,
    // Override isBetaMode to true for beta nav tests
    isBetaMode: true,
  };
});

// Import AFTER the mock is registered
const { NavPanel } = await import('../NavPanel');

const renderPanel = (isOpen = true) =>
  render(
    <MemoryRouter>
      <NavPanel isOpen={isOpen} onClose={vi.fn()} />
    </MemoryRouter>
  );

describe('NavPanel — beta mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows /community link in beta mode', () => {
    renderPanel();

    expect(screen.getByRole('link', { name: /community/i })).toBeInTheDocument();
  });

  it('shows /stable link in beta mode (beta-live route)', () => {
    renderPanel();

    expect(screen.getByRole('link', { name: /my stable/i })).toBeInTheDocument();
  });

  it('shows /training link in beta mode', () => {
    renderPanel();

    expect(screen.getByRole('link', { name: /training/i })).toBeInTheDocument();
  });

  it('shows /bank link in beta mode', () => {
    renderPanel();

    expect(screen.getByRole('link', { name: /bank/i })).toBeInTheDocument();
  });

  it('renders null when isOpen is false', () => {
    renderPanel(false);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
