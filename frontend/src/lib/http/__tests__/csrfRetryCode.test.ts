/**
 * apiClient's one CSRF retry keys on the camelCase code (Equoria-pjvp8.4,
 * phase 3k; owner ruling 2026-10-21: Equoria names are camelCase).
 *
 * The backend's CSRF middleware answers a stale token with 403
 * { code: 'invalidCsrfToken' }. The transport must drop its cached token,
 * fetch a fresh one and replay the mutation once. (apiClient also accepts the
 * old server's spelling during a deploy; that branch goes in phase 6.)
 *
 * Real transport; the network boundary is MSW (src/test/msw/server.ts).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { apiClient } from '../apiClient';
import authSessionState from '../../authSessionState';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let tokenFetches = 0;
let posts = 0;
let sentTokens: (string | null)[] = [];

beforeEach(() => {
  tokenFetches = 0;
  posts = 0;
  sentTokens = [];
  authSessionState.clear();
});

function stubStaleThenFresh(code: string) {
  server.use(
    http.get(`${base}/api/v1/auth/csrf-token`, () => {
      tokenFetches += 1;
      return HttpResponse.json({ csrfToken: `token-${tokenFetches}` });
    }),
    http.post(`${base}/api/v1/csrf-retry-probe`, ({ request }) => {
      posts += 1;
      sentTokens.push(request.headers.get('X-CSRF-Token'));
      if (posts === 1) {
        return HttpResponse.json({ success: false, code }, { status: 403 });
      }
      return HttpResponse.json({ success: true, data: { ok: true } });
    })
  );
}

describe('apiClient — 403 CSRF retry', () => {
  it.each(['invalidCsrfToken'])(
    'refetches the token and replays the mutation once on %s',
    async (code) => {
      stubStaleThenFresh(code);
      await apiClient.post('/api/v1/csrf-retry-probe', {});
      expect(posts).toBe(2);
      expect(tokenFetches).toBe(2);
      expect(sentTokens).toEqual(['token-1', 'token-2']);
    }
  );

  it('does not replay a 403 that carries another code', async () => {
    stubStaleThenFresh('forbidden');
    await expect(apiClient.post('/api/v1/csrf-retry-probe', {})).rejects.toBeTruthy();
    expect(posts).toBe(1);
  });
});
