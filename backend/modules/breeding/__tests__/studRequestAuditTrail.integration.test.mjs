/**
 * Private stud approval and rejection leave an audit_logs row (Equoria-e7tgc.7).
 *
 * S7 acceptance: "audit_logs row for accept". Approval moves money between two
 * players and starts a pregnancy, so it belongs on the same DB-backed audit
 * trail as the rest of breeding (middleware/auditLog.mjs, Equoria-jw10w). The
 * private stud endpoints live under /api/v1/studs, which the trail did not
 * classify, so no row was written.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  sharedBreed,
  makePlayer,
  makeHorse,
  disconnectLockClient,
  registerCleanup,
  requestPrivateStud,
  actOnRequest,
} from './helpers/studBookingFixtures.mjs';

const PREFIX = 'TestFixture-e7tgc7-audit';
const FEE = 300;

/** The audit write is fire-and-forget after the response; wait for it to land. */
async function auditRowsFor(userId, path) {
  const deadline = Date.now() + 3000;
  for (;;) {
    const rows = await prisma.auditLog.findMany({ where: { userId, path, method: 'POST' } });
    if (rows.length > 0 || Date.now() > deadline) {
      return rows;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

describe('private stud request audit trail (Equoria-e7tgc.7)', () => {
  const cleanup = createCleanupTracker();
  const userIds = [];
  const horseIds = [];
  let mareOwner;
  let studOwner;
  let requestId;

  beforeEach(async () => {
    registerCleanup(cleanup, { userIds, horseIds });
    userIds.length = 0;
    horseIds.length = 0;
    const breed = await sharedBreed();
    mareOwner = await makePlayer(PREFIX, 'mareOwner', 5000);
    studOwner = await makePlayer(PREFIX, 'studOwner', 0);
    userIds.push(mareOwner.user.id, studOwner.user.id);
    const stud = await makeHorse(PREFIX, {
      ownerId: studOwner.user.id,
      sex: 'Stallion',
      breedId: breed.id,
      studStatus: 'At Private Stud',
      studFee: FEE,
    });
    const mare = await makeHorse(PREFIX, { ownerId: mareOwner.user.id, sex: 'Mare', breedId: breed.id });
    horseIds.push(stud.id, mare.id);

    const res = await requestPrivateStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });
    expect(res.status).toBe(201);
    requestId = res.body.data.requestId;
  });

  afterEach(async () => {
    await cleanup.run();
  });

  afterAll(async () => {
    await disconnectLockClient();
  });

  it('approval writes one successful breeding audit row for the stallion owner', async () => {
    const res = await actOnRequest(studOwner.token, requestId, 'approve');
    expect(res.status).toBe(200);

    const rows = await auditRowsFor(studOwner.user.id, `/api/v1/studs/requests/${requestId}/approve`);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'breeding', resource: 'studs', statusCode: 200, success: true });
  });

  it('rejection writes one successful breeding audit row for the stallion owner', async () => {
    const res = await actOnRequest(studOwner.token, requestId, 'reject');
    expect(res.status).toBe(200);

    const rows = await auditRowsFor(studOwner.user.id, `/api/v1/studs/requests/${requestId}/reject`);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'breeding', resource: 'studs', statusCode: 200, success: true });
  });
});
