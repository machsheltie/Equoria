/**
 * SlotGrid — equipment / inventory slot grid for game UI (FR-CN2)
 *
 * Renders a fixed-size grid of square slots. Each slot can be:
 *   - empty   : shows a dashed gold border placeholder
 *   - filled  : renders children (item icon, image, etc.)
 *   - locked  : dimmed with a lock icon overlay
 *
 * Intended for tack equipment screens, foal trait reveal grids, and
 * any game inventory that needs a visual "slot" metaphor.
 *
 * Props:
 *   slots       — array of slot definitions
 *   columns     — number of columns (default: 4)
 *   slotSize    — side length of each slot in px (default: 64)
 *   onSlotClick — callback with slot index and slot data
 *   className   — additional classes on the grid wrapper
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface SlotItem {
  /** Unique key for this slot */
  id: string | number;
  /** Slot state */
  state: 'empty' | 'filled' | 'locked';
  /** Label shown below the slot (optional) */
  label?: string;
  /** Content rendered inside a filled slot */
  content?: React.ReactNode;
  /** Tooltip / accessible name */
  title?: string;
}

export interface SlotGridProps {
  /** Slot definitions */
  slots: SlotItem[];
  /** Number of columns in the grid */
  columns?: number;
  /** Side length of each slot in pixels */
  slotSize?: number;
  /** Called when a non-locked slot is clicked */
  onSlotClick?: (_index: number, _slot: SlotItem) => void;
  /** Additional classes on the outer grid wrapper */
  className?: string;
}

const LockIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size * 0.4}
    height={size * 0.4}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="3" y="7" width="10" height="8" rx="2" fill="currentColor" opacity={0.6} />
    <path
      d="M5 7V5a3 3 0 0 1 6 0v2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity={0.6}
    />
  </svg>
);

const SlotGrid: React.FC<SlotGridProps> = ({
  slots,
  columns = 4,
  slotSize = 64,
  onSlotClick,
  className,
}) => {
  return (
    <div
      className={cn('inline-grid gap-2', className)}
      style={{ gridTemplateColumns: `repeat(${columns}, ${slotSize}px)` }}
      role="list"
      aria-label="Item slots"
    >
      {slots.map((slot, index) => {
        const isLocked = slot.state === 'locked';
        const isEmpty = slot.state === 'empty';
        const isFilled = slot.state === 'filled';
        const isClickable = !isLocked && !!onSlotClick;

        return (
          <div key={slot.id} role="listitem" className="flex flex-col items-center gap-1">
            <button
              type="button"
              title={slot.title}
              aria-label={slot.title ?? (isEmpty ? 'Empty slot' : (slot.label ?? 'Slot'))}
              disabled={isLocked}
              onClick={isClickable ? () => onSlotClick(index, slot) : undefined}
              style={{ width: slotSize, height: slotSize }}
              className={cn(
                'relative flex items-center justify-center rounded-[var(--radius-sm)]',
                'transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)]',
                // Empty slot — dashed placeholder
                isEmpty && [
                  'border-2 border-dashed border-[rgba(200,168,78,0.3)]',
                  'bg-[rgba(10,14,26,0.4)]',
                  isClickable &&
                    'hover:border-[rgba(200,168,78,0.6)] hover:bg-[rgba(200,168,78,0.05)] cursor-pointer',
                ],
                // Filled slot — solid gold border
                isFilled && [
                  'border border-[var(--gold-dim)]',
                  'bg-[rgba(10,14,26,0.6)]',
                  isClickable &&
                    'hover:border-[var(--gold-primary)] hover:bg-[rgba(200,168,78,0.08)] cursor-pointer',
                ],
                // Locked slot
                isLocked && [
                  'border border-[rgba(100,100,120,0.3)]',
                  'bg-[rgba(10,14,26,0.25)]',
                  'cursor-not-allowed opacity-50',
                ]
              )}
            >
              {isFilled && slot.content}
              {isLocked && (
                <span className="text-[var(--text-muted)]">
                  <LockIcon size={slotSize} />
                </span>
              )}
              {isEmpty && (
                <span
                  className="text-[rgba(200,168,78,0.2)] select-none"
                  style={{ fontSize: slotSize * 0.35 }}
                  aria-hidden="true"
                >
                  +
                </span>
              )}
            </button>

            {slot.label && (
              <span
                className="text-[10px] leading-tight text-center truncate max-w-full px-0.5"
                style={{ color: 'var(--text-muted)', maxWidth: slotSize }}
              >
                {slot.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SlotGrid;
