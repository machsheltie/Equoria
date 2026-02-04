import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users as Horse, Trophy, Globe, MessageSquare, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

const BottomNavigation: React.FC = () => {
  const navItems = [
    { to: '/', icon: <Home size={20} />, label: 'Home' },
    { to: '/stable', icon: <Horse size={20} />, label: 'Stable' },
    { to: '/competitions', icon: <Trophy size={20} />, label: 'Competitions' },
    { to: '/world', icon: <Globe size={20} />, label: 'World' },
    { to: '/social', icon: <MessageSquare size={20} />, label: 'Social' },
    { to: '/settings', icon: <Settings size={20} />, label: 'Settings' },
  ];

  return (
    <motion.nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="grid grid-cols-6 h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : 'text-gray-500'}`}
          >
            {({ isActive }) => (
              <>
                {item.icon}
                <span className="mt-1">{item.label}</span>
                {isActive && (
                  <motion.div
                    className="absolute bottom-0 w-8 h-1 bg-sky-blue rounded-t-full"
                    layoutId="activeIndicator"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </motion.nav>
  );
};

export default BottomNavigation;
