/**
 * HorseDetailPage — color readout fallback tests (Equoria-lsi5).
 *
 * Verifies the branches of the color readout, which owner request 2026-10-28
 * (Equoria-2w4yo) moved from the line under the horse's name into the Horse
 * Details ledger's Color row (label in the row's <dt>, value in the <dd>):
 *   horse.phenotype?.colorName ?? 'not recorded'
 * (finalDisplayColor, the old fallback column, was dropped: Equoria-e66h.)
 *
 * Per Equoria-iwy3 (31E-FE-1) the literal string 'Unknown' was replaced with
 * 'not recorded' so legacy horses (phenotype: null)
 * render an honest fallback consistent with frontend-integration-backlog.md
 * doctrine (line 258): never show 'Unknown' for legacy horses.
 *
 * Each branch is exercised against a fresh
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
    });
    renderPage();
    const colorLine = await screen.findByTestId('horse-detail-color');
    await waitFor(() => expect(colorLine).toHaveTextContent(/^Bay$/));
    expect(colorLine).not.toHaveTextContent('Unknown');
  });

  test('the line under the name is gone; colour and temperament read in Horse Details — Equoria-2w4yo', async () => {
    // Owner request 2026-10-28: no "Breed: … • Color: … • Age: … • Gender: … •
    // Health: …" line, temperament line or markings box under the horse's name.
    global.fetch = makeFetch({
      phenotype: { colorName: 'Bay', faceMarking: 'star' },
      temperament: 'Spirited',
    });
    renderPage();
    const details = await screen.findByRole('region', { name: 'Horse Details' });
    await waitFor(() => expect(screen.getByTestId('horse-detail-color')).toHaveTextContent('Bay'));
    expect(details).toContainElement(screen.getByTestId('horse-detail-color'));
    expect(details).toContainElement(screen.getByTestId('horse-temperament-value'));
    expect(details).toContainElement(screen.getByTestId('markings-face-value'));
    for (const prefix of [/Breed:/, /Color:/, /Age:/, /Gender:/, /Health:/, /Temperament:/]) {
      expect(screen.queryByText(prefix)).not.toBeInTheDocument();
    }
    expect(screen.queryByTestId('horse-detail-age')).not.toBeInTheDocument();
    expect(screen.queryByTestId('markings-panel-title')).not.toBeInTheDocument();
  });

  test('there is no Coat tab; colour lives in Horse Details and genetics in the Genetics tab — Equoria-qzr6a', async () => {
    // Owner request 2026-10-28: "Coat does not need a special section all its
    // own in the clickable tabs."
    global.fetch = makeFetch({ phenotype: { colorName: 'Bay' } });
    renderPage();
    expect(await screen.findByRole('tab', { name: /Genetics/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Coat/ })).not.toBeInTheDocument();
    const details = screen.getByRole('region', { name: 'Horse Details' });
    expect(details).toContainElement(screen.getByTestId('horse-detail-color'));
  });

  test("renders 'not recorded' (never 'Unknown') when the phenotype is absent — Equoria-iwy3", async () => {
    // Per frontend-integration-backlog.md doctrine line 258: legacy horses with
    // colorGenotype: null and phenotype: null must NEVER show 'Unknown'. The
    // honest fallback is 'not recorded'.
    global.fetch = makeFetch({
      phenotype: null,
    });
    renderPage();
    const colorLine = await screen.findByTestId('horse-detail-color');
    await waitFor(() => expect(colorLine).toHaveTextContent(/^not recorded$/));
    // Sentinel-positive: the literal 'Unknown' must never appear in the color line.
    expect(colorLine).not.toHaveTextContent('Unknown');
  });

  test('handles malformed phenotype (array) without crash via type guard', async () => {
    // CONTRIBUTING.md §1 JSONB type guard: arrays must not produce a colorName.
    // This sentinel proves the guard is wired correctly — without it, the
    // fallback would silently degrade rather than fail loudly.
    global.fetch = makeFetch({
      phenotype: ['unexpected'],
    });
    renderPage();
    const colorLine = await screen.findByTestId('horse-detail-color');
    // Should fall through to 'not recorded', NOT crash and NOT read [0].
    await waitFor(() => expect(colorLine).toHaveTextContent(/^not recorded$/));
  });

  // Equoria-1k4n — the temperament line in the same header block previously
  // rendered the literal 'Unknown', contradicting the iwy3 doctrine comment
  // sitting a few lines above it. The 1k4n scope is the literal-string fix:
  // the fallback must read 'not recorded', never 'Unknown'.
  //
  // NOTE: the adjacent wiring bug referenced here (the `horse` object
  // construction never copied `temperament` from the fetched row, so the line
  // could never show a real DB value) was filed as Equoria-gncv and FIXED —
  // HorseDetailPage.tsx now passes `temperament` through. The real-value path
  // is covered by HorseDetailPage.temperament-wiring.test.tsx. The two tests
  // below remain scoped to the 1k4n literal-string contract (legacy-null and
  // never-'Unknown'), which is still a valid, distinct guarantee.
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
