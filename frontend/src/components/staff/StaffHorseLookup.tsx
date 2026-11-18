/**
 * StaffHorseLookup — find a horse by number or name in the Steward's Office
 * (Equoria-puj1e.5, docs/features/admin-time-back.md "Related controls").
 *
 * The Owner and Admins (horse.admin): owner, birth date, age, retired or not,
 * pregnancy and due day, foal development day, and traits. Hidden traits come
 * from the server only for the Owner, so only the Owner ever sees that line.
 * Traits read by their authored names, never their keys.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form';
import { InlineError } from '@/components/ui/state';
import { formatDate } from '@/lib/formatDate';
import { isCheckinRequired } from '@/hooks/api/useStaff';
import { useStaffHorseLookup } from '@/hooks/api/useStaffHorseLookup';
import type { StaffHorse } from '@/lib/api/staffHorses';
import { staffErrorMessage, staffTimeOptions } from './staffMessages';
import StaffSection from './StaffSection';

const lookupMessages = {
  400: 'Enter a horse’s number or part of its name.',
  403: 'Only the Owner and Admins can look horses up.',
};

const years = (n: number) => `${n} ${n === 1 ? 'year' : 'years'} old`;

function traitNames(keys: string[], labels: Record<string, string> | undefined): string {
  return keys.map((key) => labels?.[key] ?? 'a trait without a name yet').join(', ');
}

function HorseFacts({ horse }: { horse: StaffHorse }) {
  const traits = horse.epigeneticModifiers;
  const shown = [...traits.positive, ...traits.negative];
  const facts: string[] = [];
  facts.push(horse.ownerUsername ? `Owned by ${horse.ownerUsername}.` : 'No owner.');
  if (horse.dateOfBirth) {
    const age = horse.age === null ? '' : `, ${years(horse.age)}`;
    facts.push(`Born ${formatDate(horse.dateOfBirth)}${age}${horse.retired ? ', retired' : ''}.`);
  }
  if (horse.pregnancy) {
    const sire = horse.pregnancy.sireName ? ` to ${horse.pregnancy.sireName}` : '';
    facts.push(
      `In foal${sire} since ${new Date(horse.pregnancy.since).toLocaleString(undefined, staffTimeOptions)}; due ${formatDate(horse.pregnancy.dueDay)}.`
    );
  }
  if (horse.foalDevelopmentDay !== null) {
    facts.push(`Foal development day ${horse.foalDevelopmentDay}.`);
  }
  facts.push(
    shown.length > 0 ? `Traits: ${traitNames(shown, horse.traitLabels)}.` : 'No traits shown.'
  );
  if (traits.hidden && traits.hidden.length > 0) {
    facts.push(`Hidden (only you see these): ${traitNames(traits.hidden, horse.traitLabels)}.`);
  } else if (traits.hiddenCount > 0) {
    facts.push(`${traits.hiddenCount} hidden ${traits.hiddenCount === 1 ? 'trait' : 'traits'}.`);
  }
  return (
    <li className="flex flex-col gap-1 border-b border-[var(--border-muted)] pb-3">
      <p className="font-semibold text-[var(--text-primary)]">
        {horse.name} <span className="text-role-secondary">(number {horse.id})</span>
      </p>
      <p className="text-sm text-[var(--text-primary)]">{facts.join(' ')}</p>
    </li>
  );
}

export interface StaffHorseLookupProps {
  onCheckinRequired: () => void;
}

export function StaffHorseLookup({ onCheckinRequired }: StaffHorseLookupProps) {
  const lookup = useStaffHorseLookup();
  const [text, setText] = useState('');

  const checkinLapsed = isCheckinRequired(lookup.error);
  useEffect(() => {
    if (checkinLapsed) {
      onCheckinRequired();
    }
  }, [checkinLapsed, onCheckinRequired]);

  const ready = text.trim().length > 0;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (ready) lookup.mutate(text.trim());
  };
  const horses = lookup.data?.horses;

  return (
    <StaffSection
      title="Find a horse"
      intro="Look a horse up by its number or part of its name: its owner, age, pregnancy and development day."
    >
      <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Horse number or name" className="min-w-0 flex-1">
            {(field) => (
              <Input
                {...field}
                value={text}
                maxLength={40}
                onChange={(event) => setText(event.target.value)}
                autoComplete="off"
              />
            )}
          </FormField>
          <Button type="submit" variant="secondary" pending={lookup.isPending} disabled={!ready}>
            Find
          </Button>
        </div>
        {lookup.isError && (
          <InlineError message={staffErrorMessage(lookup.error, lookupMessages)} />
        )}
      </form>
      {horses && horses.length === 0 && (
        <p role="status" className="mt-4 text-sm text-role-secondary">
          No horse matches that.
        </p>
      )}
      {horses && horses.length > 0 && (
        <ul aria-label="Horses found" className="mt-4 flex flex-col gap-3">
          {horses.map((horse) => (
            <HorseFacts key={horse.id} horse={horse} />
          ))}
        </ul>
      )}
    </StaffSection>
  );
}

export default StaffHorseLookup;
