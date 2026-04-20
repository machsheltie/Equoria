/**
 * SettingsPage persistence wiring tests
 *
 * Story 21S-5: verify that SettingsPage toggles hit the mutation and that
 * initial values hydrate from the persisted profile preferences.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from '../SettingsPage';

// ── Mock auth (default: no persisted prefs) ─────────────────────────────────
const mockUser = {
  id: 'user-123',
  username: 'tester',
  preferences: { emailCompetition: false, reducedMotion: true },
};
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    isEmailVerified: true,
    error: null,
    logout: vi.fn(),
    isLoggingOut: false,
    refetchProfile: vi.fn(),
    userRole: 'user',
    hasRole: () => false,
    hasAnyRole: () => false,
    isAdmin: false,
    isModerator: false,
  }),
}));

// ── Mock the persistence hook ───────────────────────────────────────────────
const mockMutate = vi.fn();
vi.mock('@/hooks/api/useUpdatePreferences', () => ({
  useUpdatePreferences: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/settings']}>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SettingsPage — persistence wiring (Story 21S-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates notification toggles from the persisted user.preferences', async () => {
    renderPage();
    await userEvent.setup().click(screen.getByTestId('settings-nav-notifications'));
    // `emailCompetition: false` from the mocked user → the switch should be off
    const toggle = screen.getByTestId('notif-email-competition').querySelector('button');
    expect(toggle?.getAttribute('aria-checked')).toBe('false');
  });

  it('hydrates display toggles from the persisted user.preferences', async () => {
    renderPage();
    await userEvent.setup().click(screen.getByTestId('settings-nav-display'));
    // `reducedMotion: true` from the mocked user → on
    const toggle = screen.getByTestId('display-reduced-motion').querySelector('button');
    expect(toggle?.getAttribute('aria-checked')).toBe('true');
  });

  it('calls updatePreferences.mutate with exactly the changed key on toggle', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('settings-nav-notifications'));

    // Toggle the breeding notification (currently false via DEFAULT_PREFERENCES,
    // no override from user). Clicking should send { emailBreeding: true }.
    const breedingToggle = screen.getByTestId('notif-email-breeding').querySelector('button');
    expect(breedingToggle).not.toBeNull();
    await user.click(breedingToggle!);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const [payload] = mockMutate.mock.calls[0];
    expect(payload).toEqual({ emailBreeding: true });
  });

  it('persists a display toggle with the single changed key', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('settings-nav-display'));

    const compactToggle = screen.getByTestId('display-compact-cards').querySelector('button');
    await user.click(compactToggle!);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const [payload] = mockMutate.mock.calls[0];
    expect(payload).toEqual({ compactCards: true });
  });
});
