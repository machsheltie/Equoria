/**
 * LoginPage: what a player is told when the stewards' conduct rules refuse the
 * sign-in (Equoria-w47x7). Authored copy, never the server's string; a freeze
 * names the day it ends. Real api-client over MSW, like its sibling suite.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { TestRouter } from '@/test/utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import LoginPage from '../LoginPage';

const loginUrl = 'http://localhost:3000/api/v1/auth/login';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/login', state: null }),
  };
});

describe('LoginPage: conduct refusals', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  async function signInRefusedWith(body: Record<string, unknown>) {
    server.use(http.post(loginUrl, () => HttpResponse.json(body, { status: 403 })));
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <TestRouter>{children}</TestRouter>
      </QueryClientProvider>
    );
    render(
      <Wrapper>
        <LoginPage />
      </Wrapper>
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /^enter$/i }));
  }

  it('names the day a freeze ends and hides the server wording', async () => {
    await signInRefusedWith({
      success: false,
      status: 'error',
      code: 'accountFrozen',
      message: 'server wording',
      until: '2026-10-29T15:00:00.000Z',
    });
    await waitFor(() => {
      expect(screen.getByText(/Your account is frozen until October 29, 2026/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/server wording/)).not.toBeInTheDocument();
    expect(screen.queryByText(/accountFrozen/)).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('says a banned account has been banned', async () => {
    await signInRefusedWith({ code: 'accountBanned', message: 'server wording' });
    expect(await screen.findByText('This account has been banned.')).toBeInTheDocument();
    expect(screen.queryByText(/server wording/)).not.toBeInTheDocument();
  });

  it('says a banned connection can no longer sign in', async () => {
    await signInRefusedWith({ code: 'accessBlocked', message: 'server wording' });
    expect(
      await screen.findByText(
        'This connection can no longer be used to sign in or create an account.'
      )
    ).toBeInTheDocument();
  });
});
