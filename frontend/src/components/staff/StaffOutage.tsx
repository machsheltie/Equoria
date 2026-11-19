/**
 * StaffOutage — the Owner's outage tools (Equoria-puj1e.5, owner rulings
 * q377/q378; docs/features/admin-time-back.md).
 *
 * Owner only (jobs.hold, time-back). Hold the nightly jobs, enter when the
 * outage began and ended in Eastern game time, see what would move, then give
 * the time back with a fresh emailed code. Each time-back can be undone once,
 * with its own fresh code. "Deliver overdue foals now" foals only mares already
 * past their due day.
 *
 * Just a game (owner ruling 2026-10-26): no confirm page and no receipt. A
 * success is the page itself changing (the hold line, the list of time-backs);
 * a refusal is a sentence beside its control.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form';
import { InlineError } from '@/components/ui/state';
import { isCheckinRequired } from '@/hooks/api/useStaff';
import {
  useApplyTimeBack,
  useDeliverOverdueFoals,
  useJobHold,
  useSendTimeBackCode,
  useSetJobHold,
  useTimeBackPreview,
  useTimeBacks,
  useUndoTimeBack,
} from '@/hooks/api/useStaffTimeBack';
import type { TimeBackRecord, TimeBackWindow, WallTimeOccurrence } from '@/lib/api/staffTimeBack';
import { easternWallTimeCount } from '@/lib/gameTime';
import { staffTimeOptions } from './staffMessages';
import StaffSection from './StaffSection';
import {
  movedLines,
  pauseWords,
  skippedTimeWords,
  timeBackError,
  unruledLine,
} from './timeBackWords';

const occurrences: WallTimeOccurrence[] = ['first', 'second'];

const when = (iso: string) => new Date(iso).toLocaleString(undefined, staffTimeOptions);
const sixDigits = (text: string) => /^\d{6}$/.test(text.trim());

function CodeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <FormField label={label} className="w-40">
      {(field) => (
        <Input
          {...field}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FormField>
  );
}

function JobHoldLine() {
  const hold = useJobHold();
  const setHold = useSetJobHold();
  const [reason, setReason] = useState('');
  if (hold.isError) return <InlineError message={timeBackError(hold.error)} />;
  if (!hold.data) return null;
  const held = hold.data.held;
  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="text-sm text-[var(--text-primary)]">
        {held && hold.data.heldAt
          ? `The nightly jobs are held, since ${when(hold.data.heldAt)}.`
          : 'The nightly jobs are running.'}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {!held && (
          <FormField label="Why (optional)" className="min-w-0 flex-1">
            {(field) => (
              <Input
                {...field}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
          </FormField>
        )}
        <Button
          variant="secondary"
          pending={setHold.isPending}
          onClick={() => setHold.mutate({ held: !held, reason })}
        >
          {held ? 'Release the nightly jobs' : 'Hold the nightly jobs'}
        </Button>
      </div>
      {setHold.isError && <InlineError message={timeBackError(setHold.error)} />}
    </div>
  );
}

function Preview({ outage }: { outage: TimeBackWindow | null }) {
  const preview = useTimeBackPreview(outage);
  if (!outage) return null;
  if (preview.isError) return <InlineError message={timeBackError(preview.error)} />;
  if (!preview.data) return null;
  const { data } = preview;
  const lines = movedLines(data.fields);
  const unruled = unruledLine(data.unruledFields);
  return (
    <div
      className="flex flex-col gap-2 text-sm text-[var(--text-primary)]"
      aria-label="What would move"
    >
      <p>
        Gives back {pauseWords(data.pauseSeconds)}.{' '}
        {lines.length > 0 ? `Moves ${lines.join(', ')}.` : 'Nothing would move.'}
      </p>
      {data.horsesUnretired > 0 && (
        <p>
          {data.horsesUnretired === 1
            ? '1 horse that turned 21 during the outage goes back to 20.'
            : `${data.horsesUnretired} horses that turned 21 during the outage go back to 20.`}
        </p>
      )}
      {data.jobRuns.length > 0 && (
        <div>
          <p>These ran during the outage and stay as they are:</p>
          <ul className="ml-5 list-disc">
            {data.jobRuns.map((run) => (
              <li key={`${run.jobName}-${run.startedAt}`}>
                {when(run.startedAt)}: {run.effect}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.overlapsTimeBackId !== null && <p>Part of this outage has already been given back.</p>}
      {unruled && <p className="text-role-secondary">{unruled}</p>}
    </div>
  );
}

interface OutageTimeValue {
  text: string;
  occurrence: WallTimeOccurrence | null;
}

const noTime: OutageTimeValue = { text: '', occurrence: null };

/**
 * Whether an outage end is usable: entered, a time the clocks did not skip,
 * and, for a time they repeated, the Owner has said which.
 */
