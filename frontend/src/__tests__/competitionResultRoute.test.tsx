/**
 * One show's results has its own address (Equoria-iz7eu, NAV-07).
 *
 * CompetitionResultsPage opens a show's results when the URL names it
 * (useParams competitionId), but the route table registered only
 * /competition-results, so /competition-results/7 fell through to Not Found.
 * Real route table, real page and modal; only the network is stubbed (MSW).
 */

import { Suspense } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { navItems } from '../nav-items';
import { MockAuthProvider } from '@/test/utils';

describe('/competition-results/:competitionId (Equoria-iz7eu)', () => {
  it('opens that show’s results straight from the address', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <MockAuthProvider userOverrides={{ id: 123, username: 'TestUser' }}>
          <MemoryRouter initialEntries={['/competition-results/7']}>
            <Suspense fallback={<p>Loading</p>}>
              <Routes>
                {navItems.map(({ to, Page }) => (
                  <Route key={to} path={to} element={<Page />} />
                ))}
                <Route path="*" element={<p>Not Found</p>} />
              </Routes>
            </Suspense>
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

    const modal = await screen.findByTestId('competition-results-modal', {}, { timeout: 5000 });
    const named = await within(modal).findAllByText(
      /Spring Dressage Championship/,
      {},
      { timeout: 5000 }
    );
    expect(named.length).toBeGreaterThan(0);
    expect(screen.queryByText('Not Found')).not.toBeInTheDocument();
  });
});
