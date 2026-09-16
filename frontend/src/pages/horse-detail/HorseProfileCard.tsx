/**
 * HorseProfileCard — top-of-page profile card (portrait, name + inline
 * rename, badges/ribbons, attribute line, temperament, markings, in-foal
 * panel, quick-stats summary).
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 *
 * Design-system migration (Equoria-o5hub.20): the identity block (portrait,
 * h1 name, metadata, back link, edit action) renders through the canonical
 * EntityHeader (D-01 — identity detail page). The inline-rename form renders
 * through EntityHeader's titleSlot (Equoria-o5hub ratchet), so the portrait /
 * back link / metadata stay mounted while editing.
 */

import React from 'react';
import { Edit, ShoppingCart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/IconButton';
import { EntityHeader } from '@/components/layout/EntityHeader';
import { Surface } from '@/components/ui/Surface';
import HealthBadge from '../../components/horse/HealthBadge';
import MarkingsPanel from '../../components/horse/MarkingsPanel';
import PregnancyFeedingPanel from '../../components/horse/PregnancyFeedingPanel';
import { getHorseImage, getHorseImageStyle } from '@/lib/breed-images';
import { getBreedName } from '@/lib/utils';
import { useRenameHorse } from '../../hooks/api/useHorses';
import { InlineError } from '@/components/ui/state/InlineError';
import {
  HORSE_NAME_MAX_LENGTH,
  horseNameRejection,
  horseNameRejectionCopy,
  isUnnamed,
} from '@/lib/horseNamePolicy';
import { userMessageFor } from '@/lib/http/userMessage';
import { getStatColor, getStatIcon } from './statHelpers';
import type { Horse } from './HorseDetailPageTypes';

interface HorseProfileCardProps {
  horse: Horse;
  sireName: string | null;
  isEditing: boolean;
  editName: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChangeEditName: (value: string) => void;
  onOpenTemperamentReference: () => void;
  refetch: () => void;
}

const HorseProfileCard: React.FC<HorseProfileCardProps> = ({
  horse,
  sireName,
  isEditing,
  editName,
  onStartEdit,
  onCancelEdit,
  onChangeEditName,
  onOpenTemperamentReference,
  refetch,
}) => {
  const renameHorseMutation = useRenameHorse();
  const [renameError, setRenameError] = React.useState<string | null>(null);

  // Focus goes back to the pencil when the form closes, whether she saved or
  // cancelled. The pencil unmounts while editing, so this restores focus on the
  // render where it comes back — without it a keyboard user is dropped at the
  // top of the document after naming her horse (DECISIONS.md §10: focus
  // restoration is part of the accessibility floor, not a dialog-only courtesy).
  const pencilRef = React.useRef<HTMLButtonElement>(null);
  const wasEditing = React.useRef(false);
  React.useEffect(() => {
    if (wasEditing.current && !isEditing) {
      pencilRef.current?.focus();
    }
    wasEditing.current = isEditing;
  }, [isEditing]);

  const horseIsUnnamed = isUnnamed(horse.name);
  // The player's own count, so she is never surprised by the cap.
  const nameCharactersLeft = HORSE_NAME_MAX_LENGTH - editName.length;

  const handleStartEdit = () => {
    setRenameError(null);
    onStartEdit();
  };

  const handleCancelEdit = () => {
    setRenameError(null);
    onCancelEdit();
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitted = editName.trim();

    if (submitted === horse.name) {
      handleCancelEdit();
      return;
    }

    // The same rule the server enforces, said here so she reads it beside the
    // field instead of after a round trip. The server still decides.
    const rejection = horseNameRejection(submitted);
    if (rejection !== null) {
      setRenameError(horseNameRejectionCopy(rejection, submitted));
      return;
    }

    setRenameError(null);
    renameHorseMutation.mutate(
      { horseId: horse.id, name: submitted },
      {
        onSuccess: () => {
          // Surface-owned feedback: the header re-renders carrying her name.
          handleCancelEdit();
          refetch();
        },
        onError: (err) => {
          // A 400 here is the name rule (the only thing this endpoint validates),
          // so say the rule; anything else goes through the shared taxonomy. A
          // raw server string is never rendered.
          setRenameError(
            err?.statusCode === 400
              ? `That name was not accepted. A horse name can be up to ${HORSE_NAME_MAX_LENGTH} characters and cannot contain "<".`
              : userMessageFor(err).message
          );
        },
      }
    );
  };

  // Shared metadata block rendered inside the EntityHeader metadata slot.
  const identityMetadata = (
    <div className="min-w-0 space-y-1">
      {/* Badges row */}
      <div className="flex items-center gap-3 flex-wrap">
        {horse.displayedHealth && (
          <HealthBadge
            band={horse.displayedHealth}
            showCriticalWarning={horse.displayedHealth === 'critical'}
          />
        )}
        {/* Equoria-8xfo (31F-FE-2) — Conformation title ribbon.
            Hidden when never-shown (titlePoints === 0 || currentTitle === null).
            Tooltip surfaces breedingValueBoost as +X%. */}
        {horse.currentTitle && (horse.titlePoints ?? 0) > 0 ? (
          <span
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--gold-dim)] text-[var(--bg-midnight)]"
            title={
              horse.breedingValueBoost && horse.breedingValueBoost > 0
                ? `${horse.currentTitle} — Breeding value +${(
                    horse.breedingValueBoost * 100
                  ).toFixed(0)}%`
                : (horse.currentTitle ?? '')
            }
            data-testid="horse-detail-title-ribbon"
          >
            <span aria-hidden="true">🏆</span>
            {horse.currentTitle}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3 text-sm fantasy-body text-[var(--text-secondary)]">
        <span>Breed: {getBreedName(horse.breed)}</span>
        <span>•</span>
        {/* Equoria-lsi5 + Equoria-iwy3 — mirror HorseCard.tsx:130
            fallback chain. phenotype.colorName is the canonical
            genetics-derived color; finalDisplayColor is the
            vestigial pre-31E column (NULL for all canonical DB
            horses). Legacy horses (phenotype: null,
            finalDisplayColor: null) must NEVER render 'Unknown';
            'not recorded' is the honest fallback. */}
        <span data-testid="horse-detail-color">
          Color: {horse.phenotype?.colorName ?? horse.finalDisplayColor ?? 'not recorded'}
        </span>
        <span>•</span>
        <span>Age: {horse.age}</span>
        <span>•</span>
        <span>Gender: {horse.gender}</span>
        <span>•</span>
        <span>Health: {horse.healthStatus}</span>
      </div>
      {/* Equoria-8k7k + Equoria-876o — temperament line w/ reference modal trigger */}
      <div
        className="flex flex-wrap items-center gap-2 text-sm fantasy-body text-[var(--text-secondary)]"
        data-testid="horse-temperament-line"
      >
        <span>
          Temperament:{' '}
          <span
            className="font-medium text-[var(--text-primary)]"
            data-testid="horse-temperament-value"
          >
            {/* Equoria-1k4n — legacy horses have null temperament;
                'not recorded' is the honest fallback. */}
            {horse.temperament ?? 'not recorded'}
          </span>
        </span>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onOpenTemperamentReference}
          className="text-xs h-auto p-0"
          data-testid="temperament-reference-open"
          aria-label="Open temperament reference"
        >
          Learn more
        </Button>
      </div>
      {horse.forSale && (
        <div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-[var(--badge-success-bg)] border border-[var(--role-success-border)] text-[var(--status-success)] text-xs w-fit">
          <ShoppingCart className="w-3 h-3" />
          For Sale — {(horse.salePrice ?? 0).toLocaleString()} coins
        </div>
      )}
      {/* Equoria-ga5g — render markings (face / legs / advanced / modifiers) */}
      <MarkingsPanel markings={horse.markings} />
    </div>
  );

  /* Inline rename form — rendered through EntityHeader's titleSlot so the
     rest of the header (portrait, back link, metadata) stays mounted while
     editing (Equoria-o5hub ratchet; previously the whole header was swapped
     out for the bare form). */
  const renameForm = (
    <form onSubmit={handleEditSubmit} data-testid="horse-rename-form">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={editName}
          onChange={(e) => {
            setRenameError(null);
            onChangeEditName(e.target.value);
          }}
          autoFocus
          /* The real limit, so the field stops where the game stops
             (Equoria-zalyb: 40 characters). It used to stop at 50 while the
             server accepted 100 — two numbers, neither of them the rule. */
          maxLength={HORSE_NAME_MAX_LENGTH}
          aria-label="Horse name"
          aria-describedby="horse-rename-counter"
          aria-invalid={renameError !== null}
          className="font-semibold text-2xl text-[var(--text-primary)] bg-[var(--glass-bg)] border border-[var(--alpha-gold-primary-40)] rounded-[var(--radius-md)] px-3 py-1 outline-none focus:border-[var(--alpha-gold-primary-70)] focus:shadow-[var(--glow-gold)]"
        />
        <Button type="submit" size="sm" disabled={renameHorseMutation.isPending}>
          {renameHorseMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={handleCancelEdit}>
          Cancel
        </Button>
        <IconButton
          type="button"
          aria-label="Cancel editing"
          onClick={handleCancelEdit}
          icon={<X className="w-5 h-5 text-[var(--text-secondary)]" />}
        />
      </div>
      {/* How much room is left, in the functional voice (Proda Sans) DESIGN.md
          assigns to editable horse-name fields. */}
      <p
        id="horse-rename-counter"
        className="mt-1 text-xs fantasy-body text-[var(--text-secondary)] tabular-nums"
        data-testid="horse-rename-counter"
      >
        {nameCharactersLeft} of {HORSE_NAME_MAX_LENGTH} characters left
      </p>
      {renameError && <InlineError message={renameError} className="mt-1" />}
    </form>
  );

  /* An unnamed horse is an invitation, not an error — same h1, same type role
     (Basteleur Moonlight via .type-entity-title), held back in the secondary
     text colour so the word reads as a blank waiting to be filled rather than a
     name someone chose. The line beneath says what to do; the pencil beside it
     does it. */
  const unnamedTitle = (
    <div className="min-w-0">
      <h1 className="type-entity-title break-words" data-testid="horse-unnamed-title">
        <span className="text-[var(--text-secondary)] italic">{horse.name}</span>
      </h1>
      <p className="mt-1 text-sm fantasy-body text-[var(--text-secondary)]">
        She is waiting for a name — the pencil is yours whenever you are ready.
      </p>
    </div>
  );

  return (
    <Surface variant="panel" className="p-6">
      {/* EntityHeader (D-01) — canonical identity header: portrait, h1 name
          (wraps, no truncation), metadata badges, back link, edit action.
          While editing, titleSlot swaps the h1 for the inline rename form and
          the edit action is hidden (the form carries its own cancel/save). */}
      <EntityHeader
        name={horse.name}
        titleSlot={isEditing ? renameForm : horseIsUnnamed ? unnamedTitle : undefined}
        backLink={{ to: '/stable', label: 'Back to Horse List' }}
        className="py-0"
        image={
          <div className="w-32 h-32 md:w-48 md:h-48 rounded-[var(--radius-lg)] border border-[var(--glass-hover)] overflow-hidden bg-[var(--glass-bg)]">
            <img
              src={getHorseImage(horse.imageUrl, horse.breed)}
              alt={horseIsUnnamed ? 'A horse who has not been named yet' : horse.name}
              className="w-full h-full object-cover"
              style={getHorseImageStyle(horse.imageUrl, horse.breed)}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/horse-placeholder.png';
              }}
            />
          </div>
        }
        metadata={identityMetadata}
        actions={
          isEditing ? undefined : (
            <IconButton
              ref={pencilRef}
              type="button"
              /* No age gate: the owner ruled a horse may be renamed at will.
                 The label changes for a horse who has never been named, because
                 for her this is naming, not editing. */
              aria-label={horseIsUnnamed ? 'Name this horse' : 'Edit horse name'}
              onClick={handleStartEdit}
              icon={<Edit className="w-5 h-5 text-[var(--text-secondary)]" />}
            />
          )
        }
      />

      {/* Description */}
      {horse.description && (
        <p className="fantasy-body text-[var(--text-primary)] mb-4">{horse.description}</p>
      )}

      {/* In-foal panel — feed-system redesign 2026-04-29 (B6, Equoria-ta4s). */}
      {horse.inFoalSinceDate && (
        <div className="mb-4">
          <PregnancyFeedingPanel
            inFoalSinceDate={horse.inFoalSinceDate}
            feedings={horse.pregnancyFeedingsByTier ?? {}}
            sireName={sireName}
            pregnancySireId={horse.pregnancySireId ?? null}
          />
        </div>
      )}

      {/* Quick Stats Summary */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {Object.entries(horse.stats).map(([statName, value]) => (
          <div
            key={statName}
            className="flex flex-col items-center p-3 bg-[var(--bg-midnight)] rounded-[var(--radius-sm)] border border-[var(--glass-border)]"
          >
            <div className={`mb-1 ${getStatColor(value)}`}>{getStatIcon(statName)}</div>
            <span className="text-xs fantasy-caption text-[var(--text-secondary)] capitalize">
              {statName}
            </span>
            <span className="text-lg font-semibold tabular-nums text-[var(--text-primary)]">
              {value}
            </span>
          </div>
        ))}
      </div>
    </Surface>
  );
};

export default HorseProfileCard;
