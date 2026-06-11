/**
 * GroomsPage — World > Grooms Location (Epic 10)
 *
 * The Grooms location in the World hub. Two modes:
 * - Manage: View hired grooms, assignments, bond scores, salary
 * - Hire: Browse the groom marketplace
 *
 * Wraps existing MyGroomsDashboard + GroomList components from Epic 7.
 * Mirrors RidersPage.tsx pattern.
 *
 * Design-system migration (Equoria-o5hub, world-services family): management
 * page → PageHeader (not PageHero — no location artwork), PageContainer wide,
 * Surface for the info panel. Tabs were already CanonicalTabs.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, ShoppingBag, Leaf } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import GroomList from '@/components/GroomList';
import MyGroomsDashboard from '@/components/MyGroomsDashboard';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/game';

type GroomsTab = 'manage' | 'hire';

const GroomsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<GroomsTab>('manage');

  const userId = typeof user?.id === 'string' ? parseInt(user.id, 10) : (user?.id ?? 0);

  return (
    <PageContainer variant="wide" padded={false} className="pb-8">
      <PageHeader
        title="Groom Quarters"
        subtitle="Hire and manage grooms for daily horse care"
        icon={<Leaf className="w-6 h-6 text-[var(--gold-400)]" />}
        breadcrumbs={
          <nav aria-label="Breadcrumb" className="flex items-center gap-2">
            <Link to="/world" className="hover:text-[var(--text-primary)] transition-colors">
              World
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-[var(--text-primary)]">Grooms</span>
          </nav>
        }
      />

      <div className="mt-6">
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
      </div>

      {/* Info Panel */}
      <Surface variant="panel" as="aside" className="mt-10 text-sm text-[var(--text-muted)]">
        <h3 className="font-semibold text-[var(--text-primary)] mb-2">About Grooms</h3>
        <ul className="space-y-1 list-disc list-inside">
          <li>Grooms perform daily care tasks: feeding, brushing, and bonding activities</li>
          <li>Foals benefit most from consistent groom care during development</li>
          <li>Each groom has a personality that influences their task effectiveness</li>
          <li>Grooms gain XP through assignments and unlock career milestones</li>
          <li>Experienced grooms with high prestige may pass on skills as legacy mentors</li>
        </ul>
      </Surface>
    </PageContainer>
  );
};

export default GroomsPage;
