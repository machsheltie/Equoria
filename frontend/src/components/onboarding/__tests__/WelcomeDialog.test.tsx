/**
 * WelcomeDialog (Equoria-kd2dd)
 *
 * Owner ruling 2026-10-23: the first time a new player enters the game after the
 * three-step signup, a welcome popup shows ONCE: "Welcome <player name>!", the
 * line "Please review the new player guide!" as a link to the Guide, and a
 * Continue button below that loads the News page.
 *
 * Real AuthProvider + real router + real QueryClient. The server is a small
 * stateful stand-in at the HTTP boundary (MSW): the welcome-seen flag lives in
 * `serverFlag`, POST /auth/welcome-seen flips it, and GET /auth/profile reports
 * it, exactly as the backend does (proved against the real database in
 * backend/modules/auth/__tests__/welcomeSeen.integration.test.mjs).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { AuthProvider } from '../../../contexts/AuthContext';
import { server } from '../../../test/msw/server';
import { WelcomeDialog } from '../WelcomeDialog';
import OnboardingSpotlight from '../OnboardingSpotlight';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ServerState {
  welcomeSeen: boolean;
  completedOnboarding: boolean;
  onboardingStep: number;
  welcomeSeenCalls: number;
  failWelcomeSeenOnce: boolean;
  tourSkipCalls: number;
}

let serverState: ServerState;

function installServer() {
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () =>
      HttpResponse.json({
        data: {
          user: {
            id: 'u-1',
            username: 'Moonflower',
            email: 'rider@example.com',
            completedOnboarding: serverState.completedOnboarding,
            onboardingStep: serverState.onboardingStep,
            welcomeSeen: serverState.welcomeSeen,
          },
        },
      })
    ),
    http.get(`${base}/api/v1/auth/verification-status`, () =>
      HttpResponse.json({ data: { verified: true, email: 'rider@example.com', verifiedAt: null } })
    ),
    http.post(`${base}/api/v1/auth/complete-onboarding`, () => {
      serverState.tourSkipCalls += 1;
      return HttpResponse.json({ success: true, data: { completedOnboarding: true } });
    }),
    http.post(`${base}/api/v1/auth/welcome-seen`, () => {
      serverState.welcomeSeenCalls += 1;
      if (serverState.failWelcomeSeenOnce) {
        serverState.failWelcomeSeenOnce = false;
        return HttpResponse.json({ status: 'error', message: 'boom' }, { status: 500 });
      }
      serverState.welcomeSeen = true;
      return HttpResponse.json({ success: true, data: { welcomeSeen: true } });
    })
  );
}

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}</div>;
}

describe('WelcomeDialog (Equoria-kd2dd)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    serverState = {
      welcomeSeen: false,
      // A player who just finished the wizard: tour begun (step 1), not completed.
      completedOnboarding: false,
      onboardingStep: 1,
      welcomeSeenCalls: 0,
      failWelcomeSeenOnce: false,
      tourSkipCalls: 0,
    };
    installServer();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  function renderGame() {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/stable']}>
            <OnboardingSpotlight />
            <WelcomeDialog />
            <Routes>
              <Route path="/stable" element={<div>Stable Home</div>} />
              <Route path="/guide" element={<div>Guide Page</div>} />
              <Route path="/news" element={<div>News Page</div>} />
            </Routes>
            <Where />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  it('greets a new player by name with the guide link and a Continue button', async () => {
    renderGame();

    const dialog = await screen.findByRole('dialog', { name: 'Welcome Moonflower!' });
    expect(dialog).toBeInTheDocument();

    const guideLink = screen.getByRole('link', { name: 'Please review the new player guide!' });
    expect(guideLink).toHaveAttribute('href', '/guide');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    // Focus is inside the dialog (the native primitive owns the trap).
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('Continue records the flag on the server and loads the News page', async () => {
    const user = userEvent.setup();
    renderGame();

    await user.click(await screen.findByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/news'));
    expect(serverState.welcomeSeen).toBe(true);
    expect(serverState.welcomeSeenCalls).toBe(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is shown exactly once: a fresh session after Continue does not show it again', async () => {
    const user = userEvent.setup();
    const first = renderGame();
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/news'));
    first.unmount();
    queryClient.clear();

    // A new browser session: nothing cached, the server flag is all that remains.
    renderGame();
    await screen.findByText('Stable Home');
    await waitFor(() => expect(serverState.welcomeSeen).toBe(true));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('the guide link opens the Guide and counts as having seen the welcome', async () => {
    const user = userEvent.setup();
    renderGame();

    await user.click(
      await screen.findByRole('link', { name: 'Please review the new player guide!' })
    );

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/guide'));
    expect(serverState.welcomeSeen).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Escape acts as Continue', async () => {
    const user = userEvent.setup();
    renderGame();
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/news'));
    expect(serverState.welcomeSeen).toBe(true);
  });

  it('a failed save is said out loud beside Continue, keeps the dialog open, and Continue retries', async () => {
    serverState.failWelcomeSeenOnce = true;
    const user = userEvent.setup();
    renderGame();

    await user.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/stable');
    expect(serverState.welcomeSeen).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/news'));
    expect(serverState.welcomeSeen).toBe(true);
  });

  it('the guided tour waits for the note: no tour card while it is up, and Escape does not skip the tour', async () => {
    const user = userEvent.setup();
    renderGame();
    await screen.findByRole('dialog');

    expect(screen.queryByText(/Step 1 of 10/)).not.toBeInTheDocument();

    await user.keyboard('{Escape}');

    // The note is dismissed and the tour picks up afterwards, unskipped.
    expect(await screen.findByText(/Step 1 of 10/)).toBeInTheDocument();
    expect(serverState.tourSkipCalls).toBe(0);
  });

  it.each([
    ['a player who already saw it', { welcomeSeen: true }],
    ['a player still on the signup wizard (step 0)', { onboardingStep: 0 }],
    [
      'an established player who finished onboarding before the note existed',
      { completedOnboarding: true },
    ],
  ])('does not show for %s', async (_label, patch) => {
    Object.assign(serverState, patch);
    renderGame();

    await screen.findByText('Stable Home');
    // Let the profile settle: the dialog must not appear once the player is known.
    await waitFor(() => expect(serverState.welcomeSeenCalls).toBe(0));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
