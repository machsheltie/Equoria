/**
 * File for Claude Code (Equoria-brh8c, owner rulings q158 and q234: "It files an
 * issue in the game's issue list; the next Claude Code session picks it up").
 * Security gate: file-name token `Authz`.
 *
 * The owner files a held show's, a groom's or rider's payroll, or the server's
 * Diagnose report. Owner only, behind the emailed check-in. The report is built on
 * the server and stored redacted, once per failure. scripts/import-owner-filings.mjs
 * turns each unimported filing into an issue and records its id; it is run here as a
 * real child process against the test database, with a stub in place of the bd
 * executable (an external CLI, the only thing replaced).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { gameDateKey } from '../utils/gameTime.mjs';
import { recordPayrollFailure } from '../modules/staff/services/payrollFailureLog.mjs';
import { recordShowFailure } from '../modules/competition/index.mjs';
import { capabilityRequiredCode, checkinRequiredCode } from '../modules/staff/middleware/requireStaffCapability.mjs';
import {
  checkIn,
  createUserFactory,
  get,
  post,
  startEmailCapture,
  stopEmailCapture,
} from '../modules/staff/__tests__/helpers/staffFixtures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const importScript = path.join(repoRoot, 'scripts', 'import-owner-filings.mjs');
const prefix = 'TestFixture-brh8cfile';
const tag = () => randomBytes(4).toString('hex');
const cleanup = createCleanupTracker();
const staff = createUserFactory('brh8cfile');
const playerIds = [];
const showIds = [];
const filingIds = [];
let owner;
let ownerDevice;
let stubDir;

/** A held show with no entries: enough for Diagnose, which reads what it holds. */
async function makeHeldShow() {
  const show = await prisma.show.create({
    data: {
      name: `${prefix}-show-${tag()}`,
      discipline: 'Dressage',
      levelMin: 1,
      levelMax: 1,
      entryFee: 100,
      prize: 1000,
      runDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'quarantined',
      executionAttempts: 3,
    },
  });
  showIds.push(show.id);
  return show;
}

async function makePlayerWithGroom() {
  const t = tag();
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${prefix}-${t}`,
      email: `${prefix}-${t}@example.com`,
      password: 'not-a-real-hash',
      firstName: 'Filing',
      lastName: 'Player',
      money: 1000,
    },
  });
  playerIds.push(user.id);
  const groom = await prisma.groom.create({
    data: {
      name: `${prefix}-groom-${t}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      starLevel: 'rookie',
      startAge: 20,
      userId: user.id,
    },
  });
  return { user, groom };
}

const filingsFor = filingKeyPrefix =>
  prisma.ownerFiling.findMany({
    where: { filingKey: { startsWith: filingKeyPrefix } },
    orderBy: { id: 'asc' },
  });

/** A stand-in for the bd executable: records each call, answers like bd. */
function writeStubBd(dir) {
  const stub = path.join(dir, 'bd-stub.mjs');
  writeFileSync(
    stub,
    [
      "import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';",
      "import path from 'node:path';",
      "import { fileURLToPath } from 'node:url';",
      'const dir = path.dirname(fileURLToPath(import.meta.url));',
      'const args = process.argv.slice(2);',
      'const call = { args };',
      "const bodyAt = args.indexOf('--body-file');",
      "if (bodyAt >= 0) call.body = readFileSync(args[bodyAt + 1], 'utf8');",
      "appendFileSync(path.join(dir, 'calls.jsonl'), JSON.stringify(call) + '\\n');",
      "const existingFile = path.join(dir, 'existing.json');",
      "if (args[0] === 'list') {",
      "  const existing = existsSync(existingFile) ? JSON.parse(readFileSync(existingFile, 'utf8')) : {};",
      "  const ref = args[args.indexOf('--external-ref') + 1];",
      '  process.stdout.write(JSON.stringify(existing[ref] ? [{ id: existing[ref] }] : []));',
      "} else if (args[0] === 'create') {",
      "  const counter = path.join(dir, 'counter');",
      "  const n = (existsSync(counter) ? Number(readFileSync(counter, 'utf8')) : 0) + 1;",
      '  writeFileSync(counter, String(n));',
      "  process.stdout.write('Equoria-stub' + n + '\\n');",
      '}',
    ].join('\n'),
  );
  return stub;
}

function stubCalls() {
  const file = path.join(stubDir, 'calls.jsonl');
  return existsSync(file)
    ? readFileSync(file, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line))
    : [];
}

