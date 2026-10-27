/**
 * ServiceHorseBox — one paid world service with a horse dropdown.
 *
 * Owner ruling 2026-10-26 (q78, Equoria-7dmzp / Equoria-zz14s): the Veterinarian
 * and the Farrier are not "My Horses" pages. Each service is a centred box with
 * a dropdown of the player's horses and one priced button. A horse the service
 * has nothing left to do for is shown greyed out (a disabled option that says
 * why, so the reason is never colour alone); a horse that may not take the
 * service at all is simply not in the list the page passes in.
 *
 * Presentational: the page owns the data and the mutation.
 */

import React, { useEffect, useId, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import { Select } from '@/components/ui/form';

export interface ServiceHorseOption {
  id: number;
  name: string;
  /** Present when the horse cannot take this service now; shown greyed out with this reason. */
  unavailableReason?: string;
  /** This horse's own price, when it differs from the box's base cost. */
  cost?: number;
  /** Shown after the name in the dropdown, e.g. the horse's health. */
  detail?: string;
}

interface ServiceHorseBoxProps {
  /** Stable id used for test ids and element ids, e.g. "health-check". */
  serviceId: string;
  title: string;
  description?: string;
  cost: number;
  /** How the price varies by horse, shown under the description. */
  costNote?: string;
  actionLabel: string;
  horses: ServiceHorseOption[];
  pending: boolean;
  onConfirm: (_horseId: number) => void;
  /** Confirmation for the last purchase, shown under the button. */
  confirmation?: string | null;
  /** Refusal for the last attempt, shown under the button. */
  failure?: string | null;
  onboardingTarget?: string;
}

export const ServiceHorseBox: React.FC<ServiceHorseBoxProps> = ({
  serviceId,
  title,
  description,
  cost,
  costNote,
  actionLabel,
  horses,
  pending,
  onConfirm,
  confirmation,
  failure,
  onboardingTarget,
}) => {
  const selectId = useId();
  const [selected, setSelected] = useState('');

  // A horse that has just taken the service becomes unavailable: clear the pick.
  const selectedHorse = horses.find((h) => String(h.id) === selected);
  useEffect(() => {
    if (selected !== '' && (!selectedHorse || selectedHorse.unavailableReason)) {
      setSelected('');
    }
  }, [selected, selectedHorse]);

  const hasHorses = horses.length > 0;

  return (
    <section
      aria-labelledby={`${selectId}-title`}
      data-testid={`service-box-${serviceId}`}
      className="w-full max-w-sm mx-auto rounded-[var(--radius-lg)] border border-[var(--gold-dim)] bg-[var(--bg-midnight)] p-6 text-center"
    >
      <h2
        id={`${selectId}-title`}
        className="text-lg font-semibold text-[var(--text-primary)] mb-1"
      >
        {title}
      </h2>
      {description && (
        <p className={`text-sm text-[var(--text-secondary)] ${costNote ? 'mb-1' : 'mb-4'}`}>
          {description}
        </p>
      )}
      {costNote && <p className="text-xs text-[var(--text-muted)] mb-4">{costNote}</p>}

      <label
        htmlFor={selectId}
        className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-1"
      >
        Horse
      </label>
      <Select
        id={selectId}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={!hasHorses || pending}
        data-testid={`service-horse-select-${serviceId}`}
      >
        <option value="">{hasHorses ? 'Choose a horse' : 'No horses to choose'}</option>
        {horses.map((horse) => (
          <option
            key={horse.id}
            value={String(horse.id)}
            disabled={Boolean(horse.unavailableReason)}
          >
            {horse.unavailableReason
              ? `${horse.name} — ${horse.unavailableReason}`
              : horse.detail
                ? `${horse.name} (${horse.detail})`
                : horse.name}
          </option>
        ))}
      </Select>

      <Button
        type="button"
        className="w-full mt-4"
        disabled={selected === '' || pending}
        pending={pending}
        onClick={() => selected !== '' && onConfirm(Number(selected))}
        data-testid={`service-confirm-${serviceId}`}
        data-onboarding-target={onboardingTarget}
      >
        <span className="flex items-center justify-center gap-1.5">
          {actionLabel} <Currency amount={selectedHorse?.cost ?? cost} />
        </span>
      </Button>

      <div aria-live="polite" className="mt-3 min-h-[1.25rem] text-sm">
        {confirmation && (
          <p className="flex items-center justify-center gap-2 text-[var(--role-success-text)]">
            <CheckCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            {confirmation}
          </p>
        )}
        {failure && (
          <p role="alert" className="text-[var(--role-danger-text)]">
            {failure}
          </p>
        )}
      </div>
    </section>
  );
};
