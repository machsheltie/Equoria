/**
 * Audit-log redaction backfill re-redacts NESTED secrets (Equoria-oierg).
 *
 * Before Equoria-oierg the write path redacted top-level keys only, so rows
 * already in audit_logs can hold `body.profile.password` or
 * `body.items[].token` verbatim. Owner ruling 2026-10-22: run a one-off
 * backfill with the now-recursive redactor. The previous script's change
 * detection was top-level and covered params/query only.
 *
 * Drives the real script's exported core against the real database, scoped to
 * rows this file plants (so no other audit row is read or written).
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { sanitizeLogData } from '../middleware/auditLog.mjs';
import { runAuditLogRedactionBackfill } from '../scripts/backfill-audit-log-redaction.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

const fixtureTag = `TestFixture-oierg-backfill-${randomBytes(4).toString('hex')}`;
const secret = `${fixtureTag}-secret`;
const cleanup = createCleanupTracker();
const plantedIds = [];

cleanup.add(async () => {
  if (plantedIds.length) {
    await prisma.auditLog.deleteMany({ where: { id: { in: plantedIds } } });
  }
}, 'planted audit rows');

afterAll(async () => {
  await cleanup.run();
}, 30000);

async function plant(metadata) {
  const row = await prisma.auditLog.create({
    data: {
      userId: null,
      action: 'authentication',
      resource: 'fixture',
      method: 'POST',
      path: `/fixture/${fixtureTag}`,
      statusCode: 200,
      success: true,
      metadata,
    },
  });
  plantedIds.push(row.id);
  return row.id;
}

const scopeTo = ids => ({ id: { in: ids } });
const read = async id => (await prisma.auditLog.findUnique({ where: { id } })).metadata;

describe('backfill-audit-log-redaction — nested secrets (Equoria-oierg)', () => {
  it('dry-run counts a nested-secret row and writes nothing; the wet run redacts it at every depth', async () => {
    const id = await plant({
      sensitivityLevel: 'high',
      username: 'rider',
      body: {
        profile: { password: secret, displayName: 'Moonflower' },
        items: [{ token: secret, slot: 1 }, 'plain'],
      },
      params: { nested: { apiKey: secret } },
      query: { filter: { authCode: secret } },
      errorResponse: { error: { details: { refreshToken: secret } } },
      fixtureTag,
    });

    const dry = await runAuditLogRedactionBackfill({ dryRun: true, scope: scopeTo([id]) });
    expect(dry).toMatchObject({ processed: 1, needsUpdate: 1, updated: 0, failed: 0 });
    expect(JSON.stringify(await read(id))).toContain(secret);

    const wet = await runAuditLogRedactionBackfill({ scope: scopeTo([id]) });
    expect(wet).toMatchObject({ processed: 1, needsUpdate: 1, updated: 1, failed: 0 });

    const after = await read(id);
    expect(JSON.stringify(after)).not.toContain(secret);
    expect(after).toEqual({
      sensitivityLevel: 'high',
      username: 'rider',
      body: {
        profile: { password: '[REDACTED]', displayName: 'Moonflower' },
        items: [{ token: '[REDACTED]', slot: 1 }, 'plain'],
      },
      params: { nested: { apiKey: '[REDACTED]' } },
      query: { filter: { authCode: '[REDACTED]' } },
      errorResponse: { error: { details: { refreshToken: '[REDACTED]' } } },
      fixtureTag,
    });
  });

  it('still redacts a legacy top-level params/query secret (Equoria-uf987)', async () => {
    const id = await plant({ params: { token: secret, id: 42 }, query: { password: secret, page: 1 }, fixtureTag });

    const result = await runAuditLogRedactionBackfill({ scope: scopeTo([id]) });

    expect(result.updated).toBe(1);
    const after = await read(id);
    expect(after.params).toEqual({ token: '[REDACTED]', id: 42 });
    expect(after.query).toEqual({ password: '[REDACTED]', page: 1 });
  });

  it('leaves rows the live write path produced untouched, including depth-capped bodies', async () => {
    let deep = { leaf: 'value' };
    for (let i = 0; i < 12; i++) {
      deep = { level: deep };
    }
    const liveShaped = {
      sensitivityLevel: 'medium',
      body: sanitizeLogData({ list: [{ name: 'a' }, { name: 'b' }], deep }),
      params: sanitizeLogData({ id: '7' }),
      query: sanitizeLogData({}),
      errorResponse: null,
      fixtureTag,
    };
    const id = await plant(liveShaped);
    const before = await read(id);

    const result = await runAuditLogRedactionBackfill({ scope: scopeTo([id]) });

    expect(result).toMatchObject({ processed: 1, needsUpdate: 0, updated: 0, unchanged: 1 });
    expect(await read(id)).toEqual(before);
  });

  it('is idempotent: a second run finds nothing to change', async () => {
    const id = await plant({ body: { credentials: { pin: secret } }, fixtureTag });

    const first = await runAuditLogRedactionBackfill({ scope: scopeTo([id]) });
    const afterFirst = await read(id);
    const second = await runAuditLogRedactionBackfill({ scope: scopeTo([id]) });

    expect(first.updated).toBe(1);
    expect(afterFirst.body).toEqual({ credentials: '[REDACTED]' });
    expect(second).toMatchObject({ needsUpdate: 0, updated: 0, unchanged: 1 });
    expect(await read(id)).toEqual(afterFirst);
  });

  it('skips null metadata without error', async () => {
    const id = await plant(null);

    const result = await runAuditLogRedactionBackfill({ scope: scopeTo([id]) });

    expect(result).toMatchObject({ processed: 1, skippedMalformed: 1, updated: 0, failed: 0 });
    expect(await read(id)).toBeNull();
  });
});
