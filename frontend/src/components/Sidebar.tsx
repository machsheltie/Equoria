
import React from 'react';
import { Home, Search, Trophy, Settings, Users, HelpCircle, LogOut, Menu } from 'lucide-react';

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
      <div 
        className="fixed inset-0 bg-midnight-ink bg-opacity-50 z-40 lg:hidden"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-3/4 max-w-sm bg-parchment z-50 transform transition-transform duration-300 parchment-texture gold-border scroll-entrance`}>
        {/* Header */}
        <div className="p-6 border-b-2 border-aged-bronze relative">
          <h2 className="fantasy-title text-2xl text-midnight-ink">
            Equoria
          </h2>
          <div className="absolute top-2 right-2 w-8 h-8">
            <div className="w-full h-full border-2 border-burnished-gold rounded-full bg-gradient-to-br from-burnished-gold to-aged-bronze opacity-20" />
          </div>
        </div>
        
        {/* Navigation Items */}
        <nav className="py-4">
          {menuItems.map((item, index) => (
            <a
              key={item.label}
              href={item.href}
              className="flex items-center px-6 py-4 text-midnight-ink hover:bg-burnished-gold hover:bg-opacity-20 transition-all duration-200 group relative"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <item.icon 
                className="w-5 h-5 mr-4 text-mystic-silver group-hover:text-burnished-gold transition-colors" 
              />
              <span className="fantasy-body font-medium text-lg tracking-wide group-hover:text-burnished-gold">
                {item.label}
              </span>
              
              {/* Hover underline effect */}
              <div className="absolute bottom-2 left-6 right-6 h-0.5 bg-burnished-gold transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
              
              {/* Sparkle effect on hover */}
              <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-1 h-1 bg-burnished-gold rounded-full sparkle-trail" />
              </div>
            </a>
          ))}
        </nav>
        
        {/* Decorative Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="border-t-2 border-aged-bronze pt-4">
            <div className="flex justify-center space-x-2">
              <div className="w-2 h-2 bg-burnished-gold rounded-full opacity-60" />
              <div className="w-2 h-2 bg-aged-bronze rounded-full opacity-60" />
              <div className="w-2 h-2 bg-burnished-gold rounded-full opacity-60" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;