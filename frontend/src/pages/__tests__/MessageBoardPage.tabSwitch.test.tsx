/**
 * MessageBoardPage section-tab switching tests (Equoria-o5hub.30)
 *
 * MessageBoardPage was e2e-only (community.spec.ts). Its section tabs drive
 * useThreads(activeSection) — switching sections changes the visible thread list.
 * This is RTL-testable against the existing MSW /forum/threads handler (which
 * filters by ?section=): general has 2 threads, sales has 1. No vi.mock of our
 * API client (CLAUDE.md §3).
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import MessageBoardPage from '../MessageBoardPage';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MessageBoardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MessageBoardPage — section tab switching (Equoria-o5hub.30)', () => {
  it('defaults to the General section showing its threads', async () => {
    renderPage();
    // General section fixtures from the default MSW forum handler.
    expect(await screen.findByText('Welcome to Equoria Forums')).toBeInTheDocument();
    expect(screen.getByText('Tips for training young foals')).toBeInTheDocument();
    // The sales-only thread is not in General.
    expect(
      screen.queryByText('Thoroughbred stallion for stud — excellent stats')
    ).not.toBeInTheDocument();
  });

  it('switching to the Sales section shows sales threads and hides general threads', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Welcome to Equoria Forums');

    await user.click(screen.getByTestId('section-tab-sales'));

    await waitFor(() => {
      expect(
        screen.getByText('Thoroughbred stallion for stud — excellent stats')
      ).toBeInTheDocument();
      expect(screen.queryByText('Welcome to Equoria Forums')).not.toBeInTheDocument();
    });
  });

  it('switching to a section with no threads shows the honest empty state', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Welcome to Equoria Forums');

    // The default handler has no 'venting' threads.
    await user.click(screen.getByTestId('section-tab-venting'));

    await waitFor(() => {
      expect(screen.getByText(/no threads yet in venting/i)).toBeInTheDocument();
    });
  });
});
