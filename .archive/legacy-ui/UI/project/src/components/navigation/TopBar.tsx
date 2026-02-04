import React from 'react';
import { Bell, Mail, Coins as Coin } from 'lucide-react';
import { motion } from 'framer-motion';

const TopBar: React.FC = () => {
  return (
    <motion.header
      className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-10 px-4 flex items-center justify-between"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h1 className="font-pixel text-sm text-navy">Horse Reality</h1>

      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <Coin size={16} className="text-amber-500 mr-1" />
          <span className="font-medium">1,250</span>
        </div>

        <div className="relative">
          <Mail size={20} className="text-forest" />
          <span className="pixel-badge absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[8px]">
            3
          </span>
        </div>

        <div className="relative">
          <Bell size={20} className="text-forest" />
          <span className="pixel-badge absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[8px]">
            5
          </span>
        </div>

        <div className="w-8 h-8 rounded-full overflow-hidden">
          <img
            src="https://images.pexels.com/photos/1674752/pexels-photo-1674752.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2"
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </motion.header>
  );
};

export default TopBar;
