/**
 * A newly revealed trait glows once, the first time its owner views it, and
 * there is no Reveal Traits button (Equoria-lylhb; owner rulings 2026-10-16 and
 * 2026-10-19).
 *
 * Real GeneticsTab and hooks; the API is answered by MSW.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import GeneticsTab from '../GeneticsTab';
import type { Horse } from '../HorseDetailPageTypes';
import { server } from '@/test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const horse = {
  id: 78,
  name: 'TestFixture-Glow',
  breed: 'Thoroughbred',
  age: 4,
  gender: 'Mare',
  dateOfBirth: '2022-01-01T00:00:00.000Z',
  healthStatus: 'Excellent',
  stats: {},
  disciplineScores: {},
} as unknown as Horse;

function stubTraits(traits: Array<{ name: string; isNew: boolean }>) {
  const seenCalls: string[] = [];
  server.use(
    http.get(`${base}/api/v1/horses/78/epigenetic-insights`, () =>
      HttpResponse.json({
        success: true,
        data: { traitAnalysis: { traits: traits.map((t) => t.name) } },
      })
    ),
    http.get(`${base}/api/v1/horses/78/trait-timeline`, () =>
      HttpResponse.json({ success: true, data: { timeline: [] } })
    ),
    http.get(`${base}/api/v1/traits/horse/78`, () =>
      HttpResponse.json({
        success: true,
        data: {
          traits: {
            positive: traits.map((t) => ({
              name: t.name,
              isNew: t.isNew,
              definition: { type: 'positive' },
            })),
            negative: [],
            hiddenCount: 0,
          },
        },
      })
    ),
    http.get(`${base}/api/v1/traits/discovery-status/78`, () =>
      HttpResponse.json({
        success: true,
        data: { traitCounts: { visible: traits.length, hidden: 0 } },
      })
    ),
    http.post(`${base}/api/v1/traits/horse/78/seen`, ({ request }) => {
      seenCalls.push(request.url);
      return HttpResponse.json({ success: true, data: null });
    })
  );
  return seenCalls;
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

describe('GeneticsTab first-view glow (Equoria-lylhb)', () => {
  it('glows only the trait the owner has not seen, and tells the server it is seen', async () => {
    const seenCalls = stubTraits([
      { name: 'resilient', isNew: false },
      { name: 'confident', isNew: true },
    ]);
    renderTab();

    await waitFor(() => expect(screen.getAllByTestId('trait-card')).toHaveLength(2));
    await waitFor(() =>
      expect(document.querySelectorAll('[data-new-trait="true"]')).toHaveLength(1)
    );
    const glowing = document.querySelector('[data-new-trait="true"]') as HTMLElement;
    expect(glowing).toHaveTextContent(/confident/i);
    expect(glowing.style.boxShadow).toContain('--glow-gold-strong');
    await waitFor(() => expect(seenCalls).toHaveLength(1));
  });

  it('does not glow or call the server when nothing is new', async () => {
    const seenCalls = stubTraits([{ name: 'resilient', isNew: false }]);
    renderTab();

    await waitFor(() => expect(screen.getAllByTestId('trait-card')).toHaveLength(1));
    expect(document.querySelector('[data-new-trait="true"]')).toBeNull();
    expect(seenCalls).toHaveLength(0);
  });

  it('offers no Reveal Traits button', async () => {
    stubTraits([{ name: 'confident', isNew: true }]);
    renderTab();
    await waitFor(() => expect(screen.getAllByTestId('trait-card')).toHaveLength(1));
    expect(screen.queryByRole('button', { name: /reveal traits/i })).toBeNull();
  });
});
