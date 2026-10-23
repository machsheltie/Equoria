/**
 * StaffRoles: the three staff levels (Equoria-4tleh, owner ruling 2026-10-23)
 *
 * The real staff hooks over the real apiClient; MSW stubs the HTTP boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StaffRoles from '../StaffRoles';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

describe('StaffRoles: Owner, Admin, Moderator', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('titles each steward by level and offers no control on the owner or an admin', async () => {
    server.use(
      http.get(`${STAFF}/roles`, () =>
        HttpResponse.json({
          staff: [
            { id: 'owner-1', username: 'Stacey', role: 'owner' },
            { id: 'admin-1', username: 'Hazel', role: 'admin' },
            { id: 'mod-1', username: 'Willow', role: 'moderator' },
          ],
        })
      )
    );

    render(
      <QueryClientProvider client={queryClient}>
        <StaffRoles onCheckinRequired={() => undefined} />
      </QueryClientProvider>
    );

    const owner = (await screen.findByText('Stacey')).closest('li') as HTMLElement;
    const admin = screen.getByText('Hazel').closest('li') as HTMLElement;
    const mod = screen.getByText('Willow').closest('li') as HTMLElement;

    expect(within(owner).getByText(/Owner/)).toBeInTheDocument();
    expect(within(admin).getByText(/Admin/)).toBeInTheDocument();
    expect(within(mod).getByText(/Moderator/)).toBeInTheDocument();
    expect(within(owner).queryByRole('button')).not.toBeInTheDocument();
    expect(within(admin).queryByRole('button')).not.toBeInTheDocument();
    expect(within(mod).getByRole('button', { name: 'Revoke Willow' })).toBeInTheDocument();
  });

  it('offers Make admin only when the viewer may appoint admins (Equoria-i1hgt)', async () => {
    server.use(
      http.get(`${STAFF}/roles`, () =>
        HttpResponse.json({
          staff: [
            { id: 'admin-1', username: 'Hazel', role: 'admin' },
            { id: 'mod-1', username: 'Willow', role: 'moderator' },
          ],
        })
      )
    );

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <StaffRoles onCheckinRequired={() => undefined} />
      </QueryClientProvider>
    );
    await screen.findByText('Willow');
    expect(screen.queryByRole('button', { name: 'Make Willow an admin' })).not.toBeInTheDocument();
    unmount();

    render(
      <QueryClientProvider client={queryClient}>
        <StaffRoles onCheckinRequired={() => undefined} canAppointAdmin />
      </QueryClientProvider>
    );
    const mod = (await screen.findByText('Willow')).closest('li') as HTMLElement;
    const admin = screen.getByText('Hazel').closest('li') as HTMLElement;
    expect(within(mod).getByRole('button', { name: 'Make Willow an admin' })).toBeInTheDocument();
    expect(within(admin).queryByRole('button')).not.toBeInTheDocument();
  });
});
