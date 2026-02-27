import React from 'react';
import { Outlet } from 'react-router-dom';
import MainNavigation from '../MainNavigation';
import { StarField } from './StarField';

const DashboardLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-deep-space text-starlight-white font-body selection:bg-celestial-gold/30 relative">
      <div className="fixed inset-0 z-[-1]">
        <StarField density="medium" speed="slow" />
      </div>

      <MainNavigation />

      <main className="relative z-[var(--z-raised)] container mx-auto px-4 py-8 md:px-6 lg:px-8 max-w-7xl animate-fade-in-up">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
