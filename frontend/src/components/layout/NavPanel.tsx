/**
 * NavPanel — legacy navigation overlay opened by the hamburger menu.
 *
 * The former Section 07 is retired. This overlay is migration state, not a
 * reusable UX pattern or approval for dashboard-shell navigation.
 * Closes on item click, X button, backdrop click or Escape.
 *
 * It lists the five realms of owner ruling q249 (Equoria-m5ml8), each realm
 * followed by its places.
 *
 * Keyboard (Equoria-ct39p): opening moves focus into the menu, Tab and
 * Shift+Tab stay inside it, the page behind is inert while it is open, and
 * closing returns focus to whatever opened it.
 */

import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import '@/styles/navigation.css';
import { navMenuHrefs, navRealms, currentMenuHref, type NavItem } from './navItems';

interface NavPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Make every other child of <body> inert; returns the undo. */
function makeBackgroundInert(keep: HTMLElement): () => void {
  const madeInert: Element[] = [];
  for (const element of Array.from(document.body.children)) {
    if (element === keep || element.hasAttribute('inert')) continue;
    element.setAttribute('inert', '');
    madeInert.push(element);
  }
  return () => {
    for (const element of madeInert) element.removeAttribute('inert');
  };
}

export function NavPanel({ isOpen, onClose }: NavPanelProps) {
  const location = useLocation();
  const layerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const currentHref = currentMenuHref(location.pathname, location.search, navMenuHrefs);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Focus moves in on open and goes back to the opener on close; the page
  // behind cannot be reached while the menu is open.
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const layer = layerRef.current;
    const restoreBackground = layer ? makeBackgroundInert(layer) : () => {};
    panelRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    return () => {
      restoreBackground();
      if (opener?.isConnected) opener.focus();
    };
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panelRef.current.contains(active);
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const renderLink = (item: Pick<NavItem, 'name' | 'href' | 'Icon'>) => {
    const active = item.href === currentHref;
    return (
      <Link
        to={item.href}
        onClick={onClose}
        className={cn(
          'flex items-center gap-3 px-3 py-3 rounded-[var(--radius-md)] mb-0.5',
          'text-sm transition-all',
          active
            ? 'bg-[var(--glass-border-gold-subtle)] border-l-2 border-l-[var(--gold-primary)] text-[var(--gold-light)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] border-l-2 border-l-transparent'
        )}
        aria-current={active ? 'page' : undefined}
      >
        <item.Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        <span style={{ fontFamily: 'var(--font-body)' }}>{item.name}</span>
      </Link>
    );
  };

  return createPortal(
    <div ref={layerRef} data-testid="nav-panel-layer">
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          'fixed top-0 left-0 z-[var(--z-modal)] h-full w-72',
          'bg-[var(--glass-surface-heavy-bg)] backdrop-blur-xl',
          'border-r border-[var(--glass-border)]',
          'flex flex-col',
          'animate-in slide-in-from-left duration-300'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--glass-border)]">
          {/* Navigation brand mark — Dragon Tales per DESIGN.md (The Wordmark
              Rule). Single weight 400: never font-bold this face. */}
          <span
            className="text-xl font-normal tracking-wider text-[var(--gold-primary)]"
            style={{ fontFamily: 'var(--font-wordmark)' }}
          >
            Equoria
          </span>
          <button
            type="button"
            onClick={onClose}
            className="nav-touch-target flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--glass-hover)] transition-colors"
            aria-label="Close menu"
            data-testid="nav-panel-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* The five realms, each followed by its places. */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {navRealms.map((realm) => {
            const headingId = `nav-panel-${realm.id}`;
            return (
              <section key={realm.id} className="nav-panel__realm" aria-labelledby={headingId}>
                {realm.href ? (
                  <div id={headingId}>
                    {renderLink({ name: realm.name, href: realm.href, Icon: realm.Icon })}
                  </div>
                ) : (
                  <h2 id={headingId} className="nav-panel__realm-name">
                    <realm.Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                    {realm.name}
                  </h2>
                )}
                <ul className="nav-panel__places">
                  {realm.items.map((item) => (
                    <li key={item.href}>{renderLink(item)}</li>
                  ))}
                </ul>
              </section>
            );
          })}
        </nav>
      </div>
    </div>,
    document.body
  );
}
