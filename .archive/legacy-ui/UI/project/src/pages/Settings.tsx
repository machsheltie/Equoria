import React from 'react';
import { User, Bell, Shield, HelpCircle, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

const Settings: React.FC = () => {
  return (
    <div>
      <h1 className="text-xl font-medium mb-6">Settings</h1>

      <div className="mb-6 flex items-center">
        <div className="w-16 h-16 rounded-full overflow-hidden mr-4">
          <img
            src="https://images.pexels.com/photos/1674752/pexels-photo-1674752.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2"
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </div>

        <div>
          <h2 className="font-medium text-lg">HorseWhisperer</h2>
          <p className="text-gray-500">Level 15 • Gold Rank</p>
          <button className="text-sky-blue text-sm mt-1">Edit Profile</button>
        </div>
      </div>

      <div className="space-y-3">
        <motion.div
          className="bg-white rounded-lg shadow-sm overflow-hidden"
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
        >
          <div className="p-4 flex items-center">
            <div className="w-10 h-10 rounded-full bg-sky-blue/10 flex items-center justify-center mr-3">
              <User size={20} className="text-sky-blue" />
            </div>
            <div>
              <h3 className="font-medium">Account Settings</h3>
              <p className="text-sm text-gray-500">Personal information, email</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="bg-white rounded-lg shadow-sm overflow-hidden"
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
        >
          <div className="p-4 flex items-center">
            <div className="w-10 h-10 rounded-full bg-forest/10 flex items-center justify-center mr-3">
              <Bell size={20} className="text-forest" />
            </div>
            <div>
              <h3 className="font-medium">Notifications</h3>
              <p className="text-sm text-gray-500">Manage notifications and alerts</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="bg-white rounded-lg shadow-sm overflow-hidden"
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
        >
          <div className="p-4 flex items-center">
            <div className="w-10 h-10 rounded-full bg-lime/10 flex items-center justify-center mr-3">
              <Shield size={20} className="text-lime" />
            </div>
            <div>
              <h3 className="font-medium">Privacy & Security</h3>
              <p className="text-sm text-gray-500">Password, login security</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="bg-white rounded-lg shadow-sm overflow-hidden"
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
        >
          <div className="p-4 flex items-center">
            <div className="w-10 h-10 rounded-full bg-sky-blue/10 flex items-center justify-center mr-3">
              <HelpCircle size={20} className="text-sky-blue" />
            </div>
            <div>
              <h3 className="font-medium">Help & Support</h3>
              <p className="text-sm text-gray-500">FAQs, contact support</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-8 flex justify-center">
        <button className="flex items-center text-red-500 px-4 py-2 rounded-lg bg-red-50">
          <LogOut size={18} className="mr-2" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Settings;
