/**
 * VeterinarianPage — booking-panel services four-state tests (Equoria-l22ki)
 *
 * Regression guard for the "permanent Loading services… dead-end" defect: the
 * booking panel (My Horses tab, after a horse is selected) rendered a static
 * "Loading services…" line whenever the vet-services list was empty — which
 * conflated LOADING with a genuinely-empty OR an ERRORED catalog, producing a
 * dead-end you can never book from. Per FRONTEND_ASYNC_STATE_DOCTRINE §1 the
 * booking panel must distinguish LOADING → ERROR (visible + retry) → EMPTY
 * (only via success) → SUCCESS. AC: "Vet page can never be a permanent
 * 'Loading services...' dead-end."
 *
 * The tab-level renders (HorsesHealthTab useHorses / ServicesTab useVetServices)
 * were already four-state-correct on master (o5hub.17); this suite guards the
 * booking-panel sub-surface (VeterinarianPage.tsx:139-140,275) that was NOT.
 *
 * Boundary-level test: real useHorses / useVetServices over the real apiClient,
 * HTTP boundary stubbed by MSW. No vi.mock of the hooks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import VeterinarianPage from '../VeterinarianPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const HORSES = `${base}/api/v1/horses`;
const VET_SERVICES = `${base}/api/v1/vet/services`;

const sampleHorse = {
  id: 1,
  name: 'Storm Runner',
  breed: 'Thoroughbred',
  gender: 'stallion',
  age: 5,
  dateOfBirth: '2020-01-01T00:00:00Z',
  healthStatus: 'Good',
  imageUrl: undefined,
  stats: { speed: 75, stamina: 70, agility: 65, strength: 60, intelligence: 55, health: 80 },
  disciplineScores: { dressage: 45 },
  traits: ['Bold'],
  description: 'A spirited thoroughbred.',
  parentIds: {},
};

const sampleService = {
  id: 'checkup',
  name: 'Routine Check-up',
  description: 'A general health check.',
  cost: 250,
  duration: '30 min',
};

function stubHorses() {
  server.use(http.get(HORSES, () => HttpResponse.json({ success: true, data: [sampleHorse] })));
}

describe('VeterinarianPage — booking-panel services four-state (Equoria-l22ki)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    stubHorses();
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: 5, username: 'VetTester' }}>
          <MemoryRouter initialEntries={['/world/veterinarian']}>
            <VeterinarianPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

  async function selectFirstHorse(user: ReturnType<typeof userEvent.setup>) {
    const card = await screen.findByTestId('horse-card-1');
    await user.click(card);
    return screen.findByTestId('vet-booking-panel');
  }

  // ERROR — a failed services fetch must NOT leave the booking panel as a
  // permanent "Loading services…" dead-end; it renders an error + retry.
  it('booking panel renders error+retry (not a permanent Loading services… dead-end) when the services fetch fails', async () => {
    server.use(
      http.get(VET_SERVICES, () =>
        HttpResponse.json({ status: 'error', message: 'vet boom detail' }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderPage();

    const panel = await selectFirstHorse(user);

    // The dead-end lie must be gone.
    expect(within(panel).queryByText(/loading services/i)).not.toBeInTheDocument();
    // Honest error + retry inside the panel.
    const alert = within(panel).getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    // Raw server error text must never leak (doctrine §3).
    expect(within(panel).queryByText(/vet boom detail/i)).not.toBeInTheDocument();
  });

  // EMPTY — a successful-but-empty catalog is honest, not "Loading services…".
  it('booking panel renders an honest empty (not Loading services…) when the catalog is genuinely empty', async () => {
    server.use(http.get(VET_SERVICES, () => HttpResponse.json({ success: true, data: [] })));

    const user = userEvent.setup();
    renderPage();

    const panel = await selectFirstHorse(user);

    expect(within(panel).queryByText(/loading services/i)).not.toBeInTheDocument();
    expect(within(panel).getByText(/no services available/i)).toBeInTheDocument();
    expect(within(panel).queryByRole('alert')).not.toBeInTheDocument();
  });

  // SUCCESS — real services render as booking buttons.
  it('booking panel renders service booking buttons on a successful catalog fetch', async () => {
    server.use(
      http.get(VET_SERVICES, () => HttpResponse.json({ success: true, data: [sampleService] }))
    );

    const user = userEvent.setup();
    renderPage();

    const panel = await selectFirstHorse(user);

    expect(within(panel).getByTestId('book-btn-1-checkup')).toBeInTheDocument();
    expect(within(panel).queryByText(/loading services/i)).not.toBeInTheDocument();
    expect(within(panel).queryByRole('alert')).not.toBeInTheDocument();
  });
});
