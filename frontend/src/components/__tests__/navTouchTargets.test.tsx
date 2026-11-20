/**
 * Top-bar and menu controls meet the 44px touch minimum (Equoria-v0ng4, NAV-06).
 *
 * The phone header's menu, notifications, help, settings and logout controls and
 * the menu's close button were 32px squares with nothing widening their hit
 * area. jsdom does not lay out CSS, so this checks that every control carries
 * the touch-target class.
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '../../test/utils';
import MainNavigation from '../MainNavigation';
import { NavPanel } from '../layout/NavPanel';

function renderHeader() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <MemoryRouter>
          <MainNavigation onOpenNav={() => {}} />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('touch targets (Equoria-v0ng4)', () => {
  it('every control in the top bar carries it', () => {
    renderHeader();
    const header = screen.getByTestId('main-navigation');
    const controls = [
      ...within(header).getAllByRole('button'),
      ...within(header)
        .getAllByRole('link')
        // The wordmark and the breadcrumb trail are text, not square controls.
        .filter((link) => link.closest('nav') === null && link.textContent !== 'Equoria'),
    ];
    const names = controls.map(
      (control) => control.getAttribute('aria-label') ?? control.textContent
    );
    expect(names).toEqual(
      expect.arrayContaining(['Open menu', 'Log out', 'Need Help?', 'User settings'])
    );
    expect(names.some((name) => name?.startsWith('Notifications'))).toBe(true);
    for (const control of controls) {
      expect(control, control.getAttribute('aria-label') ?? '').toHaveClass('nav-touch-target');
    }
  });

  it('the phone menu’s close button carries it', () => {
    render(
      <MemoryRouter>
        <NavPanel isOpen onClose={() => {}} />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveClass('nav-touch-target');
  });
});
