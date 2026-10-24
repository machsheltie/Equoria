/**
 * NeedHelpPage (Equoria-vc5x1)
 *
 * Boundary-level: the real page, hooks, apiClient and React Query run; only the
 * HTTP transport is stubbed by MSW. Covers the three sections, the Online /
 * Offline pill text, the four async states, sending through the Messages API
 * and the authored refusal copy for each server guardrail code.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import NeedHelpPage from '../NeedHelpPage';
import MainNavigation from '@/components/MainNavigation';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/help/staff`;
const SEND = `${base}/api/v1/messages`;

const team = {
  owner: [{ id: 'o1', username: 'Stacey', online: true }],
  admin: [{ id: 'a1', username: 'AdminAnna', online: false }],
  moderator: [
    { id: 'm1', username: 'ModMaya', online: true },
    { id: 'm2', username: 'ModMiles', online: false },
  ],
};

function stubStaff(data: unknown = team) {
  server.use(http.get(STAFF, () => HttpResponse.json({ success: true, data })));
}

function renderPage(ui: React.ReactElement = <NeedHelpPage />) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MockAuthProvider userOverrides={{ id: 'player-1' as unknown as number }}>
          {ui}
        </MockAuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('NeedHelpPage', () => {
  it('lists the Owner, Admin and Moderators sections by name', async () => {
    stubStaff();
    renderPage();

    const owner = await screen.findByRole('region', { name: 'Owner / Head Admin' });
    expect(within(owner).getByText('Stacey')).toBeInTheDocument();
    const admin = screen.getByRole('region', { name: 'Admin' });
    expect(within(admin).getByText('AdminAnna')).toBeInTheDocument();
    const mods = screen.getByRole('region', { name: 'Moderators' });
    expect(within(mods).getByText('ModMaya')).toBeInTheDocument();
    expect(within(mods).getByText('ModMiles')).toBeInTheDocument();
  });

  it('labels every status pill with Online or Offline in words', async () => {
    stubStaff();
    renderPage();

    const mods = await screen.findByRole('region', { name: 'Moderators' });
    const maya = within(mods).getByText('ModMaya').closest('li') as HTMLElement;
    const miles = within(mods).getByText('ModMiles').closest('li') as HTMLElement;
    expect(within(maya).getByText('Online')).toBeInTheDocument();
    expect(within(miles).getByText('Offline')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Admin' })).getByText('Offline')
    ).toBeInTheDocument();
  });

  it('shows a loading state before the team arrives', () => {
    stubStaff();
    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an error with a working retry, never an empty team', async () => {
    server.use(http.get(STAFF, () => HttpResponse.json({ success: false }, { status: 500 })));
    renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/no moderators are listed/i)).not.toBeInTheDocument();

    stubStaff();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('ModMaya')).toBeInTheDocument();
  });

  it('says so when a section is truly empty', async () => {
    stubStaff({ ...team, moderator: [] });
    renderPage();
    expect(await screen.findByText('No moderators are listed yet.')).toBeInTheDocument();
    expect(screen.getByText('Stacey')).toBeInTheDocument();
  });

  it('does not offer to message yourself', async () => {
    stubStaff({ ...team, moderator: [{ id: 'player-1', username: 'Me', online: true }] });
    renderPage();
    await screen.findByText('Me');
    expect(screen.queryByRole('button', { name: 'Message Me' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Message Stacey' })).toBeInTheDocument();
  });

  it('sends the chosen person a message through the Messages API and confirms it', async () => {
    stubStaff();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(SEND, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { message: { id: 9 } } }, { status: 201 });
      })
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Message ModMaya' }));
    await userEvent.type(
      screen.getByLabelText('Your message to ModMaya'),
      'My mare is off her feed'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Your message has gone to ModMaya');
    expect(body).toMatchObject({ recipientId: 'm1', content: 'My mare is off her feed' });
  });

  it.each([
    ['helpOpenConversation', 409, /conversation open with someone on the team/i],
    ['helpDuplicateContent', 409, /already sent this same message/i],
    ['helpCooldown', 429, /wrote to the team a moment ago/i],
  ])('shows friendly copy for %s and keeps what was typed', async (code, status, copy) => {
    stubStaff();
    server.use(
      http.post(SEND, () =>
        HttpResponse.json({ success: false, message: 'server words', code }, { status })
      )
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Message Stacey' }));
    await userEvent.type(screen.getByLabelText('Your message to Stacey'), 'hello there');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(copy);
    expect(alert).not.toHaveTextContent(code);
    expect(alert).not.toHaveTextContent('server words');
    expect(screen.getByLabelText('Your message to Stacey')).toHaveValue('hello there');
  });
});

describe('top bar Need Help? button', () => {
  it('is a link to the help page named Need Help? with a matching tooltip', () => {
    renderPage(<MainNavigation />);
    const button = screen.getByRole('link', { name: 'Need Help?' });
    expect(button).toHaveAttribute('href', '/help');
    expect(button).toHaveAttribute('title', 'Need Help?');
  });
});
