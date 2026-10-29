/**
 * StaffPayrollDiagnostics — payroll that went wrong, per groom or rider
 * (Equoria-brh8c, owner ruling 2026-10-28 q158).
 *
 * Owner only (payroll.diagnose). Players never see it. She picks grooms or
 * riders and searches by name; with no name the list shows everyone with a
 * logged payroll failure. For one staff member:
 *
 * - Diagnose opens a report with one Copy report button, to hand to Claude
 *   Code or Codex. It lists every failure with its error and stack.
 * - Test run tries the failed pay week for this one groom or rider and undoes
 *   it: it says what Re-run would do, or that it failed. Nothing changes.
 * - Re-run stays locked until a test run of that failure has passed on the
 *   code running now (a new deploy locks it again). It never pays a week twice.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField, Input, Select } from '@/components/ui/form';
import { ErrorState, InlineError, SectionLoading } from '@/components/ui/state';
import {
  isCheckinRequired,
  useDiagnosePayroll,
  usePayrollFailures,
  usePayrollStaffSearch,
  useRerunPayroll,
  useTestRunPayroll,
} from '@/hooks/api/useStaff';
import type { ApiError } from '@/lib/http/types';
import type {
  PayrollFailure,
  PayrollOutcome,
  PayrollStaffMember,
  PayrollStaffType,
  PayrollTestRun,
} from '@/lib/api/staff';
import { formatDateTime } from '@/lib/formatDate';
import { userMessageFor } from '@/lib/http/userMessage';
import { staffTimeOptions, staffErrorMessage } from './staffMessages';
import StaffSection from './StaffSection';
import CopyReportPanel from './CopyReportPanel';

const kindOptions = [
  { value: 'groom', label: 'Grooms' },
  { value: 'rider', label: 'Riders' },
];

const passLabels: Record<string, string> = {
  weeklySettlement: 'Sunday pay-week settlement',
  manualPayroll: 'Your manual groom payday',
  testRun: 'Your test run',
  rerun: 'Your re-run',
};

const toolMessages = {
  404: 'That groom, rider or failure is not there any more.',
  409: 'That failure cannot be re-run.',
};

const rerunMessagesByCode: Record<string, string> = {
  testRunRequired: 'Test run this failure first. Re-run unlocks when the test run passes.',
  testRunStale:
    'The game was updated, or the pay week changed, since the last test run. Test run it again.',
  rerunFailed:
    'The re-run failed and nothing was changed. Use Diagnose: the report now includes this failure.',
};

function rerunErrorMessage(error: unknown): string {
  const code = (error as Partial<ApiError> | null)?.code;
  if (code && rerunMessagesByCode[code]) {
    return rerunMessagesByCode[code];
  }
  return staffErrorMessage(error, toolMessages);
}

/** What a re-run did, or would do, in plain words. */
export function outcomeWords(outcome: PayrollOutcome, name: string, amount: number): string {
  switch (outcome) {
    case 'paid':
      return `${name}'s week is paid: ${amount.toLocaleString()} coins from the player.`;
    case 'alreadyPaid':
      return 'That week is already paid. Nothing to do.';
    case 'notEnoughCoins':
      return 'The player does not have enough coins for that week. Nothing changes; the Sunday settlement deals with an unpaid week.';
    case 'weekEnded':
      return 'That pay week has ended, so the Sunday settlement has dealt with it. Nothing to do.';
    case 'alreadySettled':
      return 'That week was already settled. Nothing to do.';
    case 'cannotWork':
      return `${name}'s week is marked unpaid: they cannot work until the player pays.`;
    case 'leftForHirePool':
      return `${name} leaves for the grooms for hire: a full week went unpaid.`;
    case 'cannotRide':
      return `${name}'s week is marked unpaid: they cannot ride until the player pays.`;
    case 'leftRoster':
      return `${name} leaves the player's riders: a full week went unpaid.`;
    case 'noLongerOnStaff':
      return `${name} is no longer with that player. Nothing to do.`;
    case 'hiredThatWeek':
      return `${name} was hired that week, so the hire fee paid it. Nothing to do.`;
    default:
      return 'Nothing to do.';
  }
}