function timeReady({ text, occurrence }: OutageTimeValue): boolean {
  const count = easternWallTimeCount(text);
  return count === 1 || (count === 2 && occurrence !== null);
}

/**
 * One end of the outage, in Eastern time. Only on the night the clocks go back
 * does a small choice appear, for a 1:xx a.m. that happened twice.
 */
function OutageTime({
  label,
  value,
  onChange,
}: {
  label: string;
  value: OutageTimeValue;
  onChange: (next: OutageTimeValue) => void;
}) {
  const count = easternWallTimeCount(value.text);
  const clock = value.text.slice(11).replace(/^0/, '');
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <FormField label={label}>
        {(field) => (
          <Input
            {...field}
            type="datetime-local"
            value={value.text}
            onChange={(e) => onChange({ text: e.target.value, occurrence: null })}
          />
        )}
      </FormField>
      {count === 0 && <InlineError message={skippedTimeWords} />}
      {count === 2 && (
        <fieldset className="flex flex-col gap-1 text-sm text-[var(--text-primary)]">
          <legend>{clock} a.m. happened twice that night.</legend>
          {occurrences.map((choice) => (
            <label key={choice} className="flex items-center gap-2">
              <input
                type="radio"
                name={label}
                checked={value.occurrence === choice}
                onChange={() => onChange({ text: value.text, occurrence: choice })}
              />
              {choice === 'first'
                ? `first ${clock} (before clocks went back)`
                : `second ${clock} (after)`}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

/** The window as the server reads it; a choice is sent only for a time that happened twice. */
function outageWindow(start: OutageTimeValue, end: OutageTimeValue): TimeBackWindow {
  return {
    start: start.text,
    end: end.text,
    ...(start.occurrence ? { startOccurrence: start.occurrence } : {}),
    ...(end.occurrence ? { endOccurrence: end.occurrence } : {}),
  };
}

function GiveBack({ onCheckinRequired }: { onCheckinRequired: () => void }) {
  const [start, setStart] = useState(noTime);
  const [end, setEnd] = useState(noTime);
  const [shown, setShown] = useState<TimeBackWindow | null>(null);
  const [code, setCode] = useState('');
  const sendCode = useSendTimeBackCode();
  const apply = useApplyTimeBack();

  const lapsed = isCheckinRequired(sendCode.error) || isCheckinRequired(apply.error);
  useEffect(() => {
    if (lapsed) onCheckinRequired();
  }, [lapsed, onCheckinRequired]);

  const ready = timeReady(start) && timeReady(end);
  const outage = outageWindow(start, end);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <OutageTime label="Outage began (Eastern)" value={start} onChange={setStart} />
        <OutageTime label="Outage ended (Eastern)" value={end} onChange={setEnd} />
        <Button variant="secondary" disabled={!ready} onClick={() => setShown(outage)}>
          Show what moves
        </Button>
      </div>
      <Preview outage={shown} />
      <div className="flex flex-wrap items-end gap-3">
        <Button
          variant="secondary"
          pending={sendCode.isPending}
          onClick={() => sendCode.mutate('timeBackApply')}
        >
          Email me a code
        </Button>
        <CodeField label="Code from the email" value={code} onChange={setCode} />
        <Button
          pending={apply.isPending}
          disabled={!ready || !sixDigits(code)}
          onClick={() =>
            apply.mutate(
              { outage, code: code.trim() },
              {
                onSuccess: () => {
                  setCode('');
                  setShown(null);
                },
              }
            )
          }
        >
          Give the time back
        </Button>
      </div>
      {sendCode.isSuccess && !apply.isSuccess && (
        <p role="status" className="text-sm text-role-secondary">
          A code is on its way to your email.
        </p>
      )}
      {sendCode.isError && <InlineError message={timeBackError(sendCode.error)} />}
      {apply.isError && <InlineError message={timeBackError(apply.error)} />}
    </div>
  );
}

function TimeBackEntry({ record }: { record: TimeBackRecord }) {
  const [code, setCode] = useState('');
  const sendCode = useSendTimeBackCode();
  const undo = useUndoTimeBack();
  const moved = movedLines(record.summary?.fields);
  return (
    <li className="flex flex-col gap-2 border-t border-[var(--border-muted)] pt-3">
      <p className="text-sm text-[var(--text-primary)]">
        {when(record.windowStart)} to {when(record.windowEnd)}: {pauseWords(record.pauseSeconds)}{' '}
        given back on {when(record.appliedAt)}.
        {moved.length > 0 ? ` Moved ${moved.join(', ')}.` : ''}
      </p>
      {record.reversedAt ? (
        <p className="text-sm text-role-secondary">Undone on {when(record.reversedAt)}.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <Button
            variant="secondary"
            pending={sendCode.isPending}
            onClick={() => sendCode.mutate('timeBackUndo')}
          >
            Email me an undo code
          </Button>
          <CodeField label="Undo code" value={code} onChange={setCode} />
          <Button
            variant="secondary"
            pending={undo.isPending}
            disabled={!sixDigits(code)}
            onClick={() => undo.mutate({ id: record.id, code: code.trim() })}
          >
            Undo
          </Button>
        </div>
      )}
      {sendCode.isError && <InlineError message={timeBackError(sendCode.error)} />}
      {undo.isError && <InlineError message={timeBackError(undo.error)} />}
    </li>
  );
}

function OverdueFoals() {
  const deliver = useDeliverOverdueFoals();
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button variant="secondary" pending={deliver.isPending} onClick={() => deliver.mutate()}>
          Deliver overdue foals now
        </Button>
      </div>
      {deliver.isSuccess && (
        <p role="status" className="text-sm text-[var(--text-primary)]">
          {deliver.data.foalsBorn === 1
            ? '1 overdue foal delivered.'
            : `${deliver.data.foalsBorn.toLocaleString()} overdue foals delivered.`}
        </p>
      )}
      {deliver.isError && <InlineError message={timeBackError(deliver.error)} />}
    </div>
  );
}

export interface StaffOutageProps {
  onCheckinRequired: () => void;
}

export function StaffOutage({ onCheckinRequired }: StaffOutageProps) {
  const list = useTimeBacks();
  return (
    <StaffSection
      title="Lost time"
      intro="When the game was down, hold the nightly jobs and give the players their time back."
    >
      <div className="flex flex-col gap-6">
        <JobHoldLine />
        <GiveBack onCheckinRequired={onCheckinRequired} />
        {list.isError && <InlineError message={timeBackError(list.error)} />}
        {list.data && list.data.length > 0 && (
          <ul aria-label="Time given back" className="flex flex-col gap-3">
            {list.data.map((record) => (
              <TimeBackEntry key={record.id} record={record} />
            ))}
          </ul>
        )}
        <OverdueFoals />
      </div>
    </StaffSection>
  );
}

export default StaffOutage;
