/**
 * "File for Claude Code" (Equoria-brh8c, owner rulings q158 and q234: "It files an
 * issue in the game's issue list; the next Claude Code session picks it up").
 *
 * The owner files a Diagnose report from the Steward's Office. The report is built
 * here on the server (never taken from the browser) and is already redacted. It is
 * kept in owner_filings until a Claude Code session runs
 * scripts/import-owner-filings.mjs, which creates the issue and records its id.
 *
 * Idempotent: each filing has a key naming what was filed, e.g. a held show and its
 * newest recorded failure. Filing the same thing twice returns the first filing.
 * A new failure makes a new key, so it can be filed again.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { gameDateKey } from '../../../utils/gameTime.mjs';
import { redactSecrets } from '../../../utils/diagnosticReport.mjs';
import { readPayrollFailures } from './payrollFailureLog.mjs';

const titleLength = 150;

/** The show failure rows (competition writes them; staff reads them, as the list does). */
const showFailureJobName = 'showFailure';

const filingSelect = { id: true, beadId: true, importedAt: true, createdAt: true };

function describeFiling(row) {
  return row
    ? {
        filed: true,
        filingId: row.id,
        filedAt: row.createdAt,
        imported: row.importedAt !== null,
        beadId: row.beadId,
      }
    : { filed: false, filingId: null, filedAt: null, imported: false, beadId: null };
}

function shortTitle(text) {
  const clean = redactSecrets(String(text)).replace(/\s+/g, ' ').trim();
  return clean.length > titleLength ? `${clean.slice(0, titleLength - 1)}…` : clean;
}

async function newestShowFailure(showId) {
  return prisma.cronRunLog.findFirst({
    where: { jobName: showFailureJobName, summary: { path: ['showId'], equals: showId } },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    select: { id: true, errorMessage: true },
  });
}

/** The key and title a held show is filed under: the show and its newest failure. */
export async function showFilingSubject(showId) {
  const [show, failure] = await Promise.all([
    prisma.show.findUnique({ where: { id: showId }, select: { name: true } }),
    newestShowFailure(showId),
  ]);
  return {
    kind: 'show',
    filingKey: `show:${showId}:failure:${failure?.id ?? 'none'}`,
    title: shortTitle(
      `Held show ${showId} (${show?.name ?? 'unknown'}) did not settle: ${failure?.errorMessage ?? 'no failure recorded'}`,
    ),
  };
}

const passWords = {
  weeklySettlement: 'weekly settlement',
  manualPayroll: 'manual groom payday',
  testRun: 'test run',
  rerun: 're-run',
};

/** The key and title a groom's or rider's payroll is filed under: their newest failure. */
export async function payrollFilingSubject(staffType, staffId) {
  const [newest] = await readPayrollFailures(staffType, staffId);
  return {
    kind: 'payroll',
    filingKey: `payroll:${staffType}:${staffId}:failure:${newest?.id ?? 'none'}`,
    title: shortTitle(
      `Payroll ${passWords[newest?.source] ?? 'pass'} failed for ${staffType} ${staffId}: ${newest?.message ?? 'no failure recorded'}`,
    ),
  };
}

/** The server report is filed once per game day. */
export function serverFilingSubject(now = new Date()) {
  const day = gameDateKey(now);
  return {
    kind: 'server',
    filingKey: `server:${day}`,
    title: `Server memory and speed report, ${day}`,
  };
}

/** Whether a subject is already filed, for the button's label. */
export async function filingState(subject) {
  const row = await prisma.ownerFiling.findUnique({
    where: { filingKey: subject.filingKey },
    select: filingSelect,
  });
  return describeFiling(row);
}

/**
 * File a report once. A second filing of the same subject returns the first.
 *
 * @param {{ kind: string, filingKey: string, title: string }} subject
 * @param {string} report - the redacted Diagnose report, built on the server
 * @param {{ id: string }} actor
 * @returns {Promise<{ alreadyFiled: boolean, filed: true, filingId: number, ... }>}
 */
export async function fileOwnerReport(subject, report, actor) {
  try {
    const row = await prisma.ownerFiling.create({
      data: {
        filingKey: subject.filingKey,
        kind: subject.kind,
        title: subject.title,
        report: redactSecrets(report),
        filedById: actor.id,
      },
      select: filingSelect,
    });
    return { alreadyFiled: false, ...describeFiling(row) };
  } catch (error) {
    // The unique key refused a second row: this subject is already filed.
    if (error?.code !== 'P2002') {
      throw error;
    }
    return { alreadyFiled: true, ...(await filingState(subject)) };
  }
}
