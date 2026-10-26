/**
 * CareArea: tonight's care on the horse page (Equoria-j765w.2; owner ruling
 * q67, 2026-10-26).
 *
 * Tonight's care is a line in the horse's care journal, open until the player
 * presses "Groom <name>". For a foal under 3 she first picks one of the day's
 * activities from its age band; the groom does it. One press, no confirm page,
 * no receipt, no before/after numbers (owner ruling 2026-10-26). The bond the
 * grooming adds shows in Current Status, where bond always lives.
 *
 * Every label comes from the server as authored text; activity ids and refusal
 * codes are used for logic only (owner ruling 2026-10-23: no code names).
 * Home reminders link here with #care (Equoria-akwyn); "Assign a groom" keeps
 * this horse on the way to Groom Quarters (Equoria-e861f).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { InlineError, SectionLoading } from '@/components/ui/state';
import { useCareStatus, useGroomHorse } from '@/hooks/api/useGroomCare';
import { actionMessageFor } from '@/lib/http/actionMessage';
import { userMessageFor } from '@/lib/http/userMessage';
import type { CareStatus } from '@/lib/api/groomCare';
import '@/styles/horseCare.css';

/** A small lantern: hollow flame while tonight's care is open, lit once it is done. */
const Lantern: React.FC = () => (
  <svg
    className="horse-care__lantern"
    viewBox="0 0 28 28"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M11 4.5a3 3 0 0 1 6 0" />
    <path d="M9 7h10l-1 2H10z" />
    <path d="M10 9v11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V9" />
    <path d="M8.5 22.5h11" />
    <path
      className="horse-care__lantern-flame"
      d="M14 12.2c1.6 1.7 2.1 3 2.1 4.1a2.1 2.1 0 0 1-4.2 0c0-1.1.5-2.4 2.1-4.1z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);

/** The refusal copy for the groom press, by the server's refusal code. */
const groomRefusalCopy = {
  activityRequired: "Choose today's activity first.",
  activityNotOffered: "That activity is not on today's list any more. Please choose again.",
  alreadyGroomedToday: 'This horse has already been groomed today.',
  noGroomAssigned: 'This horse needs a groom before it can be groomed.',
  groomCannotWork: 'The groom cannot work right now.',
};

type CareState = 'open' | 'tended' | 'waiting';

const careStateOf = (status: CareStatus): CareState =>
  status.groomedToday ? 'tended' : status.canGroomToday ? 'open' : 'waiting';

const CareArea: React.FC<{ horseId: number; horseName: string }> = ({ horseId, horseName }) => {
  const care = useCareStatus(horseId);
  const groom = useGroomHorse(horseId);
  const [activity, setActivity] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const { hash } = useLocation();

  // A home reminder opens this horse's Care area (#care): bring it into view and
  // move focus to it, so a keyboard or screen-reader player lands where she meant to.
  useEffect(() => {
    if (hash !== '#care') return;
    const section = sectionRef.current;
    if (!section) return;
    section.scrollIntoView?.({ block: 'start' });
    section.focus({ preventScroll: true });
  }, [hash, horseId]);

  const status = care.data;
  const state = status ? careStateOf(status) : null;
  const name = status?.horseName ?? horseName;
  const foal = status?.foal ?? null;
  // A picked activity that is no longer offered (the day moved on) does not count.
  const chosen =
    foal && activity && foal.activities.some((a) => a.id === activity) ? activity : null;
  const needsChoice = Boolean(foal) && chosen === null;

  const handleGroom = () => {
    groom.mutate({ activity: foal ? (chosen ?? undefined) : undefined });
  };

  const groomError = groom.isError ? actionMessageFor(groom.error, {}, groomRefusalCopy) : null;

  return (
    <section
      id="care"
      ref={sectionRef}
      tabIndex={-1}
      className="horse-care"
      data-state={state ?? 'loading'}
      aria-labelledby="horse-care-heading"
      data-testid="horse-care"
    >
      <div className="horse-care__head">
        <Lantern />
        <h2 id="horse-care-heading" className="horse-care__title">
          Tonight&rsquo;s Care
        </h2>
      </div>

      {care.isPending && <SectionLoading label="Loading tonight's care" minHeight="96px" />}

      {care.isError && (
        <div className="horse-care__actions" data-testid="horse-care-error">
          <InlineError message={userMessageFor(care.error).message} />
          <Button type="button" variant="secondary" size="sm" onClick={() => care.refetch()}>
            Try Again
          </Button>
        </div>
      )}

      {status && state === 'tended' && (
        <>
          <p className="horse-care__line" data-testid="horse-care-line">
            <strong>{name}</strong> has been groomed tonight
            {status.groom ? (
              <>
                {' '}
                by <strong>{status.groom.name}</strong>
              </>
            ) : null}
            .
          </p>
          {foal?.todaysActivity && (
            <p className="horse-care__note" data-testid="horse-care-todays-activity">
              Today&rsquo;s activity: {foal.todaysActivity.label}.
            </p>
          )}
          <p className="horse-care__note">Tonight&rsquo;s care is done. Come back tomorrow.</p>
        </>
      )}

      {status && state === 'waiting' && (
        <>
          <p className="horse-care__line" data-testid="horse-care-line">
            Tonight&rsquo;s care for <strong>{name}</strong> is still open.
          </p>
          {status.refusal && (
            <p className="horse-care__note" data-testid="horse-care-refusal">
              {status.refusal.message}{' '}
              {status.refusal.code === 'noGroomAssigned' ? (
                <Link
                  to={`/grooms?horseId=${horseId}`}
                  className="horse-care__link"
                  data-testid="horse-care-assign-groom"
                >
                  Assign a groom
                </Link>
              ) : (
                <Link to="/grooms" className="horse-care__link">
                  Visit Groom Quarters
                </Link>
              )}
            </p>
          )}
        </>
      )}

      {status && state === 'open' && (
        <>
          <p className="horse-care__line" data-testid="horse-care-line">
            Tonight&rsquo;s care for <strong>{name}</strong> is still open
            {status.groom ? (
              <>
                . <strong>{status.groom.name}</strong> is ready when you are.
              </>
            ) : (
              '.'
            )}
          </p>

          {foal && (
            <fieldset className="horse-care__activities" data-testid="horse-care-activities">
              <legend>
                Day {foal.day} of {name}&rsquo;s life, {foal.band.label}. Choose today&rsquo;s
                activity:
              </legend>
              <div className="horse-care__choices">
                {foal.activities.map((choice) => (
                  <label key={choice.id} className="horse-care__choice">
                    <input
                      type="radio"
                      name={`care-activity-${horseId}`}
                      value={choice.id}
                      checked={chosen === choice.id}
                      onChange={() => {
                        groom.reset();
                        setActivity(choice.id);
                      }}
                      disabled={groom.isPending}
                    />
                    {choice.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="horse-care__actions">
            <Button
              type="button"
              onClick={handleGroom}
              disabled={needsChoice}
              pending={groom.isPending}
              data-testid="horse-care-groom"
            >
              Groom {name}
            </Button>
            {groomError && <InlineError message={groomError} />}
          </div>
        </>
      )}
    </section>
  );
};

export default CareArea;
