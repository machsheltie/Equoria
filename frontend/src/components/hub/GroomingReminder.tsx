/**
 * GroomingReminder: the home reminder for tonight's grooming (Equoria-akwyn,
 * Equoria-j765w.3; owner ruling q67, 2026-10-26).
 *
 * Lists only the player's horses that have a groom and have not been groomed
 * this Eastern game day (GET /api/v1/grooms/care/ungroomed-today, foals first).
 * Each name opens that horse's Care area, where the "Groom" press lives. The
 * old hub card told her a foal "needs enrichment" and sent her to Groom
 * Quarters, which cannot groom; it also listed foals already tended.
 *
 * One sentence, not a card wall: the reminder belongs to the stable's evening,
 * not to a dashboard.
 */

import React from 'react';
import { Link } from 'react-router';
import { InlineError } from '@/components/ui/state';
import { useUngroomedToday } from '@/hooks/api/useGroomCare';
import { userMessageFor } from '@/lib/http/userMessage';
import '@/styles/horseCare.css';

/** How many names the sentence carries before "and N more". */
const namesShown = 8;

export function GroomingReminder() {
  const { data: horses, isPending, isError, error, refetch } = useUngroomedToday();

  if (isPending) {
    return (
      <p
        className="grooming-reminder__quiet"
        role="status"
        aria-busy="true"
        data-testid="grooming-reminder-loading"
      >
        Checking who is waiting to be groomed tonight…
      </p>
    );
  }

  if (isError) {
    return (
      <div className="grooming-reminder__error" data-testid="grooming-reminder-error">
        <InlineError message={userMessageFor(error).message} />
        <button type="button" className="grooming-reminder__retry" onClick={() => void refetch()}>
          Try Again
        </button>
      </div>
    );
  }

  if (horses.length === 0) {
    return (
      <p className="grooming-reminder__quiet" data-testid="grooming-reminder-empty">
        No horse is waiting to be groomed tonight.
      </p>
    );
  }

  const shown = horses.slice(0, namesShown);
  const more = horses.length - shown.length;

  return (
    <section aria-label="Tonight's grooming" data-testid="grooming-reminder">
      <p className="grooming-reminder__line">
        <span className="grooming-reminder__lead">Waiting to be groomed tonight: </span>
        {shown.map((horse, index) => (
          <React.Fragment key={horse.horseId}>
            {index > 0 && (index === shown.length - 1 && more === 0 ? ' and ' : ', ')}
            <Link
              to={`/horses/${horse.horseId}#care`}
              className="grooming-reminder__link"
              data-testid={`grooming-reminder-horse-${horse.horseId}`}
            >
              {horse.horseName}
            </Link>
          </React.Fragment>
        ))}
        {more > 0 && (
          <>
            {' and '}
            <Link to="/stable" className="grooming-reminder__link">
              {more} more
            </Link>
          </>
        )}
        .
      </p>
    </section>
  );
}

export default GroomingReminder;
