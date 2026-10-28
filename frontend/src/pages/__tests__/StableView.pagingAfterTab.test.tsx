/**
 * Next goes to the next page after switching category (Equoria-t1vz2, STA-04)
 *
 * The page number was shared by every category tab. On page 4 of All, the
 * Mares tab (3 pages) clamped its DISPLAY to page 1 but Next stepped from the
 * stored page 4, landing on page 3 and skipping page 2. Switching category now
 * starts at page 1, and Previous/Next step from the page shown.
 *
 * Real StableView, real hooks and API client; MSW only at the HTTP boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import React from 'react';
import { server } from '@/test/msw/server';
import StableView from '../StableView';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// 36 mares + 12 stallions: All has 4 pages of 12, Mares has 3.
const horses = Array.from({ length: 48 }, (_, i) => ({
  id: i + 1,
  name: `Horse ${i + 1}`,
  sex: i < 36 ? 'Mare' : 'Stallion',
  age: 6,
  ageYears: 6,
  healthStatus: 'Good',
  displayedHealth: 'Good',
}));

function renderPage() {
  server.use(
    http.get(`${base}/api/v1/horses`, () => HttpResponse.json({ success: true, data: horses }))
  );
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <StableView />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('StableView — paging after a category switch (Equoria-t1vz2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Next from the first page of Mares shows page 2, not page 3', async () => {
    const user = userEvent.setup();
    renderPage();
    const allPanel = await screen.findByRole('tabpanel');
    await within(allPanel).findByText(/Page 1 of 4/);

    await user.click(within(allPanel).getByRole('button', { name: '4' }));
    expect(within(screen.getByRole('tabpanel')).getByText(/Page 4 of 4/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /mares/i }));
    const maresPanel = screen.getByRole('tabpanel');
    expect(within(maresPanel).getByText(/Page 1 of 3/)).toBeInTheDocument();

    await user.click(within(maresPanel).getByRole('button', { name: 'Next' }));
    expect(within(screen.getByRole('tabpanel')).getByText(/Page 2 of 3/)).toBeInTheDocument();
  });
});
