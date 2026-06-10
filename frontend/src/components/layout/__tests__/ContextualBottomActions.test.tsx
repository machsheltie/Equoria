/**
 * ContextualBottomActions — DashboardLayout contextual bottom-action slot
 * (Equoria-o5hub.5, handoff §6.9 / D-24).
 *
 * Contract under test:
 *  1. A page registering actions via <ContextualBottomActions> gets them
 *     rendered inside the layout's fixed slot (NOT in the page flow).
 *  2. The slot stacks ABOVE BottomNav on mobile (bottom offset = nav height
 *     + safe area) and sits at the viewport bottom (safe area only) on md+,
 *     at the --z-nav tier — never --z-modal (dialogs must layer above).
 *  3. The content wrapper switches to the combined nav+actions reservation
 *     while actions are registered and reverts when they unregister.
 *  4. Sentinel-negative: with no registration, no slot exists and the
 *     default padding applies.
 *  5. FALLBACK: without a provider (direct page renders in vitest), the
 *     children render in place so action-bar testids never disappear.
 */

import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Routes, Route } from 'react-router-dom';
import { MemoryRouter, MockAuthProvider } from '../../../test/utils';
import DashboardLayout from '../DashboardLayout';
import { ContextualBottomActions } from '../ContextualBottomActions';

/** Page that can mount/unmount its contextual actions on demand. */
function TogglePage({ initiallyRegistered = true }: { initiallyRegistered?: boolean }) {
  const [registered, setRegistered] = useState(initiallyRegistered);
  return (
    <div>
      <p>page body content</p>
      <button type="button" data-testid="toggle-actions" onClick={() => setRegistered((r) => !r)}>
        toggle
      </button>
      {registered && (
        <ContextualBottomActions>
          <button type="button" data-testid="ctx-action-primary">
            Primary action
          </button>
        </ContextualBottomActions>
      )}
    </div>
  );
}

function renderLayout(initiallyRegistered: boolean) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <MemoryRouter initialEntries={['/test-page']}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route
                path="/test-page"
                element={<TogglePage initiallyRegistered={initiallyRegistered} />}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

/** The content wrapper is the direct parent of <main id="main-content">. */
function getContentWrapper(): HTMLElement {
  const main = document.getElementById('main-content');
  expect(main).not.toBeNull();
  return main!.parentElement as HTMLElement;
}

const DEFAULT_PADDING = 'pb-[calc(var(--bottom-nav-height)+var(--safe-area-bottom)+1rem)]';
const RESERVED_PADDING = 'pb-[var(--content-bottom-reserve)]';
const RESERVED_PADDING_DESKTOP = 'md:pb-[var(--content-bottom-reserve-desktop)]';

describe('DashboardLayout contextual bottom-action slot (Equoria-o5hub.5)', () => {
  it('renders registered actions inside the layout slot, not in the page flow', () => {
    renderLayout(true);

    const slot = screen.getByTestId('contextual-bottom-actions');
    expect(within(slot).getByTestId('ctx-action-primary')).toBeInTheDocument();

    // The action is portaled OUT of the page body — its DOM ancestor chain
    // must not include the main content element.
    const action = screen.getByTestId('ctx-action-primary');
    expect(document.getElementById('main-content')!.contains(action)).toBe(false);
  });

  it('slot stacks above BottomNav on mobile and at the safe-area bottom on md+, at the nav z-tier', () => {
    renderLayout(true);

    const slot = screen.getByTestId('contextual-bottom-actions');
    expect(slot.className).toContain('fixed');
    // Mobile: bottom offset clears the bottom nav + iOS safe area.
    expect(slot.className).toContain(
      'bottom-[calc(var(--bottom-nav-height)+var(--safe-area-bottom))]'
    );
    // md+ (BottomNav hidden ≥768px): viewport bottom, safe area only.
    expect(slot.className).toContain('md:bottom-[var(--safe-area-bottom)]');
    // z tier: nav, NEVER modal — dialogs must layer above the action bar.
    expect(slot.className).toContain('z-[var(--z-nav)]');
    expect(slot.className).not.toContain('z-[var(--z-modal)]');
  });

  it('content wrapper reserves nav+actions space while registered', () => {
    renderLayout(true);

    const wrapper = getContentWrapper();
    expect(wrapper.className).toContain(RESERVED_PADDING);
    expect(wrapper.className).toContain(RESERVED_PADDING_DESKTOP);
    expect(wrapper.className).not.toContain(DEFAULT_PADDING);
  });

  it('unregistering removes the slot and reverts the content padding', () => {
    renderLayout(true);

    // Sanity: registered state first (sentinel-positive baseline).
    expect(screen.getByTestId('contextual-bottom-actions')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toggle-actions'));

    expect(screen.queryByTestId('contextual-bottom-actions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ctx-action-primary')).not.toBeInTheDocument();

    const wrapper = getContentWrapper();
    expect(wrapper.className).toContain(DEFAULT_PADDING);
    expect(wrapper.className).toContain('md:pb-0');
    expect(wrapper.className).not.toContain(RESERVED_PADDING);
  });

  it('re-registering after unregistering brings the slot back (round trip)', () => {
    renderLayout(false);

    expect(screen.queryByTestId('contextual-bottom-actions')).not.toBeInTheDocument();
    expect(getContentWrapper().className).toContain(DEFAULT_PADDING);

    fireEvent.click(screen.getByTestId('toggle-actions'));

    const slot = screen.getByTestId('contextual-bottom-actions');
    expect(within(slot).getByTestId('ctx-action-primary')).toBeInTheDocument();
    expect(getContentWrapper().className).toContain(RESERVED_PADDING);
  });

  it('sentinel-negative: with nothing registered there is no slot and the default padding applies', () => {
    renderLayout(false);

    expect(screen.queryByTestId('contextual-bottom-actions')).not.toBeInTheDocument();
    const wrapper = getContentWrapper();
    expect(wrapper.className).toContain(DEFAULT_PADDING);
    expect(wrapper.className).toContain('md:pb-0');
  });

  it('BottomNav respects the iOS safe-area inset (height grows, inset consumed as padding)', () => {
    renderLayout(false);

    const nav = screen.getByTestId('bottom-nav');
    expect(nav.className).toContain('h-[calc(var(--bottom-nav-height)+var(--safe-area-bottom))]');
    expect(nav.className).toContain('pb-[var(--safe-area-bottom)]');
  });
});

describe('ContextualBottomActions fallback without a provider', () => {
  it('renders children in place so direct page renders keep their action bars', () => {
    render(
      <ContextualBottomActions>
        <button type="button" data-testid="ctx-action-fallback">
          Fallback action
        </button>
      </ContextualBottomActions>
    );

    expect(screen.getByTestId('ctx-action-fallback')).toBeInTheDocument();
    // No layout slot exists in this mode.
    expect(screen.queryByTestId('contextual-bottom-actions')).not.toBeInTheDocument();
  });
});