function runImport(extraArgs = []) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [importScript, `--bd=${path.join(stubDir, 'bd-stub.mjs')}`, ...extraArgs],
      { cwd: repoRoot, env: { ...process.env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.status, stdout: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

beforeAll(() => {
  const staffScope = () => ({ in: staff.createdUserIds });
  cleanup.add(
    () => prisma.ownerFiling.deleteMany({ where: { filingKey: { contains: ':' }, filedById: staffScope() } }),
    'owner filings',
  );
  cleanup.add(() => prisma.ownerFiling.deleteMany({ where: { id: { in: filingIds } } }), 'direct filings');
  cleanup.add(
    () =>
      prisma.cronRunLog.deleteMany({
        where: {
          jobName: 'showFailure',
          OR: showIds.map(id => ({ summary: { path: ['showId'], equals: id } })),
        },
      }),
    'show failures',
  );
  cleanup.add(async () => {
    const grooms = await prisma.groom.findMany({ where: { name: { startsWith: prefix } }, select: { id: true } });
    const ids = grooms.map(g => g.id);
    await prisma.cronRunLog.deleteMany({
      where: {
        jobName: 'payrollFailure',
        OR: ids.map(id => ({
          AND: [{ summary: { path: ['staffType'], equals: 'groom' } }, { summary: { path: ['staffId'], equals: id } }],
        })),
      },
    });
    await prisma.groom.deleteMany({ where: { id: { in: ids } } });
  }, 'grooms');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: playerIds } } }), 'players');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: staffScope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: staffScope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: staffScope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: staffScope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: staffScope() } }), 'staff users');
  stubDir = mkdtempSync(path.join(tmpdir(), 'brh8c-bd-'));
  writeStubBd(stubDir);
});

afterAll(async () => {
  rmSync(stubDir, { recursive: true, force: true });
  await cleanup.run();
}, 60_000);

beforeEach(async () => {
  startEmailCapture();
  if (!owner) {
    owner = await staff.makeUser('owner');
    ownerDevice = await checkIn(owner);
  }
});
afterEach(() => stopEmailCapture());

describe('who may file for Claude Code', () => {
  it('admins and moderators are refused, players see nothing, the owner must check in', async () => {
    const show = await makeHeldShow();
    const { groom } = await makePlayerWithGroom();
    const urls = [
      `/api/v1/staff/shows/quarantined/${show.id}/file`,
      `/api/v1/staff/payroll/groom/${groom.id}/file`,
      '/api/v1/staff/server-health/file',
    ];
    for (const role of ['admin', 'moderator']) {
      const steward = await staff.makeUser(role);
      const device = await checkIn(steward);
      for (const url of urls) {
        const res = await post(url, steward, {}, device);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe(capabilityRequiredCode);
      }
    }
    const player = await staff.makeUser('user');
    for (const url of urls) {
      expect((await post(url, player, {})).status).toBe(404);
      const res = await post(url, owner, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(checkinRequiredCode);
    }
    expect(await filingsFor(`show:${show.id}:`)).toHaveLength(0);
    expect(await filingsFor(`payroll:groom:${groom.id}:`)).toHaveLength(0);
  }, 120_000);
});

describe('filing', () => {
  it('a held show is filed once per failure, redacted; Diagnose says it is filed', async () => {
    const show = await makeHeldShow();
    const secret = `zz-${randomBytes(12).toString('hex')}`;
    process.env.BRH8C_FILE_FIXTURE_TOKEN = secret;
    try {
      await recordShowFailure(show.id, {
        source: 'nightlyRun',
        error: new Error(`Cannot pay owner@example.com from 203.0.113.5 key ${secret}`),
      });
      const before = await get(`/api/v1/staff/shows/quarantined/${show.id}/diagnose`, owner, ownerDevice);
      expect(before.body.filing).toMatchObject({ filed: false });

      const first = await post(`/api/v1/staff/shows/quarantined/${show.id}/file`, owner, {}, ownerDevice);
      expect(first.status).toBe(200);
      expect(first.body.filing).toMatchObject({ filed: true, alreadyFiled: false, imported: false });
      const second = await post(`/api/v1/staff/shows/quarantined/${show.id}/file`, owner, {}, ownerDevice);
      expect(second.body.filing).toMatchObject({
        filed: true,
        alreadyFiled: true,
        filingId: first.body.filing.filingId,
      });

      const rows = await filingsFor(`show:${show.id}:`);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: 'show', filedById: owner.id, importedAt: null });
      expect(rows[0].title).toContain(`Held show ${show.id}`);
      expect(rows[0].report).toContain(`quarantined show ${show.id}`);
      for (const leak of ['owner@example.com', '203.0.113.5', secret]) {
        expect(rows[0].report).not.toContain(leak);
        expect(rows[0].title).not.toContain(leak);
      }
      const after = await get(`/api/v1/staff/shows/quarantined/${show.id}/diagnose`, owner, ownerDevice);
      expect(after.body.filing).toMatchObject({ filed: true, filingId: rows[0].id });

      // A new failure is a new subject: it can be filed again.
      await recordShowFailure(show.id, { source: 'testRun', message: 'fixture: failed again' });
      await post(`/api/v1/staff/shows/quarantined/${show.id}/file`, owner, {}, ownerDevice);
      expect(await filingsFor(`show:${show.id}:`)).toHaveLength(2);
    } finally {
      delete process.env.BRH8C_FILE_FIXTURE_TOKEN;
    }
  }, 90_000);

  it("a groom's payroll and the server report are filed once each", async () => {
    const { user, groom } = await makePlayerWithGroom();
    await recordPayrollFailure({
      staffType: 'groom',
      staffId: groom.id,
      userId: user.id,
      source: 'weeklySettlement',
      weekStart: new Date(),
      weekKey: gameDateKey(new Date()),
      error: new Error('fixture: the settlement failed'),
    });
    const url = `/api/v1/staff/payroll/groom/${groom.id}/file`;
    expect((await post(url, owner, {}, ownerDevice)).body.filing.alreadyFiled).toBe(false);
    expect((await post(url, owner, {}, ownerDevice)).body.filing.alreadyFiled).toBe(true);
    const payroll = await filingsFor(`payroll:groom:${groom.id}:`);
    expect(payroll).toHaveLength(1);
    expect(payroll[0].title).toContain('Payroll weekly settlement failed for groom');
    const diagnose = await get(`/api/v1/staff/payroll/groom/${groom.id}/diagnose`, owner, ownerDevice);
    expect(diagnose.body.filing).toMatchObject({ filed: true });

    // The server report is one per game day; this suite may not be the first today.
    const serverKey = `server:${gameDateKey(new Date())}`;
    const existed = await prisma.ownerFiling.findUnique({ where: { filingKey: serverKey } });
    const filed = await post('/api/v1/staff/server-health/file', owner, {}, ownerDevice);
    expect(filed.body.filing).toMatchObject({ filed: true, alreadyFiled: existed !== null });
    if (!existed) {
      filingIds.push(filed.body.filing.filingId);
    }
    expect((await post('/api/v1/staff/server-health/file', owner, {}, ownerDevice)).body.filing.alreadyFiled).toBe(
      true,
    );
    expect(await prisma.ownerFiling.count({ where: { filingKey: serverKey } })).toBe(1);
    const health = await get('/api/v1/staff/server-health', owner, ownerDevice);
    expect(health.body.filing).toMatchObject({ filed: true });
  }, 90_000);
});

