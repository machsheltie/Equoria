/**
 * StaffHorseAges — the Owner's two tools that change a horse's age
 * (Equoria-a7f1p, owner ruling 2026-11-03 q341).
 *
 * Owner only (horses.age.set): set one horse's age by its number, or age every
 * horse now, the same pass the nightly job runs. The server refuses everyone
 * else; the office shows this area only to the account that holds the tool.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form';
import { InlineError } from '@/components/ui/state';
import { isCheckinRequired, useAgeEveryHorse, useSetHorseAge } from '@/hooks/api/useStaff';
import { staffErrorMessage } from './staffMessages';
import StaffSection from './StaffSection';

const minAge = 0;
const maxAge = 30;

const setAgeMessages = {
  400: `Enter a horse number and an age from ${minAge} to ${maxAge}.`,
  403: 'Only the Owner can change a horse’s age.',
  404: 'No horse has that number.',
};

const ageEveryMessages = {
  403: 'Only the Owner can age every horse.',
};

function wholeNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export interface StaffHorseAgesProps {
  onCheckinRequired: () => void;
}

export function StaffHorseAges({ onCheckinRequired }: StaffHorseAgesProps) {
  const setAge = useSetHorseAge();
  const ageEvery = useAgeEveryHorse();
  const [horseText, setHorseText] = useState('');
  const [ageText, setAgeText] = useState('');

  const checkinLapsed = isCheckinRequired(setAge.error) || isCheckinRequired(ageEvery.error);
  useEffect(() => {
    if (checkinLapsed) {
      onCheckinRequired();
    }
  }, [checkinLapsed, onCheckinRequired]);

  const horseId = wholeNumber(horseText);
  const gameAge = wholeNumber(ageText);
  const ready = horseId !== null && horseId > 0 && gameAge !== null && gameAge <= maxAge;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setAge.mutate({ horseId, gameAge });
  };

  return (
    <StaffSection
      title="Horse ages"
      intro="Set one horse’s age, or age every horse now, the way the nightly job does."
    >
      <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Horse number" className="min-w-0 flex-1">
            {(field) => (
              <Input
                {...field}
                inputMode="numeric"
                value={horseText}
                onChange={(event) => setHorseText(event.target.value)}
                autoComplete="off"
              />
            )}
          </FormField>
          <FormField label={`Age in years (${minAge} to ${maxAge})`} className="min-w-0 flex-1">
            {(field) => (
              <Input
                {...field}
                inputMode="numeric"
                value={ageText}
                onChange={(event) => setAgeText(event.target.value)}
                autoComplete="off"
              />
            )}
          </FormField>
          <Button type="submit" variant="secondary" pending={setAge.isPending} disabled={!ready}>
            Set age
          </Button>
        </div>
        {setAge.isError && (
          <InlineError message={staffErrorMessage(setAge.error, setAgeMessages)} />
        )}
        {setAge.isSuccess && (
          <p role="status" className="text-sm text-[var(--text-primary)]">
            {setAge.data.horseName} is now {setAge.data.newAge}.
          </p>
        )}
      </form>

      <div className="mt-6 flex flex-col gap-2">
        <div>
          <Button
            variant="secondary"
            pending={ageEvery.isPending}
            onClick={() => ageEvery.mutate(undefined)}
          >
            Age every horse now
          </Button>
        </div>
        {ageEvery.isError && (
          <InlineError message={staffErrorMessage(ageEvery.error, ageEveryMessages)} />
        )}
        {ageEvery.isSuccess && (
          <p role="status" className="text-sm text-[var(--text-primary)]">
            {ageEvery.data.totalProcessed.toLocaleString()}{' '}
            {ageEvery.data.totalProcessed === 1 ? 'horse' : 'horses'} checked,{' '}
            {ageEvery.data.birthdaysFound.toLocaleString()}{' '}
            {ageEvery.data.birthdaysFound === 1 ? 'birthday' : 'birthdays'}
            {ageEvery.data.errors > 0
              ? `, ${ageEvery.data.errors.toLocaleString()} could not be aged.`
              : '.'}
          </p>
        )}
      </div>
    </StaffSection>
  );
}

export default StaffHorseAges;
