/**
 * "Breed to <stallion> (<fee>)" and the mare picker (Equoria-q4uem.9).
 *
 * Owner rulings q91/q94 (2026-10-26): the player presses the button, which
 * names the fee, and picks one of her mares from a dropdown. Choosing the mare
 * is the one click. Her own stallion or a Public Stud: the mare is in foal at
 * once (7 days). A Private Stud: her request is sent. No confirm page, no foal
 * preview or odds, no before/after balance and no receipt; the result is said
 * in place. q106: the Private request is disabled when she cannot afford the
 * fee (the server refuses it too).
 */

import React, { useId, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { InlineError, SectionLoading } from '@/components/ui/state';
import { useAuth } from '@/contexts/AuthContext';
import { useHorses } from '@/hooks/api/useHorses';
import { useBreedToStallion, type BreedingKind } from '@/hooks/api/useStuds';
import { toBreedingHorses } from '@/lib/api/breedingHorse';
import { userMessageFor } from '@/lib/http/userMessage';
import { breedButtonLabel, breedingDoneLine, breedingRefusal, mareChoices } from './studBreeding';

export interface BreedToStallionProps {
  stallion: { id: number; name: string; breed: string | null };
  kind: BreedingKind;
  fee: number;
  /** The stallion owner's name, for the Private request line. */
  ownerName?: string | null;
}

const MarePicker: React.FC<{
  selectId: string;
  stallion: BreedToStallionProps['stallion'];
  value: string;
  disabled: boolean;
  onChoose: (damId: number) => void;
}> = ({ selectId, stallion, value, disabled, onChoose }) => {
  const horses = useHorses();
  if (horses.isPending) return <SectionLoading label="Fetching your mares" minHeight="64px" />;
  if (horses.isError) {
    return (
      <div className="stud-breed__picker-error">
        <InlineError message={userMessageFor(horses.error).message} />
        <Button type="button" variant="secondary" size="sm" onClick={() => horses.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  const choices = mareChoices(toBreedingHorses(horses.data), stallion.breed);
  if (choices.length === 0) {
    return <p className="stud-quiet">You have no mares in your stable yet.</p>;
  }
  return (
    <>
      <label htmlFor={selectId} className="stud-breed__label">
        Choose one of your mares
      </label>
      <select
        id={selectId}
        className="stud-field"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          if (event.target.value) onChoose(Number(event.target.value));
        }}
      >
        <option value="">Select a mare…</option>
        {choices.map(({ mare, unavailable }) => (
          <option key={mare.id} value={mare.id} disabled={unavailable !== null}>
            {unavailable
              ? `${mare.name} · ${unavailable}`
              : `${mare.name} · ${mare.breedName} · ${mare.age}`}
          </option>
        ))}
      </select>
    </>
  );
};

const BreedToStallion: React.FC<BreedToStallionProps> = ({ stallion, kind, fee, ownerName }) => {
  const selectId = useId();
  const pickerId = useId();
  const { user } = useAuth();
  const breed = useBreedToStallion();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState('');
  const [done, setDone] = useState<{ damId: number; mareName: string } | null>(null);
  const { data: horses } = useHorses();

  const balance = typeof user?.money === 'number' ? user.money : null;
  const cannotAfford = kind === 'private' && balance !== null && balance < fee;

  const choose = (damId: number) => {
    setChosen(String(damId));
    const mareName = horses?.find((horse) => horse.id === damId)?.name ?? 'Your mare';
    breed.mutate(
      { kind, sireId: stallion.id, damId, fee },
      {
        onSuccess: () => {
          setDone({ damId, mareName });
          setOpen(false);
          setChosen('');
        },
      }
    );
  };

  return (
    <div className="stud-breed">
      <Button
        type="button"
        aria-expanded={open}
        aria-controls={pickerId}
        disabled={cannotAfford || breed.isPending}
        onClick={() => {
          setOpen((was) => !was);
          setDone(null);
          breed.reset();
        }}
      >
        {breedButtonLabel(stallion.name, kind, fee)}
      </Button>
      {cannotAfford && (
        <p className="stud-quiet">
          You need {fee.toLocaleString()} coins to ask for {stallion.name}.
        </p>
      )}

      {open && (
        <div className="stud-breed__picker" id={pickerId}>
          <MarePicker
            selectId={selectId}
            stallion={stallion}
            value={chosen}
            disabled={breed.isPending}
            onChoose={choose}
          />
          {breed.isPending && (
            <p className="stud-quiet" role="status">
              {kind === 'private' ? 'Sending your request…' : 'Breeding…'}
            </p>
          )}
          {breed.isError && <InlineError message={breedingRefusal(breed.error, stallion.name)} />}
        </div>
      )}

      {done && (
        <div className="stud-breed__done" role="status">
          <p className="stud-breed__done-line">
            {breedingDoneLine(kind, done.mareName, stallion.name, ownerName ?? null)}
          </p>
          <Link to={`/horses/${done.damId}`} className="stud-link">
            Open {done.mareName}
          </Link>
        </div>
      )}
    </div>
  );
};

export default BreedToStallion;
