/**
 * FarrierPage tab + cross-tab interaction tests (Equoria-o5hub.30)
 *
 * The Farrier location uses controlled CanonicalTabs so two cross-tab handlers
 * can switch programmatically:
 *   - onNavigateToServices (My Horses → Services, after a horse is selected) —
 *     the issue flags this as the highest-value gap.
 *   - onNavigateToHorses   (Services → My Horses, from the "select a horse" banner)
 *
 * Strategy: real page, real CanonicalTabs, real useHorses (default MSW handler)
 * and real useFarrierServices via a per-test MSW handler at the network
 * boundary. No vi.mock of our API client (CLAUDE.md §3). Assertions target the
 * visible tab panel the cross-tab button reveals.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import React from 'react';
import FarrierPage from '../FarrierPage';

function farrierServicesHandler() {
  return http.get('*/api/v1/farrier/services', () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          id: 'trim',
          name: 'Hoof Trim',
          description: 'Routine hoof trimming.',
          cost: 150,
          duration: '30 min',
          icon: null,
        },
        {
          id: 'shoe',
          name: 'Corrective Shoeing',
          description: 'Gait-improving shoes.',
          cost: 400,
          duration: '1 hr',
          icon: null,
        },
      ],
    })
  );
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <FarrierPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FarrierPage — tab switching + cross-tab nav (Equoria-o5hub.30)', () => {
  beforeEach(() => {
    server.use(farrierServicesHandler());
  });

  it('renders the My Horses tab by default', async () => {
    renderPage();
    expect(await screen.findByTestId('horses-hoof-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('farrier-services-tab')).not.toBeInTheDocument();
  });

  it('clicking the Services tab shows the services panel', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('horses-hoof-tab');

    await user.click(screen.getByRole('tab', { name: /services/i }));

    expect(await screen.findByTestId('farrier-services-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('horses-hoof-tab')).not.toBeInTheDocument();
  });

  it('selecting a horse then clicking "View Services" jumps to the Services tab (onNavigateToServices)', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByTestId('horses-hoof-tab');
    // Select the first horse from the default MSW horse list (id 1) — wait for
    // the real card to land after the horses query resolves.
    await user.click(await screen.findByTestId('horse-card-1'));

    // The cross-tab "View Services" button only appears once a horse is selected.
    const viewServices = await screen.findByRole('button', { name: /view services/i });
    await user.click(viewServices);

    // Cross-tab handler switched to Services, and because a horse is selected the
    // booking banner shows the selected horse name (proving selection persisted
    // across the tab jump).
    const servicesTab = await screen.findByTestId('farrier-services-tab');
    expect(within(servicesTab).getByText(/booking for:/i)).toBeInTheDocument();
    // Booking buttons are now enabled (a horse is selected).
    expect(within(servicesTab).getByTestId('farrier-service-trim')).toBeInTheDocument();
  });

  it('the Services tab "My Horses" banner jumps back when no horse is selected (onNavigateToHorses)', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('horses-hoof-tab');

    // Go to Services without selecting a horse — the select-horse banner shows.
    await user.click(screen.getByRole('tab', { name: /services/i }));
    const servicesTab = await screen.findByTestId('farrier-services-tab');
    expect(within(servicesTab).getByTestId('farrier-select-horse-banner')).toBeInTheDocument();

    // Its "My Horses" button is the onNavigateToHorses cross-tab handler.
    await user.click(within(servicesTab).getByRole('button', { name: /my horses/i }));
    expect(await screen.findByTestId('horses-hoof-tab')).toBeInTheDocument();
  });
});
