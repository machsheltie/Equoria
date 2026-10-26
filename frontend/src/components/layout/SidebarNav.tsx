/**
 * SidebarNav — Desktop (≥1024px) collapsible left sidebar (Story 22-8)
 *
 * Celestial Night styling: navy bg, gold icon accents, Proda Sans labels,
 * 2px gold left-border on active route. Collapses to a 64px icon-only
 * rail via a ChevronLeft/ChevronRight toggle. Toggle state persists
 * to localStorage key `equoria-sidebar-collapsed`.
 *
 * All 11 routes are rendered — no beta gating, no read-only mode.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { homeRooms, NAV_SECTIONS, isRouteActive, type NavItem } from './navItems';

const STORAGE_KEY = 'equoria-sidebar-collapsed';
const threadKey = 'equoria-sidebar-home-thread';

function readStoredCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* storage blocked — non-fatal */
  }
}

function readStoredThread(): boolean {
  try {
    return window.localStorage.getItem(threadKey) === 'true';
  } catch {
    return false;
  }
}

function writeStoredThread(value: boolean): void {
  try {
    window.localStorage.setItem(threadKey, String(value));
  } catch {
    /* storage blocked — non-fatal */
  }
}

/** A four-point star: the mark each room hangs from on the thread. */
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
  const [threadOpen, setThreadOpen] = useState<boolean>(readStoredThread);
  const roomActive = homeRooms.some((room) => isRouteActive(location.pathname, room.href));
  const threadShown = threadOpen;

  // Arriving in a room lets the thread down, so the player sees where they are.
  useEffect(() => {
    if (roomActive) setThreadOpen(true);
  }, [roomActive]);

  useEffect(() => {
    writeStoredThread(threadOpen);
  }, [threadOpen]);

  useEffect(() => {
    writeStoredCollapsed(collapsed);
  }, [collapsed]);

  const toggle = () => setCollapsed((prev) => !prev);

  const renderLink = (item: NavItem, active: boolean) => (
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
            'w-8 h-8 flex items-center justify-center rounded-md',
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
        {NAV_SECTIONS.map((item) => {
          const active = isRouteActive(location.pathname, item.href);
          const isHome = item.href === '/';
          return (
            <div key={item.href}>
              <div className="flex items-stretch gap-1">
                <div className="min-w-0 flex-1">{renderLink(item, active)}</div>
                {isHome && !collapsed && (
                  <button
                    type="button"
                    onClick={() => setThreadOpen((prev) => !prev)}
                    aria-expanded={threadShown}
                    aria-controls="home-rooms-thread"
                    aria-label={
                      threadShown ? 'Draw up the rooms under Home' : 'Let down the rooms under Home'
                    }
                    data-testid="home-thread-toggle"
                    className={cn(
                      'flex w-11 shrink-0 items-center justify-center rounded-md',
                      'text-[var(--text-secondary)] hover:text-[var(--gold-primary)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)]',
                      'transition-colors'
                    )}
                  >
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        'h-4 w-4 transition-transform duration-200 motion-reduce:transition-none',
                        threadShown && 'rotate-180'
                      )}
                    />
                  </button>
                )}
              </div>
              {isHome && (
                <div
                  id="home-rooms-thread"
                  data-testid="home-rooms-thread"
                  hidden={!collapsed && !threadShown}
                  className="relative"
                >
                  <ul
                    aria-label="Rooms under Home"
                    className={cn('relative py-1', collapsed ? 'space-y-0.5' : 'ml-5 space-y-0.5')}
                  >
                    {!collapsed && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute bottom-3 left-[5px] top-0 w-px bg-gradient-to-b from-[var(--gold-primary)] to-[var(--gold-dim)]/30"
                      />
                    )}
                    {homeRooms.map((room) => {
                      const roomIsActive = isRouteActive(location.pathname, room.href);
                      return (
                        <li key={room.href} className="flex items-center gap-2">
                          {!collapsed && <ThreadStar lit={roomIsActive} />}
                          <div className="min-w-0 flex-1">{renderLink(room, roomIsActive)}</div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export default SidebarNav;
