import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Auth handlers (CSRF + login/register/logout/refresh/profile/me/forgot/reset).
 * First-match-wins ordering is load-bearing — these register at the head of the
 * exported `handlers` array. Do not reorder.
 */
export const authHandlers = [
  // CSRF token — used by api-client before any state-changing request
  http.get(`${base}/api/v1/auth/csrf-token`, () =>
    HttpResponse.json({ csrfToken: 'test-csrf-token' })
  ),

  // Auth login/register/logout
  http.post(`${base}/api/v1/auth/login`, async ({ request }) => {
    const { email, password } = (await request.json()) as { email?: string; password?: string };

    if (!email || !password || password === 'wrong' || email.includes('invalid')) {
      return HttpResponse.json(
        { status: 'error', message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (password === 'rate-limit') {
      return HttpResponse.json(
        { status: 'error', message: 'Too many attempts' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    return HttpResponse.json({
      status: 'success',
      data: {
        user: {
          id: 1,
          username: 'testuser',
          email,
          firstName: 'Test',
          lastName: 'User',
          money: 1000,
          level: 1,
          xp: 0,
        },
      },
    });
  }),
  http.post(`${base}/api/v1/auth/register`, async ({ request }) => {
    const { email, username, password } = (await request.json()) as {
      email?: string;
      username?: string;
      password?: string;
    };

    if (!email || !username || !password) {
      return HttpResponse.json(
        { status: 'error', message: 'Missing required fields' },
        { status: 400 }
      );
    }

    return HttpResponse.json(
      {
        status: 'success',
        data: {
          user: {
            id: 2,
            username,
            email,
            money: 500,
            level: 1,
            xp: 0,
          },
        },
      },
      { status: 201 }
    );
  }),
  http.post(`${base}/api/v1/auth/logout`, () =>
    HttpResponse.json({ status: 'success', message: 'Logged out' })
  ),
  http.post(`${base}/api/v1/auth/refresh-token`, () =>
    HttpResponse.json({ status: 'success', message: 'Token refreshed' })
  ),

  // Auth profile
  http.get(`${base}/api/v1/auth/profile`, () =>
    HttpResponse.json({
      status: 'success',
      data: {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'user',
        },
      },
    })
  ),
  http.get(`${base}/api/v1/auth/me`, () =>
    HttpResponse.json({
      status: 'success',
      data: {
        user: { id: 1, username: 'testuser', email: 'test@example.com', role: 'user' },
      },
    })
  ),
  http.post(`${base}/api/v1/auth/forgot-password`, async ({ request }) => {
    const { email } = (await request.json()) as { email?: string };
    if (!email) {
      return HttpResponse.json({ status: 'error', message: 'Email is required' }, { status: 400 });
    }
    return HttpResponse.json({ status: 'success', message: 'Reset email sent' });
  }),
  http.post(`${base}/api/v1/auth/reset-password`, async ({ request }) => {
    const { token, newPassword } = (await request.json()) as {
      token?: string;
      newPassword?: string;
    };
    if (!token || !newPassword) {
      return HttpResponse.json(
        { status: 'error', message: 'Invalid reset request' },
        { status: 400 }
      );
    }
    return HttpResponse.json({ status: 'success', message: 'Password reset successful' });
  }),
];
