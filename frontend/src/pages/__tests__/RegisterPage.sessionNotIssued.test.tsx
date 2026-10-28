/**
 * Sign-up that created the account but could not open its session
 * (Equoria-nqky1, ACC-09).
 *
 * The server now answers 201 with `sessionIssued: false` in that case (before:
 * a 500 while the account already existed, and a retry said the email was
 * taken). The page must send the player to sign in and tell her the account is
 * ready, not to the verify-email screen of a session she does not have.
 *
 * Real RegisterPage and LoginPage, real React Query and apiClient; only the
 * HTTP transport is stubbed by MSW with the real register response shape.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import RegisterPage from '../RegisterPage';
import LoginPage from '../LoginPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function registerAnswer(sessionIssued: boolean) {
  server.use(
    http.post(`${base}/api/v1/auth/register`, () =>
      HttpResponse.json(
        {
          success: true,
          message: sessionIssued
            ? 'User registered successfully. Please check your email to verify your account.'
            : 'Your account is ready. Please sign in.',
          data: {
            user: {
              id: 'u1',
              username: 'johndoe',
              email: 'john@example.com',
              money: 10000,
              level: 1,
              xp: 0,
            },
            sessionIssued,
          },
        },
        { status: 201 }
      )
    )
  );
}

async function signUp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-email" element={<div>Check your email</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const user = userEvent.setup();
  const adult = new Date();
  adult.setUTCFullYear(adult.getUTCFullYear() - 20);
  await user.type(screen.getByLabelText(/first name/i), 'John');
  await user.type(screen.getByLabelText(/last name/i), 'Doe');
  await user.type(screen.getByLabelText(/username/i), 'johndoe');
  await user.type(screen.getByLabelText(/email/i), 'john@example.com');
  await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123@');
  await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123@');
  await user.type(screen.getByLabelText(/date of birth/i), adult.toISOString().slice(0, 10));
  await user.click(screen.getByRole('button', { name: /begin your journey/i }));
}

describe('RegisterPage when the session was not opened (Equoria-nqky1)', () => {
  it('sends the player to sign in and says the account is ready', async () => {
    registerAnswer(false);
    await signUp();
    expect(await screen.findByTestId('login-account-ready')).toHaveTextContent(/account is ready/i);
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument();
  });

  it('a normal sign-up still goes to the verify-email screen', async () => {
    registerAnswer(true);
    await signUp();
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });
});
