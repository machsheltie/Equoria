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
 *   [media]  [prefix] Title                         [price]
 *            Subtitle
 *            Description
 *            Meta (badges, tags, stat chips — caller-rendered)
 *   ────────────────────────────────────────────────────────
 *   Action (button or footer — caller-rendered)
 *
 * Click behaviour:
 *   - onClick only (no action): renders as <button> (fully interactive).
 *   - onClick + action: renders outer as a div[role=button] so the action
 *     footer's buttons are not nested inside a <button> (invalid HTML).
 *     Callers must stopPropagation on action button clicks to prevent the
 *     card's onClick from also firing.
 *   - no onClick: non-interactive <div>.
 */

import type { ReactNode, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface ItemCardProps {
  /** Leading visual: image, icon, or any ReactNode. Caller controls size. */
  media?: ReactNode;
  /** Icon or badge rendered immediately left of the title text. */
  titlePrefix?: ReactNode;
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
  /** Optional click handler. When provided, card becomes interactive. */
  onClick?: () => void;
  /** Accessible label override; falls back to title. */
  'aria-label'?: string;
  /** Test hook. */
  'data-testid'?: string;
  /** Extra classes on the outer card. */
  className?: string;
}

/**
 * Surface alignment (DECISIONS.md §4, Equoria-o5hub marketplace family):
 * the card uses the same glass tokens as Surface(panel) but keeps its own
 * zero-padding layout (the info/action areas own internal padding, so the
 * .glass-panel padding recipe cannot be composed directly). Blur was removed —
 * repeated cards must never own a backdrop-filter (single-blur-layer rule);
 * interaction affordance comes from the canonical .glass-panel-interactive
 * class (hover lift/glow + focus-visible ring), matching Surface(interactive).
 */
const CARD_BASE = [
  'flex flex-col',
  'bg-[var(--glass-bg)] border border-[var(--glass-border)]',
  'rounded-[var(--radius-md)] overflow-hidden',
  'transition-all duration-200',
];

const CARD_INTERACTIVE = ['glass-panel-interactive', 'text-left'];

export function ItemCard({
  media,
  titlePrefix,
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
  const hasClick = !!onClick && !disabled;

  const stateClasses = cn(
    selected && 'border-[var(--gold-primary)] shadow-[var(--glow-gold)]',
    disabled && 'opacity-60 pointer-events-none'
  );

  const infoArea = (
    <div className="flex gap-3 p-4">
      {media && <div className="flex-shrink-0">{media}</div>}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {titlePrefix && <span className="flex-shrink-0">{titlePrefix}</span>}
            <h3
              className="text-base font-semibold text-[var(--text-primary)] truncate min-w-0"
              style={{ fontFamily: 'var(--font-heading)' }}
              title={title}
            >
              {title}
            </h3>
          </div>
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
  );

  const actionArea = action ? (
    <div className="border-t border-[var(--glass-border)] p-3">{action}</div>
  ) : null;

  // onClick + action: outer div[role=button] avoids <button> nesting the action's <button>s.
  // Callers must e.stopPropagation() on action button clicks.
  if (hasClick && action) {
    const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.();
      }
    };
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKey}
        aria-label={ariaLabel ?? title}
        data-testid={dataTestId}
        className={cn(CARD_BASE, CARD_INTERACTIVE, stateClasses, className)}
      >
        {infoArea}
        {actionArea}
      </div>
    );
  }

  // onClick only (no action): whole card is a proper <button>.
  if (hasClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? title}
        data-testid={dataTestId}
        className={cn(CARD_BASE, CARD_INTERACTIVE, stateClasses, className)}
      >
        {infoArea}
      </button>
    );
  }

  // Non-interactive card.
  return (
    <div
      data-testid={dataTestId}
      aria-label={ariaLabel}
      className={cn(CARD_BASE, stateClasses, className)}
    >
      {infoArea}
      {actionArea}
    </div>
  );
}

export default ItemCard;
