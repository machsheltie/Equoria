/**
 * ItemCard — canonical card for shop, inventory, equip, and service lists.
 *
 * One layout, one set of text-size tokens. Replaces the duplicated inline
 * card markup that drifted across InventoryPage, FeedShopPage, HorseEquipPage,
 * TackShopPage, VeterinarianPage, and FarrierPage.
 *
 * Text scale (tokenized — do not deviate per page):
 *   title       → text-base font-semibold truncate     (single line, no wrap)
 *   subtitle    → text-xs text-muted truncate
 *   description → text-sm text-secondary line-clamp-2
 *   price       → text-base font-bold
 *
 * Layout:
 *   [media]  Title                              [price]
 *            Subtitle
 *            Description
 *            Meta (badges, tags, stat chips — caller-rendered)
 *   ────────────────────────────────────────────────────
 *   Action (button or footer — caller-rendered)
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ItemCardProps {
  /** Leading visual: image, icon, or any ReactNode. Caller controls size. */
  media?: ReactNode;
  /** Main title (item name, service name, horse name). */
  title: string;
  /** Short qualifier under the title (category, duration, breed, etc.). */
  subtitle?: ReactNode;
  /** Multi-line description — clamped to 2 lines. */
  description?: ReactNode;
  /** Free-form region for badges, tags, or small stat groups. */
  meta?: ReactNode;
  /** Top-right price/cost slot. */
  price?: ReactNode;
  /** Bottom action area (button, controls, footer text). Rendered with a divider above. */
  action?: ReactNode;
  /** Currently-equipped / selected state — adds gold accent border. */
  selected?: boolean;
  /** Disabled appearance (no pointer effect, dimmed). */
  disabled?: boolean;
  /** Optional click handler. When provided, card renders as a button. */
  onClick?: () => void;
  /** Accessible label override; falls back to title. */
  'aria-label'?: string;
  /** Test hook. */
  'data-testid'?: string;
  /** Extra classes on the outer card. */
  className?: string;
}

const CARD_BASE = [
  'flex flex-col',
  'bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)]',
  'rounded-xl overflow-hidden',
  'transition-all duration-200',
];

const CARD_INTERACTIVE = [
  'hover:border-[var(--glass-hover)] hover:shadow-[var(--glow-gold)] hover:-translate-y-0.5',
  'cursor-pointer text-left',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)]',
];

export function ItemCard({
  media,
  title,
  subtitle,
  description,
  meta,
  price,
  action,
  selected = false,
  disabled = false,
  onClick,
  'aria-label': ariaLabel,
  'data-testid': dataTestId,
  className,
}: ItemCardProps) {
  const interactive = !!onClick && !disabled;

  const body = (
    <>
      <div className="flex gap-3 p-4">
        {media && <div className="flex-shrink-0">{media}</div>}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="text-base font-semibold text-[var(--text-primary)] truncate min-w-0"
              style={{ fontFamily: 'var(--font-heading)' }}
              title={title}
            >
              {title}
            </h3>
            {price && (
              <span className="text-base font-bold text-[var(--gold-primary)] flex-shrink-0 whitespace-nowrap">
                {price}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-[var(--text-muted)] truncate">{subtitle}</p>}
          {description && (
            <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{description}</p>
          )}
          {meta && <div className="flex flex-wrap gap-1.5 mt-1">{meta}</div>}
        </div>
      </div>
      {action && <div className="border-t border-[var(--glass-border)] p-3">{action}</div>}
    </>
  );

  const stateClasses = cn(
    selected && 'border-[var(--gold-primary)] shadow-[var(--glow-gold)]',
    disabled && 'opacity-60 pointer-events-none'
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? title}
        data-testid={dataTestId}
        className={cn(CARD_BASE, CARD_INTERACTIVE, stateClasses, className)}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      data-testid={dataTestId}
      aria-label={ariaLabel}
      className={cn(CARD_BASE, stateClasses, className)}
    >
      {body}
    </div>
  );
}

export default ItemCard;