function TestRunNote({ testRun, name }: { testRun: PayrollTestRun; name: string }) {
  if (!testRun.passed) {
    return (
      <p className="mt-2 text-sm text-[var(--text-primary)]" role="alert">
        The test run failed. Nothing was changed. Use Diagnose: the report now includes this
        failure. Re-run stays locked.
      </p>
    );
  }
  return (
    <p className="mt-2 text-sm text-[var(--text-primary)]" role="status">
      The test run passed and was undone. Re-run would do this:{' '}
      {outcomeWords(testRun.outcome, name, testRun.amount)}
    </p>
  );
}

function FailureRow({
  member,
  failure,
  rerunReady,
}: {
  member: PayrollStaffMember;
  failure: PayrollFailure;
  rerunReady: boolean;
}) {
  const testRun = useTestRunPayroll();
  const rerun = useRerunPayroll();
  const vars = { staffType: member.staffType, staffId: member.id, failureId: failure.id };
  const busy = testRun.isPending || rerun.isPending;
  const when = formatDateTime(failure.at, staffTimeOptions);
  const pass = passLabels[failure.source ?? ''] ?? 'A payroll pass';

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[var(--text-primary)]">
          {pass}{' '}
          <span className="text-sm text-role-secondary">
            — {when}
            {failure.weekKey ? `, pay week starting ${failure.weekKey}` : ''}
          </span>
        </span>
        {failure.replayable && (
          <span className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              size="sm"
              pending={testRun.isPending}
              disabled={busy}
              aria-label={`Test run the ${pass.toLowerCase()} of ${when}`}
              onClick={() => {
                rerun.reset();
                testRun.mutate(vars);
              }}
            >
              Test run
            </Button>
            <Button
              variant="destructive"
              size="sm"
              pending={rerun.isPending}
              disabled={!rerunReady || busy}
              aria-label={`Re-run the ${pass.toLowerCase()} of ${when}`}
              onClick={() => rerun.mutate(vars)}
            >
              Re-run
            </Button>
          </span>
        )}
      </div>
      {testRun.isError && <InlineError message={staffErrorMessage(testRun.error, toolMessages)} />}
      {rerun.isError && <InlineError message={rerunErrorMessage(rerun.error)} />}
      {testRun.data && !testRun.isPending && !rerun.isSuccess && (
        <TestRunNote testRun={testRun.data.testRun} name={member.name} />
      )}
      {rerun.isSuccess && (
        <p className="mt-2 text-sm text-[var(--text-primary)]" role="status">
          Re-run done.{' '}
          {outcomeWords(rerun.data.result.outcome, member.name, rerun.data.result.amount)}
        </p>
      )}
    </li>
  );
}

