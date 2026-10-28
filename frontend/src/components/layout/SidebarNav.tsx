/**
 * SidebarNav — Desktop (≥1024px) collapsible left sidebar (Story 22-8)
 *
 * Celestial Night styling: navy bg, gold icon accents, Proda Sans labels,
 * 2px gold left-border on active route. Collapses to a 64px icon-only
 * rail via a ChevronLeft/ChevronRight toggle. Toggle state persists
 * to localStorage key `equoria-sidebar-collapsed`.
 *
 * The menu is the five realms of owner ruling q249 (Equoria-m5ml8). Each realm
 * lets its places down on a gold thread, the way Home's rooms first did (owner
 * ruling q96); a realm's thread opens on its own when the player is in one of
 * its places, and each thread remembers being let down.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import '@/styles/navigation.css';
import {
  navMenuHrefs,
  navRealms,
  currentMenuHref,
  type NavItem,
  type NavRealm,
  type NavRealmId,
} from './navItems';

const storageKey = 'equoria-sidebar-collapsed';

/** Home keeps the key its thread has always used, so players' choice survives. */
const threadKey = (realm: NavRealmId) => `equoria-sidebar-${realm}-thread`;

function readStoredCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(storageKey) === 'true';
  } catch {
    return false;
  }
}

function writeStoredCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(storageKey, String(value));
  } catch {
    /* storage blocked — non-fatal */
  }
}

function readStoredThreads(): Record<NavRealmId, boolean> {
  const open = {} as Record<NavRealmId, boolean>;
  for (const realm of navRealms) {
    try {
      open[realm.id] = window.localStorage.getItem(threadKey(realm.id)) === 'true';
    } catch {
      open[realm.id] = false;
    }
  }
  return open;
}

function writeStoredThread(realm: NavRealmId, value: boolean): void {
  try {
    window.localStorage.setItem(threadKey(realm), String(value));
  } catch {
    /* storage blocked — non-fatal */
  }
}

/** A four-point star: the mark each place hangs from on the thread. */
function ThreadStar({ lit }: { lit: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={cn(
        'h-3 w-3 shrink-0 transition-[color,filter] duration-200 motion-reduce:transition-none',
        lit
          ? 'text-[var(--gold-bright)] drop-shadow-[0_0_4px_rgba(245,230,163,0.7)]'
          : 'text-[var(--gold-dim)]'
      )}
    >
      <path d="M6 0 7.3 4.7 12 6 7.3 7.3 6 12 4.7 7.3 0 6 4.7 4.7Z" fill="currentColor" />
    </svg>
  );
}

