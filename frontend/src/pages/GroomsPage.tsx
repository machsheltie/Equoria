/**
 * GroomsPage — World > Grooms Location (Epic 10)
 *
 * The Grooms location in the World hub. Two modes:
 * - Manage: View hired grooms, assignments, bond scores, salary
 * - Hire: Browse the groom marketplace
 *
 * Wraps existing MyGroomsDashboard + GroomList components from Epic 7.
 * Mirrors RidersPage.tsx pattern.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, ShoppingBag, Leaf } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import GroomList from '@/components/GroomList';
import MyGroomsDashboard from '@/components/MyGroomsDashboard';
import PageHero from '@/components/layout/PageHero';

type GroomsTab = 'manage' | 'hire';

const GroomsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<GroomsTab>('manage');

  const userId = typeof user?.id === 'string' ? parseInt(user.id, 10) : (user?.id ?? 0);

  return (
    <div className="min-h-screen">
      <PageHero
        title="Groom Quarters"
        subtitle="Hire and manage grooms for daily horse care"
        mood="nature"
        icon={<Leaf className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
          <Link to="/world" className="hover:text-[var(--cream)] transition-colors">
            World
          </Link>
          <span>/</span>
          <span className="text-[var(--cream)]">Grooms</span>
        </div>
      </PageHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Manage / Hire Tabs */}
        <div
          className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-8 w-fit"
          role="tablist"
          aria-label="Grooms section"
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
            <Users className="w-4 h-4" />
            Manage Grooms
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
            data-onboarding-target="groom-hire-button"
          >
            <ShoppingBag className="w-4 h-4" />
            Hire Grooms
          </button>
        </div>

        {/* Tab Content */}
        <div role="tabpanel">
          {activeTab === 'manage' ? (
            <MyGroomsDashboard userId={userId} onBrowseMarketplace={() => setActiveTab('hire')} />
          ) : (
            <GroomList userId={userId} />
          )}
        </div>

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl glass-panel text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--cream)] mb-2">About Grooms</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Grooms perform daily care tasks: feeding, brushing, and bonding activities</li>
            <li>Foals benefit most from consistent groom care during development</li>
            <li>Each groom has a personality that influences their task effectiveness</li>
            <li>Grooms gain XP through assignments and unlock career milestones</li>
            <li>Experienced grooms with high prestige may pass on skills as legacy mentors</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GroomsPage;
