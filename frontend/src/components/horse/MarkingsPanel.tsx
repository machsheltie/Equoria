/**
 * MarkingsPanel — Equoria-ga5g (31E-3 follow-up)
 *
 * Renders the markings stored on Horse.phenotype JSONB:
 *   - Face marking (none / star / strip / blaze / snip)
 *   - Per-leg markings (FL / FR / HL / HR — coronet / pastern / sock / stocking / none)
 *   - Advanced markings (bloody shoulder / snowflake / frost) — only when present
 *   - Boolean modifiers (sooty / flaxen / pangare / rabicano) — only when true
 *
 * Modifier / advanced chips are intentionally hidden when their flag is false
 * to avoid clutter; we never show "sooty: false".
 *
 * Returns null when the markings object is missing — legacy horses created
 * before the 31E-3 marking system have no marking data on phenotype.
 *
 * `inline` (Equoria-2w4yo, owner request 2026-10-28): the horse page's Horse
 * Details ledger carries the markings in its own "Markings" row, so the lines
 * render without the boxed panel and its heading, and a horse with nothing to
 * show reads "not recorded" there instead of an empty row.
 */

import React from 'react';
import type { HorseMarkings } from '@/pages/horse-detail/HorseDetailPageTypes';

interface MarkingsPanelProps {
  markings?: HorseMarkings | null;
  /** Lines only, no box or heading; "not recorded" when there is nothing. */
  inline?: boolean;
}

function capitalize(word?: string): string {
  if (!word) return 'None';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const LEG_LABELS: Record<keyof NonNullable<HorseMarkings['legMarkings']>, string> = {
  frontLeft: 'FL',
  frontRight: 'FR',
  hindLeft: 'HL',
  hindRight: 'HR',
};

const ADVANCED_LABELS: Record<keyof NonNullable<HorseMarkings['advancedMarkings']>, string> = {
  bloodyShoulderPresent: 'Bloody Shoulder',
  snowflakePresent: 'Snowflake',
  frostPresent: 'Frost',
};

const MODIFIER_LABELS: Record<keyof NonNullable<HorseMarkings['modifiers']>, string> = {
  isSooty: 'Sooty',
  isFlaxen: 'Flaxen',
  hasPangare: 'Pangare',
  isRabicano: 'Rabicano',
};

const notRecorded = <span data-testid="markings-not-recorded">not recorded</span>;

const MarkingsPanel: React.FC<MarkingsPanelProps> = ({ markings, inline = false }) => {
  if (!markings) return inline ? notRecorded : null;

  const { faceMarking, legMarkings, advancedMarkings, modifiers } = markings;

  // Build the list of "true" advanced markings — we hide the false ones.
  const presentAdvanced = advancedMarkings
    ? (Object.entries(advancedMarkings).filter(([, v]) => v === true) as Array<
        [keyof NonNullable<HorseMarkings['advancedMarkings']>, boolean]
      >)
    : [];

  // Build the list of "true" modifiers.
  const presentModifiers = modifiers
    ? (Object.entries(modifiers).filter(([, v]) => v === true) as Array<
        [keyof NonNullable<HorseMarkings['modifiers']>, boolean]
      >)
    : [];

  // If literally nothing to show (legacy horse with empty subfields), return null.
  const hasFace = faceMarking !== undefined && faceMarking !== null;
  const hasLegs = legMarkings && Object.values(legMarkings).some((v) => v !== undefined);
  const hasAdvanced = presentAdvanced.length > 0;
  const hasModifiers = presentModifiers.length > 0;
  if (!hasFace && !hasLegs && !hasAdvanced && !hasModifiers) {
    return inline ? notRecorded : null;
  }

  // In the ledger the value column is right-aligned, so the chip rows are too.
  const chipRow = inline ? 'flex flex-wrap justify-end gap-1.5' : 'flex flex-wrap gap-1.5';

  const lines = (
    <div className={inline ? 'space-y-1' : 'space-y-2 text-sm fantasy-body'}>
      {hasFace && (
        <div data-testid="markings-face">
          <span className="text-[var(--text-secondary)]">Face: </span>
          <span
            className="font-medium text-[var(--text-primary)]"
            data-testid="markings-face-value"
          >
            {capitalize(faceMarking)}
          </span>
        </div>
      )}

      {hasLegs && legMarkings && (
        <div data-testid="markings-legs">
          <span className="text-[var(--text-secondary)]">Legs: </span>
          <span className="font-medium text-[var(--text-primary)]">
            {(Object.keys(LEG_LABELS) as Array<keyof typeof LEG_LABELS>)
              .map((leg) => `${LEG_LABELS[leg]}: ${capitalize(legMarkings[leg])}`)
              .join(', ')}
          </span>
        </div>
      )}

      {hasAdvanced && (
        <div data-testid="markings-advanced" className={chipRow}>
          {presentAdvanced.map(([key]) => (
            <span
              key={key}
              data-testid={`markings-advanced-${key}`}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900/30 border border-amber-500/40 text-amber-300"
            >
              {ADVANCED_LABELS[key]}
            </span>
          ))}
        </div>
      )}

      {hasModifiers && (
        <div data-testid="markings-modifiers" className={chipRow}>
          {presentModifiers.map(([key]) => (
            <span
              key={key}
              data-testid={`markings-modifier-${key}`}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800/50 border border-slate-500/40 text-slate-300"
            >
              {MODIFIER_LABELS[key]}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  if (inline) {
    return <div data-testid="markings-panel">{lines}</div>;
  }

  return (
    <div
      className="mt-3 p-3 rounded-md bg-[var(--surface-subtle)] border border-[var(--border-subtle)]"
      data-testid="markings-panel"
    >
      <h3
        className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-2"
        data-testid="markings-panel-title"
      >
        Markings
      </h3>
      {lines}
    </div>
  );
};

export default MarkingsPanel;
