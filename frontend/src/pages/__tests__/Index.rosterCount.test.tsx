/**
 * Hub roster counts tell the truth (Equoria-pm0gu; FRONTEND_ASYNC_STATE_DOCTRINE §4).
 *
 * Boundary-level: the REAL useHorses hook runs through the REAL api-client; only
 * the network is stubbed (MSW). The defect: the hub header ("0 horses") and the
 * AsidePanel Stable Summary derived their counts from an empty list that stood
 * in for "not loaded yet" and "failed to load", so a player with a full stable
 * read "0 horses" until the list arrived, and forever if it failed.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import Index from '../Index';
import { AsidePanel } from '@/components/layout/AsidePanel';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const HORSES = `${base}/api/v1/horses`;

const horses = [
  { id: 1, name: 'Moonlit', breed: { name: 'Arabian' }, sex: 'mare', age: 4 },
  { id: 2, name: 'Starling', breed: { name: 'Friesian' }, sex: 'stallion', age: 6 },
];

function renderHub(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <MemoryRouter initialEntries={['/']}>{ui}</MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

const failing = () =>
  HttpResponse.json({ success: false, message: 'RAW-SERVER-TEXT leak' }, { status: 500 });

describe('Index hub header roster count (Equoria-pm0gu)', () => {
  it('does not say "0 horses" while the list is still loading', async () => {
    server.use(
      http.get(HORSES, async () => {
        await delay(150);
        return HttpResponse.json({ success: true, data: horses });
      })
    );
    renderHub(<Index />);

    const header = screen.getByTestId('page-header');
    expect(header).toHaveTextContent('—');
    expect(header).not.toHaveTextContent(/\b0\s+horses/);
    await waitFor(() => expect(header).toHaveTextContent(/2\s+horses/));
  });

  it('does not say "0 horses" after the list failed to load', async () => {
    server.use(http.get(HORSES, failing));
    renderHub(<Index />);

    expect(await screen.findByText(/unable to load horses/i)).toBeInTheDocument();
    const header = screen.getByTestId('page-header');
    expect(header).toHaveTextContent('—');
    expect(header).not.toHaveTextContent(/\b0\s+horses/);
  });

  it('a stable that is genuinely empty reads 0 horses', async () => {
    server.use(http.get(HORSES, () => HttpResponse.json({ success: true, data: [] })));
    renderHub(<Index />);

    expect(await screen.findByText(/your stable is empty/i)).toBeInTheDocument();
    const header = screen.getByTestId('page-header');
    expect(header).toHaveTextContent(/0\s+horses/);
  });
});

describe('AsidePanel Stable Summary (Equoria-pm0gu)', () => {
  const stat = (label: string) => screen.getByText(label).parentElement as HTMLElement;

  it('shows an unavailable marker, not 0, while the list is loading', async () => {
    server.use(
      http.get(HORSES, async () => {
        await delay(150);
        return HttpResponse.json({ success: true, data: horses });
      })
    );
    renderHub(<AsidePanel />);

    for (const label of ['Total Horses', 'Ready to Train', 'Needs Care']) {
      expect(stat(label)).toHaveTextContent('—');
      expect(stat(label)).not.toHaveTextContent(/\b0\b/);
    }
    expect(screen.queryByText('No horses yet')).not.toBeInTheDocument();
    await within(stat('Total Horses')).findByText('2');
  });

  it('shows an unavailable marker, not 0, after the list failed to load', async () => {
    server.use(http.get(HORSES, failing));
    renderHub(<AsidePanel />);

    // Let the failed request settle, then check nothing fell back to zero.
    await screen.findByText('Total Horses');
    await new Promise((r) => setTimeout(r, 100));
    for (const label of ['Total Horses', 'Ready to Train', 'Needs Care']) {
      expect(stat(label)).toHaveTextContent('—');
      expect(stat(label)).not.toHaveTextContent(/\b0\b/);
    }
    expect(screen.queryByText('No horses yet')).not.toBeInTheDocument();
  });

  it('a genuinely empty stable reads 0 and "No horses yet"', async () => {
    server.use(http.get(HORSES, () => HttpResponse.json({ success: true, data: [] })));
    renderHub(<AsidePanel />);

    expect(await screen.findByText('No horses yet')).toBeInTheDocument();
    expect(stat('Total Horses')).toHaveTextContent('0');
  });
});
