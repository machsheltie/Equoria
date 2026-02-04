import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Award, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Horse } from '../../types/horse';
import HorseStats from '../horse/HorseStats';

interface HorseCardProps {
  horse: Horse;
}

const HorseCard: React.FC<HorseCardProps> = ({ horse }) => {
  return (
    <motion.div className="card" whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
      <div className="relative">
        <img src={horse.imageUrl} alt={horse.name} className="w-full h-40 object-cover" />
        {horse.isPremium && (
          <div className="absolute top-2 right-2 pixel-badge px-1 py-0.5">Premium</div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-navy/80 to-transparent p-2">
          <h3 className="text-white font-medium">{horse.name}</h3>
          <p className="text-silver text-xs">
            {horse.breed} • {horse.age} years old
          </p>
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1">
            {horse.disciplines.slice(0, 3).map((discipline) => (
              <span
                key={discipline}
                className="inline-block px-1.5 py-0.5 bg-sky-blue/10 text-sky-blue rounded text-xs"
              >
                {discipline}
              </span>
            ))}
            {horse.disciplines.length > 3 && (
              <span className="text-xs text-gray-500">+{horse.disciplines.length - 3}</span>
            )}
          </div>

          <div className="flex items-center space-x-1">
            <Heart size={16} className="text-red-500" />
            <span className="text-xs">{horse.health}%</span>
          </div>
        </div>

        <HorseStats
          stats={{
            speed: horse.stats.speed,
            agility: horse.stats.agility,
            stamina: horse.stats.stamina,
            jumping: horse.stats.jumping,
          }}
          size="sm"
        />

        <div className="mt-3 flex justify-between items-center">
          <div className="flex items-center">
            <Award size={16} className="text-amber-500 mr-1" />
            <span className="text-xs font-medium">{horse.trophies} trophies</span>
          </div>

          <Link
            to={`/stable/${horse.id}`}
            className="btn-primary text-xs py-1 px-3 flex items-center"
          >
            View <ArrowRight size={14} className="ml-1" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default HorseCard;
