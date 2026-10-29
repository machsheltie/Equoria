/**
 * Diagnose: the report the owner copies and hands to Claude Code or Codex
 * (Equoria-ehlbj, Equoria-yqi49; owner ruling q29).
 *
 * Plain Markdown, read-only. It names the show, its entries, the staged
 * placements, what settling would pay, every recorded failed try (time, where,
 * message, stack), the owner's test runs, the commit the server runs and the
 * source files the stacks name.
 *
 * Never in it: emails, passwords, tokens, cookies, IP addresses, connection
 * strings or any environment value other than the commit. Accounts appear by
 * id only. Every free text (error messages, stacks, staged JSON) goes through
 * redactSecrets before it is written.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { deployedCommitSha } from '../../../utils/deployedCommitSha.mjs';
import { readShowFailures } from './showFailureLog.mjs';
import {
  fence,
  iso,
  redactSecrets,
  relativeStack,
  sourceFilesInStacks,
} from '../../../utils/diagnosticReport.mjs';
import {
  loadQuarantinedShow,
  planQuarantinedSettlement,
  quarantineResolveCapability,
} from './showQuarantineResolution.mjs';

/** How many of the owner's tool uses the report lists. */
const toolUsesListed = 10;

/** How many ledger rows the report lists. */
const ledgerRowsListed = 50;

const sourceLabels = {
  nightlyRun: 'Nightly show run (the show failed before or while paying)',
  nightlyPayout: 'Nightly show run (one placing failed to pay and rolled back)',
  reaperStranded: 'Show reaper (the run stopped mid-show)',
  testRun: "Owner's Test run",
  runShow: "Owner's Run Show",
};

async function readContext(show) {
  return Promise.all([
    readShowFailures(show.id),
    prisma.staffActionLog.findMany({
      where: {
        capability: quarantineResolveCapability,
        targetType: 'show',
        targetId: String(show.id),
      },
      orderBy: { id: 'desc' },
      take: toolUsesListed,
      select: { createdAt: true, outcome: true, after: true, error: true },
    }),
    prisma.userTransaction.findMany({
      where: { metadata: { path: ['showId'], equals: show.id } },
      orderBy: { id: 'asc' },
      take: ledgerRowsListed,
      select: { id: true, createdAt: true, userId: true, type: true, category: true, amount: true },
    }),
  ]);
}

function failureSection(failures) {
  if (failures.length === 0) {
    return ['No failure was recorded for this show (failures are recorded since Equoria-yqi49).'];
  }
  return failures.flatMap((failure, index) => {
    const lines = [
      `### ${index + 1}. ${iso(failure.at)} — ${sourceLabels[failure.source] ?? failure.source ?? 'unknown'}`,
      `- Commit running then: ${failure.commitSha ?? 'not known'}`,
      `- Message: ${redactSecrets(failure.message ?? '(none)')}`,
    ];
    if (failure.detail) {
      lines.push(`- Detail: ${redactSecrets(JSON.stringify(failure.detail))}`);
    }
    lines.push(
      failure.stack
        ? fence(redactSecrets(relativeStack(failure.stack)))
        : '- No stack (nothing was thrown).',
      '',
    );
    return lines;
  });
}

function toolUseLine(use) {
  const after = use.after && typeof use.after === 'object' ? use.after : {};
  const action =
    after.action === 'testRun' ? 'Test run' : after.action === 'runShow' ? 'Run Show' : 'Tool use';
  const error = use.outcome === 'failed' && use.error ? ` — ${redactSecrets(use.error)}` : '';
  return `- ${iso(use.createdAt)} ${action}: ${use.outcome} on commit ${after.commitSha ?? 'not known'}${error}`;
}

/**
 * Build the report for a quarantined show.
 *
 * @param {number} showId
 * @returns {Promise<{ showId: number, commitSha: string|null, report: string }>}
 */
