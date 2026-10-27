/**
 * The owner's stud standing for her stallion (Equoria-q4uem.9).
 *
 * Owner rulings: q93 (2026-10-26) one three-way choice, Not at stud / Public
 * Stud / Private Stud, with the fee beside the chosen mode; 2026-10-02 the fee
 * is hers to set, never the game's; 2026-10-23 a stallion stands at stud from
 * age 3. Choosing Not at stud takes him off at once; choosing a mode shows the
 * fee and one Save.
 */

import React, { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/state';
import { useSetStudStanding, type StudStanding as Standing } from '@/hooks/api/useStuds';
import { minBreedingAge, standingRefusal } from './studBreeding';

const standingOptions: { value: Standing; label: string }[] = [
  { value: 'none', label: 'Not at stud' },
  { value: 'public', label: 'Public Stud' },
  { value: 'private', label: 'Private Stud' },
];

const EXPLAIN: Record<Standing, string> = {
  none: 'Not standing at stud. Other players cannot find him among the stallions at stud.',
  public: 'Public Stud: any player can breed a mare to him, and the fee is paid to you at once.',
  private:
    'Private Stud: players send a request, and you accept or reject each one. The fee moves only when you accept.',
};

export function standingOf(studStatus: string | undefined): Standing {
  if (studStatus === 'At Public Stud') return 'public';
  if (studStatus === 'At Private Stud') return 'private';
  return 'none';
}

export interface StudStandingProps {
  horseId: number;
  horseName: string;
  ageYears: number | null;
  studStatus: string | undefined;
  studFee: number | undefined;
}

const StudStanding: React.FC<StudStandingProps> = ({
  horseId,
  horseName,
  ageYears,
  studStatus,
  studFee,
}) => {
  const feeId = useId();
  const saved = standingOf(studStatus);
  const [choice, setChoice] = useState<Standing>(saved);
  // An unknown fee is an empty field, never a believable 0 (doctrine §4).
  const [feeInput, setFeeInput] = useState(typeof studFee === 'number' ? String(studFee) : '');
  const [feeProblem, setFeeProblem] = useState<string | null>(null);
  const setStanding = useSetStudStanding(horseId);
  const tooYoung = ageYears !== null && ageYears < minBreedingAge;

  const save = (standing: Standing) => {
    setFeeProblem(null);
    const fee = Number(feeInput);
    if (standing !== 'none' && (feeInput.trim() === '' || !Number.isInteger(fee) || fee < 0)) {
      setFeeProblem('The stud fee is a whole number of coins, 0 or more.');
      return;
    }
    setStanding.mutate({ standing, fee: standing === 'none' ? 0 : fee });
  };

  const pick = (standing: Standing) => {
    setChoice(standing);
    setStanding.reset();
    if (standing === 'none' && saved !== 'none') save('none');
  };

  return (
    <section className="stud-plaque" aria-labelledby={`${feeId}-title`}>
      <h3 id={`${feeId}-title`} className="stud-plaque__title">
        Stud standing
      </h3>
      <div className="stud-three" role="radiogroup" aria-label="Stud standing">
        {standingOptions.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={choice === value}
            disabled={(tooYoung && value !== 'none') || setStanding.isPending}
            onClick={() => pick(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {tooYoung ? (
        <p className="stud-explain">{horseName} can stand at stud from age 3.</p>
      ) : (
        <p className="stud-explain">{EXPLAIN[choice]}</p>
      )}

      {choice !== 'none' && !tooYoung && (
        <form
          className="stud-feeset"
          onSubmit={(event) => {
            event.preventDefault();
            save(choice);
          }}
        >
          <label htmlFor={feeId} className="stud-feeset__label">
            Stud fee
          </label>
          <input
            id={feeId}
            className="stud-field stud-field--fee"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={feeInput}
            onChange={(event) => setFeeInput(event.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={setStanding.isPending}>
            {setStanding.isPending ? 'Saving…' : 'Save'}
          </Button>
        </form>
      )}

      {feeProblem && <InlineError message={feeProblem} />}
      {setStanding.isError && (
        <InlineError message={standingRefusal(setStanding.error, horseName)} />
      )}
      {setStanding.isSuccess && (
        <p className="stud-saved" role="status">
          {choice === 'none'
            ? `${horseName} is no longer standing at stud.`
            : `${horseName} stands at ${choice === 'public' ? 'Public' : 'Private'} Stud for ${Number(feeInput).toLocaleString()}.`}
        </p>
      )}
    </section>
  );
};

export default StudStanding;
