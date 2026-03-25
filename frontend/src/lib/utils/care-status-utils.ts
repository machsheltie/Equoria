/**
 * Care Status Utilities — shared helpers for horse care chip display
 *
 * Used by Index.tsx, StableView.tsx, AsidePanel.tsx to determine
 * care status (Fed, Shod, Groomed, Vetted) and training cooldown state.
 */

/** Determine care urgency from a date field and day thresholds.
 *  Returns 'none' if the field was never set (system not yet active). */
export function careChipStatus(
  dateStr: unknown,
  warnDays: number,
  errorDays: number
): 'good' | 'warn' | 'bad' | 'none' {
  if (!dateStr) return 'none';
  const ts =
    typeof dateStr === 'string'
      ? new Date(dateStr).getTime()
      : typeof dateStr === 'number'
        ? dateStr
        : typeof dateStr === 'object' && dateStr !== null
          ? new Date(String(dateStr)).getTime()
          : 0;
  if (!ts) return 'bad';
  const daysAgo = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (daysAgo >= errorDays) return 'bad';
  if (daysAgo >= warnDays) return 'warn';
  return 'good';
}

/** Training cooldown: returns status and appropriate label */
export function trainingCooldownChip(cooldown: unknown): {
  label: string;
  status: 'good' | 'warn';
} {
  if (!cooldown) return { label: 'Can Train', status: 'good' };
  const ts =
    cooldown instanceof Date
      ? cooldown.getTime()
      : typeof cooldown === 'number'
        ? cooldown
        : typeof cooldown === 'string'
          ? new Date(cooldown).getTime()
          : 0;
  if (ts > Date.now()) return { label: 'Cooldown', status: 'warn' };
  return { label: 'Can Train', status: 'good' };
}

/** Check if a horse needs any care (for summary counts).
 *  'none' (never set) is not counted — only active overdue statuses count. */
export function horseNeedsCare(horse: Record<string, unknown>): boolean {
  const statuses = [
    careChipStatus(horse.lastFedDate, 1, 3),
    careChipStatus(horse.lastShod, 7, 14),
    careChipStatus(horse.lastGroomed, 3, 7),
    careChipStatus(horse.lastVettedDate, 7, 14),
  ];
  return statuses.some((s) => s === 'warn' || s === 'bad');
}

/** Check if a horse is ready to train (cooldown expired or never set) */
export function isReadyToTrain(horse: Record<string, unknown>): boolean {
  return trainingCooldownChip(horse.trainingCooldown).status === 'good';
}
