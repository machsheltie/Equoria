/**
 * HorseDetailPage — temperament wiring regression tests (Equoria-gncv).
 *
 * Bug (filed as Equoria-gncv, adjacent-locations finding from Equoria-1k4n):
 * the HorseDetailPage `horse: Horse` object is constructed by hand at
 * HorseDetailPage.tsx (~lines 321-422) from the fetched row. That construction
 * never copied `temperament` from `horseRaw`, so `horse.temperament` was always
 * `undefined`. As a result the temperament line (data-testid
 * `horse-temperament-value`, HorseDetailPage.tsx:601) AND the
 * `highlightTemperament` prop passed to TemperamentReferenceModal
 * (HorseDetailPage.tsx:803) could NEVER show the real DB value — they always
 * fell back to 'not recorded' even for horses whose row carried a real
 * temperament (e.g. 'Spirited').
 *
 * The literal-string fallback ('not recorded', not 'Unknown') was already
 * corrected under Equoria-1k4n / Equoria-iwy3. This file covers the distinct
 * WIRING defect: a populated temperament from the API must actually render.
 *
 * Sentinel-positive design: the first test fails on pre-fix code (the field is
 * dropped → 'not recorded' shown instead of 'Spirited'). It passes only once
 * the object construction copies `temperament` through. The fallback test
 * guards the legacy-null path so the fix can't over-correct into showing a
 * literal where data is genuinely absent.
 *
 * Per CLAUDE.md frontend testing philosophy: existing unit tests may keep
 * mocked fetch responses; these assertions are scoped to the render-layer
 * wiring only.
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
  name: 'TemperamentTest',
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

describe('HorseDetailPage temperament wiring (Equoria-gncv)', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test('renders the REAL temperament value from the API row (was dropped during object construction)', async () => {
    // SENTINEL-POSITIVE: pre-fix this fails — the field is never copied into
    // the constructed `horse` object so the line shows 'not recorded'. Post-fix
    // the actual DB value 'Spirited' renders.
    global.fetch = makeFetch({ temperament: 'Spirited' });
    renderPage();
    const tempValue = await screen.findByTestId('horse-temperament-value');
    await waitFor(() => expect(tempValue).toHaveTextContent('Spirited'));
    expect(tempValue).not.toHaveTextContent('not recorded');
    expect(tempValue).not.toHaveTextContent('Unknown');
  });

  test('a different temperament value also renders (not a hardcoded string)', async () => {
    // Guards against a fix that accidentally hardcodes one value: a second,
    // distinct temperament must round-trip too.
    global.fetch = makeFetch({ temperament: 'Calm' });
    renderPage();
    const tempValue = await screen.findByTestId('horse-temperament-value');
    await waitFor(() => expect(tempValue).toHaveTextContent('Calm'));
    expect(tempValue).not.toHaveTextContent('not recorded');
  });

  test("legacy horse with null temperament still renders 'not recorded' (never 'Unknown')", async () => {
    // The fix must not over-correct: a genuinely absent value still uses the
    // honest 'not recorded' fallback per the Equoria-iwy3 convention.
    global.fetch = makeFetch({ temperament: null });
    renderPage();
    const tempValue = await screen.findByTestId('horse-temperament-value');
    await waitFor(() => expect(tempValue).toHaveTextContent('not recorded'));
    expect(tempValue).not.toHaveTextContent('Unknown');
  });

  test('temperament omitted entirely from the row falls back to not recorded', async () => {
    // Boundary: the API row has no `temperament` key at all (undefined, not
    // null). Must still hit the fallback, not render 'undefined'.
    global.fetch = makeFetch({});
    renderPage();
    const tempValue = await screen.findByTestId('horse-temperament-value');
    await waitFor(() => expect(tempValue).toHaveTextContent('not recorded'));
    expect(tempValue).not.toHaveTextContent('undefined');
    expect(tempValue).not.toHaveTextContent('Unknown');
  });
});
