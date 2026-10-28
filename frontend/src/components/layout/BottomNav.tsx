/**
 * BottomNav — the phone (< 768px) bottom bar: the five realms (owner ruling
 * 2026-10-28, q267), matching the main menu. Each realm opens its own list in
 * the phone menu (NavPanel); the realm the player is in keeps a gold dot and
 * is announced as the current location, so it is never shown by color alone.
 */

import { useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import '@/styles/navigation.css';
import { currentRealmId, navRealms, type NavRealmId } from './navItems';

interface BottomNavProps {
  /** The realm whose list is open, if any. */
  openRealm: NavRealmId | null;
  /** Open (or, when it is already open, close) a realm's list. */
  onRealmClick: (realm: NavRealmId | null) => void;
}

export function BottomNav({ openRealm, onRealmClick }: BottomNavProps) {
  const location = useLocation();
  const here = currentRealmId(location.pathname, location.search);

  return (
    <nav
      data-testid="bottom-nav"
      aria-label="Primary navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[var(--z-nav)]',
        // Equoria-o5hub.5 (D-24): total height grows by the iOS home-indicator
        // inset and the inset is consumed as padding-bottom, so the tappable
        // 56px row keeps its full size while the bar's surface extends under
        // the indicator (0px everywhere except notched iOS).
        'h-[calc(var(--bottom-nav-height)+var(--safe-area-bottom))]',
        'pb-[var(--safe-area-bottom)]',
        'md:hidden', // phone-only
        'bg-[var(--glass-surface-heavy-bg)] backdrop-blur-heavy',
        'border-t border-[var(--glass-border)]',
        'flex items-stretch'
      )}
    >
      {navRealms.map((realm) => {
        const current = realm.id === here;
        const open = realm.id === openRealm;
        return (
          <button
            key={realm.id}
            type="button"
            onClick={() => onRealmClick(open ? null : realm.id)}
            data-testid={`bottom-nav-${realm.id}`}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-current={current ? 'location' : undefined}
            className={cn(
              'nav-touch-target relative flex-1 h-full min-w-0',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)] focus-visible:ring-inset'
            )}
          >
            <span className="flex flex-col items-center justify-center gap-1 h-full">
              <realm.Icon
                className={cn(
                  'w-5 h-5',
                  current || open ? 'text-[var(--gold-primary)]' : 'text-[var(--text-secondary)]'
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  'text-[10px] tracking-wide',
                  current || open ? 'text-[var(--gold-light)]' : 'text-[var(--text-secondary)]'
                )}
              >
                {realm.name}
              </span>
              {current && (
                <span
                  data-testid={`bottom-nav-active-dot-${realm.id}`}
                  aria-hidden="true"
                  className="w-1.5 h-1.5 rounded-full bg-[var(--gold-primary)] shadow-[0_0_6px_var(--gold-primary)] absolute bottom-1"
                />
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export default BottomNav;
