/**
 * Settings Display switches work; Notifications switches are gone
 * (Equoria-apfwp, ACC-04).
 *
 * Owner ruling 2026-10-28 (q247): "Make the display switches work and remove
 * the notification switches." Old behaviour: Reduced Motion, High Contrast and
 * Compact Cards saved a preference that nothing read, and the six
 * Notifications switches saved preferences the notification service never
 * consulted.
 *
 * Real AuthProvider, real React Query, real apiClient, real SettingsPage and
 * the real DisplayPreferencesApplier mounted as in App; only the HTTP transport
 * is stubbed by MSW with the real response shapes.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { AuthProvider } from '@/contexts/AuthContext';
import { DisplayPreferencesApplier } from '@/components/DisplayPreferencesApplier';
import SettingsPage from '../SettingsPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const player = {
  id: 7,
  username: 'MoonRider',
  email: 'moonrider@equoria.local',
  firstName: 'Moon',
  lastName: 'Rider',
  role: 'user',
  money: 5000,
  level: 1,
  xp: 0,
  welcomeSeen: true,
  completedOnboarding: true,
  onboardingStep: 10,
  preferences: { reducedMotion: false, highContrast: false, compactCards: false },
};

const root = () => document.documentElement;

describe('Settings Display switches (Equoria-apfwp)', () => {
  let queryClient: QueryClient;
  let saved: Record<string, boolean>;

  beforeEach(() => {
    saved = {};
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(['profile'], { user: player });
    queryClient.setQueryData(['verificationStatus'], {
      verified: true,
      email: player.email,
      verifiedAt: null,
    });
    server.use(
      http.get(`${base}/api/v1/auth/profile`, () =>
        HttpResponse.json({
          success: true,
          data: { user: { ...player, preferences: { ...player.preferences, ...saved } } },
        })
      ),
      http.patch(`${base}/api/v1/auth/profile/preferences`, async ({ request }) => {
        Object.assign(saved, (await request.json()) as Record<string, boolean>);
        return HttpResponse.json({
          success: true,
          data: { preferences: { ...player.preferences, ...saved } },
        });
      })
    );
  });

  afterEach(() => {
    delete root().dataset.reducedMotion;
    delete root().dataset.highContrast;
    delete root().dataset.compactCards;
  });

  function renderSettings() {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/settings']}>
            <DisplayPreferencesApplier />
            <SettingsPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  it('has no Notifications section', async () => {
    renderSettings();
    const nav = await screen.findByTestId('settings-nav');
    expect(within(nav).queryByText('Notifications')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-nav-notifications')).not.toBeInTheDocument();
    expect(within(nav).getByText('Display')).toBeInTheDocument();
  });

  it.each([
    ['display-reduced-motion', 'reducedMotion', 'reducedMotion'],
    ['display-high-contrast', 'highContrast', 'highContrast'],
    ['display-compact-cards', 'compactCards', 'compactCards'],
  ] as const)(
    'flipping %s on applies it to the page and saves it',
    async (testId, key, datasetKey) => {
      const user = userEvent.setup();
      renderSettings();
      await user.click(await screen.findByTestId('settings-nav-display'));
      expect(root().dataset[datasetKey]).toBeUndefined();

      await user.click(within(screen.getByTestId(testId)).getByRole('switch'));

      await waitFor(() => expect(root().dataset[datasetKey]).toBe('true'));
      await waitFor(() => expect(saved[key]).toBe(true));

      await user.click(within(screen.getByTestId(testId)).getByRole('switch'));
      await waitFor(() => expect(root().dataset[datasetKey]).toBeUndefined());
    }
  );

  it('a saved switch is applied on arrival, before Settings is opened', async () => {
    queryClient.setQueryData(['profile'], {
      user: { ...player, preferences: { ...player.preferences, highContrast: true } },
    });
    saved = { highContrast: true };
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <DisplayPreferencesApplier />
        </AuthProvider>
      </QueryClientProvider>
    );
    await waitFor(() => expect(root().dataset.highContrast).toBe('true'));
    expect(root().dataset.reducedMotion).toBeUndefined();
  });
});

describe('Display switch stylesheet (displayPreferences.css)', () => {
  const css = readFileSync(join(__dirname, '../../styles/displayPreferences.css'), 'utf8');
  const index = readFileSync(join(__dirname, '../../index.css'), 'utf8');

  it('is imported by index.css', () => {
    expect(index).toContain("@import './styles/displayPreferences.css';");
  });

  it('reduced motion zeroes the duration tokens and stops animation, but not spinners', () => {
    expect(css).toMatch(/:root\[data-reduced-motion='true'\]\s*\{[^}]*--duration-normal: 0ms/);
    expect(css).toMatch(/\*:not\(\.animate-spin\)[\s\S]*?animation: none !important/);
  });

  it('high contrast lifts supporting and muted text', () => {
    expect(css).toMatch(/:root\[data-high-contrast='true'\]\s*\{[^}]*--text-secondary:/);
    expect(css).toMatch(/:root\[data-high-contrast='true'\]\s*\{[^}]*--text-muted:/);
  });

  it('compact cards hide the horse card stat grid', () => {
    expect(css).toMatch(
      /:root\[data-compact-cards='true'\] \[data-horse-card-stats\]\s*\{\s*display: none;/
    );
  });
});
