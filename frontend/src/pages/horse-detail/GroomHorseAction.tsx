/**
 * GroomHorseAction: the daily "Groom Horse" press in the horse page's Quick
 * Actions bar (owner ruling 2026-10-28, Equoria-7dje4).
 *
 * Owner rulings: grooms never work on their own; the player presses
 * "Groom Horse" once a day (q67, 2026-10-20); one press, no confirm page, no
 * receipt (2026-10-26). Once a groom is assigned, the press lives in Quick
 * Actions; until then the bar offers "Assign Groom". Old contract, replaced by
 * Equoria-7dje4: a "Tonight's Care" block in the middle of the page
 * (CareArea).
 *
 * A foal under 3 has a short list of the day's activities, and the server
 * requires one. Pressing "Groom Horse" for a foal opens that list just above
 * the button, and choosing an activity grooms (pending owner question q264,
 * which may make the groom choose instead: FoalActivityPicker is the one
 * piece to swap). Labels come from the server as authored text; activity ids
 * and refusal codes are for logic only. Home reminders link to the horse with
 * #care; the press takes focus then, so the player lands where she meant to.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Brush } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/state';
import { useCareStatus, useGroomHorse } from '@/hooks/api/useGroomCare';
import { actionMessageFor } from '@/lib/http/actionMessage';
import { userMessageFor } from '@/lib/http/userMessage';
import type { CareStatus } from '@/lib/api/groomCare';
import '@/styles/horseCare.css';

/** The refusal copy for the groom press, by the server's refusal code. */
const groomRefusalCopy = {
  activityRequired: "Choose today's activity first.",
  activityNotOffered: "That activity is not on today's list any more. Please choose again.",
  alreadyGroomedToday: 'This horse has already been groomed today.',
  noGroomAssigned: 'This horse needs a groom before it can be groomed.',
  groomCannotWork: 'The groom cannot work right now.',
};

type Foal = NonNullable<CareStatus['foal']>;

/** Today's activities for a foal; choosing one grooms. */
const FoalActivityPicker: React.FC<{
  foal: Foal;
  horseName: string;
  disabled: boolean;
  onChoose: (activityId: string) => void;
}> = ({ foal, horseName, disabled, onChoose }) => (
  <div
    className="groom-action__picker"
    role="group"
    aria-label={`Today's activity for ${horseName}`}
    data-testid="groom-activity-picker"
  >
    <p className="groom-action__picker-title">
      Day {foal.day}, {foal.band.label}. Choose today&rsquo;s activity:
    </p>
    <div className="groom-action__choices">
      {foal.activities.map((choice) => (
        <Button
          key={choice.id}
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => onChoose(choice.id)}
        >
          {choice.label}
        </Button>
      ))}
    </div>
  </div>
);

const GroomHorseAction: React.FC<{ horseId: number; className?: string }> = ({
  horseId,
  className,
}) => {
  const navigate = useNavigate();
  const care = useCareStatus(horseId);
  const groom = useGroomHorse(horseId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pressRef = useRef<HTMLButtonElement>(null);
  const { hash } = useLocation();
  const careReady = care.isSuccess;

  // A home reminder opens this horse with #care: move focus to the press.
  useEffect(() => {
    if (hash === '#care' && careReady) pressRef.current?.focus();
  }, [hash, careReady]);

  const status = care.data;
  const groomError = groom.isError ? actionMessageFor(groom.error, {}, groomRefusalCopy) : null;

  // No groom yet (or the status read says so): the bar offers Assign Groom.
  if (care.isSuccess && status && status.groom === null) {
    return (
      <Button
        type="button"
        size="sm"
        className={className}
        onClick={() => navigate(`/grooms?horseId=${horseId}`)}
        title="Assign a groom to this horse"
        data-testid="action-assign-groom"
      >
        <Brush className="w-3.5 h-3.5" />
        Assign Groom
      </Button>
    );
  }

  const foal = status?.foal ?? null;
  const groomedToday = status?.groomedToday === true;
  const canGroom = status?.canGroomToday === true;
  const reason = groomedToday
    ? 'Groomed today. Come back tomorrow.'
    : (status?.refusal?.message ?? (care.isError ? 'Care status could not be read.' : null));

  const press = () => {
    groom.reset();
    if (foal) {
      setPickerOpen((open) => !open);
      return;
    }
    groom.mutate({});
  };

  const choose = (activityId: string) => {
    groom.mutate({ activity: activityId }, { onSuccess: () => setPickerOpen(false) });
  };

  return (
    <div className="groom-action">
      {pickerOpen && foal && canGroom && (
        <FoalActivityPicker
          foal={foal}
          horseName={status?.horseName ?? ''}
          disabled={groom.isPending}
          onChoose={choose}
        />
      )}
      <Button
        ref={pressRef}
        type="button"
        size="sm"
        className={className}
        onClick={press}
        disabled={!canGroom || care.isPending}
        pending={groom.isPending}
        aria-expanded={foal ? pickerOpen : undefined}
        title={reason ?? 'Groom this horse'}
        data-testid="action-groom-horse"
      >
        <Brush className="w-3.5 h-3.5" />
        {groomedToday ? 'Groomed Today' : 'Groom Horse'}
      </Button>
      {care.isError && <InlineError message={userMessageFor(care.error).message} />}
      {care.isError && (
        <button
          type="button"
          className="groom-action__retry"
          onClick={() => care.refetch()}
          data-testid="groom-status-retry"
        >
          Try Again
        </button>
      )}
      {groomError && <InlineError message={groomError} className="groom-action__error" />}
    </div>
  );
};

export default GroomHorseAction;
