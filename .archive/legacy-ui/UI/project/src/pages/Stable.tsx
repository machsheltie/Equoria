import React, { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import HorseCard from '../components/cards/HorseCard';
import { mockHorses } from '../data/mockData';

const Stable: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('all');

  const filters = [
    { id: 'all', label: 'All Horses' },
    { id: 'foals', label: 'Foals' },
    { id: 'mares', label: 'Mares' },
    { id: 'stallions', label: 'Stallions' },
    { id: 'retired', label: 'Retired' },
  ];

  const filteredHorses = mockHorses.filter((horse) => {
    if (activeFilter === 'all') return true;
    return horse.category === activeFilter;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-medium">Your Stable</h1>
        <button className="btn-primary">+ Add Horse</button>
      </div>

      <div className="relative mb-4">
        <Search
          size={18}
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Search horses..."
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-sky-blue"
        />
      </div>

      <div className="flex items-center space-x-3 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {filters.map((filter) => (
          <button
            key={filter.id}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap ${
              activeFilter === filter.id ? 'bg-sky-blue text-white' : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}

        <button className="px-4 py-1.5 rounded-full bg-gray-100 text-gray-700 flex items-center text-sm">
          <Filter size={14} className="mr-1" />
          More Filters
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredHorses.map((horse, index) => (
          <motion.div
            key={horse.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <HorseCard horse={horse} />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Stable;
