/**
 * HorseNameField — where a new player names her first horse (Equoria-zalyb).
 *
 * OWNER RULING 2026-09-14: the starter horse's name goes through the shared name
 * policy and an over-long one is REJECTED, not silently shortened — "with a
 * rejection message worth reading, since it is a new player's first action".
 *
 * So this field's job is to make that rejection RARE and, when it happens,
 * legible: it stops at the real limit, shows how much room is left, and says
 * what is wrong beside the field itself (`InlineError`) rather than in a toast
 * that vanishes while she is still reading it. The server remains the validator;
 * `@/lib/horseNamePolicy` is the same rule said early.
 *
 * Extracted from BreedSelector.tsx, which was at its size ceiling.
 */

import React from 'react';
import { Input } from '@/components/ui/form';
import { InlineError } from '@/components/ui/state/InlineError';
import {
  HORSE_NAME_MAX_LENGTH,
  horseNameRejection,
  horseNameRejectionCopy,
} from '@/lib/horseNamePolicy';

export interface HorseNameFieldProps {
  /** Exactly what she has typed so far. */
  name: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Shown in the preview chip once there is a name to preview. */
  breedName?: string;
  gender?: string;
}

export function HorseNameField({ name, onChange, breedName, gender }: HorseNameFieldProps) {
  // Only complain about a name she has actually started typing — an untouched
  // field is not a mistake, and the step's Continue button already says the step
  // is unfinished.
  const rejection = name.length > 0 ? horseNameRejection(name) : null;
  const charactersLeft = HORSE_NAME_MAX_LENGTH - name.length;

  return (
    <div>
      <label
        htmlFor="horse-name-input"
        className="block text-xs text-[var(--text-muted)] font-[var(--font-body)] uppercase tracking-widest mb-2"
      >
        Name Your Horse
      </label>
      <Input
        id="horse-name-input"
        type="text"
        value={name}
        onChange={onChange}
        placeholder="e.g. Midnight Comet"
        /* The game's real limit. The field has always stopped here; what changed
           is that the server now agrees instead of quietly shortening a longer
           name. */
        maxLength={HORSE_NAME_MAX_LENGTH}
        aria-describedby="horse-name-counter"
        aria-invalid={rejection !== null}
        data-testid="horse-name-input"
      />

      <p
        id="horse-name-counter"
        className="mt-1.5 text-xs text-[var(--text-muted)] font-[var(--font-body)] tabular-nums"
        data-testid="horse-name-counter"
      >
        {charactersLeft} of {HORSE_NAME_MAX_LENGTH} characters left
      </p>

      {rejection !== null && (
        <InlineError message={horseNameRejectionCopy(rejection, name)} className="mt-1.5" />
      )}

      {/* Live preview chip — her horse, said back to her. */}
      {name.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] font-[var(--font-body)]">Preview:</span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--alpha-gold-primary-12)] border border-[var(--alpha-gold-ember-30)] text-[var(--gold-primary)] font-[var(--font-heading)]">
            {name}
            {breedName ? ` · ${breedName}` : ''}
            {gender ? ` · ${gender}` : ''}
          </span>
        </div>
      )}
    </div>
  );
}

export default HorseNameField;
