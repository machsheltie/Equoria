/**
 * BottomNav — Mobile-only (< 768px) 5-item tab bar (Story 22-8)
 *
 * Gold-dot indicator appears under the icon of the active route. The
 * "More" tab calls `onMoreClick` which opens the full hamburger panel
 * (NavPanel) instead of navigating.
 */

import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BOTTOM_NAV_ITEMS, isRouteActive } from './navItems';

interface BottomNavProps {
  /** Handler for the "More" tab — typically opens the full NavPanel overlay. */
  onMoreClick: () => void;
}

export function BottomNav({ onMoreClick }: BottomNavProps) {
  const location = useLocation();

  return (
    <nav
      data-testid="bottom-nav"
      aria-label="Primary navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[var(--z-nav)]',
        'h-[var(--bottom-nav-height)]',
        'md:hidden', // phone-only
        'bg-[var(--glass-surface-heavy-bg)] backdrop-blur-xl',
        'border-t border-[var(--glass-border)]',
        'flex items-stretch'
      )}
    >
      {BOTTOM_NAV_ITEMS.map((item) => {
        const active = isRouteActive(location.pathname, item.href);
        const isMore = item.href === '#more';

        const content = (
          <div className="flex flex-col items-center justify-center gap-1 flex-1 h-full">
            <item.Icon
              className={cn(
                'w-5 h-5',
                active ? 'text-[var(--gold-primary)]' : 'text-[var(--text-secondary)]'
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                'text-[10px] tracking-wide',
                active ? 'text-[var(--gold-light)]' : 'text-[var(--text-secondary)]'
              )}
            >
              {item.name}
            </span>
            {active && (
              <span
                data-testid={`bottom-nav-active-dot-${item.href.replace('/', '')}`}
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-[var(--gold-primary)] shadow-[0_0_6px_var(--gold-primary)] absolute bottom-1"
              />
            )}
          </div>
        );

        if (isMore) {
          return (
            <button
              key={item.href}
              type="button"
              onClick={onMoreClick}
              data-testid="bottom-nav-more"
              aria-label="More navigation"
              className={cn(
                'relative flex-1 h-full',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)] focus-visible:ring-inset'
              )}
            >
              {content}
            </button>
          );
        }

        return (
          <Link
            key={item.href}
            to={item.href}
            data-testid={`bottom-nav-${item.name.toLowerCase()}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex-1 h-full',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)] focus-visible:ring-inset'
            )}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomNav;
