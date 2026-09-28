/**
 * runConformationShowChild.mjs — Equoria-bvddn.21 regression helper.
 *
 * Standalone entry point (NOT a jest test) that executes a single
 * conformation show via the real, unmodified executeConformationShow
 * service in its OWN OS process with its OWN PrismaClient/connection pool.
 *
 * Why a child process instead of Promise.all() inside one jest test: this
 * module's shared PrismaClient (packages/database/prismaClient.mjs is a
 * process-wide singleton) serializes a second logical call's queries behind
 * an already-open interactive transaction from a first call — confirmed by
 * timestamped instrumentation during development of this regression test:
 * a second executeConformationShow's pre-transaction `entries.findMany`
 * read did not resolve until AFTER the first call's ENTIRE transaction
 * (including commit) had finished, even though both calls were started back
 * to back via Promise.all in the same tick. That in-process serialization
 * would mask the real defect (two genuinely concurrent requests each seeing
 * a stale pre-transaction read) behind an accidentally-safe scheduling
 * order. Running each call in its own process gives each its own
 * PrismaClient/connection, reproducing the real production shape: two
 * independent request-handling contexts racing against the same DB row.
 *
 * Usage: `node runConformationShowChild.mjs <showId>`
 * Prints one JSON line to stdout: {ok:true, result} or {ok:false, error}.
 * Exit code 0 on success, 1 on failure.
 */

import { fileURLToPath } from 'node:url';

import prisma from '../../../../../packages/database/prismaClient.mjs';
import { executeConformationShow } from '../../services/conformationShowService.mjs';

async function main() {
  const showId = Number(process.argv[2]);
  try {
    const result = await executeConformationShow(showId);
    process.stdout.write(`${JSON.stringify({ ok: true, result })}\n`);
    process.exitCode = 0;
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ ok: false, error: error?.message ?? String(error) })}\n`,
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