export async function diagnoseQuarantinedShow(showId) {
  const show = await loadQuarantinedShow(prisma, showId);
  const plan = planQuarantinedSettlement(show);
  const [failures, toolUses, ledger] = await readContext(show);
  const commitSha = deployedCommitSha();
  const stacks = failures.filter(f => f.stack).map(f => redactSecrets(relativeStack(f.stack)));
  const files = sourceFilesInStacks(stacks);

  const lines = [
    `# Equoria: quarantined show ${show.id} — diagnosis`,
    '',
    "Made by the Steward's Office for the owner to hand to Claude Code or Codex. It holds no emails, passwords, tokens, IP addresses or server settings.",
    '',
    '## The ask',
    'This show failed to settle three times and is held (status `quarantined`): no money has moved since, players see "Results delayed". Find why it cannot settle from the failures below, fix the cause in the code with a regression test (do not edit existing tests to pass), and report the fix. The owner then deploys it, presses Test run (the real settlement in a transaction that is always rolled back), and Run Show once the test run passes on the new commit.',
    'The settlement code: backend/modules/competition/shows/showQuarantineResolution.mjs (owner tools), showExecutionService.mjs (nightly run), showSettlementRecovery.mjs, showEscrowTx.mjs; the reaper: backend/services/jobs/impl/showExecutionReaper.mjs.',
    '',
    '## Code running now',
    `- Commit: ${commitSha ?? 'not known (RAILWAY_GIT_COMMIT_SHA is not set)'}`,
    `- Report made: ${new Date().toISOString()}`,
    '',
    '## The show',
    `- Id: ${show.id}`,
    `- Name: ${redactSecrets(show.name)}`,
    `- Type: ${show.showType}; discipline: ${show.discipline}; levels ${show.levelMin}-${show.levelMax}`,
    `- Status: ${show.status}; kind: ${plan.kind === 'halfSettled' ? 'half-settled (some placings already paid)' : 'unexecuted (nobody paid yet)'}`,
    `- Failed tries counted: ${show.executionAttempts}`,
    `- Entry fee ${show.entryFee}, prize ${show.prize}; still held: prize escrow ${show.prizeEscrow}, fee escrow ${show.feeEscrow}`,
    `- Host account id: ${show.createdByUserId ?? 'none'}`,
    `- Created ${iso(show.createdAt)}; opened ${iso(show.openDate)}; closed ${iso(show.closeDate)}; run date ${iso(show.runDate)}; executed ${iso(show.executedAt)}; last claimed ${iso(show.claimedAt)}; updated ${iso(show.updatedAt)}`,
    '',
    `## Entries (${show.entries.length})`,
    `- Entry ids: ${show.entries.map(e => e.id).join(', ') || 'none'}`,
    ...show.entries.map(
      e =>
        `- Entry ${e.id}: horse ${e.horseId}, owner account ${e.userId}, fee paid ${e.feePaid}${e.groomId ? `, groom ${e.groomId}` : ''}`,
    ),
    `- Results already recorded for horses: ${show.competitionResults.map(r => r.horseId).join(', ') || 'none'}`,
    '',
    '## Staged placements (the ordering a settlement replays)',
    show.stagedOrdering
      ? fence(redactSecrets(JSON.stringify(show.stagedOrdering, null, 2)))
      : 'None staged.',
    '',
    '## What settling would pay',
    `- Placements readable: ${plan.ordering ? 'yes' : 'NO (the staged ordering cannot be read)'}`,
    ...plan.pending.map(
      p =>
        `- Placement ${p.staged.placement}: horse ${p.staged.horseId}, owner account ${p.staged.userId}, prize ${p.prize}`,
    ),
    `- Unpaid prize share back to host: ${plan.unpaidPrizeShare + plan.prizeRefund}; entry fees to host: ${plan.feesToCreator}`,
    '',
    `## Failed tries (${failures.length}, newest first)`,
    ...failureSection(failures),
    '',
    '## Source files named in the stacks',
    ...(files.length > 0 ? files.map(f => `- ${f}`) : ['- none']),
    '',
    "## Owner's test runs and runs (newest first)",
    ...(toolUses.length > 0 ? toolUses.map(toolUseLine) : ['- none yet']),
    '',
    `## Ledger rows for this show (${ledger.length})`,
    ...(ledger.length > 0
      ? ledger.map(
          r =>
            `- #${r.id} ${iso(r.createdAt)} account ${r.userId}: ${r.type} ${r.amount} (${r.category})`,
        )
      : ['- none']),
    '',
  ];
  return { showId, commitSha, report: lines.join('\n') };
}

export { redactSecrets, sourceFilesInStacks };
