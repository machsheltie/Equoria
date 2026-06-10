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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/game';

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
        {/* Manage / Hire Tabs — CanonicalTabs underline variant (Equoria-o5hub.11) */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as GroomsTab)}>
          <TabsList aria-label="Grooms section">
            <TabsTrigger value="manage" data-testid="manage-tab">
              <Users className="w-4 h-4 inline-block mr-2" aria-hidden="true" />
              Manage Grooms
            </TabsTrigger>
            <TabsTrigger
              value="hire"
              data-testid="hire-tab"
              data-onboarding-target="groom-hire-button"
            >
              <ShoppingBag className="w-4 h-4 inline-block mr-2" aria-hidden="true" />
              Hire Grooms
            </TabsTrigger>
          </TabsList>
          <TabsContent value="manage">
            <MyGroomsDashboard userId={userId} onBrowseMarketplace={() => setActiveTab('hire')} />
          </TabsContent>
          <TabsContent value="hire">
            <GroomList userId={userId} />
          </TabsContent>
        </Tabs>

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
