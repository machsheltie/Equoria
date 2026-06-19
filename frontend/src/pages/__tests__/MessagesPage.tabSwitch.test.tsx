/**
 * MessagesPage tab switching tests (Equoria-o5hub.30)
 *
 * MessagesPage was e2e-only (community.spec.ts). Its tab logic — inbox / sent /
 * notifications, switching the visible MessageRow set and the empty/loaded
 * panels — is RTL-testable in isolation against the existing MSW handlers for
 * /messages/inbox, /messages/sent, /messages/unread-count, and
 * /users/me/game-notifications. No vi.mock of our API client (CLAUDE.md §3).
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import MessagesPage from '../MessagesPage';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MessagesPage — tab switching (Equoria-o5hub.30)', () => {
  it('defaults to the inbox tab showing received messages', async () => {
    renderPage();
    // Inbox fixtures from the default MSW handler.
    expect(await screen.findByText('Interested in your mare')).toBeInTheDocument();
    expect(screen.getByText('Club invitation')).toBeInTheDocument();
    // The sent-only message is not in the inbox.
    expect(screen.queryByText('Welcome to the stable')).not.toBeInTheDocument();
  });

  it('switching to Sent shows sent messages and hides inbox messages', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Interested in your mare');

    await user.click(screen.getByTestId('tab-sent'));

    await waitFor(() => {
      expect(screen.getByText('Welcome to the stable')).toBeInTheDocument();
      expect(screen.queryByText('Interested in your mare')).not.toBeInTheDocument();
    });
  });

  it('switching to Notifications shows the honest empty notifications state', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Interested in your mare');

    await user.click(screen.getByTestId('tab-notifications'));

    // The default game-notifications handler returns zero notifications.
    expect(await screen.findByTestId('empty-notifications')).toBeInTheDocument();
  });

  it('switching back from Sent to Inbox restores the inbox messages', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Interested in your mare');

    await user.click(screen.getByTestId('tab-sent'));
    await waitFor(() => expect(screen.getByText('Welcome to the stable')).toBeInTheDocument());

    await user.click(screen.getByTestId('tab-inbox'));
    await waitFor(() => {
      expect(screen.getByText('Interested in your mare')).toBeInTheDocument();
      expect(screen.queryByText('Welcome to the stable')).not.toBeInTheDocument();
    });
  });
});
