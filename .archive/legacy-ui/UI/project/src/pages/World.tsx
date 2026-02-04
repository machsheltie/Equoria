import React from 'react';
import { Map, Navigation, Compass, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

const World: React.FC = () => {
  return (
    <div>
      <h1 className="text-xl font-medium mb-4">World</h1>

      <div className="mb-4 relative rounded-lg overflow-hidden">
        <img
          src="https://images.pexels.com/photos/1619317/pexels-photo-1619317.jpeg?auto=compress&cs=tinysrgb&w=1200"
          alt="World Map"
          className="w-full h-48 object-cover"
        />
        <div className="absolute inset-0 bg-navy/30 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-white text-xl font-medium">Explore Equestria</h2>
            <p className="text-silver mt-1">Discover new locations and events</p>
            <button className="mt-3 bg-white text-navy px-4 py-1.5 rounded-full text-sm font-medium flex items-center mx-auto">
              <Navigation size={16} className="mr-1" />
              Open Map
            </button>
          </div>
        </div>
      </div>

      <h2 className="font-medium text-lg mb-3">Current Events</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <motion.div
          className="card relative overflow-hidden"
          whileHover={{ y: -5 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute top-2 right-2 pixel-badge px-2 py-0.5">Special</div>
          <img
            src="https://images.pexels.com/photos/2115984/pexels-photo-2115984.jpeg?auto=compress&cs=tinysrgb&w=800"
            alt="Summer Festival"
            className="w-full h-32 object-cover"
          />
          <div className="p-3">
            <h3 className="font-medium">Summer Festival</h3>
            <p className="text-sm text-gray-500 mb-2">
              Join the celebration with special prizes and events
            </p>
            <div className="flex justify-between items-center">
              <div className="flex items-center text-xs text-gray-500">
                <Calendar size={14} className="mr-1" />
                14 days remaining
              </div>
              <button className="text-sky-blue text-sm font-medium">Participate</button>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="card relative overflow-hidden"
          whileHover={{ y: -5 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute top-2 right-2 pixel-badge px-2 py-0.5 bg-amber-500">New</div>
          <img
            src="https://images.pexels.com/photos/998252/pexels-photo-998252.jpeg?auto=compress&cs=tinysrgb&w=800"
            alt="Ranch Exploration"
            className="w-full h-32 object-cover"
          />
          <div className="p-3">
            <h3 className="font-medium">Ranch Exploration</h3>
            <p className="text-sm text-gray-500 mb-2">
              Explore new territories and find hidden treasures
            </p>
            <div className="flex justify-between items-center">
              <div className="flex items-center text-xs text-gray-500">
                <Compass size={14} className="mr-1" />
                Adventure awaits
              </div>
              <button className="text-sky-blue text-sm font-medium">Explore</button>
            </div>
          </div>
        </motion.div>
      </div>

      <h2 className="font-medium text-lg mb-3">Locations</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {['Training Arena', 'Market Square', 'Breeding Center', 'Veterinary', 'Forest Trail'].map(
          (location, index) => (
            <motion.div
              key={index}
              className="card p-3 text-center"
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-10 h-10 bg-sky-blue/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <Map size={20} className="text-sky-blue" />
              </div>
              <h3 className="font-medium text-sm">{location}</h3>
              <button className="mt-2 text-xs text-sky-blue">Visit</button>
            </motion.div>
          )
        )}
      </div>
    </div>
  );
};

export default World;
