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
 * Data is loaded through the trainer API hooks.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ShoppingBag } from 'lucide-react';
import TrainerList from '@/components/TrainerList';
import MyTrainersDashboard from '@/components/MyTrainersDashboard';
import { useAuth } from '@/contexts/AuthContext';
import PageHero from '@/components/layout/PageHero';

type TrainersTab = 'manage' | 'hire';

const TrainersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TrainersTab>('manage');
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      <PageHero
        title="Trainer Academy"
        subtitle="Hire and manage trainers to coach your horses"
        mood="default"
        icon={<GraduationCap className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
          <Link to="/world" className="hover:text-[var(--cream)] transition-colors">
            World
          </Link>
          <span>/</span>
          <span className="text-[var(--cream)]">Trainers</span>
        </div>
      </PageHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
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
          {activeTab === 'manage' ? (
            <MyTrainersDashboard userId={user?.id ?? 0} />
          ) : (
            <TrainerList userId={user?.id ?? 0} />
          )}
        </div>

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl glass-panel text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--cream)] mb-2">About Trainers</h3>
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
