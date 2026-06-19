/**
 * VeterinarianPage tab render/switch tests (Equoria-o5hub.30)
 *
 * The Vet Clinic had no test file. It uses controlled CanonicalTabs (My Horses /
 * Services). This covers the basic tab render + switch and the horse-selection
 * booking panel that appears below the My Horses grid.
 *
 * Strategy: real page, real CanonicalTabs, real useHorses (default MSW handler)
 * and real useVetServices via a per-test MSW handler. No vi.mock of our API
 * client (CLAUDE.md §3).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import React from 'react';
import VeterinarianPage from '../VeterinarianPage';

function vetServicesHandler() {
  return http.get('*/api/v1/vet/services', () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          id: 'checkup',
          name: 'Health Check',
          description: 'Routine health assessment.',
          cost: 200,
          duration: '20 min',
        },
        {
          id: 'genetics',
          name: 'Genetics Analysis',
          description: 'Reveals hidden bloodline traits.',
          cost: 600,
          duration: '45 min',
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
        <VeterinarianPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('VeterinarianPage — tab render/switch (Equoria-o5hub.30)', () => {
  beforeEach(() => {
    server.use(vetServicesHandler());
  });

  it('renders the My Horses tab by default', async () => {
    renderPage();
    expect(await screen.findByTestId('horses-health-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('vet-services-tab')).not.toBeInTheDocument();
  });

  it('switching to the Services tab shows the vet service catalog', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('horses-health-tab');

    await user.click(screen.getByRole('tab', { name: /services/i }));

    const servicesTab = await screen.findByTestId('vet-services-tab');
    expect(within(servicesTab).getByTestId('vet-service-checkup')).toBeInTheDocument();
    expect(within(servicesTab).getByTestId('vet-service-genetics')).toBeInTheDocument();
    expect(screen.queryByTestId('horses-health-tab')).not.toBeInTheDocument();
  });

  it('selecting a horse in My Horses reveals the booking panel for that horse', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('horses-health-tab');

    // Before selection: instructional prompt, no booking panel.
    expect(screen.queryByTestId('vet-booking-panel')).not.toBeInTheDocument();

    await user.click(await screen.findByTestId('horse-card-1'));

    // The booking panel appears below the grid with that horse's service buttons.
    const panel = await screen.findByTestId('vet-booking-panel');
    expect(within(panel).getByTestId('book-btn-1-checkup')).toBeInTheDocument();
  });

  it('clicking a selected horse again deselects it and hides the booking panel', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('horses-health-tab');

    const card = await screen.findByTestId('horse-card-1');
    await user.click(card);
    expect(await screen.findByTestId('vet-booking-panel')).toBeInTheDocument();

    // Toggle off — the page's handleSelectHorse deselects on re-click.
    await user.click(screen.getByTestId('horse-card-1'));
    expect(screen.queryByTestId('vet-booking-panel')).not.toBeInTheDocument();
  });
});
