import React from 'react';
import { Calendar, Clock, Medal, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { Competition } from '../../types/competition';

interface CompetitionCardProps {
  competition: Competition;
  onEnter: (competitionId: string) => void;
}

const CompetitionCard: React.FC<CompetitionCardProps> = ({ competition, onEnter }) => {
  return (
    <motion.div
      className="card overflow-hidden mb-4"
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
    >
      <div className="relative">
        <img
          src={competition.imageUrl}
          alt={competition.name}
          className="w-full h-32 object-cover"
        />
        <div className="absolute top-2 right-2 pixel-badge py-0.5 px-2">
          {competition.discipline}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-medium text-lg mb-1">{competition.name}</h3>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex items-center text-sm text-gray-600">
            <Calendar size={14} className="mr-1" />
            {competition.date}
          </div>

          <div className="flex items-center text-sm text-gray-600">
            <Clock size={14} className="mr-1" />
            {competition.time}
          </div>

          <div className="flex items-center text-sm text-gray-600">
            <Medal size={14} className="mr-1 text-amber-500" />
            {competition.prizePool} coins
          </div>

          <div className="flex items-center text-sm text-gray-600">
            <Users size={14} className="mr-1" />
            {competition.participants} participants
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500">Requirements:</p>
            <div className="flex mt-1 space-x-1">
              {competition.requirements.map((req, index) => (
                <span key={index} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                  {req}
                </span>
              ))}
            </div>
          </div>

          <button className="horseshoe-btn text-sm" onClick={() => onEnter(competition.id)}>
            Enter
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default CompetitionCard;
