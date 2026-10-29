#!/usr/bin/env node
/**
 * Import the owner's "File for Claude Code" reports into the game's issue list
 * (Equoria-brh8c, owner ruling q234: "It files an issue in the game's issue list;
 * the next Claude Code session picks it up").
 *
 * Run by a Claude Code session on the development laptop, from the repository root:
 *
 *   DATABASE_URL="<the game database>" node scripts/import-owner-filings.mjs [--dry-run]
 *
 * Without DATABASE_URL in the environment, backend/.env is read (the local database).
 * For each owner_filings row not yet imported, it runs `bd create` (title from the
 * failure, body = the redacted report, type bug, priority P1, label ownerFiled,
 * external ref ownerFiling-<id>) and records the new issue id on the row.
 *
 * Safe to run twice: imported rows are skipped, and before creating an issue it asks
 * bd for one already carrying that external ref (a run that stopped between creating
 * the issue and recording it), recording that id instead of creating a second one.
 *
 * Never prints a secret: no database address, no environment value; errors pass
 * through the same redaction as the reports. --dry-run lists what would be imported
 * and changes nothing. --bd=<path> (or BD_BIN) names the bd executable; a .mjs or .js
 * path is run with this Node.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ownerFiledLabel = 'ownerFiled';

/** The external ref an imported filing's issue carries. */
export const externalRefFor = (filingId) => `ownerFiling-${filingId}`;

/** @param {string[]} argv */
export function parseArgs(argv) {
  const options = { dryRun: false, bd: process.env.BD_BIN || 'bd' };
  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--bd=')) {
      options.bd = arg.slice('--bd='.length);
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

/** Run bd with arguments (no shell); returns its trimmed standard output. */
export function runBd(bdPath, args) {
  const viaNode = /\.(mjs|js)$/i.test(bdPath);
  const file = viaNode ? process.execPath : bdPath;
  const fullArgs = viaNode ? [bdPath, ...args] : args;
  return execFileSync(file, fullArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
}

/** The id of an issue already carrying this filing's external ref, or null. */
function existingIssueFor(bdPath, filingId) {
  const out = runBd(bdPath, [
    'list',
    '--all',
    '--json',
    '--limit',
    '0',
    '--external-ref',
    externalRefFor(filingId),
  ]);
  if (out === '') {
    return null;
  }
  const rows = JSON.parse(out);
  return Array.isArray(rows) && rows.length > 0 ? String(rows[0].id) : null;
}

function createIssue(bdPath, filing) {
  const dir = mkdtempSync(path.join(tmpdir(), 'owner-filing-'));
  try {
    const bodyFile = path.join(dir, 'report.md');
    writeFileSync(bodyFile, filing.report, 'utf8');
    const out = runBd(bdPath, [
      'create',
      '--silent',
      '--title',
      filing.title,
      '--type',
      'bug',
      '--priority',
      '1',
      '--labels',
      ownerFiledLabel,
      '--external-ref',
      externalRefFor(filing.id),
      '--body-file',
      bodyFile,
    ]);
    const id = out.split(/\s+/).filter(Boolean).at(-1);
    if (!id) {
      throw new Error('bd create printed no issue id');
    }
    return id;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * @param {{ prisma: object, bdPath?: string, dryRun?: boolean, log?: (line: string) => void,
 *   redact?: (text: string) => string }} options
 * @returns {Promise<{ pending: number, imported: Array<{ filingId: number, beadId: string }>, failed: number }>}
 */
export async function importOwnerFilings({
  prisma,
  bdPath = 'bd',
  dryRun = false,
  log = (line) => console.log(line),
  redact = (text) => text,
}) {
  const pending = await prisma.ownerFiling.findMany({
    where: { importedAt: null },
    orderBy: { id: 'asc' },
    select: { id: true, kind: true, title: true, report: true },
  });
  const result = { pending: pending.length, imported: [], failed: 0 };
  if (pending.length === 0) {
    log('No owner filings waiting.');
    return result;
  }
  for (const filing of pending) {
    if (dryRun) {
      log(`Would import filing ${filing.id} (${filing.kind}): ${filing.title}`);
      continue;
    }
    try {
      const beadId = existingIssueFor(bdPath, filing.id) ?? createIssue(bdPath, filing);
      // Guarded on importedAt: a second run that reached the same row records nothing.
      const marked = await prisma.ownerFiling.updateMany({
        where: { id: filing.id, importedAt: null },
        data: { importedAt: new Date(), beadId },
      });
      if (marked.count === 1) {
        result.imported.push({ filingId: filing.id, beadId });
        log(`Imported filing ${filing.id} as ${beadId}: ${filing.title}`);
      }
    } catch (error) {
      result.failed += 1;
      log(`Filing ${filing.id} was not imported: ${redact(error?.message ?? String(error))}`);
    }
  }
  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      'Usage: DATABASE_URL="<database>" node scripts/import-owner-filings.mjs [--dry-run] [--bd=<path>]'
    );
    return 0;
  }
  const { redactSecrets } = await import('../backend/utils/diagnosticReport.mjs');
  let prisma;
  try {
    ({ default: prisma } = await import('../packages/database/prismaClient.mjs'));
    const result = await importOwnerFilings({
      prisma,
      bdPath: options.bd,
      dryRun: options.dryRun,
      redact: redactSecrets,
    });
    if (!options.dryRun) {
      console.log(
        `Done: ${result.imported.length} imported, ${result.failed} failed, of ${result.pending} waiting.`
      );
    }
    return result.failed > 0 ? 1 : 0;
  } catch (error) {
    console.error(
      `Owner filings import stopped: ${redactSecrets(error?.message ?? String(error))}`
    );
    return 1;
  } finally {
    await prisma?.$disconnect();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main();
}

export const scriptPath = fileURLToPath(import.meta.url);
