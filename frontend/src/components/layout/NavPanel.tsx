/**
 * NavPanel — full navigation overlay opened by hamburger menu (Section 07)
 *
 * Frosted glass sidebar with gold icons + Cinzel labels.
 * Closes on item click, X button, or backdrop click.
 *
 * All routes are exposed during beta — no feature-flag filtering.
 */

import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import { NAV_SECTIONS, isRouteActive } from './navItems';

interface NavPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NavPanel({ isOpen, onClose }: NavPanelProps) {
  const location = useLocation();

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

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
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
          <span
            className="text-xl font-bold tracking-wider text-[var(--gold-primary)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Equoria
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--glass-hover)] transition-colors"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {NAV_SECTIONS.map((item) => {
            const active = isRouteActive(location.pathname, item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-[var(--radius-md)] mb-0.5',
                  'text-sm transition-all',
                  active
                    ? 'bg-[var(--glass-border-gold-subtle)] border-0 border-l-2 border-l-[var(--gold-primary)] text-[var(--gold-light)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] border border-transparent'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <item.Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <span style={{ fontFamily: 'var(--font-heading)' }}>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
