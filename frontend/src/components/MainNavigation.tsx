/**
 * MainNavigation — Compact top bar (Section 07)
 *
 * Layout: [hamburger] [EQUORIA] [breadcrumb]  ...  [coins] [bell] [avatar]
 * Matches direction-4-hybrid.html mockup.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, LogOut, User } from 'lucide-react';
import { useUnreadCount } from '@/hooks/api/useMessages';
import { useAuth } from '@/contexts/AuthContext';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { NavPanel } from '@/components/layout/NavPanel';

const MainNavigation: React.FC = () => {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const { data: unreadData } = useUnreadCount();
  const { user, logout } = useAuth();

  const unreadCount = unreadData?.count ?? 0;
  const displayMoney = user?.money?.toLocaleString() ?? '0';

  return (
    <>
      <header
        role="banner"
        className="sticky top-0 z-[var(--z-sticky)] flex items-center justify-between px-4 md:px-8 py-3 border-b border-[var(--glass-border)]"
        style={{
          background: 'rgba(15, 25, 50, 0.55)',
          backdropFilter: 'blur(10px) saturate(1.3) brightness(1.1)',
          WebkitBackdropFilter: 'blur(10px) saturate(1.3) brightness(1.1)',
        }}
        data-testid="main-navigation"
      >
        {/* Left: hamburger + logo + breadcrumb */}
        <div className="flex items-center gap-4 md:gap-6">
          {/* Hamburger */}
          <button
            onClick={() => setIsNavOpen(true)}
            className="w-8 h-8 flex flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--glass-hover)] transition-colors cursor-pointer"
            aria-label="Open menu"
            data-testid="hamburger-menu"
            data-onboarding-target="nav-menu"
          >
            <span className="block w-4 h-0.5 bg-current rounded-sm" />
            <span className="block w-4 h-0.5 bg-current rounded-sm" />
            <span className="block w-4 h-0.5 bg-current rounded-sm" />
          </button>

          {/* Logo */}
          <Link
            to="/"
            className="text-xl font-bold tracking-wider text-[var(--gold-primary)] hover:text-[var(--gold-light)] transition-colors"
            style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.08em' }}
            data-onboarding-target="nav-logo"
          >
            Equoria
          </Link>

          {/* Breadcrumb */}
          <Breadcrumb />
        </div>

        {/* Right: coins + bell + avatar */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* Coins pill */}
          <Link
            to="/bank"
            className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-[var(--gold-light)] bg-[rgba(200,168,78,0.08)] px-3 py-1 rounded-[var(--radius-sm)] border border-[rgba(200,168,78,0.15)] hover:bg-[rgba(200,168,78,0.15)] transition-colors"
            data-testid="coins-display"
            data-onboarding-target="nav-coins"
          >
            <span aria-hidden="true">🪙</span>
            <span>{displayMoney}</span>
          </Link>

          {/* Notification bell */}
          <Link
            to="/messages"
            className="relative w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--glass-hover)] transition-colors"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            data-testid="notification-indicator"
            data-onboarding-target="nav-notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[var(--status-danger)] rounded-full border-2 border-[var(--bg-deep-space)]"
                data-testid="notification-dot"
              />
            )}
          </Link>

          {/* Avatar */}
          <Link
            to="/settings"
            className="w-8 h-8 rounded-full bg-[var(--bg-twilight)] border-2 border-[var(--gold-dim)] flex items-center justify-center text-[0.7rem] text-[var(--gold-light)] hover:border-[var(--gold-primary)] transition-colors cursor-pointer"
            aria-label="User settings"
            data-testid="user-avatar"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User className="w-3.5 h-3.5" />
            )}
          </Link>

          {/* Logout */}
          <button
            onClick={() => logout()}
            className="w-8 h-8 rounded-[var(--radius-sm)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--status-danger)] hover:border-[var(--status-danger)] transition-colors cursor-pointer"
            aria-label="Log out"
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Full nav panel overlay */}
      <NavPanel isOpen={isNavOpen} onClose={() => setIsNavOpen(false)} />
    </>
  );
};

export default MainNavigation;
