/**
 * TrainersPage — World > Trainers Location (Epic 13)
 *
 * The Trainers location in the World hub. Two modes:
 * - Manage: View current trainers, assignments, career progress, trait discovery
 * - Hire: Browse and hire trainer candidates from marketplace
 *
 * Follows the "Hire → Assign → Discover → Retire" staff system pattern.
 * Mirrors RidersPage.tsx (Epic 9C) and GroomsPage.tsx (Epic 7).
 *
 * All data is mock — wire to /api/trainers/* when Story 13-5 is scheduled.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, GraduationCap, ShoppingBag } from 'lucide-react';
import TrainerList from '@/components/TrainerList';
import MyTrainersDashboard from '@/components/MyTrainersDashboard';
import MainNavigation from '@/components/MainNavigation';

type TrainersTab = 'manage' | 'hire';

const TrainersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TrainersTab>('manage');

  return (
    <div className="min-h-screen">
      <MainNavigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link to="/world" className="hover:text-white/70 transition-colors">
            World
          </Link>
          <span>/</span>
          <span className="text-white/70">Trainers</span>
        </div>

        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/world"
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Back to World"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white/90">🎓 Trainers</h1>
            <p className="text-sm text-white/50 mt-0.5">
              Hire and manage trainers to coach your horses
            </p>
          </div>
        </div>

        {/* Manage / Hire Tabs */}
        <div
          className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-8 w-fit"
          role="tablist"
          aria-label="Trainers section"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'manage'}
            onClick={() => setActiveTab('manage')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'manage'
                ? 'bg-white/10 text-white/90 shadow-sm'
                : 'text-white/40 hover:text-white/70'
            }`}
            data-testid="manage-tab"
          >
            <GraduationCap className="w-4 h-4" />
            Manage Trainers
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'hire'}
            onClick={() => setActiveTab('hire')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'hire'
                ? 'bg-white/10 text-white/90 shadow-sm'
                : 'text-white/40 hover:text-white/70'
            }`}
            data-testid="hire-tab"
          >
            <ShoppingBag className="w-4 h-4" />
            Hire Trainers
          </button>
        </div>

        {/* Tab Content */}
        <div role="tabpanel">
          {activeTab === 'manage' ? <MyTrainersDashboard /> : <TrainerList />}
        </div>

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl bg-white/3 border border-white/8 text-sm text-white/40">
          <h3 className="font-semibold text-white/60 mb-2">About Trainers</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Trainers are assigned to horses and boost training session effectiveness</li>
            <li>Each trainer has hidden specializations revealed through training sessions</li>
            <li>
              <strong>Level = visibility, not quality</strong> — a novice trainer may secretly excel
              at your horse&apos;s discipline
            </li>
            <li>Trainers gain XP over time and can unlock legacy certifications at Level 7+</li>
            <li>Mandatory retirement at 80 weeks — plan your succession</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TrainersPage;
