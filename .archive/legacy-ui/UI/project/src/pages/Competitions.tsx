import React, { useState } from 'react';
import { Filter, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import CompetitionCard from '../components/cards/CompetitionCard';
import { mockCompetitions } from '../data/mockData';

const Competitions: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('all');

  const disciplines = [
    { id: 'all', label: 'All' },
    { id: 'saddleseat', label: 'Saddleseat' },
    { id: 'gaited', label: 'Gaited' },
    { id: 'hunter', label: 'Hunter' },
    { id: 'western', label: 'Western Pleasure' },
    { id: 'crosscountry', label: 'Cross Country' },
  ];

  const filteredCompetitions = mockCompetitions.filter((competition) => {
    if (activeFilter === 'all') return true;
    return competition.discipline.toLowerCase() === activeFilter;
  });

  const handleEnterCompetition = (competitionId: string) => {
    console.log(`Entering competition: ${competitionId}`);
    // Logic to enter competition
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-medium">Competitions</h1>
        <button className="flex items-center text-sm bg-gray-100 px-3 py-1.5 rounded-full">
          <Calendar size={16} className="mr-1" />
          Calendar View
        </button>
      </div>

      <div className="flex items-center space-x-3 overflow-x-auto pb-2 mb-4">
        {disciplines.map((discipline) => (
          <button
            key={discipline.id}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap ${
              activeFilter === discipline.id
                ? 'bg-sky-blue text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setActiveFilter(discipline.id)}
          >
            {discipline.label}
          </button>
        ))}

        <button className="px-4 py-1.5 rounded-full bg-gray-100 text-gray-700 flex items-center text-sm whitespace-nowrap">
          <Filter size={14} className="mr-1" />
          More Filters
        </button>
      </div>

      <div>
        {filteredCompetitions.map((competition, index) => (
          <motion.div
            key={competition.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <CompetitionCard competition={competition} onEnter={handleEnterCompetition} />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Competitions;