describe('scripts/import-owner-filings.mjs', () => {
  it('dry run changes nothing; a run creates one issue per filing and records it; a second run does nothing', async () => {
    // Only this test's filings are waiting: earlier ones are marked imported here first.
    await prisma.ownerFiling.updateMany({
      where: { importedAt: null },
      data: { importedAt: new Date(), beadId: 'preexisting' },
    });
    const made = [];
    for (const n of [1, 2]) {
      const row = await prisma.ownerFiling.create({
        data: {
          filingKey: `${prefix}:${tag()}:${n}`,
          kind: 'payroll',
          title: `Fixture filing ${n}`,
          report: `# Report ${n}\nThe body of filing ${n}.`,
        },
      });
      filingIds.push(row.id);
      made.push(row);
    }
    // A run that stopped after creating the issue for filing 2 but before recording it.
    writeFileSync(
      path.join(stubDir, 'existing.json'),
      JSON.stringify({ [`ownerFiling-${made[1].id}`]: 'Equoria-earlier' }),
    );

    const dry = runImport(['--dry-run']);
    expect(dry.code).toBe(0);
    expect(dry.stdout).toContain(`Would import filing ${made[0].id}`);
    expect(stubCalls()).toHaveLength(0);
    expect(await prisma.ownerFiling.count({ where: { id: { in: made.map(m => m.id) }, importedAt: null } })).toBe(2);

    const run = runImport();
    expect(run.code).toBe(0);
    const creates = stubCalls().filter(c => c.args[0] === 'create');
    expect(creates).toHaveLength(1);
    const args = creates[0].args;
    const flag = name => args[args.indexOf(name) + 1];
    expect(flag('--title')).toBe('Fixture filing 1');
    expect(flag('--type')).toBe('bug');
    expect(flag('--priority')).toBe('1');
    expect(flag('--labels')).toBe('ownerFiled');
    expect(flag('--external-ref')).toBe(`ownerFiling-${made[0].id}`);
    expect(creates[0].body).toBe(made[0].report);
    const rows = await prisma.ownerFiling.findMany({
      where: { id: { in: made.map(m => m.id) } },
      orderBy: { id: 'asc' },
    });
    expect(rows.map(r => r.beadId)).toEqual(['Equoria-stub1', 'Equoria-earlier']);
    expect(rows.every(r => r.importedAt !== null)).toBe(true);
    expect(run.stdout).toContain('2 imported, 0 failed');
    for (const secret of [process.env.DATABASE_URL, process.env.JWT_SECRET].filter(Boolean)) {
      expect(run.stdout).not.toContain(secret);
    }

    const again = runImport();
    expect(again.code).toBe(0);
    expect(again.stdout).toContain('No owner filings waiting.');
    expect(stubCalls().filter(c => c.args[0] === 'create')).toHaveLength(1);
  }, 120_000);
});
