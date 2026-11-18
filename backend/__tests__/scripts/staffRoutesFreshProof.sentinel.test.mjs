/**
 * STAFF-CR-06 (Equoria-puj1e.5, owner rulings q377/q378) - doctrine: the owner's
 * outage tools are mounted only in the staff routes, a time-back write names
 * requireFreshStaffProof('<purpose>') directly after its capability guard, and
 * holding the jobs needs only its capability.
 *
 * Old contract (until Equoria-puj1e.5): both capabilities were refused on every
 * route because requireFreshStaffProof did not exist. Owner rulings 2026-11-18:
 * the outage tools are mounted for the Owner, and apply and undo each need a
 * fresh emailed code; holding the jobs does not.
 *
 * Split out of staffRoutesGuarded.sentinel.test.mjs (file-size ratchet); planted
 * route files are laid out the same way, as <case>/routes/<file> in an OS temp dir.
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHECK = path.resolve(HERE, '..', '..', '..', 'scripts', 'doctrine-checks', 'check-staff-routes-guarded.mjs');

let scanStaffRoutes;
let tmp;

const importExpress = "import express from 'express';";
const importGuards =
  'import { requireStaffCapability, requireAnyStaffCapability, requireStaffRole } from ' +
  "'../middleware/requireStaffCapability.mjs';";
const importControllers = "import { handler, h, done, replyToTicket } from '../controllers/staffController.mjs';";
// Lines 1-4 of every planted file; the first snippet line is line 5.
const HEADER = [importExpress, importGuards, importControllers, 'const router = express.Router();'];
const file = (...lines) => `${[...HEADER, ...lines, 'export default router;'].join('\n')}\n`;

const plant = (name, body) => {
  const routes = path.join(mkdtempSync(path.join(tmp, 'case-')), 'routes');
  mkdirSync(routes);
  writeFileSync(path.join(routes, name), body);
  return routes;
};
const scan = (name, body) => scanStaffRoutes(plant(name, body));
const lines = failures => failures.map(f => f.line);

beforeAll(async () => {
  ({ scanStaffRoutes } = await import(pathToFileURL(CHECK).href));
  tmp = mkdtempSync(path.join(tmpdir(), 'equoria-staff-fresh-'));
});

afterAll(() => {
  if (tmp) {
    rmSync(tmp, { recursive: true, force: true });
  }
});

describe('check-staff-routes-guarded: capabilities that need a fresh-proof guard (STAFF-CR-06)', () => {
  const importWithProof =
    'import { requireStaffCapability, requireAnyStaffCapability, requireFreshStaffProof } from ' +
    "'../middleware/requireStaffCapability.mjs';";
  // Same five-line header as file(), so the first snippet line is still line 5.
  const proofFile = (...body) =>
    `${[importExpress, importWithProof, importControllers, 'const router = express.Router();', ...body, 'export default router;'].join('\n')}\n`;

  test('a time-back write without requireFreshStaffProof is refused', () => {
    const failures = scan('fresh.mjs', file("router.post('/x', requireStaffCapability('time-back'), h);"));
    expect(lines(failures)).toEqual([5]);
    expect(failures[0].reason).toContain('time-back');
    expect(failures[0].reason).toContain('requireFreshStaffProof');
  });

  test('time-back inside requireAnyStaffCapability on a write is refused', () => {
    const failures = scan(
      'fresh-any.mjs',
      file("router.post('/x', requireAnyStaffCapability(['ticket.file', 'time-back']), h);"),
    );
    expect(lines(failures)).toEqual([5]);
    expect(failures[0].reason).toContain('requireFreshStaffProof');
  });

  test('a time-back write with requireFreshStaffProof directly after its guard passes', () => {
    const ok = proofFile(
      "router.post('/time-back/apply', requireStaffCapability('time-back'), requireFreshStaffProof('timeBackApply'), h);",
      "router.post('/time-back/:id/undo', requireStaffCapability('time-back'), requireFreshStaffProof('timeBackUndo'), h);",
    );
    expect(scan('fresh-ok.mjs', ok)).toEqual([]);
  });

  test('a time-back read and the code-sending route need no fresh proof', () => {
    const ok = file(
      "router.get('/time-back', requireStaffCapability('time-back'), h);",
      "router.post('/time-back/code', requireStaffCapability('time-back'), h);",
    );
    expect(scan('fresh-read.mjs', ok)).toEqual([]);
  });

  test('requireFreshStaffProof anywhere but directly after a time-back guard fails', () => {
    const failures = scan(
      'fresh-misplaced.mjs',
      proofFile(
        "router.post('/a', requireStaffCapability('warn'), requireFreshStaffProof('timeBackApply'), h);",
        "router.post('/b', requireFreshStaffProof('timeBackApply'), requireStaffCapability('time-back'), h);",
        "router.post('/c', requireStaffCapability('time-back'), h, requireFreshStaffProof('timeBackApply'));",
        "router.post('/d', requireStaffCapability('time-back'), requireFreshStaffProof(purpose), h);",
        "router.post('/e', requireStaffCapability('time-back'), requireFreshStaffProof('timeBackApply'));",
      ),
    );
    expect(lines(failures)).toEqual([5, 6, 7, 8, 9]);
  });

  test('jobs.hold needs only its capability guard (owner ruling q378)', () => {
    expect(scan('hold.mjs', file("router.post('/jobs/hold', requireStaffCapability('jobs.hold'), h);"))).toEqual([]);
  });

  test.each(['time-back', 'jobs.hold'])('a router.use guarded by %s is refused', cap => {
    expect(scan('fresh-use.mjs', file(`router.use(requireStaffCapability('${cap}'));`))).toHaveLength(1);
  });

  test('the real staff routes still pass', () => {
    expect(scanStaffRoutes()).toEqual([]);
  });
});
