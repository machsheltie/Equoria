/**
 * StaffRenames: find a horse or show by number, see its name and owner, rename it
 * with a reason; rename a player by username (Equoria-puj1e.3, owner ruling q375).
 *
 * The real hooks over the real apiClient; MSW stubs the HTTP boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { server } from '@/test/msw/server';
import StaffRenames from '../StaffRenames';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const CONTENT = `${base}/api/v1/staff/content`;

describe('StaffRenames', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const renderIt = (onCheckinRequired = () => undefined) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StaffRenames onCheckinRequired={onCheckinRequired} />
        </MemoryRouter>
      </QueryClientProvider>
    );

  const horseArea = () => screen.getByText('A horse').parentElement as HTMLElement;

  it('shows the horse and its owner, then renames it with a reason and shows the new name', async () => {
    let sent: unknown = null;
    server.use(
      http.get(`${CONTENT}/horses/42`, () =>
        HttpResponse.json({ id: 42, name: 'Rude Name', ownerUsername: 'Willow' })
      ),
      http.post(`${CONTENT}/horses/42/rename`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ id: 42, name: 'Bramble' });
      })
    );
    const user = userEvent.setup();
    renderIt();

    const area = horseArea();
    await user.type(within(area).getByLabelText('Horse number'), '42');
    await user.click(within(area).getByRole('button', { name: 'Find horse' }));
    expect(await within(area).findByText(/owned by Willow/)).toBeInTheDocument();
    expect(within(area).getByText(/Rude Name/)).toBeInTheDocument();

    const rename = within(area).getByRole('button', { name: 'Rename horse' });
    expect(rename).toBeDisabled();
    await user.type(within(area).getByLabelText(/New name/), 'Bramble');
    await user.type(within(area).getByLabelText(/Reason/), 'Offensive name');
    await user.click(rename);

    expect(await within(area).findByText(/^Bramble/)).toBeInTheDocument();
    expect(within(area).queryByText(/Rude Name/)).toBeNull();
    expect(sent).toEqual({ name: 'Bramble', reason: 'Offensive name' });
  });

  it('says why a rename was refused and keeps what was typed', async () => {
    server.use(
      http.get(`${CONTENT}/shows/5`, () =>
        HttpResponse.json({ id: 5, name: 'Old Show', hostUsername: null })
      ),
      http.post(`${CONTENT}/shows/5/rename`, () =>
        HttpResponse.json(
          { success: false, code: 'renameNameTaken', message: 'RAW-SERVER-TEXT' },
          { status: 409 }
        )
      )
    );
    const user = userEvent.setup();
    renderIt();

    const area = screen.getByText('A show').parentElement as HTMLElement;
    await user.type(within(area).getByLabelText('Show number'), '5');
    await user.click(within(area).getByRole('button', { name: 'Find show' }));
    await within(area).findByText('Old Show');
    await user.type(within(area).getByLabelText(/New name/), 'Taken Show');
    await user.type(within(area).getByLabelText(/Reason/), 'Rude');
    await user.click(within(area).getByRole('button', { name: 'Rename show' }));

    expect(await within(area).findByText(/That name is taken/)).toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).toBeNull();
    expect(within(area).getByLabelText(/New name/)).toHaveValue('Taken Show');
  });

  it('renames a player by their username and shows the new one', async () => {
    let sent: unknown = null;
    server.use(
      http.post(`${CONTENT}/players/rename`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ id: 'p-1', username: 'KindRider' });
      })
    );
    const user = userEvent.setup();
    renderIt();

    const area = screen.getByText('A player').parentElement as HTMLElement;
    await user.type(within(area).getByLabelText(/username now/), 'RudeRider');
    await user.type(within(area).getByLabelText(/New username/), 'KindRider');
    await user.type(within(area).getByLabelText(/Reason/), 'Offensive username');
    await user.click(within(area).getByRole('button', { name: 'Rename player' }));

    expect(await within(area).findByText('Now called KindRider.')).toBeInTheDocument();
    expect(sent).toEqual({
      username: 'RudeRider',
      newUsername: 'KindRider',
      reason: 'Offensive username',
    });
  });

  it('returns the office to check-in when this browser has lapsed', async () => {
    let lapsed = false;
    server.use(
      http.get(`${CONTENT}/horses/42`, () =>
        HttpResponse.json(
          { success: false, code: 'staffCheckinRequired', message: 'x' },
          { status: 403 }
        )
      )
    );
    const user = userEvent.setup();
    renderIt(() => {
      lapsed = true;
    });
    const area = horseArea();
    await user.type(within(area).getByLabelText('Horse number'), '42');
    await user.click(within(area).getByRole('button', { name: 'Find horse' }));
    await within(area).findByText(/check-in on this browser has lapsed/);
    expect(lapsed).toBe(true);
  });
});
