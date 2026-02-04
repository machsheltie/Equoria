import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ProfileSummary from '../components/dashboard/ProfileSummary';
import RecentCompetitions from '../components/dashboard/RecentCompetitions';
import { mockCompetitionResults } from '../data/mockData';

const Dashboard: React.FC = () => {
  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <ProfileSummary
          username="HorseWhisperer"
          level={15}
          xp={3450}
          xpRequired={5000}
          rank="Gold"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-medium text-lg">Your Stable</h2>
          <Link to="/stable" className="text-sky-blue text-sm flex items-center">
            View All <ChevronRight size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map((index) => (
            <Link to={`/stable/${index}`} key={index}>
              <div className="rounded-lg overflow-hidden bg-white shadow-sm h-28 relative">
                <img
                  src={`https://images.pexels.com/photos/635499/pexels-photo-635499.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&dpr=2`}
                  alt={`Horse ${index}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <h3 className="text-white text-sm font-medium">Horse {index}</h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <RecentCompetitions results={mockCompetitionResults} />
      </motion.div>
    </div>
  );
};

export default Dashboard;