function StaffMemberPanel({ member }: { member: PayrollStaffMember }) {
  const failures = usePayrollFailures(member.staffType, member.id);
  const diagnose = useDiagnosePayroll();
  const [report, setReport] = useState<string | null>(null);

  let body: React.ReactNode;
  if (failures.isPending) {
    body = <SectionLoading label={`Loading ${member.name}'s payroll failures`} />;
  } else if (failures.isError) {
    body = <InlineError message={staffErrorMessage(failures.error, toolMessages)} />;
  } else if (failures.data.failures.length === 0) {
    body = (
      <p className="text-sm text-role-secondary">No payroll failure is logged for {member.name}.</p>
    );
  } else {
    body = (
      <ul className="divide-y divide-[var(--border-muted)]">
        {failures.data.failures.map((failure) => (
          <FailureRow
            key={failure.id}
            member={member}
            failure={failure}
            rerunReady={failures.data.rerunReadyFailureId === failure.id}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="mt-4 border-l-2 border-[var(--border-muted)] pl-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[var(--text-primary)]">
          {member.name}{' '}
          <span className="text-sm text-role-secondary">
            —{' '}
            {member.onStaff ? `with ${member.employerName ?? 'a player'}` : 'not with a player now'}
          </span>
        </h3>
        <Button
          variant="secondary"
          size="sm"
          pending={diagnose.isPending}
          aria-label={`Diagnose ${member.name}`}
          onClick={() =>
            diagnose.mutate(
              { staffType: member.staffType, staffId: member.id },
              { onSuccess: ({ diagnosis }) => setReport(diagnosis.report) }
            )
          }
        >
          Diagnose
        </Button>
      </div>
      {diagnose.isError && (
        <InlineError message={staffErrorMessage(diagnose.error, toolMessages)} />
      )}
      {report !== null && <CopyReportPanel report={report} onClose={() => setReport(null)} />}
      <div className="mt-2">{body}</div>
    </div>
  );
}

export interface StaffPayrollDiagnosticsProps {
  onCheckinRequired: () => void;
}

export function StaffPayrollDiagnostics({ onCheckinRequired }: StaffPayrollDiagnosticsProps) {
  const [staffType, setStaffType] = useState<PayrollStaffType>('groom');
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<PayrollStaffMember | null>(null);
  const search = usePayrollStaffSearch(staffType, query);

  const checkinLapsed = isCheckinRequired(search.error);
  useEffect(() => {
    if (checkinLapsed) {
      onCheckinRequired();
    }
  }, [checkinLapsed, onCheckinRequired]);

  const find = (event: React.FormEvent) => {
    event.preventDefault();
    setChosen(null);
    setQuery(name.trim());
  };
  const kindWord = staffType === 'groom' ? 'grooms' : 'riders';

  let results: React.ReactNode;
  if (search.isPending) {
    results = <SectionLoading label={`Looking for ${kindWord}`} />;
  } else if (search.isError) {
    const { title, message, retryable } = userMessageFor(search.error);
    results = (
      <ErrorState
        title={title}
        message={message}
        retry={retryable ? { label: 'Try Again', onClick: () => void search.refetch() } : undefined}
      />
    );
  } else if (search.data.staff.length === 0) {
    results = (
      <EmptyState
        variant="first-use"
        title={query ? `No ${kindWord} by that name` : 'No payroll trouble'}
        description={
          query
            ? 'Check the spelling and try again.'
            : `No payroll failure is logged for any of the ${kindWord}.`
        }
      />
    );
  } else {
    results = (
      <ul className="divide-y divide-[var(--border-muted)]">
        {search.data.staff.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <span className="text-[var(--text-primary)]">
              {member.name}{' '}
              <span className="text-sm text-role-secondary">
                — {member.failureCount ?? 0} logged{' '}
                {member.failureCount === 1 ? 'failure' : 'failures'}
                {member.employerName ? `, with ${member.employerName}` : ''}
              </span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              aria-label={`Open ${member.name}`}
              onClick={() => setChosen(member)}
            >
              Open
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <StaffSection
      title="Payroll trouble"
      intro="When the Sunday pay-week settlement or your manual groom payday fails for a groom or rider, it is logged here. Diagnose gives you a report to copy for Claude Code or Codex. Once it is fixed and deployed, Test run tries that pay week and undoes it; Re-run unlocks when the test run passes on the code running now, and never pays a week twice."
    >
      <form onSubmit={find} className="flex flex-wrap items-end gap-3" noValidate>
        <FormField label="Staff" className="w-40">
          {(field) => (
            <Select
              {...field}
              value={staffType}
              options={kindOptions}
              onChange={(event) => {
                setStaffType(event.target.value as PayrollStaffType);
                setChosen(null);
              }}
            />
          )}
        </FormField>
        <FormField label="Name" className="min-w-0 flex-1">
          {(field) => (
            <Input
              {...field}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
            />
          )}
        </FormField>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      <div className="mt-4">{results}</div>
      {chosen && <StaffMemberPanel key={`${chosen.staffType}-${chosen.id}`} member={chosen} />}
    </StaffSection>
  );
}

export default StaffPayrollDiagnostics;
