/**
 * RidersPage — World > Riders Location (Epic 9C)
 *
 * The Riders location in the World hub. Two modes:
 * - Hire: Browse and hire rider candidates from marketplace
 * - Manage: View current riders, assignments, career progress, trait discovery
 *
 * Follows the "Hire → Assign → Discover → Retire" staff system pattern.
 * Mirrors the Grooms location pattern from Epic 7.
 *
 * Design-system migration (Equoria-o5hub, world-services family): management
 * page → PageHeader (not PageHero — no location artwork), PageContainer wide,
 * Surface for the info panel. Tabs were already CanonicalTabs.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, ShoppingBag, Swords } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import RiderList from '@/components/RiderList';
import MyRidersDashboard from '@/components/MyRidersDashboard';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/game';

type RidersTab = 'hire' | 'manage';

const RidersPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<RidersTab>('manage');

  // Equoria-phv9p: user.id is a UUID string; parseInt(uuid) -> NaN disabled the
  // useUserRiders query (enabled: Boolean(userId)), so the dashboard never
  // rendered. Pass the id through raw, matching TrainersPage. The User.id type
  // is now correctly `string` (Equoria-ai6pw), so the fallback is '' not 0.
  const userId = user?.id ?? '';

  return (
    <PageContainer variant="wide" padded={false} className="pb-8">
      <PageHeader
        title="Rider Hall"
        subtitle="Hire and manage riders for your competition horses"
        icon={<Swords className="w-6 h-6 text-[var(--gold-400)]" />}
        breadcrumbs={
          <nav aria-label="Breadcrumb" className="flex items-center gap-2">
            <Link to="/world" className="hover:text-[var(--text-primary)] transition-colors">
              World
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-[var(--text-primary)]">Riders</span>
          </nav>
        }
      />

      <div className="mt-6">
        {/* Hire / Manage Tabs — CanonicalTabs underline variant (Equoria-o5hub.11) */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RidersTab)}>
          <TabsList aria-label="Riders section">
            <TabsTrigger value="manage" data-testid="manage-tab">
              <Users className="w-4 h-4 inline-block mr-2" aria-hidden="true" />
              Manage Riders
            </TabsTrigger>
            <TabsTrigger
              value="hire"
              data-testid="hire-tab"
              data-onboarding-target="rider-hire-button"
            >
              <ShoppingBag className="w-4 h-4 inline-block mr-2" aria-hidden="true" />
              Hire Riders
            </TabsTrigger>
          </TabsList>
          <TabsContent value="manage">
            <MyRidersDashboard userId={userId} onBrowseMarketplace={() => setActiveTab('hire')} />
          </TabsContent>
          <TabsContent value="hire">
            <RiderList userId={userId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Info Panel */}
      <Surface variant="panel" as="aside" className="mt-10 text-sm text-[var(--text-muted)]">
        <h3 className="font-semibold text-[var(--text-primary)] mb-2">About Riders</h3>
        <ul className="space-y-1 list-disc list-inside">
          <li>Riders must be assigned before a horse can enter competitions</li>
          <li>Assignments persist until manually changed or the horse retires</li>
          <li>Competing reveals hidden affinities — discipline, temperament, and gait</li>
          <li>
            <strong>Level = visibility, not quality</strong> — a rookie rider may secretly excel
          </li>
          <li>Legacy riders with high prestige may earn contract extensions</li>
        </ul>
      </Surface>
    </PageContainer>
  );
};

export default RidersPage;
