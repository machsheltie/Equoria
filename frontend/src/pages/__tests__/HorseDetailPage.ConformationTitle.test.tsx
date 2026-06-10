/**
 * HorseDetailPage — Conformation Title display tests (Equoria-8xfo / 31F-FE-2).
 *
 * Verifies:
 *   1. Title ribbon renders next to horse name when currentTitle + titlePoints > 0.
 *   2. Conformation Titles block in Stud/Sale tab shows currentTitle, titlePoints,
 *      and breedingValueBoost when titlePoints > 0.
 *   3. Both the ribbon and the block are HIDDEN when titlePoints === 0 and
 *      currentTitle is null (legacy / never-shown horses) — silence-is-golden.
 *
 * Approach mirrors HorseDetailPage.color-fallback.test.tsx — uses global.fetch
 * stub so it stays inside the existing unit-test pattern (no vi.mock of
 * api-client, per CLAUDE.md frontend testing philosophy).
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, MockAuthProvider } from '../../test/utils';
import { vi } from 'vitest';
import HorseDetailPage from '../HorseDetailPage';

const baseHorse = {
  id: 1,
  name: 'TitleTest',
  breed: 'Thoroughbred',
  age: 5,
  gender: 'Stallion',
  dateOfBirth: '2020-03-15',
  healthStatus: 'Excellent',
  phenotype: { colorName: 'Bay' },
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

describe('HorseDetailPage — Conformation Titles (Equoria-8xfo)', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test('renders title ribbon when currentTitle is set and titlePoints > 0', async () => {
    global.fetch = makeFetch({
      currentTitle: 'Champion',
      titlePoints: 1500,
      breedingValueBoost: 0.1,
    });
    renderPage();
    const ribbon = await screen.findByTestId('horse-detail-title-ribbon');
    await waitFor(() => expect(ribbon).toHaveTextContent('Champion'));
    // Tooltip should include +10% boost
    expect(ribbon.getAttribute('title')).toContain('+10%');
  });

  test('hides title ribbon when horse has never been shown (titlePoints === 0)', async () => {
    global.fetch = makeFetch({
      currentTitle: null,
      titlePoints: 0,
      breedingValueBoost: 0,
    });
    renderPage();
    // Wait for the page to settle by finding the stud tab (visible in header chrome).
    await screen.findByRole('tab', { name: /Stud \/ Sale/i });
    expect(screen.queryByTestId('horse-detail-title-ribbon')).toBeNull();
  });

  test('Stud/Sale tab shows Conformation Titles block with all three fields', async () => {
    global.fetch = makeFetch({
      currentTitle: 'Champion',
      titlePoints: 1500,
      breedingValueBoost: 0.1,
    });
    renderPage();

    // Switch to Stud/Sale tab (Radix trigger — userEvent fires the full pointer sequence)
    const studTab = await screen.findByRole('tab', { name: /Stud \/ Sale/i });
    await userEvent.click(studTab);

    const block = await screen.findByTestId('conformation-titles-block');
    expect(block).toBeInTheDocument();
    expect(screen.getByTestId('conformation-current-title')).toHaveTextContent('Champion');
    expect(screen.getByTestId('conformation-title-points')).toHaveTextContent('1,500');
    expect(screen.getByTestId('conformation-breeding-boost')).toHaveTextContent('+10%');
  });

  test('Stud/Sale tab hides Conformation Titles block when never shown', async () => {
    global.fetch = makeFetch({
      currentTitle: null,
      titlePoints: 0,
      breedingValueBoost: 0,
    });
    renderPage();

    const studTab = await screen.findByRole('tab', { name: /Stud \/ Sale/i });
    await userEvent.click(studTab);

    // Wait for stud-sale-tab to render (proves we navigated)
    await screen.findByTestId('stud-sale-tab');
    expect(screen.queryByTestId('conformation-titles-block')).toBeNull();
  });

  test('Stud/Sale tab omits boost row when breedingValueBoost is 0 but title exists', async () => {
    global.fetch = makeFetch({
      currentTitle: 'Show Champion',
      titlePoints: 500,
      breedingValueBoost: 0,
    });
    renderPage();

    const studTab = await screen.findByRole('tab', { name: /Stud \/ Sale/i });
    await userEvent.click(studTab);

    await screen.findByTestId('conformation-titles-block');
    expect(screen.getByTestId('conformation-current-title')).toHaveTextContent('Show Champion');
    expect(screen.getByTestId('conformation-title-points')).toHaveTextContent('500');
    expect(screen.queryByTestId('conformation-breeding-boost')).toBeNull();
  });
});
