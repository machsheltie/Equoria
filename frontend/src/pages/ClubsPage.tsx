/**
 * ClubsPage — Clubs System (Epic 11 + 19B-3)
 *
 * Three-tab structure:
 *   - Discipline Clubs tab: list + join
 *   - Breed Clubs tab: list + join
 *   - My Club tab: memberships, active elections, club leaderboard, create club
 *
 * All data live via useClubs / useMyClubs / useClubElections / useVote / useNominate hooks.
 *
 * Decomposed under Equoria-m0ye2: the sub-components (ElectionCard,
 * TransferLeadershipModal, MyClubTab, ClubElectionsSection, ClubGrid) and
 * constants/helpers live under `pages/clubs/`. This file is now the thin
 * page composition only — tab state plus the three top-level club queries.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/game';
import { useClubs } from '@/hooks/api/useClubs';
import { tabsConfig, type ClubsTab } from './clubs/constants';
import { ClubGrid } from './clubs/ClubGrid';
import { MyClubTab } from './clubs/MyClubTab';

const ClubsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ClubsTab>('discipline');

  const { data: disciplineData, isLoading: discLoading } = useClubs('discipline');
  const { data: breedData, isLoading: breedLoading } = useClubs('breed');
  const { data: allData } = useClubs();

  const disciplineClubs = disciplineData?.clubs ?? [];
  const breedClubs = breedData?.clubs ?? [];
  const allClubs = allData?.clubs ?? [];
  const totalClubs = allClubs.length;

  return (
    <div className="min-h-screen">
      <PageHero
        title="Clubs"
        subtitle="Join discipline associations and breed clubs"
        mood="default"
        icon={<Users className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
            <Link to="/" className="hover:text-[var(--cream)] transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link to="/community" className="hover:text-[var(--cream)] transition-colors">
              Community
            </Link>
            <span>/</span>
            <span className="text-[var(--cream)]">Clubs</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60 glass-panel rounded-lg px-3 py-1.5">
            <Users className="w-4 h-4" />
            <span>{totalClubs > 0 ? `${totalClubs} clubs total` : '…'}</span>
          </div>
        </div>
      </PageHero>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Tab Navigation + Content — CanonicalTabs underline variant (Equoria-o5hub.11) */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ClubsTab)}>
          <TabsList aria-label="Club categories" data-testid="club-tabs">
            {tabsConfig.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="gap-2"
                data-testid={`tab-${tab.id}`}
              >
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="discipline">
            <ClubGrid clubs={disciplineClubs} isLoading={discLoading} testPrefix="discipline" />
          </TabsContent>
          <TabsContent value="breed">
            <ClubGrid clubs={breedClubs} isLoading={breedLoading} testPrefix="breed" />
          </TabsContent>
          <TabsContent value="my-club">
            <MyClubTab allClubs={allClubs} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ClubsPage;
