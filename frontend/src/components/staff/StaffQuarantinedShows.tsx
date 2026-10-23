/**
 * StaffQuarantinedShows — the shows held back after three failed runs
 * (Equoria-ehlbj, owner rulings 2026-10-23).
 *
 * Owner only (shows.quarantine.resolve). Players are told "Results delayed";
 * only the owner sees the show itself. Two tools per show:
 *
 * - Diagnose downloads one file she can hand to Claude Code or Codex.
 * - Run show is two steps: Preview names the placements and the prize money and
 *   moves nothing; Confirm settles once. A second press, here or on another
 *   browser, finds the show already run.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, InlineError, SectionLoading } from '@/components/ui/state';
import {
  isCheckinRequired,
  useDiagnoseQuarantinedShow,
  usePreviewQuarantinedShow,
  useQuarantinedShows,
  useRunQuarantinedShow,
} from '@/hooks/api/useStaff';
import type { QuarantinedShow, QuarantinedShowPreview } from '@/lib/api/staff';
import { userMessageFor } from '@/lib/http/userMessage';
import { staffErrorMessage } from './staffMessages';
import StaffSection from './StaffSection';

const previewMessages = {
  404: 'That show is not there any more.',
  409: 'That show is no longer held back.',
  422: "This show's placements cannot be read. Use Diagnose and hand the file to Claude Code or Codex.",
};

const runMessages = {
  409: 'The show changed or was already run. Reload the list and preview it again.',
  500: 'The show did not settle and nothing was changed. Use Diagnose and hand the file to Claude Code or Codex.',
};

/** Hand a JSON export to the browser as a file. */
function saveJsonFile(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function coins(amount: number) {
  return `${amount.toLocaleString()} coins`;
}

function PreviewPanel({
  preview,
  onConfirm,
  onCancel,
  confirming,
  error,
}: {
  preview: QuarantinedShowPreview;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
  error: unknown;
}) {
  return (
    <div className="mt-3 border-l-2 border-[var(--border-muted)] pl-4">
      <p className="text-[var(--text-primary)]">
        Running this show pays these placings. Nothing has moved yet.
      </p>
      {preview.placements.length === 0 ? (
        <p className="mt-2 text-sm text-role-secondary">No placing is left to pay.</p>
      ) : (
        <ol className="mt-2 divide-y divide-[var(--border-muted)]">
          {preview.placements.map((row) => (
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
        The host receives {coins(preview.entryFeesToHost)} in entry fees
        {preview.unpaidPrizeShareToHost > 0
          ? ` and ${coins(preview.unpaidPrizeShareToHost)} of unpaid prize`
          : ''}
        .
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          variant="destructive"
          size="sm"
          pending={confirming}
          aria-label={`Confirm and run ${preview.name}`}
          onClick={onConfirm}
        >
          Confirm and run
        </Button>
        <Button variant="secondary" size="sm" disabled={confirming} onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {error ? <InlineError message={staffErrorMessage(error, runMessages)} /> : null}
    </div>
  );
}

function ShowRow({ show }: { show: QuarantinedShow }) {
  const diagnose = useDiagnoseQuarantinedShow();
  const previewShow = usePreviewQuarantinedShow();
  const runShow = useRunQuarantinedShow();
  const [preview, setPreview] = useState<QuarantinedShowPreview | null>(null);

  const runDiagnose = () =>
    diagnose.mutate(show.id, {
      onSuccess: ({ diagnosis }) =>
        saveJsonFile(`quarantined-show-${show.id}-diagnosis.json`, diagnosis),
    });
  const runPreview = () => {
    runShow.reset();
    previewShow.mutate(show.id, { onSuccess: ({ preview: next }) => setPreview(next) });
  };
  const confirm = () => {
    if (preview) {
      runShow.mutate({ showId: show.id, previewDigest: preview.previewDigest });
    }
  };

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[var(--text-primary)]">
          {show.name}{' '}
          <span className="text-sm text-role-secondary">
            — {show.discipline}, {show.entryCount} {show.entryCount === 1 ? 'entry' : 'entries'},{' '}
            {show.executionAttempts} failed {show.executionAttempts === 1 ? 'try' : 'tries'}
          </span>
        </span>
        <span className="flex gap-3">
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
            pending={previewShow.isPending}
            aria-label={`Run ${show.name}`}
            onClick={runPreview}
          >
            Run show
          </Button>
        </span>
      </div>
      <p className="mt-1 text-sm text-role-secondary">
        Holding {coins(show.prizeEscrow)} of prize and {coins(show.feeEscrow)} of entry fees.
      </p>
      {diagnose.isError && <InlineError message={staffErrorMessage(diagnose.error)} />}
      {previewShow.isError && (
        <InlineError message={staffErrorMessage(previewShow.error, previewMessages)} />
      )}
      {preview && !runShow.isSuccess && (
        <PreviewPanel
          preview={preview}
          onConfirm={confirm}
          onCancel={() => setPreview(null)}
          confirming={runShow.isPending}
          error={runShow.error}
        />
      )}
      {runShow.isSuccess && (
        <p className="mt-2 text-[var(--text-primary)]" role="status">
          {show.name} has been run and paid.
        </p>
      )}
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
      intro="Players see Results delayed. Diagnose gives you a file for Claude Code or Codex; Run show previews the payout, then settles it once."
    >
      {body}
    </StaffSection>
  );
}

export default StaffQuarantinedShows;
