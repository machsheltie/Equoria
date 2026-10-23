/**
 * competitionsApi.list walks every page of open shows (Equoria-fyoca).
 *
 * The list endpoint pages its answer. The client used to send no page or limit,
 * so only the first 20 open shows ever loaded and the Arena filters could only
 * narrow those 20. Real api-client; only the HTTP boundary is stubbed (MSW).
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { competitionsApi } from '../competitionsApi';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const show = (id: number) => ({
  id,
  name: `Show ${id}`,
  discipline: 'Dressage',
  date: '2026-11-01T00:00:00.000Z',
  prizePool: 1000,
  entryFee: 50,
  currentEntries: 0,
});

describe('competitionsApi.list', () => {
  it('requests successive pages until a short page and returns every open show', async () => {
    const requested: Array<{ page: string | null; limit: string | null }> = [];
    server.use(
      http.get(`${base}/api/v1/competition`, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page') ?? '1');
        const limit = Number(url.searchParams.get('limit') ?? '20');
        requested.push({
          page: url.searchParams.get('page'),
          limit: url.searchParams.get('limit'),
        });
        // 230 open shows in total, served `limit` at a time.
        const all = Array.from({ length: 230 }, (_, i) => show(i + 1));
        const rows = all.slice((page - 1) * limit, page * limit);
        return HttpResponse.json({ success: true, data: rows });
      })
    );

    const shows = await competitionsApi.list();

    expect(shows).toHaveLength(230);
    expect(new Set(shows.map((s) => s.id)).size).toBe(230);
    expect(requested.map((r) => r.page)).toEqual(['1', '2', '3']);
    expect(requested.every((r) => r.limit === '100')).toBe(true);
  });

  it('asks only once when the first page is already the whole list', async () => {
    let calls = 0;
    server.use(
      http.get(`${base}/api/v1/competition`, () => {
        calls += 1;
        return HttpResponse.json({ success: true, data: [show(1), show(2)] });
      })
    );

    const shows = await competitionsApi.list();

    expect(shows).toHaveLength(2);
    expect(calls).toBe(1);
  });
});
