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
 * Design-system migration (Equoria-o5hub, world-services family): management
 * page → PageHeader (not PageHero — no location artwork), PageContainer wide,
 * Surface for the info panel. Tabs were already CanonicalTabs.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ShoppingBag } from 'lucide-react';
import TrainerList from '@/components/TrainerList';
import MyTrainersDashboard from '@/components/MyTrainersDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/game';

type TrainersTab = 'manage' | 'hire';

const TrainersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TrainersTab>('manage');
  const { user } = useAuth();

  return (
    <PageContainer variant="wide" padded={false} className="pb-8">
      <PageHeader
        title="Trainer Academy"
        subtitle="Hire and manage trainers to coach your horses"
        icon={<GraduationCap className="w-6 h-6 text-[var(--gold-400)]" />}
        breadcrumbs={
          <nav aria-label="Breadcrumb" className="flex items-center gap-2">
            <Link to="/world" className="hover:text-[var(--text-primary)] transition-colors">
              World
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-[var(--text-primary)]">Trainers</span>
          </nav>
        }
      />

      <div className="mt-6">
        {/* Manage / Hire Tabs — CanonicalTabs underline variant (Equoria-o5hub.11) */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TrainersTab)}>
          <TabsList aria-label="Trainers section">
            <TabsTrigger value="manage" data-testid="manage-tab">
              <GraduationCap className="w-4 h-4 inline-block mr-2" aria-hidden="true" />
              Manage Trainers
            </TabsTrigger>
            <TabsTrigger value="hire" data-testid="hire-tab">
              <ShoppingBag className="w-4 h-4 inline-block mr-2" aria-hidden="true" />
              Hire Trainers
            </TabsTrigger>
          </TabsList>
          <TabsContent value="manage">
            <MyTrainersDashboard userId={user?.id ?? ''} />
          </TabsContent>
          <TabsContent value="hire">
            <TrainerList userId={user?.id ?? ''} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Info Panel */}
      <Surface variant="panel" as="aside" className="mt-10 text-sm text-[var(--text-muted)]">
        <h3 className="font-semibold text-[var(--text-primary)] mb-2">About Trainers</h3>
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
      </Surface>
    </PageContainer>
  );
};

export default TrainersPage;
