/**
 * HorseDetailPage — color readout fallback tests (Equoria-lsi5).
 *
 * Verifies the three branches of the fallback chain on the page header:
 *   horse.phenotype?.colorName ?? horse.finalDisplayColor ?? 'not recorded'
 *
 * Per Equoria-iwy3 (31E-FE-1) the literal string 'Unknown' was replaced with
 * 'not recorded' so legacy horses (phenotype: null, finalDisplayColor: null)
 * render an honest fallback consistent with frontend-integration-backlog.md
 * doctrine (line 258): never show 'Unknown' for legacy horses.
 *
 * This mirrors HorseCard.tsx:130. Each branch is exercised against a fresh
 * mocked API response so a regression in the readout cannot pass silently.
 *
 * Per CLAUDE.md frontend testing philosophy: existing unit tests may keep
 * mocked fetch responses; new full-stack feature coverage prefers Playwright.
 * These three unit assertions are scoped to the render-layer fallback only —
 * the end-to-end real-DB color chip is covered by the Equoria-fhag sentinel.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, MockAuthProvider } from '../../test/utils';
import { vi } from 'vitest';
import HorseDetailPage from '../HorseDetailPage';

const baseHorse = {
  id: 1,
  name: 'ColorTest',
  breed: 'Thoroughbred',
  age: 5,
  gender: 'Stallion',
  dateOfBirth: '2020-03-15',
  healthStatus: 'Excellent',
  stats: {
    speed: 50,
    stamina: 50,
    agility: 50,
    strength: 50,
    intelligence: 50,
    precision: 50,
    balance: 50,
    boldness: 50,
    flexibility: 50,
    obedience: 50,
    focus: 50,
    endurance: 50,
  },
  disciplineScores: {},
};

const originalFetch = global.fetch;

function makeFetch(horseOverride: Record<string, unknown>) {
  return vi.fn(((url: RequestInfo | URL) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (
      urlStr.includes('/epigenetic-insights') ||
      urlStr.includes('/trait-interactions') ||
      urlStr.includes('/trait-timeline') ||
      urlStr.includes('/genotype') ||
      urlStr.includes('/color')
    ) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { traits: [] } }),
      } as Response);
    }
    // Main horse fetch
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: { ...baseHorse, ...horseOverride },
        }),
    } as Response);
  }) as typeof fetch);
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  window.history.pushState({}, 'Test', '/horses/1');
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/horses/:id" element={<HorseDetailPage />} />
          </Routes>
        </BrowserRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('HorseDetailPage color readout fallback (Equoria-lsi5)', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test('renders phenotype.colorName when present (canonical-DB case)', async () => {
    global.fetch = makeFetch({
      phenotype: { colorName: 'Bay' },
      // legacy column is null for every real horse — still must be ignored
      finalDisplayColor: null,
    });
    renderPage();
    const colorLine = await screen.findByTestId('horse-detail-color');
    await waitFor(() => expect(colorLine).toHaveTextContent('Color: Bay'));
    expect(colorLine).not.toHaveTextContent('Unknown');
  });

  test('falls back to finalDisplayColor when phenotype is null', async () => {
    global.fetch = makeFetch({
      phenotype: null,
      finalDisplayColor: 'Chestnut',
    });
    renderPage();
    const colorLine = await screen.findByTestId('horse-detail-color');
    await waitFor(() => expect(colorLine).toHaveTextContent('Color: Chestnut'));
  });

  test("renders 'not recorded' (never 'Unknown') when both fields are absent — Equoria-iwy3", async () => {
    // Per frontend-integration-backlog.md doctrine line 258: legacy horses with
    // colorGenotype: null and phenotype: null must NEVER show 'Unknown'. The
    // honest fallback is 'not recorded'.
    global.fetch = makeFetch({
      phenotype: null,
      finalDisplayColor: null,
    });
    renderPage();
    const colorLine = await screen.findByTestId('horse-detail-color');
    await waitFor(() => expect(colorLine).toHaveTextContent('Color: not recorded'));
    // Sentinel-positive: the literal 'Unknown' must never appear in the color line.
    expect(colorLine).not.toHaveTextContent('Unknown');
  });

  test('handles malformed phenotype (array) without crash via type guard', async () => {
    // CONTRIBUTING.md §1 JSONB type guard: arrays must not produce a colorName.
    // This sentinel proves the guard is wired correctly — without it, the
    // fallback would silently degrade rather than fail loudly.
    global.fetch = makeFetch({
      phenotype: ['unexpected'],
      finalDisplayColor: 'Black',
    });
    renderPage();
    const colorLine = await screen.findByTestId('horse-detail-color');
    // Should fall through to finalDisplayColor, NOT crash and NOT read [0].
    await waitFor(() => expect(colorLine).toHaveTextContent('Color: Black'));
  });

  test('phenotype.colorName wins over finalDisplayColor when both populated', async () => {
    global.fetch = makeFetch({
      phenotype: { colorName: 'Palomino' },
      finalDisplayColor: 'Bay', // should be ignored
    });
    renderPage();
    const colorLine = await screen.findByTestId('horse-detail-color');
    await waitFor(() => expect(colorLine).toHaveTextContent('Color: Palomino'));
    expect(colorLine).not.toHaveTextContent('Bay');
  });

  // Equoria-1k4n — the temperament line in the same header block previously
  // rendered the literal 'Unknown', contradicting the iwy3 doctrine comment
  // sitting a few lines above it. The 1k4n scope is the literal-string fix:
  // the fallback must read 'not recorded', never 'Unknown'.
  //
  // NOTE (adjacent bug, filed separately per OPTIMAL_FIX_DISCIPLINE §3): the
  // HorseDetailPage `horse` object construction (HorseDetailPage.tsx ~321-422)
  // never copies `temperament` from the fetched row, so this line ALWAYS hits
  // the fallback regardless of the real DB value. That wiring gap is a
  // distinct defect tracked in its own issue — NOT bundled into 1k4n. These
  // tests therefore assert the literal-string contract (the 1k4n scope), not
  // the (currently impossible) real-value path.
  test("temperament: legacy horse renders 'not recorded' (never 'Unknown') — Equoria-1k4n", async () => {
    global.fetch = makeFetch({ temperament: null });
    renderPage();
    const tempValue = await screen.findByTestId('horse-temperament-value');
    await waitFor(() => expect(tempValue).toHaveTextContent('not recorded'));
    // Sentinel-positive: the exact defect (literal 'Unknown') must NOT appear.
    expect(tempValue).not.toHaveTextContent('Unknown');
  });

  test("temperament: literal 'Unknown' never appears even when a value is sent — Equoria-1k4n", async () => {
    // Even with a populated temperament the line must not regress to the
    // literal 'Unknown' string.
    global.fetch = makeFetch({ temperament: 'Spirited' });
    renderPage();
    const tempValue = await screen.findByTestId('horse-temperament-value');
    await waitFor(() => expect(tempValue).toBeInTheDocument());
    expect(tempValue).not.toHaveTextContent('Unknown');
  });

  // Equoria-gncv — the wiring gap referenced in the NOTE above is now fixed:
  // `temperament` is copied off horseRaw during the `horse` object
  // construction. These sentinels assert the REAL value reaches the render
  // layer (the previously-impossible path) and that the fallback still
  // applies when the column is null.
  test('temperament: real DB value is displayed (wiring fixed) — Equoria-gncv', async () => {
    global.fetch = makeFetch({ temperament: 'Spirited' });
    renderPage();
    const tempValue = await screen.findByTestId('horse-temperament-value');
    // Before the gncv fix this could only ever read 'not recorded'.
    await waitFor(() => expect(tempValue).toHaveTextContent('Spirited'));
    expect(tempValue).not.toHaveTextContent('not recorded');
  });

  test("temperament: null column still falls back to 'not recorded' — Equoria-gncv", async () => {
    // Sentinel-negative: the fix must not break the honest empty state for
    // legacy horses that genuinely have no temperament.
    global.fetch = makeFetch({ temperament: null });
    renderPage();
    const tempValue = await screen.findByTestId('horse-temperament-value');
    await waitFor(() => expect(tempValue).toHaveTextContent('not recorded'));
  });
});
