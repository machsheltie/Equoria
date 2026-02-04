import React, { useState } from 'react';
import { Users, MessageSquare, Search } from 'lucide-react';
import { motion } from 'framer-motion';

const Social: React.FC = () => {
  const [activeTab, setActiveTab] = useState('chat');

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-medium">Social Hub</h1>

        <div className="flex space-x-2">
          <button
            className={`px-4 py-1.5 rounded-full text-sm ${
              activeTab === 'chat' ? 'bg-sky-blue text-white' : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={16} className="inline-block mr-1" />
            Chat
          </button>

          <button
            className={`px-4 py-1.5 rounded-full text-sm ${
              activeTab === 'forum' ? 'bg-sky-blue text-white' : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setActiveTab('forum')}
          >
            <Users size={16} className="inline-block mr-1" />
            Forum
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search
          size={18}
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder={activeTab === 'chat' ? 'Search chats...' : 'Search forum topics...'}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-sky-blue"
        />
      </div>

      {activeTab === 'chat' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-4">
            <h2 className="font-medium text-sm text-gray-500 mb-2">DIRECT MESSAGES</h2>
            <div className="space-y-2">
              {['HorseTrainer22', 'GallopGirl', 'ShowJumper', 'DressageKing'].map((user, index) => (
                <div key={index} className="flex items-center p-3 bg-white rounded-lg">
                  <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                    <img
                      src={`https://images.pexels.com/photos/${1674752 + index}/pexels-photo-${1674752 + index}.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2`}
                      alt={user}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h3 className="font-medium">{user}</h3>
                      <span className="text-xs text-gray-500">12:34 PM</span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      Hey, would you like to trade horses? I have a...
                    </p>
                  </div>

                  {index < 2 && <div className="w-3 h-3 bg-lime rounded-full"></div>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-medium text-sm text-gray-500 mb-2">GROUP CHATS</h2>
            <div className="space-y-2">
              {['Stable Owners', 'Horse Trading', 'Competition Tips'].map((group, index) => (
                <div key={index} className="flex items-center p-3 bg-white rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center mr-3">
                    <Users size={20} className="text-navy" />
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h3 className="font-medium">{group}</h3>
                      <span className="text-xs text-gray-500">Yesterday</span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      New competition announcement! Check out the...
                    </p>
                  </div>

                  {index === 0 && (
                    <div className="px-1.5 py-0.5 rounded bg-lime/10 text-lime text-xs font-medium">
                      5+
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'forum' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-4 flex space-x-2 overflow-x-auto pb-2">
            {['All', 'Trading', 'Breeding', 'Competitions', 'Tips', 'Social'].map((category) => (
              <button
                key={category}
                className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap ${
                  category === 'All' ? 'bg-sky-blue text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {[
              { title: 'Breeding tips for Arabian horses?', replies: 23, author: 'ArabianLover' },
              {
                title: 'Anyone interested in trading thoroughbreds?',
                replies: 15,
                author: 'RacingFan',
              },
              { title: 'Best training routine for Saddleseat?', replies: 42, author: 'SaddlePro' },
              {
                title: 'How to prepare for Western Pleasure?',
                replies: 18,
                author: 'WesternRider',
              },
            ].map((topic, index) => (
              <div key={index} className="bg-white p-4 rounded-lg">
                <h3 className="font-medium mb-1">{topic.title}</h3>
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded-full overflow-hidden mr-2">
                      <img
                        src={`https://images.pexels.com/photos/${1674752 + index}/pexels-photo-${1674752 + index}.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2`}
                        alt={topic.author}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-sm text-gray-500">{topic.author}</span>
                  </div>

                  <div className="flex items-center">
                    <MessageSquare size={14} className="text-gray-400 mr-1" />
                    <span className="text-sm text-gray-500">{topic.replies} replies</span>
                  </div>
                </div>

                {index === 0 && (
                  <div className="mt-3 pl-3 border-l-2 border-sky-blue">
                    <p className="text-sm">
                      I recommend focusing on bloodlines first. Look for strong gait traits!
                    </p>
                    <div className="flex items-center mt-1">
                      <div className="w-5 h-5 rounded-full overflow-hidden mr-1">
                        <img
                          src="https://images.pexels.com/photos/1674752/pexels-photo-1674752.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2"
                          alt="Commenter"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-xs text-gray-500">HorseWhisperer</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-center">
            <button className="horseshoe-btn">New Topic</button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Social;
