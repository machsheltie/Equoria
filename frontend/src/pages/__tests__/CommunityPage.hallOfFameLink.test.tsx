/**
 * Community's Hall of Fame card opens the Hall of Fame (Equoria-631wc, NAV-08).
 *
 * The card pointed at /my-stable, which opened on the Stable Profile tab. The
 * Hall of Fame has its own address, /hall-of-fame (/my-stable redirects there).
 * Real page and hooks; only the network is stubbed (MSW defaults).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import CommunityPage from '../CommunityPage';

describe('CommunityPage — Hall of Fame card (Equoria-631wc)', () => {
  it('links to /hall-of-fame', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: 7, username: 'HubTester' }}>
          <MemoryRouter initialEntries={['/community']}>
            <CommunityPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );
    const card = await screen.findByRole('link', { name: /hall of fame/i });
    expect(card).toHaveAttribute('href', '/hall-of-fame');
  });
});
