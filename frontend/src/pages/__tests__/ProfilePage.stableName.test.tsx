/**
 * The stable has its own name, edited on the player's page (Equoria-kgush, STA-06)
 *
 * Owner ruling 2026-10-28 (q250): each stable has its own name, separate from
 * the player's username, and the stable page and the player page are one page.
 * Saving a stable name must never rename the account, and a failed save must
 * say so.
 *
 * Real page + real hooks + real apiClient; MSW only at the HTTP boundary.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from '@/test/utils';
import { server } from '@/test/msw/server';
import ProfilePage from '../ProfilePage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const USER = {
  id: 7,
  username: 'ProfileTester',
  email: 'profile@example.com',
  role: 'user',
  money: 12345,
  xp: 250,
  level: 3,
  bio: '',
  stableName: null as string | null,
};

function stubBoundary(put: (body: Record<string, unknown>) => Response) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () =>
      HttpResponse.json({ status: 'success', data: { user: USER } })
    ),
    http.put(`${base}/api/v1/auth/profile`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      return put(body);
    }),
    http.get(`${base}/api/v1/users/:id/activity`, () =>
      HttpResponse.json({ success: true, data: [] })
    )
  );
  return bodies;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/profile']}>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProfilePage — the stable name (Equoria-kgush)', () => {
  it('saves the stable name as its own field and never as the username', async () => {
    const user = userEvent.setup();
    const bodies = stubBoundary((body) =>
      HttpResponse.json({
        success: true,
        data: { user: { ...USER, stableName: body.stableName ?? null } },
      })
    );
    renderPage();

    const field = await screen.findByLabelText('Stable Name');
    expect(screen.getByTestId('profile-stable-row')).toHaveTextContent('Not yet named');
    await user.type(field, 'Moonlit Meadow');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('Moonlit Meadow', { selector: 'p' })).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
    expect(bodies[0].stableName).toBe('Moonlit Meadow');
    expect(bodies[0].username).toBe('ProfileTester');
  });

  it('shows the failure at the form when the save is refused, and keeps what she typed', async () => {
    const user = userEvent.setup();
    stubBoundary(() =>
      HttpResponse.json({ success: false, message: 'Validation failed' }, { status: 400 })
    );
    renderPage();

    const field = await screen.findByLabelText('Stable Name');
    await user.type(field, 'Starlight Farm');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/your profile was not saved/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Stable Name')).toHaveValue('Starlight Farm');
  });

  it('refuses a two-letter stable name before sending anything', async () => {
    const user = userEvent.setup();
    const bodies = stubBoundary(() => HttpResponse.json({ success: true, data: { user: USER } }));
    renderPage();

    const field = await screen.findByLabelText('Stable Name');
    await user.type(field, 'ab');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/at least 3 characters/i)).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });
});
