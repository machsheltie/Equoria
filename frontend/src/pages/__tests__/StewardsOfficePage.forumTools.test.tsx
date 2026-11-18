/**
 * The Steward's Office mounts the forum tools by capability (Equoria-puj1e.3,
 * owner rulings q381 and q382): reported posts for every steward holding
 * report.review; the word lists only for the Owner and Admins (words.manage),
 * never a moderator.
 *
 * The real gate, page and hooks; MSW stubs the HTTP boundary.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, MockAuthProvider, Routes, Route } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StewardGate from '@/components/staff/StewardGate';
import StewardsOfficePage from '../StewardsOfficePage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

function renderOffice(role: string, capabilities: string[]) {
  server.use(
    http.get(`${STAFF}/me`, () => HttpResponse.json({ role, capabilities, trusted: true }))
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider userOverrides={{ id: 'staff-1', username: 'Steward' } as never}>
        <MemoryRouter initialEntries={['/steward']}>
          <Routes>
            <Route
              path="/steward"
              element={
                <StewardGate>
                  <StewardsOfficePage />
                </StewardGate>
              }
            />
          </Routes>
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe("The Steward's Office forum tools", () => {
  it('gives a moderator the reported posts and not the word lists', async () => {
    renderOffice('moderator', ['post.review', 'report.review']);
    expect(await screen.findByRole('heading', { name: 'Reported posts' })).toBeInTheDocument();
    expect(await screen.findByText('No reports are waiting.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Forum words' })).toBeNull();
  });

  it('gives an admin the word lists as well', async () => {
    renderOffice('admin', ['post.review', 'report.review', 'words.manage']);
    expect(await screen.findByRole('heading', { name: 'Forum words' })).toBeInTheDocument();
    expect(await screen.findByText('No blocked words yet.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reported posts' })).toBeInTheDocument();
  });
});
