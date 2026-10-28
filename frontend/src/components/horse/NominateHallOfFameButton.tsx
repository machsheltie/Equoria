/**
 * NominateHallOfFameButton — the owner's Hall of Fame nomination for one
 * retired horse (Equoria-vb1n0, owner ruling 2026-10-28).
 *
 * A horse retires at 21; from then its owner may nominate it to the Hall of
 * Fame, once, ever. Rendered at the top of the owner's horse page only (the
 * visitor view never mounts it). After nominating, the button gives way to a
 * plain statement of where the horse stands.
 */

import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/state';
import { useHorseHallOfFameStatus, useNominateHorse } from '@/hooks/api/useHallOfFame';
import { retirementAgeYears } from '@/lib/horseAgePolicy';
import { userMessageFor } from '@/lib/http/userMessage';

interface NominateHallOfFameButtonProps {
  horseId: number;
  horseName: string;
  ageYears: number | null | undefined;
}

export function NominateHallOfFameButton({
  horseId,
  horseName,
  ageYears,
}: NominateHallOfFameButtonProps) {
  const retired = typeof ageYears === 'number' && ageYears >= retirementAgeYears;
  const status = useHorseHallOfFameStatus(horseId, retired);
  const nominate = useNominateHorse(horseId);

  if (!retired || status.isPending) {
    return null;
  }

  if (status.isError) {
    return (
      <div className="flex flex-wrap items-center gap-3 mb-4" data-testid="hall-of-fame-nomination">
        <InlineError message="This horse's Hall of Fame standing could not be loaded." />
        <Button type="button" variant="secondary" size="sm" onClick={() => void status.refetch()}>
          Try Again
        </Button>
      </div>
    );
  }

  const { inducted, nominated, canNominate } = status.data;
  if (inducted) {
    return (
      <p className="mb-4 text-sm text-[var(--gold-light)]" data-testid="hall-of-fame-nomination">
        {horseName} is in the Hall of Fame.
      </p>
    );
  }
  if (nominated) {
    return (
      <p className="mb-4 text-sm text-role-secondary" data-testid="hall-of-fame-nomination">
        {horseName} has been nominated to the Hall of Fame.
      </p>
    );
  }
  if (!canNominate) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4" data-testid="hall-of-fame-nomination">
      <Button
        type="button"
        onClick={() => nominate.mutate()}
        pending={nominate.isPending}
        disabled={nominate.isPending}
      >
        Nominate horse to the Hall of Fame
      </Button>
      {nominate.isError && (
        <InlineError
          message={`${horseName} was not nominated. ${userMessageFor(nominate.error).message}`}
        />
      )}
    </div>
  );
}

export default NominateHallOfFameButton;
