import React from 'react';
import { Star, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface ProfileSummaryProps {
  username: string;
  level: number;
  xp: number;
  xpRequired: number;
  rank: string;
}

const ProfileSummary: React.FC<ProfileSummaryProps> = ({
  username,
  level,
  xp,
  xpRequired,
  rank,
}) => {
  const xpPercentage = Math.min(100, (xp / xpRequired) * 100);

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center">
        <div className="w-14 h-14 rounded-full overflow-hidden mr-3">
          <img
            src="https://images.pexels.com/photos/1674752/pexels-photo-1674752.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2"
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </div>

        <div>
          <h2 className="font-medium text-lg">{username}</h2>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="flex items-center">
              <Star size={14} className="text-amber-500 mr-1" />
              <span>Level {level}</span>
            </div>
            <span>•</span>
            <div className="flex items-center">
              <TrendingUp size={14} className="text-sky-blue mr-1" />
              <span>{rank} Rank</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs mb-1">
          <span>
            XP: {xp}/{xpRequired}
          </span>
          <span>{Math.round(xpPercentage)}%</span>
        </div>
        <div className="progress-bar">
          <motion.div
            className="progress-value"
            initial={{ width: 0 }}
            animate={{ width: `${xpPercentage}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  );
};

export default ProfileSummary;
