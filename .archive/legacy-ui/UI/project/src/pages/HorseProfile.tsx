import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import HorseTabNavigation from '../components/horse/HorseTabNavigation';
import HorseStats from '../components/horse/HorseStats';
import { mockHorses } from '../data/mockData';

const HorseProfile: React.FC = () => {
  const { horseId } = useParams<{ horseId: string }>();
  const [activeTab, setActiveTab] = useState('info');

  // Find the horse by ID (using mock data)
  const horse = mockHorses.find((h) => h.id === horseId) || mockHorses[0];

  return (
    <div>
      <div className="flex items-center mb-4">
        <Link to="/stable" className="mr-2">
          <ArrowLeft size={20} className="text-gray-500" />
        </Link>
        <h1 className="text-xl font-medium flex-1">{horse.name}</h1>
        <div className="flex space-x-2">
          <button className="p-2 rounded-full bg-gray-100">
            <Share2 size={18} className="text-gray-700" />
          </button>
          <button className="p-2 rounded-full bg-gray-100">
            <Edit size={18} className="text-gray-700" />
          </button>
        </div>
      </div>

      <motion.div
        className="relative rounded-lg overflow-hidden mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <img src={horse.imageUrl} alt={horse.name} className="w-full h-64 object-cover" />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex space-x-2 mb-1">
                {horse.disciplines.slice(0, 3).map((discipline) => (
                  <span key={discipline} className="pixel-badge text-[10px] py-0.5 px-1">
                    {discipline}
                  </span>
                ))}
              </div>
              <h2 className="text-white text-xl font-medium">{horse.name}</h2>
              <p className="text-silver text-sm">
                {horse.breed} • {horse.gender} • {horse.age} years old
              </p>
            </div>

            <div className="bg-white rounded-full px-3 py-1 text-sm font-medium text-navy">
              Level {horse.level}
            </div>
          </div>
        </div>
      </motion.div>

      <HorseTabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'info' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card p-4">
              <h3 className="font-medium mb-3">Basic Information</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Breed:</span>
                  <span className="font-medium">{horse.breed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Age:</span>
                  <span className="font-medium">{horse.age} years</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Gender:</span>
                  <span className="font-medium">{horse.gender}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Height:</span>
                  <span className="font-medium">{horse.height} hands</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Temperament:</span>
                  <span className="font-medium">{horse.temperament}</span>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="font-medium mb-3">Performance</h3>
              <HorseStats stats={horse.stats} size="md" />
            </div>
          </div>

          <div className="card p-4 mt-4">
            <h3 className="font-medium mb-3">Training & Care</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">Daily Training</p>
                <div className="progress-bar">
                  <div className="progress-value" style={{ width: `${horse.training.daily}%` }} />
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Grooming</p>
                <div className="progress-bar">
                  <div className="progress-value" style={{ width: `${horse.care.grooming}%` }} />
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Feeding</p>
                <div className="progress-bar">
                  <div className="progress-value" style={{ width: `${horse.care.feeding}%` }} />
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Rest</p>
                <div className="progress-bar">
                  <div className="progress-value" style={{ width: `${horse.care.rest}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button className="horseshoe-btn">Start Training</button>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'stats' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="card p-4">
            <h3 className="font-medium mb-3">Detailed Statistics</h3>
            <HorseStats stats={horse.stats} size="lg" />

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Movement</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">Walk</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <div
                          key={star}
                          className={`w-4 h-4 rounded-full mx-0.5 ${
                            star <= horse.movement.walk ? 'bg-lime' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">Trot</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <div
                          key={star}
                          className={`w-4 h-4 rounded-full mx-0.5 ${
                            star <= horse.movement.trot ? 'bg-lime' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">Canter</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <div
                          key={star}
                          className={`w-4 h-4 rounded-full mx-0.5 ${
                            star <= horse.movement.canter ? 'bg-lime' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">Gallop</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <div
                          key={star}
                          className={`w-4 h-4 rounded-full mx-0.5 ${
                            star <= horse.movement.gallop ? 'bg-lime' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">Conformation</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">Head</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <div
                          key={star}
                          className={`w-4 h-4 rounded-full mx-0.5 ${
                            star <= horse.conformation.head ? 'bg-lime' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">Neck</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <div
                          key={star}
                          className={`w-4 h-4 rounded-full mx-0.5 ${
                            star <= horse.conformation.neck ? 'bg-lime' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">Body</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <div
                          key={star}
                          className={`w-4 h-4 rounded-full mx-0.5 ${
                            star <= horse.conformation.body ? 'bg-lime' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">Legs</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <div
                          key={star}
                          className={`w-4 h-4 rounded-full mx-0.5 ${
                            star <= horse.conformation.legs ? 'bg-lime' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default HorseProfile;
