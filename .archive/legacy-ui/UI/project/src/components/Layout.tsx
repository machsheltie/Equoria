import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNavigation from './navigation/BottomNavigation';
import TopBar from './navigation/TopBar';

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 pb-16 pt-14 px-4 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  );
};

export default Layout;
