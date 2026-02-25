import React from 'react';
import { Home, Search, Trophy, Settings, Users, HelpCircle, LogOut } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const menuItems = [
    { icon: Home, label: 'Stable', href: '#' },
    { icon: Search, label: 'World', href: '#' },
    { icon: Trophy, label: 'Compete', href: '#' },
    { icon: Search, label: 'Search', href: '#' },
    { icon: Users, label: 'Forums', href: '#' },
    { icon: Settings, label: 'Settings', href: '#' },
    { icon: HelpCircle, label: 'Support', href: '#' },
    { icon: LogOut, label: 'Logout', href: '#' },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />

      {/* Sidebar */}
      <div
        className="fixed left-0 top-0 h-full w-3/4 max-w-sm z-50 transform transition-transform duration-300 scroll-entrance"
        style={{
          background: 'rgba(10,22,40,0.97)',
          backdropFilter: 'blur(12px)',
          borderRight: '1px solid var(--border-default)',
        }}
      >
        {/* Header */}
        <div className="p-6 border-b relative" style={{ borderColor: 'var(--border-default)' }}>
          <h2 className="fantasy-title text-2xl">Equoria</h2>
        </div>

        {/* Navigation Items */}
        <nav className="py-4">
          {menuItems.map((item, index) => (
            <a
              key={item.label}
              href={item.href}
              className="flex items-center px-6 py-4 text-[rgb(220,235,255)] hover:bg-[rgba(37,99,235,0.1)] transition-all duration-200 group relative"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <item.icon className="w-5 h-5 mr-4 text-[rgb(100,130,165)] group-hover:text-[rgb(212,168,67)] transition-colors" />
              <span className="font-medium text-lg tracking-wide group-hover:text-[rgb(212,168,67)] transition-colors">
                {item.label}
              </span>
            </a>
          ))}
        </nav>

        {/* Footer */}
        <div
          className="absolute bottom-0 left-0 right-0 p-4 border-t"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          <p className="text-xs text-center text-[rgb(100,130,165)]">&copy; 2025 Equoria</p>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
