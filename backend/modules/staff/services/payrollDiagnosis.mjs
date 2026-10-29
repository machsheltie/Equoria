/**
 * Diagnose for payroll: the report the owner copies and hands to Claude Code or
 * Codex (Equoria-brh8c, owner ruling q158).
 *
 * Plain Markdown, read-only. It names the groom or rider, every recorded payroll
 * failure (time, pass, pay week, commit, message, stack), the source files the
 * stacks name, their recent pay rows, the owner's test runs and re-runs, and the
 * commit the server runs.
 *
 * Never in it: emails, passwords, tokens, cookies, IP addresses, connection
 * strings or any environment value other than the commit. Accounts appear by id
 * only. Every free text goes through redactSecrets before it is written.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { deployedCommitSha } from '../../../utils/deployedCommitSha.mjs';
import {
  fence,
  iso,
  redactSecrets,
  relativeStack,
  sourceFilesInStacks,
} from '../../../utils/diagnosticReport.mjs';
import { readPayrollFailures } from './payrollFailureLog.mjs';
import { loadPayrollStaff, payrollDiagnoseCapability } from './payrollDiagnosticsService.mjs';

const toolUsesListed = 10;
const payRowsListed = 20;

const sourceLabels = {
  weeklySettlement: 'Weekly settlement (Sunday just after midnight Eastern; takes no money)',
  manualPayroll: "Owner's manual groom payday",
  testRun: "Owner's Test run",
  rerun: "Owner's Re-run",
};

const codePointers = {
  groom:
    'Weekly settlement: backend/modules/grooms/services/groomPlayerPayService.mjs (settleEndedGroomPayWeek) and groomFeeArrearsService.mjs (handleUnpaidFees). Manual payday: groomSalaryService.mjs (processWeeklySalaries) and groomFeeCollection.mjs. Re-run: groomPayrollReplay.mjs.',
  rider:
    'Weekly settlement: backend/modules/riders/services/riderPlayerPayService.mjs (settleEndedRiderPayWeek) and riderUnpaidService.mjs (handleUnpaidRiders). Re-run: riderPayrollReplay.mjs.',
};

function failureSection(failures) {
  if (failures.length === 0) {
    return ['No payroll failure was recorded (failures are recorded since Equoria-brh8c).'];
  }
  return failures.flatMap((failure, index) => {
    const lines = [
      `### ${index + 1}. ${iso(failure.at)} — ${sourceLabels[failure.source] ?? failure.source ?? 'unknown'}`,
      `- Pay week starting: ${failure.weekKey ?? 'not known'}; employer account id: ${failure.userId ?? 'none'}`,
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
    after.action === 'testRun' ? 'Test run' : after.action === 'rerun' ? 'Re-run' : 'Tool use';
  const result = after.outcome ? `, result ${after.outcome}` : '';
  const error = use.outcome === 'failed' && use.error ? ` — ${redactSecrets(use.error)}` : '';
  return `- ${iso(use.createdAt)} ${action} of failure ${after.failureId ?? '?'}: ${use.outcome}${result} on commit ${after.commitSha ?? 'not known'}${error}`;
}

function payRows(staffType, staffId) {
  return staffType === 'groom'
    ? prisma.groomSalaryPayment.findMany({
        where: { groomId: staffId },
        orderBy: { id: 'desc' },
        take: payRowsListed,
        select: {
          id: true,
          userId: true,
          amount: true,
          weekKey: true,
          paymentDate: true,
          status: true,
        },
      })
    : prisma.riderSalaryPayment.findMany({
        where: { riderId: staffId },
        orderBy: { id: 'desc' },
        take: payRowsListed,
        select: {
          id: true,
          userId: true,
          amount: true,
          weekKey: true,
          paymentDate: true,
          status: true,
        },
      });
}

/**
 * Build the report for one groom or rider.
 *
 * @param {'groom'|'rider'} staffType
 * @param {number} staffId
 * @returns {Promise<{ staffType: string, staffId: number, commitSha: string|null, report: string }>}
 */
export async function diagnosePayrollStaff(staffType, staffId) {
  const staffMember = await loadPayrollStaff(staffType, staffId);
  const [failures, toolUses, rows] = await Promise.all([
    readPayrollFailures(staffType, staffId),
    prisma.staffActionLog.findMany({
      where: {
        capability: payrollDiagnoseCapability,
        targetType: staffType,
        targetId: String(staffId),
      },
      orderBy: { id: 'desc' },
      take: toolUsesListed,
      select: { createdAt: true, outcome: true, after: true, error: true },
    }),
    payRows(staffType, staffId),
  ]);
  const commitSha = deployedCommitSha();
  const stacks = failures.filter(f => f.stack).map(f => redactSecrets(relativeStack(f.stack)));
  const files = sourceFilesInStacks(stacks);

  const lines = [
    `# Equoria: payroll failures of ${staffType} ${staffMember.id} — diagnosis`,
    '',
    "Made by the Steward's Office for the owner to hand to Claude Code or Codex. It holds no emails, passwords, tokens, IP addresses or server settings.",
    '',
    '## The ask',
    `A payroll pass failed for this ${staffType}. Since Equoria-hc96y players pay their own staff (Pay Groom / Pay Rider); the weekly settlement only applies the unpaid rules to a week left unpaid, and the owner keeps a manual groom payday. Find why it failed from the failures below, fix the cause in the code with a regression test (do not edit existing tests to pass), and report the fix. The owner then deploys it, presses Test run (the same pass for this one ${staffType} in a transaction that is always rolled back), and Re-run once the test run passes on the new commit.`,
    codePointers[staffType],
    '',
    '## Code running now',
    `- Commit: ${commitSha ?? 'not known (RAILWAY_GIT_COMMIT_SHA is not set)'}`,
    `- Report made: ${new Date().toISOString()}`,
    '',
    `## The ${staffType}`,
    `- Id: ${staffMember.id}`,
    `- Name: ${redactSecrets(staffMember.name)}`,
    `- Level: ${redactSecrets(String(staffMember.starLevel))}`,
    `- Employer account id: ${staffMember.employerId ?? 'none (not on a staff)'}`,
    `- On staff now: ${staffMember.onStaff ? 'yes' : 'no'}; unpaid since: ${iso(staffMember.unpaidSince)}`,
    '',
    `## Failures (${failures.length}, newest first)`,
    ...failureSection(failures),
    '',
    '## Source files named in the stacks',
    ...(files.length > 0 ? files.map(f => `- ${f}`) : ['- none']),
    '',
    "## Owner's test runs and re-runs (newest first)",
    ...(toolUses.length > 0 ? toolUses.map(toolUseLine) : ['- none yet']),
    '',
    `## Recent pay rows (${rows.length}, newest first)`,
    ...(rows.length > 0
      ? rows.map(
          r =>
            `- #${r.id} week ${r.weekKey ?? iso(r.paymentDate)} account ${r.userId}: ${r.status} ${r.amount}`,
        )
      : ['- none']),
    '',
  ];
  return { staffType, staffId, commitSha, report: lines.join('\n') };
}
