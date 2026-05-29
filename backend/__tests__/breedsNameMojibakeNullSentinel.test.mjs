/**
 * Equoria-wm987 — Sentinel: no breed name contains U+FFFD ('�') replacement char.
 *
 * Background: the 26qjf.3 breed import created 11 rows whose names contained
 * U+FFFD where UTF-8 multi-byte chars should be (e.g. 'Asturc�n' duplicated
 * the proper 'Asturcón'). All 11 had zero horse FK references and proper
 * counterparts already existed; backend/scripts/cleanup-mojibake-breeds.mjs
 * deleted them. This sentinel guards against regression: any future import
 * pipeline that introduces a U+FFFD-bearing breed name will fail this test.
 *
 * Pure real-DB read against the canonical equoria database (per CLAUDE.md §3
 * "Real DB only" — no mocks, no fixtures). Read-only, no mutations.
 */

import { describe, test, expect, afterAll } from '@jest/globals';
import prisma from '../../packages/database/prismaClient.mjs';

describe('Equoria-wm987 — breeds.name U+FFFD sentinel', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('no row in breeds.name contains U+FFFD replacement char', async () => {
    const rows = await prisma.$queryRaw`
      SELECT id, name FROM breeds WHERE name LIKE '%' || chr(65533) || '%' ORDER BY id;
    `;
    expect(rows).toEqual([]);
  });
});
