/**
 * StaffQuarantinedShows — the shows held back after three failed runs
 * (Equoria-ehlbj, Equoria-yqi49; owner rulings 2026-10-23 q29, q41).
 *
 * Owner only (shows.quarantine.resolve). Players are told "Results delayed";
 * only the owner sees the show itself. Three tools per show:
 *
 * - Diagnose opens a report with one Copy report button, to hand to Claude
 *   Code or Codex. It lists every failed try with its error and stack.
 * - Test run runs the real settlement and undoes it: it shows what Run show
 *   would pay, or that it failed. Nothing moves.
 * - Run show settles once. It stays locked until a test run has passed on the
 *   code running now (a new deploy locks it again). A second press, here or on
 *   another browser, finds the show already run.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, InlineError, SectionLoading } from '@/components/ui/state';
import {
  isCheckinRequired,
  useDiagnoseQuarantinedShow,
  useQuarantinedShows,
  useRunQuarantinedShow,
  useTestRunQuarantinedShow,
} from '@/hooks/api/useStaff';
import type { ApiError } from '@/lib/http/types';
import type { QuarantinedShow, QuarantinedShowTestRun } from '@/lib/api/staff';
import { userMessageFor } from '@/lib/http/userMessage';
import { competitionDisciplineLabel } from '@/lib/utils/training-utils';
import { staffErrorMessage } from './staffMessages';
import StaffSection from './StaffSection';
import CopyReportPanel from './CopyReportPanel';

const toolMessages = {
  404: 'That show is not there any more.',
  409: 'That show is no longer held back. Reload the list.',
  422: "This show's placements cannot be read. Use Diagnose and hand the report to Claude Code or Codex.",
};

const runMessagesByCode: Record<string, string> = {
  testRunRequired: 'Test run this show first. Run show unlocks when the test run passes.',
  testRunStale:
    'The game was updated, or the show changed, since the last test run. Test run it again.',
  showNotQuarantined: 'That show was already run.',
  settlementFailed:
    'The show did not settle and nothing was changed. Use Diagnose: the report now includes this failure.',
};

function runErrorMessage(error: unknown): string {
  const code = (error as Partial<ApiError> | null)?.code;
  if (code && runMessagesByCode[code]) {
    return runMessagesByCode[code];
  }
  return staffErrorMessage(error, toolMessages);
}

function coins(amount: number) {
  return `${amount.toLocaleString()} coins`;
}

function TestRunPanel({ testRun }: { testRun: QuarantinedShowTestRun }) {
  if (!testRun.passed) {
    return (
      <div className="mt-3 border-l-2 border-[var(--border-muted)] pl-4" role="alert">
        <p className="text-[var(--text-primary)]">
          The test run failed. Nothing was changed. Use Diagnose: the report now includes this
          failure. Run show stays locked.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-3 border-l-2 border-[var(--border-muted)] pl-4">
      <p className="text-[var(--text-primary)]" role="status">
        The test run passed and was undone. Run show would pay:
      </p>
      {testRun.placements.length === 0 ? (
        <p className="mt-2 text-sm text-role-secondary">No placing is left to pay.</p>
      ) : (
        <ol className="mt-2 divide-y divide-[var(--border-muted)]">
          {testRun.placements.map((row) => (
            <li key={row.horseId} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="text-[var(--text-primary)]">
                {row.placement}. {row.horseName ?? 'A horse'}
                {row.ownerName ? (
                  <span className="text-sm text-role-secondary"> — {row.ownerName}</span>
                ) : null}
              </span>
              <span className="text-[var(--text-primary)]">{coins(row.prize)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-sm text-role-secondary">
        The host receives {coins(testRun.entryFeesToHost)} in entry fees
        {testRun.unpaidPrizeShareToHost > 0
          ? ` and ${coins(testRun.unpaidPrizeShareToHost)} of unpaid prize`
          : ''}
        . Coins out of the show: {coins(testRun.coinsIn)}; coins paid: {coins(testRun.coinsOut)}.
      </p>
    </div>
  );
}

function runLockedReason(show: QuarantinedShow): string {
  if (!show.lastTestRun) {
    return 'Run show unlocks after a test run passes.';
  }
  if (!show.lastTestRun.passed) {
    return 'The last test run failed. Run show unlocks after a test run passes.';
  }
  return 'The game was updated since the last test run. Test run it again.';
}

function ShowRow({ show }: { show: QuarantinedShow }) {
  const diagnose = useDiagnoseQuarantinedShow();
  const testRunShow = useTestRunQuarantinedShow();
  const runShow = useRunQuarantinedShow();
  const [report, setReport] = useState<string | null>(null);
  const [testRun, setTestRun] = useState<QuarantinedShowTestRun | null>(null);

  const runDiagnose = () =>
    diagnose.mutate(show.id, { onSuccess: ({ diagnosis }) => setReport(diagnosis.report) });
  const runTest = () => {
    runShow.reset();
    testRunShow.mutate(show.id, { onSuccess: ({ testRun: next }) => setTestRun(next) });
  };
  const run = () => runShow.mutate(show.id);

  if (runShow.isSuccess) {
    return (
      <li className="py-4">
        <p className="text-[var(--text-primary)]" role="status">
          {show.name} has been run and paid.
        </p>
      </li>
    );
  }

  const busy = testRunShow.isPending || runShow.isPending;
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[var(--text-primary)]">
          {show.name}{' '}
          <span className="text-sm text-role-secondary">
            — {competitionDisciplineLabel(show.discipline)}, {show.entryCount}{' '}
            {show.entryCount === 1 ? 'entry' : 'entries'}, {show.executionAttempts} failed{' '}
            {show.executionAttempts === 1 ? 'try' : 'tries'}
          </span>
        </span>
        <span className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            size="sm"
            pending={diagnose.isPending}
            aria-label={`Diagnose ${show.name}`}
            onClick={runDiagnose}
          >
            Diagnose
          </Button>
          <Button
            variant="secondary"
            size="sm"
            pending={testRunShow.isPending}
            disabled={busy}
            aria-label={`Test run ${show.name}`}
            onClick={runTest}
          >
            Test run
          </Button>
          <Button
            variant="destructive"
            size="sm"
            pending={runShow.isPending}
            disabled={!show.runShowReady || busy}
            aria-label={`Run ${show.name}`}
            onClick={run}
          >
            Run show
          </Button>
        </span>
      </div>
      <p className="mt-1 text-sm text-role-secondary">
        Holding {coins(show.prizeEscrow)} of prize and {coins(show.feeEscrow)} of entry fees.
        {show.runShowReady
          ? ' The test run passed: Run show is unlocked.'
          : ` ${runLockedReason(show)}`}
      </p>
      {diagnose.isError && (
        <InlineError message={staffErrorMessage(diagnose.error, toolMessages)} />
      )}
      {testRunShow.isError && (
        <InlineError message={staffErrorMessage(testRunShow.error, toolMessages)} />
      )}
      {runShow.isError && <InlineError message={runErrorMessage(runShow.error)} />}
      {report !== null && <CopyReportPanel report={report} onClose={() => setReport(null)} />}
      {testRun && !testRunShow.isPending && <TestRunPanel testRun={testRun} />}
    </li>
  );
}

export interface StaffQuarantinedShowsProps {
  onCheckinRequired: () => void;
}

export function StaffQuarantinedShows({ onCheckinRequired }: StaffQuarantinedShowsProps) {
  const shows = useQuarantinedShows(true);

  const checkinLapsed = isCheckinRequired(shows.error);
  useEffect(() => {
    if (checkinLapsed) {
      onCheckinRequired();
    }
  }, [checkinLapsed, onCheckinRequired]);

  let body: React.ReactNode;
  if (shows.isPending) {
    body = <SectionLoading label="Loading held-back shows" />;
  } else if (shows.isError) {
    const { title, message, retryable } = userMessageFor(shows.error);
    body = (
      <ErrorState
        title={title}
        message={message}
        retry={retryable ? { label: 'Try Again', onClick: () => void shows.refetch() } : undefined}
      />
    );
  } else if (shows.data.shows.length === 0) {
    body = (
      <EmptyState
        variant="first-use"
        title="No shows held back"
        description="Every show has settled."
      />
    );
  } else {
    body = (
      <ul className="divide-y divide-[var(--border-muted)]">
        {shows.data.shows.map((show) => (
          <ShowRow key={show.id} show={show} />
        ))}
      </ul>
    );
  }

  return (
    <StaffSection
      title="Shows held back"
      intro="Players see Results delayed. Diagnose gives you a report to copy for Claude Code or Codex. Once it is fixed and deployed, Test run tries the show and undoes it; Run show unlocks when the test run passes on the code running now, and settles the show once."
    >
      {body}
    </StaffSection>
  );
}

export default StaffQuarantinedShows;
