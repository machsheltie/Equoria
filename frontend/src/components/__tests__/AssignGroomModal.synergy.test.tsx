/**
 * AssignGroomModal — Synergy preview tests (Equoria-atb6 / 31D-FE-2).
 *
 * Verifies:
 *   1. Synergy badge renders per groom row when horseTemperament is non-null
 *      AND the synergy preview is non-zero (positive +X% or negative -X%).
 *   2. Synergy badge is hidden when synergy === 0 (silence-is-golden — no
 *      clutter for non-matching pairs).
 *   3. Synergy badges are NOT rendered for any groom when horseTemperament is
 *      null (legacy horse) — no fetches fire, no N+1 storm.
 *
 * Uses global.fetch stub to control the per-pair synergy endpoint response.
 * Matches the existing global.fetch pattern used in HorseDetailPage tests
 * (no vi.mock of api-client, per CLAUDE.md frontend testing philosophy).
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import AssignGroomModal from '../AssignGroomModal';

const mockAvailableGrooms = [
  {
    id: 1,
    name: 'Sarah Johnson',
    skillLevel: 'expert',
    specialty: 'foalCare',
    personality: 'patient',
    experience: 8,
    sessionRate: 100,
    isActive: true,
    availableSlots: 2,
    currentAssignments: 2,
    maxAssignments: 4,
  },
  {
    id: 2,
    name: 'Mike Rodriguez',
    skillLevel: 'intermediate',
    specialty: 'general',
    personality: 'strict',
    experience: 5,
    sessionRate: 75,
    isActive: true,
    availableSlots: 1,
    currentAssignments: 2,
    maxAssignments: 3,
  },
];

const originalFetch = global.fetch;

/**
 * Stub the synergy endpoint. Returns per-pair shapes keyed by groomId:
 *   groomId 1 (patient) — Nervous horse → +25% bonding
 *   groomId 2 (strict)  — Nervous horse → -15% bonding (negative)
 */
function makeSynergyFetch(synergyByGroomId: Record<number, number>) {
  return vi.fn(((url: RequestInfo | URL) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    const match = urlStr.match(/\/api\/v1\/grooms\/(\d+)\/horses\/(\d+)\/synergy/);
    if (match) {
      const groomId = Number(match[1]);
      const modifier = synergyByGroomId[groomId] ?? 0;
      const pct = Math.round(modifier * 100);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              synergyModifier: modifier,
              temperament: 'Nervous',
              personality: groomId === 1 ? 'patient' : 'strict',
              message:
                modifier > 0
                  ? `+${pct}% bonding: ${groomId === 1 ? 'Patient' : 'Strict'} groom × Nervous horse`
                  : modifier < 0
                    ? `${pct}% bonding: ${groomId === 1 ? 'Patient' : 'Strict'} groom × Nervous horse`
                    : 'No synergy',
            },
          }),
      } as Response);
    }
    // Fallback for any other request the modal might issue
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: {} }),
    } as Response);
  }) as typeof fetch);
}

function renderModal(props: { horseTemperament?: string | null; fetchImpl?: typeof fetch }) {
  if (props.fetchImpl) global.fetch = props.fetchImpl;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AssignGroomModal
          isOpen={true}
          onClose={() => {}}
          horseId={42}
          horseName="Nervous Nelly"
          userId={1}
          availableGrooms={mockAvailableGrooms}
          horseTemperament={props.horseTemperament ?? null}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('AssignGroomModal — Synergy Preview (Equoria-atb6)', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test('renders positive synergy badge when temperament present + matching personality', async () => {
    renderModal({
      horseTemperament: 'Nervous',
      fetchImpl: makeSynergyFetch({ 1: 0.25, 2: 0 }), // patient=+25%, strict=0 for test
    });

    // Wait for the patient groom's badge to render
    const badges = await screen.findAllByTestId('groom-row-synergy-badge');
    expect(badges.length).toBe(1);
    expect(badges[0]).toHaveAttribute('data-synergy-sign', 'positive');
    expect(badges[0]).toHaveTextContent('+25% bonding');
  });

  test('renders negative synergy badge when modifier < 0', async () => {
    renderModal({
      horseTemperament: 'Nervous',
      fetchImpl: makeSynergyFetch({ 1: 0, 2: -0.15 }), // strict=-15% for Nervous
    });

    const badges = await screen.findAllByTestId('groom-row-synergy-badge');
    expect(badges.length).toBe(1);
    expect(badges[0]).toHaveAttribute('data-synergy-sign', 'negative');
    expect(badges[0]).toHaveTextContent('-15% bonding');
  });

  test('hides synergy badge entirely when modifier === 0 (silence-is-golden)', async () => {
    renderModal({
      horseTemperament: 'Nervous',
      fetchImpl: makeSynergyFetch({ 1: 0, 2: 0 }),
    });

    // Wait for the modal + grooms to render
    await screen.findByText('Sarah Johnson');
    // Give the fetch a beat to resolve
    await waitFor(() => {
      expect(screen.queryAllByTestId('groom-row-synergy-badge').length).toBe(0);
    });
  });

  test('does NOT fire synergy fetches when horseTemperament is null', async () => {
    const fetchSpy = makeSynergyFetch({ 1: 0.25, 2: 0.25 });
    renderModal({ horseTemperament: null, fetchImpl: fetchSpy });

    await screen.findByText('Sarah Johnson');
    // No synergy badges anywhere — the conditional gate prevents the hook from
    // mounting at all when temperament is null.
    expect(screen.queryAllByTestId('groom-row-synergy-badge').length).toBe(0);

    // Sentinel: confirm no synergy URL was ever requested.
    const synergyCalls = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => {
        const url = c[0];
        const urlStr = typeof url === 'string' ? url : (url as URL).toString();
        return urlStr.includes('/synergy');
      }
    );
    expect(synergyCalls.length).toBe(0);
  });
});
