/**
 * CareChip — shared status chip for horse care indicators (fed, shod, groomed, vetted, cooldown).
 * Returns null when status is 'none' (system not active for this horse).
 */

import { cn } from '@/lib/utils';

const colors = {
  good: 'text-[var(--status-success)]',
  warn: 'text-[var(--status-warning)]',
  bad: 'text-[var(--status-danger)]',
} as const;

const icons = { good: '✓', warn: '⏰', bad: '✗' } as const;

export function CareChip({
  label,
  status,
}: {
  label: string;
  status: 'good' | 'warn' | 'bad' | 'none';
}) {
  if (status === 'none') return null;
  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-[0.6rem] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.03)] whitespace-nowrap',
        colors[status]
      )}
    >
      {icons[status]} {label}
    </span>
  );
}
