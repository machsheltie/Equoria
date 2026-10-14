/**
 * /steward is indistinguishable from an unknown address (STAFF-CR-17)
 *
 * The whole real App (routes, AuthProvider, guards, layout), with only the
 * HTTP boundary stubbed by MSW. For a signed-out visitor and for a signed-in
 * player, /steward must leave the same DOM, the same URL and the same history
 * as /some-random-path, with no login redirect. A steward still reaches the
 * office (check-in first, on a new browser).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API = `${base}/api/v1`;

const json = (body: unknown, status = 200) => HttpResponse.json(body as object, { status });
const notFound = () => json({ success: false, message: 'Not found' }, 404);

type Visitor = 'anonymous' | 'player' | 'staff';

function stubVisitor(visitor: Visitor) {
  if (visitor === 'anonymous') {
    server.use(
      http.get(`${API}/auth/profile`, () => json({ status: 'error', message: 'No token' }, 401)),
      http.post(`${API}/auth/refresh-token`, () =>
        json({ status: 'error', message: 'No token' }, 401)
      ),
      // The real backend answers a signed-out /staff/me like any unknown route.
      http.get(`${API}/staff/me`, notFound)
    );
    return;
  }
  const user =
    visitor === 'staff'
      ? { id: 'admin-1', username: 'Stacey', email: 's@example.com', role: 'admin' }
      : { id: 'u-1', username: 'Mara', email: 'm@example.com', role: 'user' };
  server.use(
    http.get(`${API}/auth/profile`, () => json({ status: 'success', data: { user } })),
    http.get(`${API}/staff/me`, () =>
      visitor === 'staff'
        ? json({ role: 'admin', capabilities: ['log.view.own'], trusted: false })
        : notFound()
    )
  );
}

interface Visit {
  html: string;
  url: string;
  historyAdded: number;
  historyState: unknown;
  staffMeAsked: number;
  login: boolean;
}

let requests: string[] = [];
const onRequest = ({ request }: { request: Request }) => {
  requests.push(new URL(request.url).pathname);
};

beforeEach(() => {
  requests = [];
  server.events.on('request:start', onRequest);
});

afterEach(() => {
  server.events.removeListener('request:start', onRequest);
  window.history.replaceState(null, '', '/');
});

/** Load a fresh App at `path` as `visitor`, let it settle, and record what it shows. */
async function visit(visitor: Visitor, path: string): Promise<Visit> {
  stubVisitor(visitor);
  requests = [];
  vi.resetModules();
  const { default: App } = await import('@/App');
  // Same browser state for every visit: the one-time theme welcome is seen.
  localStorage.clear();
  localStorage.setItem('equoria-theme-welcome-shown', 'true');
  window.history.replaceState(null, '', '/');
  window.history.pushState(null, '', path);
  const lengthBefore = window.history.length;

  render(<App />);
  await waitFor(() => expect(requests).toContain('/api/v1/auth/profile'));
  if (visitor !== 'anonymous' && path === '/steward') {
    await waitFor(() => expect(requests).toContain('/api/v1/staff/me'));
  }
  // Let every answer reach React (lazy routes, query notifications).
  await act(() => new Promise((resolve) => setTimeout(resolve, 300)));

  const result: Visit = {
    html: document.body.innerHTML,
    url: window.location.pathname + window.location.search + window.location.hash,
    historyAdded: window.history.length - lengthBefore,
    historyState: window.history.state,
    staffMeAsked: requests.filter((p) => p === '/api/v1/staff/me').length,
    login: window.location.pathname === '/login',
  };
  cleanup();
  return result;
}

describe('/steward is indistinguishable from an unknown address (STAFF-CR-17)', () => {
  it.each<Visitor>(['anonymous', 'player'])(
    'for a %s visitor: same DOM, URL and history, no login redirect',
    async (visitor) => {
      const unknown = await visit(visitor, '/some-random-path');
      const steward = await visit(visitor, '/steward');

      expect(unknown.login).toBe(false);
      expect(steward.login).toBe(false);
      expect(steward.url).toBe('/steward');
      expect(unknown.url).toBe('/some-random-path');
      expect(steward.historyAdded).toBe(unknown.historyAdded);
      expect(steward.historyState).toEqual(unknown.historyState);
      expect(steward.html).toBe(unknown.html);
      expect(steward.html).not.toMatch(/steward/i);
    }
  );

  it('never asks a signed-out visitor about staff', async () => {
    const steward = await visit('anonymous', '/steward');
    expect(steward.staffMeAsked).toBe(0);
  });

  it('a steward reaches the office at /steward and nothing at an unknown address', async () => {
    const unknown = await visit('staff', '/some-random-path');
    expect(unknown.html).not.toMatch(/Steward&#x27;s Office|Steward's Office/);
    expect(unknown.url).toBe('/some-random-path');

    stubVisitor('staff');
    vi.resetModules();
    const { default: App } = await import('@/App');
    window.history.replaceState(null, '', '/steward');
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: "The Steward's Office" }, { timeout: 10_000 })
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /send.*code/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/steward');
  });
});
