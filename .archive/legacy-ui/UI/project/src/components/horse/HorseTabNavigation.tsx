import React from 'react';
import { Info, Dna, LineChart, Heart, Award, BarChart2, History } from 'lucide-react';
import { motion } from 'framer-motion';

interface HorseTabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const HorseTabNavigation: React.FC<HorseTabNavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'info', label: 'Info', icon: <Info size={16} /> },
    { id: 'genetics', label: 'Genetics', icon: <Dna size={16} /> },
    { id: 'stats', label: 'Stats', icon: <LineChart size={16} /> },
    { id: 'health', label: 'Health', icon: <Heart size={16} /> },
    { id: 'competitions', label: 'Competitions', icon: <Award size={16} /> },
    { id: 'training', label: 'Training', icon: <BarChart2 size={16} /> },
    { id: 'history', label: 'History', icon: <History size={16} /> },
  ];

  return (
    <div className="border-b border-gray-200 mb-4 overflow-x-auto pb-1">
      <div className="flex space-x-4 min-w-max">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`flex items-center py-2 px-3 text-sm font-medium relative ${
              activeTab === tab.id ? 'text-sky-blue' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.icon}
            <span className="ml-1">{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-blue"
                layoutId="activeTab"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default HorseTabNavigation;
