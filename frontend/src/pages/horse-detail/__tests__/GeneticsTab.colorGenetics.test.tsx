/**
 * Genetics tab, owner ruling 2026-10-26 (q72): traits plus color genetics;
 * color genetics stay hidden until the Vet's Genetic Testing is paid for; the
 * invented numbers and the Behavioral Flags panel are gone.
 * Old contract: Genetic Potential / Average Trait Strength / Breeding Value /
 * "prime breeding candidate" tiles, per-trait strength and rarity, and a flags
 * panel (Equoria-8tz7p, Equoria-q4uem.14, Equoria-8v2y9).
 *
 * Real GeneticsTab and hooks; the API is answered by MSW.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import GeneticsTab from '../GeneticsTab';
import type { Horse } from '../HorseDetailPageTypes';
import { server } from '@/test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const horse = {
  id: 79,
  name: 'TestFixture-Color',
  breed: 'Thoroughbred',
  age: 4,
  gender: 'Mare',
  dateOfBirth: '2022-01-01T00:00:00.000Z',
  healthStatus: 'Excellent',
  stats: {},
  disciplineScores: {},
} as unknown as Horse;

function stub(genetics: Record<string, unknown>) {
  server.use(
    http.get(`${base}/api/v1/traits/horse/79`, () =>
      HttpResponse.json({
        success: true,
        data: {
          traits: {
            positive: [{ name: 'resilient', definition: { type: 'positive', rarity: 'rare' } }],
            negative: [],
            hiddenCount: 0,
          },
        },
      })
    ),
    http.get(`${base}/api/v1/traits/discovery-status/79`, () =>
      HttpResponse.json({ success: true, data: { traitCounts: { visible: 1, hidden: 0 } } })
    ),
    http.get(`${base}/api/v1/horses/79/genetics`, () =>
      HttpResponse.json({ success: true, data: genetics })
    )
  );
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <GeneticsTab horse={horse} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('GeneticsTab color genetics (q72)', () => {
  it('keeps color genetics hidden for an untested horse and points to the Vet', async () => {
    stub({ horseId: 79, horseName: 'x', colorGeneticsTested: false });
    renderTab();
    expect(await screen.findByTestId('color-genetics-untested')).toBeInTheDocument();
    expect(screen.queryByTestId('color-genotype-table')).toBeNull();
    expect(screen.getByRole('link', { name: /vet clinic/i })).toHaveAttribute('href', '/vet');
  });

  it('shows the genotype with authored gene names once tested, never stored codes', async () => {
    stub({
      horseId: 79,
      horseName: 'x',
      colorGeneticsTested: true,
      colorGenotype: { E_Extension: 'E/e', A_Agouti: 'A/a' },
      phenotype: null,
    });
    renderTab();
    expect(await screen.findByTestId('color-genotype-table')).toBeInTheDocument();
    expect(screen.getByText('Extension')).toBeInTheDocument();
    expect(screen.getByText('E/e')).toBeInTheDocument();
    expect(screen.queryByText(/E_Extension/)).toBeNull();
    expect(screen.queryByTestId('color-genetics-untested')).toBeNull();
  });

  // Owner ruling 2026-10-29 (q294, Equoria-9kakx): the game admin sees all
  // colour genetics, tested or not. The server sends her the genotype of an
  // untested horse (no one else gets it); the tab shows it.
  it('shows the genotype the server sends the admin for an untested horse', async () => {
    stub({
      horseId: 79,
      horseName: 'x',
      colorGeneticsTested: false,
      colorGenotype: { E_Extension: 'e/e' },
      phenotype: null,
    });
    renderTab();
    expect(await screen.findByTestId('color-genotype-table')).toBeInTheDocument();
    expect(screen.getByText('e/e')).toBeInTheDocument();
    expect(screen.queryByTestId('color-genetics-untested')).toBeNull();
  });

  it('lists the horse traits without strength, rarity or invented scores, and no flags panel', async () => {
    stub({ horseId: 79, horseName: 'x', colorGeneticsTested: false });
    renderTab();
    const card = await screen.findByTestId('trait-card');
    expect(card).toHaveTextContent(/resilient/i);
    expect(card).not.toHaveTextContent(/rare|legendary|common|strength/i);
    for (const gone of [
      /genetic potential/i,
      /average trait strength/i,
      /breeding value/i,
      /prime breeding candidate/i,
      /behavioral/i,
      /unknown flag/i,
    ]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });
});
