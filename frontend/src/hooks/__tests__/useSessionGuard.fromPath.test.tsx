/**
 * useSessionGuard "from" path freshness (Equoria-bvddn.40 a)
 *
 * The redirect state's `from` includes search and hash. It must follow
 * in-page navigation that changes only the query string or hash.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useNavigate } from 'react-router';
import { AuthProvider } from '../../contexts/AuthContext';
import { useSessionGuard } from '../useSessionGuard';
import { server } from '../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function Page() {
  const { isLoading, redirectState } = useSessionGuard();
  const navigate = useNavigate();
  if (isLoading) return <div data-testid="loading" />;
  return (
    <div>
      <div data-testid="from">{redirectState?.from}</div>
      <button onClick={() => navigate('/stable?tab=foals')}>query</button>
      <button onClick={() => navigate('/stable?tab=foals#latest')}>hash</button>
    </div>
  );
}

describe('useSessionGuard redirect "from" path', () => {
  it('tracks search and hash changes on the same pathname', async () => {
    server.use(
      http.get(`${base}/api/v1/auth/profile`, () =>
        HttpResponse.json({ message: 'Session expired.', status: 'error' }, { status: 401 })
      ),
      http.get(`${base}/api/v1/auth/verification-status`, () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
      ),
      http.post(`${base}/api/v1/auth/refresh-token`, () =>
        HttpResponse.json({ message: 'no session' }, { status: 401 })
      )
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/stable']}>
            <Page />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByTestId('from')).toHaveTextContent('/stable'));
    await user.click(screen.getByText('query'));
    await waitFor(() => expect(screen.getByTestId('from')).toHaveTextContent('/stable?tab=foals'));
    await user.click(screen.getByText('hash'));
    await waitFor(() =>
      expect(screen.getByTestId('from')).toHaveTextContent('/stable?tab=foals#latest')
    );
    queryClient.clear();
  });
});
