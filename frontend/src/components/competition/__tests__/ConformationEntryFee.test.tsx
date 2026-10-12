/**
 * Conformation pages show the entry fee — Equoria-wgfbf (follow-up of
 * Equoria-mwjst).
 *
 * Since Equoria-mwjst, entering a conformation show debits the show's
 * configured entry fee (owner ruling 2026-10-05: same as regular shows). Owner
 * ruling 2026-10-06: "Each page should show the entry fee." The regular-show
 * card, detail modal and entry confirmation already do; the conformation show
 * list and its entry dialog showed no price at all, so a player could be
 * charged without seeing one.
 *
 * Boundary-level: real components and React Query hooks, the network stubbed
 * with MSW — the fee rendered must be the server's `entryFee`, never a constant.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import ConformationShowsPanel from '../ConformationShowsPanel';
import ConformationEntryModal from '../ConformationEntryModal';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const PAID_SHOW = {
  id: 101,
  name: 'Moonlit Conformation Classic',
  discipline: 'Conformation',
  date: '2026-10-12T00:00:00Z',
  entryFee: 250,
  prizePool: 0,
  status: 'open',
  showType: 'conformation',
};
const FREE_SHOW = { ...PAID_SHOW, id: 102, name: 'Lantern Yard Halter Show', entryFee: 0 };

/** The dialog's eligibility read for the entered horse, as the backend shapes it. */
function stubEligibleHorse(horseId: number) {
  server.use(
    http.get(`${base}/api/v1/competition/conformation/eligibility/${horseId}`, () =>
      HttpResponse.json({
        success: true,
        data: {
          horseId,
          horseName: 'Starlight',
          eligible: true,
          errors: [],
          warnings: [],
          ageClass: 'Mature',
          groomAssigned: true,
        },
      })
    )
  );
}

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>{ui}</MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('conformation pages show the entry fee (Equoria-wgfbf)', () => {
  it('each open conformation show in the list shows its entry fee from the server', async () => {
    server.use(
      http.get(`${base}/api/v1/competition`, () =>
        HttpResponse.json({ success: true, data: [PAID_SHOW, FREE_SHOW] })
      )
    );

    renderWithProviders(<ConformationShowsPanel />);

    const paidRow = await screen.findByTestId(`conformation-show-row-${PAID_SHOW.id}`);
    expect(within(paidRow).getByTestId(`conformation-show-fee-${PAID_SHOW.id}`)).toHaveTextContent(
      /Entry:\s*250/
    );
    const freeRow = screen.getByTestId(`conformation-show-row-${FREE_SHOW.id}`);
    expect(within(freeRow).getByTestId(`conformation-show-fee-${FREE_SHOW.id}`)).toHaveTextContent(
      /Entry:\s*Free/
    );
  });

  it('the entry dialog states the fee the player is about to pay', async () => {
    stubEligibleHorse(7);
    renderWithProviders(
      <ConformationEntryModal
        isOpen={true}
        onClose={() => {}}
        show={{ id: PAID_SHOW.id, name: PAID_SHOW.name, entryFee: PAID_SHOW.entryFee }}
        horse={{ id: 7, name: 'Starlight', sex: 'Mare' }}
      />
    );

    expect(await screen.findByTestId('conformation-entry-fee')).toHaveTextContent(
      /Entry fee:\s*250/
    );
  });

  it('a free conformation show says so in the entry dialog', async () => {
    stubEligibleHorse(7);
    renderWithProviders(
      <ConformationEntryModal
        isOpen={true}
        onClose={() => {}}
        show={{ id: FREE_SHOW.id, name: FREE_SHOW.name, entryFee: FREE_SHOW.entryFee }}
        horse={{ id: 7, name: 'Starlight', sex: 'Mare' }}
      />
    );

    expect(await screen.findByTestId('conformation-entry-fee')).toHaveTextContent(
      /Entry fee:\s*Free/
    );
  });
});