export function SidebarNav() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(readStoredCollapsed);
  const [threads, setThreads] = useState<Record<NavRealmId, boolean>>(readStoredThreads);
  const currentHref = currentMenuHref(location.pathname, location.search, navMenuHrefs);
  const currentRealm = navRealms.find((realm) =>
    realm.items.some((item) => item.href === currentHref)
  )?.id;

  // Arriving in a place lets its realm's thread down, so the player sees where they are.
  useEffect(() => {
    if (!currentRealm) return;
    setThreads((prev) => (prev[currentRealm] ? prev : { ...prev, [currentRealm]: true }));
  }, [currentRealm]);

  useEffect(() => {
    for (const realm of navRealms) writeStoredThread(realm.id, threads[realm.id]);
  }, [threads]);

  useEffect(() => {
    writeStoredCollapsed(collapsed);
  }, [collapsed]);

  const toggle = () => setCollapsed((prev) => !prev);
  const toggleThread = (realm: NavRealmId) =>
    setThreads((prev) => ({ ...prev, [realm]: !prev[realm] }));

  const renderLink = (item: { name: string; href: string; Icon: NavItem['Icon'] }) => {
    const active = item.href === currentHref;
    return (
      <Link
        to={item.href}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? item.name : undefined}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm',
          'transition-colors',
          active
            ? 'bg-[var(--glass-border-gold-subtle)] text-[var(--gold-light)] border-l-2 border-l-[var(--gold-primary)] pl-[10px]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] border-l-2 border-l-transparent pl-[10px]',
          collapsed && 'justify-center px-0'
        )}
      >
        <item.Icon
          className={cn('w-5 h-5 flex-shrink-0', active && 'text-[var(--gold-primary)]')}
          aria-hidden="true"
        />
        {!collapsed && (
          <span className="truncate" style={{ fontFamily: 'var(--font-body)' }}>
            {item.name}
          </span>
        )}
      </Link>
    );
  };

  const renderRealm = (realm: NavRealm) => {
    const open = threads[realm.id];
    const threadId = `${realm.id}-rooms-thread`;
    const toggleLabel = open
      ? `Draw up the ${realm.name} thread`
      : `Let down the ${realm.name} thread`;
    return (
      <div key={realm.id}>
        <div className="nav-realm__row">
          {realm.href ? (
            <>
              <div className="nav-realm__link">
                {renderLink({ name: realm.name, href: realm.href, Icon: realm.Icon })}
              </div>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleThread(realm.id)}
                  aria-expanded={open}
                  aria-controls={threadId}
                  aria-label={toggleLabel}
                  data-testid={`${realm.id}-thread-toggle`}
                  className="nav-realm__toggle"
                >
                  <ChevronDown aria-hidden="true" className="nav-realm__chevron" data-open={open} />
                </button>
              )}
            </>
          ) : (
            // A realm with no page of its own (Compete): its heading only opens its thread.
            <button
              type="button"
              onClick={() => toggleThread(realm.id)}
              aria-expanded={collapsed || open}
              aria-controls={threadId}
              title={collapsed ? realm.name : undefined}
              data-testid={`${realm.id}-thread-toggle`}
              data-current={currentRealm === realm.id}
              className="nav-realm__toggle nav-realm__toggle--heading"
              disabled={collapsed}
            >
              <realm.Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              {!collapsed && (
                <>
                  <span className="nav-realm__label">{realm.name}</span>
                  <ChevronDown aria-hidden="true" className="nav-realm__chevron" data-open={open} />
                </>
              )}
            </button>
          )}
        </div>
        <div id={threadId} data-testid={threadId} hidden={!collapsed && !open}>
          <ul
            aria-label={`Places under ${realm.name}`}
            className={cn('nav-thread', !collapsed && 'nav-thread--hung')}
          >
            {!collapsed && <span aria-hidden="true" className="nav-thread__line" />}
            {realm.items.map((item) => (
              <li key={item.href} className="nav-thread__place">
                {!collapsed && <ThreadStar lit={item.href === currentHref} />}
                <div>{renderLink(item)}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <aside
      data-testid="sidebar-nav"
      data-collapsed={collapsed}
      aria-label="Primary navigation"
      className={cn(
        'sticky top-0 h-screen shrink-0',
        'bg-[var(--bg-sidebar)] border-r border-[var(--glass-border)]',
        'flex flex-col',
        'transition-[width] duration-300 ease-[var(--ease-default)]',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Brand / logo row */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--glass-border)]">
        {/* Brand mark — Dragon Tales per DESIGN.md (The Wordmark Rule).
            Single weight 400: never font-bold this face. */}
        {!collapsed && (
          <span
            className="text-xl font-normal tracking-wider text-[var(--gold-primary)]"
            style={{ fontFamily: 'var(--font-wordmark)' }}
          >
            Equoria
          </span>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          data-testid="sidebar-toggle"
          className={cn(
            'nav-touch-target flex items-center justify-center rounded-md',
            'border border-[var(--glass-border)] text-[var(--text-secondary)]',
            'hover:text-[var(--gold-primary)] hover:border-[var(--glass-hover)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)]',
            'transition-colors',
            collapsed && 'mx-auto'
          )}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav list */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navRealms.map(renderRealm)}
      </nav>
    </aside>
  );
}

export default SidebarNav;
