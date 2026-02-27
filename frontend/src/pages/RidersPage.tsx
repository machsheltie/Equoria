/**
 * RidersPage — World > Riders Location (Epic 9C)
 *
 * The Riders location in the World hub. Two modes:
 * - Hire: Browse and hire rider candidates from marketplace
 * - Manage: View current riders, assignments, career progress, trait discovery
 *
 * Follows the "Hire → Assign → Discover → Retire" staff system pattern.
 * Mirrors the Grooms location pattern from Epic 7.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import RiderList from '@/components/RiderList';
import MyRidersDashboard from '@/components/MyRidersDashboard';
import MainNavigation from '@/components/MainNavigation';

type RidersTab = 'hire' | 'manage';

const RidersPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<RidersTab>('manage');

  const userId = typeof user?.id === 'string' ? parseInt(user.id, 10) : (user?.id ?? 0);

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
          <span className="text-white/70">Riders</span>
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
            <h1 className="text-2xl font-bold text-white/90">🏇 Riders</h1>
            <p className="text-sm text-white/50 mt-0.5">
              Hire and manage riders for your competition horses
            </p>
          </div>
        </div>

        {/* Hire / Manage Tabs */}
        <div
          className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-8 w-fit"
          role="tablist"
          aria-label="Riders section"
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
            Manage Riders
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
            data-onboarding-target="rider-hire-button"
          >
            <ShoppingBag className="w-4 h-4" />
            Hire Riders
          </button>
        </div>

        {/* Tab Content */}
        <div role="tabpanel">
          {activeTab === 'manage' ? (
            <MyRidersDashboard userId={userId} />
          ) : (
            <RiderList userId={userId} />
          )}
        </div>

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl bg-white/3 border border-white/8 text-sm text-white/40">
          <h3 className="font-semibold text-white/60 mb-2">About Riders</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Riders must be assigned before a horse can enter competitions</li>
            <li>Assignments persist until manually changed or the horse retires</li>
            <li>Competing reveals hidden affinities — discipline, temperament, and gait</li>
            <li>
              <strong>Level = visibility, not quality</strong> — a rookie rider may secretly excel
            </li>
            <li>Legacy riders with high prestige may earn contract extensions</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RidersPage;
