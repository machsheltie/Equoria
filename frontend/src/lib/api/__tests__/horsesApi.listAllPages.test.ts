/**
 * The horse list reads the whole stable (Equoria-6tda3, STA-03).
 *
 * GET /api/v1/horses returns at most 200 horses a page with keyset
 * `pageInfo` (Equoria-cmw85.19). A stable of more than 200 horses showed only
 * the newest 200 because horsesApi.list made one request and ignored
 * pageInfo.nextCursor. Real API client; MSW only at the HTTP boundary.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { horsesApi } from '../horses';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function horses(fromId: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: fromId + i,
    name: `Horse ${fromId + i}`,
    sex: 'Mare',
    ageYears: 5,
  }));
}

describe('horsesApi.list (Equoria-6tda3)', () => {
  it('follows pageInfo.nextCursor until the last page and returns every horse', async () => {
    const cursorsSeen: (string | null)[] = [];
    server.use(
      http.get(`${base}/api/v1/horses`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursorsSeen.push(cursor);
        if (!cursor) {
          return HttpResponse.json({
            success: true,
            data: horses(1, 200),
            pageInfo: { nextCursor: 'page-2', hasMore: true },
          });
        }
        if (cursor === 'page-2') {
          return HttpResponse.json({
            success: true,
            data: horses(201, 200),
            pageInfo: { nextCursor: 'page-3', hasMore: true },
          });
        }
        return HttpResponse.json({
          success: true,
          data: horses(401, 15),
          pageInfo: { nextCursor: null, hasMore: false },
        });
      })
    );

    const all = await horsesApi.list();

    expect(all).toHaveLength(415);
    expect(new Set(all.map((h) => h.id)).size).toBe(415);
    expect(cursorsSeen).toEqual([null, 'page-2', 'page-3']);
  });

  it('makes one request for a stable that fits on one page', async () => {
    let requests = 0;
    server.use(
      http.get(`${base}/api/v1/horses`, () => {
        requests += 1;
        return HttpResponse.json({
          success: true,
          data: horses(1, 3),
          pageInfo: { nextCursor: null, hasMore: false },
        });
      })
    );

    const all = await horsesApi.list();

    expect(all).toHaveLength(3);
    expect(requests).toBe(1);
  });

  it('fails the whole read when a later page fails, never returning a partial stable', async () => {
    server.use(
      http.get(`${base}/api/v1/horses`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (!cursor) {
          return HttpResponse.json({
            success: true,
            data: horses(1, 200),
            pageInfo: { nextCursor: 'page-2', hasMore: true },
          });
        }
        return HttpResponse.json({ success: false, message: 'boom' }, { status: 500 });
      })
    );

    await expect(horsesApi.list()).rejects.toMatchObject({ statusCode: 500 });
  });
});
