/**
 * SidebarNav — Desktop (≥1024px) collapsible left sidebar (Story 22-8)
 *
 * Celestial Night styling: navy bg, gold icon accents, Cinzel labels,
 * 2px gold left-border on active route. Collapses to a 64px icon-only
 * rail via a ChevronLeft/ChevronRight toggle. Toggle state persists
 * to localStorage key `equoria-sidebar-collapsed`.
 *
 * All 11 routes are rendered — no beta gating, no read-only mode.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS, isRouteActive } from './navItems';

const STORAGE_KEY = 'equoria-sidebar-collapsed';

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

export function SidebarNav() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(readStoredCollapsed);

  useEffect(() => {
    writeStoredCollapsed(collapsed);
  }, [collapsed]);

  const toggle = () => setCollapsed((prev) => !prev);

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
        {!collapsed && (
          <span
            className="text-xl font-bold tracking-wider text-[var(--gold-primary)]"
            style={{ fontFamily: 'var(--font-heading)' }}
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
          return (
            <Link
              key={item.href}
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
                <span className="truncate" style={{ fontFamily: 'var(--font-heading)' }}>
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export default SidebarNav;
