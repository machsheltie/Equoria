/**
 * MyClubTab (extracted from ClubsPage — ClubsPage split under Equoria-m0ye2)
 *
 * The "My Club" tab: the player's memberships, active elections per joined
 * club, a create-club form, the global club leaderboard, and the
 * transfer-leadership modal (president only).
 *
 * Note: the original ClubsPage rendered a hidden `<Award className="hidden" />`
 * purely to suppress an unused-import warning for the `Award` icon. That hack
 * is dropped here because the icon was never actually used — the extracted
 * file simply does not import `Award`, which is the honest fix.
 */

import React, { useState } from 'react';
import { Crown, Vote, BarChart3, Trophy, PlusCircle, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Crown className="w-4 h-4" />
            My Clubs
          </h2>
          <div className="space-y-3">
            {myMemberships.map((m) => (
              <div key={m.id} className="glass-panel flex items-center gap-3">
                <span className="text-xl">{clubIcon(m.club)}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white/80">{m.club.name}</div>
                  <div className="text-xs text-white/40 capitalize">{m.role}</div>
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
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-8 p-6 rounded-xl bg-white/3 border border-white/8 text-center">
          <Crown className="w-10 h-10 text-celestial-gold/40 mx-auto mb-3" />
          <h2 className="text-base font-bold text-white/70 mb-1">Club Governance</h2>
          <p className="text-sm text-white/40 mb-4">
            Join a club to access governance, elections, and member rankings — or create your own.
          </p>
        </div>
      )}

      {/* Active Elections for each joined club */}
      {myMemberships.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Vote className="w-4 h-4" />
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
          onClick={() => setShowCreate((v) => !v)}
          data-testid="create-club-toggle"
        >
          <PlusCircle className="w-4 h-4" />
          Create a new club
        </Button>

        {showCreate && (
          <div className="mt-4 glass-panel">
            <h3 className="text-sm font-semibold text-white/70 mb-3">New Club</h3>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40 mb-2"
              placeholder="Club name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={100}
              data-testid="create-club-name"
            />
            <div className="flex gap-2 mb-2">
              <select
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/40"
                value={newType}
                onChange={(e) => setNewType(e.target.value as ClubType)}
                data-testid="create-club-type"
              >
                <option value="discipline">Discipline</option>
                <option value="breed">Breed</option>
              </select>
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40"
                placeholder="Category (e.g. Dressage)"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                data-testid="create-club-category"
              />
            </div>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40 resize-none mb-3 h-20"
              placeholder="Club description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              data-testid="create-club-description"
            />
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
          </div>
        )}
      </div>

      {/* Global Leaderboard */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Club Leaderboard
        </h2>
        {allClubs.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm">No clubs yet</div>
        ) : (
          <div className="space-y-2">
            {[...allClubs]
              .sort((a, b) => b.memberCount - a.memberCount)
              .slice(0, 5)
              .map((club, idx) => (
                <div
                  key={club.id}
                  className="glass-panel flex items-center gap-3"
                  data-testid={`leaderboard-row-${club.id}`}
                >
                  <span className="w-6 text-center text-sm font-bold text-white/40">{idx + 1}</span>
                  <span className="text-lg">{clubIcon(club)}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white/80">{club.name}</div>
                    <div className="text-xs text-white/40">
                      {club.leader.username} · {club.memberCount} members
                    </div>
                  </div>
                  {idx === 0 && <Trophy className="w-4 h-4 text-celestial-gold" />}
                </div>
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
