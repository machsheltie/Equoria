/**
 * StableView category-tab filter tests (Equoria-o5hub.30)
 *
 * StableView was mocked out in App.story-8-1.test.tsx, leaving its category tab
 * filter (All / Foals / Mares / Stallions / Retired) without coverage. The tabs
 * filter the user's horse list by age + sex; this is pure client-side filtering,
 * RTL-testable against the default MSW horse list (Storm Runner = stallion age 5,
 * Midnight Dream = mare age 4). No vi.mock of our API client (CLAUDE.md §3).
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import StableView from '../StableView';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <StableView />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('StableView — category tab filter (Equoria-o5hub.30)', () => {
  it('All tab shows every horse', async () => {
    renderPage();
    // Both default horses are present on the All tab.
    expect(await screen.findByText('Storm Runner')).toBeInTheDocument();
    expect(screen.getByText('Midnight Dream')).toBeInTheDocument();
  });

  it('Stallions tab filters to the stallion only', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Storm Runner');

    await user.click(screen.getByRole('tab', { name: /stallions/i }));

    await waitFor(() => {
      expect(screen.getByText('Storm Runner')).toBeInTheDocument();
      expect(screen.queryByText('Midnight Dream')).not.toBeInTheDocument();
    });
  });

  it('Mares tab filters to the mare only', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Midnight Dream');

    await user.click(screen.getByRole('tab', { name: /mares/i }));

    await waitFor(() => {
      expect(screen.getByText('Midnight Dream')).toBeInTheDocument();
      expect(screen.queryByText('Storm Runner')).not.toBeInTheDocument();
    });
  });

  it('Foals tab shows the honest filtered-empty state (no horses under age 3)', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Storm Runner');

    await user.click(screen.getByRole('tab', { name: /foals/i }));

    // Neither adult horse should appear under Foals.
    await waitFor(() => {
      expect(screen.queryByText('Storm Runner')).not.toBeInTheDocument();
      expect(screen.queryByText('Midnight Dream')).not.toBeInTheDocument();
    });
  });
});
