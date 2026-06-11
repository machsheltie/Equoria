/**
 * MyClubTab (extracted from ClubsPage — ClubsPage split under Equoria-m0ye2)
 *
 * The "My Club" tab: the player's memberships, active elections per joined
 * club, a create-club form, the global club leaderboard, and the
 * transfer-leadership modal (president only).
 *
 * Migrated to canonical primitives (Equoria-o5hub community lane):
 * Surface panels, canonical form controls + FormField, EmptyState,
 * role-token colors. Action hierarchy: the create-club toggle drops to
 * secondary while the form (with its own gold submit) is open (D-08).
 */

import React, { useState } from 'react';
import { Crown, Vote, BarChart3, Trophy, PlusCircle, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/Surface';
import EmptyState from '@/components/ui/EmptyState';
import { FormField, Input, Select, Textarea } from '@/components/ui/form';
import { useMyClubs, useCreateClub } from '@/hooks/api/useClubs';
import type { Club, ClubType, ClubMembership } from '@/lib/api-client';
import { clubIcon } from './constants';
import { ClubElectionsSection } from './ClubElectionsSection';
import { TransferLeadershipModal } from './TransferLeadershipModal';

export const MyClubTab: React.FC<{ allClubs: Club[] }> = ({ allClubs }) => {
  const { data: myClubsData } = useMyClubs();
  const myMemberships = myClubsData?.memberships ?? [];
  const createClub = useCreateClub();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ClubType>('discipline');
  const [newCategory, setNewCategory] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [transferMembership, setTransferMembership] = useState<ClubMembership | null>(null);

  const handleCreate = async () => {
    if (!newName.trim() || !newCategory.trim() || !newDescription.trim()) return;
    await createClub.mutateAsync({
      name: newName.trim(),
      type: newType,
      category: newCategory.trim(),
      description: newDescription.trim(),
    });
    setShowCreate(false);
    setNewName('');
    setNewCategory('');
    setNewDescription('');
  };

  // Gather all clubIds the user is in
  const myClubIds = new Set(myMemberships.map((m) => m.club.id));

  return (
    <div data-testid="my-club-tab">
      {/* My Memberships */}
      {myMemberships.length > 0 ? (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-role-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
            <Crown className="w-4 h-4" aria-hidden="true" />
            My Clubs
          </h2>
          <div className="space-y-3">
            {myMemberships.map((m) => (
              <Surface key={m.id} variant="panel" className="flex items-center gap-3">
                <span className="text-xl" aria-hidden="true">
                  {clubIcon(m.club)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-role-primary break-words">
                    {m.club.name}
                  </div>
                  <div className="text-xs text-role-muted capitalize">{m.role}</div>
                </div>
                {m.role === 'president' && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setTransferMembership(m)}
                    data-testid={`transfer-leadership-btn-${m.club.id}`}
                    title="Transfer Leadership"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                    Transfer
                  </Button>
                )}
              </Surface>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <EmptyState
            variant="first-use"
            icon={<Crown className="h-8 w-8 text-[var(--gold-400)]" aria-hidden="true" />}
            title="Club Governance"
            description="Join a club to access governance, elections, and member rankings — or create your own."
          />
        </div>
      )}

      {/* Active Elections for each joined club */}
      {myMemberships.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-role-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
            <Vote className="w-4 h-4" aria-hidden="true" />
            Elections
          </h2>
          {myMemberships.map((m) => (
            <ClubElectionsSection
              key={m.id}
              clubId={m.club.id}
              clubName={m.club.name}
              isMember={myClubIds.has(m.club.id)}
            />
          ))}
        </div>
      )}

      <div className="mb-8">
        <Button
          type="button"
          variant={showCreate ? 'secondary' : 'default'}
          onClick={() => setShowCreate((v) => !v)}
          data-testid="create-club-toggle"
        >
          <PlusCircle className="w-4 h-4" />
          Create a new club
        </Button>

        {showCreate && (
          <Surface variant="panel" className="mt-4 space-y-3">
            <h3 className="text-sm font-semibold text-role-secondary">New Club</h3>
            <FormField label="Club name">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  placeholder="Club name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={100}
                  data-testid="create-club-name"
                />
              )}
            </FormField>
            <div className="flex gap-2">
              <FormField label="Type" className="flex-1">
                {(fieldProps) => (
                  <Select
                    {...fieldProps}
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as ClubType)}
                    data-testid="create-club-type"
                    options={[
                      { value: 'discipline', label: 'Discipline' },
                      { value: 'breed', label: 'Breed' },
                    ]}
                  />
                )}
              </FormField>
              <FormField label="Category" className="flex-1">
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    placeholder="Category (e.g. Dressage)"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    data-testid="create-club-category"
                  />
                )}
              </FormField>
            </div>
            <FormField label="Description">
              {(fieldProps) => (
                <Textarea
                  {...fieldProps}
                  className="resize-none h-20"
                  placeholder="Club description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  data-testid="create-club-description"
                />
              )}
            </FormField>
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={
                  !newName.trim() ||
                  !newCategory.trim() ||
                  !newDescription.trim() ||
                  createClub.isPending
                }
                onClick={handleCreate}
                data-testid="create-club-submit"
              >
                {createClub.isPending ? 'Creating…' : 'Create Club'}
              </Button>
            </div>
          </Surface>
        )}
      </div>

      {/* Global Leaderboard */}
      <div>
        <h2 className="text-sm font-semibold text-role-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" aria-hidden="true" />
          Club Leaderboard
        </h2>
        {allClubs.length === 0 ? (
          <EmptyState
            variant="first-use"
            icon={<BarChart3 className="h-8 w-8 text-[var(--gold-400)]" aria-hidden="true" />}
            title="No clubs yet"
            description="The leaderboard fills in as clubs are founded and members join."
          />
        ) : (
          <div className="space-y-2">
            {[...allClubs]
              .sort((a, b) => b.memberCount - a.memberCount)
              .slice(0, 5)
              .map((club, idx) => (
                <Surface
                  key={club.id}
                  variant="panel"
                  className="flex items-center gap-3"
                  data-testid={`leaderboard-row-${club.id}`}
                >
                  <span className="w-6 text-center text-sm font-bold text-role-muted">
                    {idx + 1}
                  </span>
                  <span className="text-lg" aria-hidden="true">
                    {clubIcon(club)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-role-primary break-words">
                      {club.name}
                    </div>
                    <div className="text-xs text-role-muted break-words">
                      {club.leader.username} · {club.memberCount} members
                    </div>
                  </div>
                  {idx === 0 && (
                    <Trophy className="w-4 h-4 text-[var(--gold-400)]" aria-hidden="true" />
                  )}
                </Surface>
              ))}
          </div>
        )}
      </div>

      {/* Transfer Leadership modal — rendered only for the president of a club */}
      {transferMembership && (
        <TransferLeadershipModal
          membership={transferMembership}
          onClose={() => setTransferMembership(null)}
        />
      )}
    </div>
  );
};
