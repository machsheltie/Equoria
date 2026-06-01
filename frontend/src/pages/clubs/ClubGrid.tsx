/**
 * ClubGrid (extracted from ClubsPage — ClubsPage split under Equoria-m0ye2)
 *
 * Renders a grid of club cards for a given list (discipline or breed),
 * including loading skeletons, an empty state, and a per-card Join button
 * (or "Member" badge). Owns the join mutation and computes membership from
 * useMyClubs.
 */

import React from 'react';
import { Users, Crown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useJoinClub, useMyClubs } from '@/hooks/api/useClubs';
import type { Club } from '@/lib/api-client';
import { clubIcon } from './constants';

export const ClubGrid: React.FC<{
  clubs: Club[];
  isLoading: boolean;
  testPrefix: string;
}> = ({ clubs, isLoading, testPrefix }) => {
  const joinClub = useJoinClub();
  const { data: myClubsData } = useMyClubs();
  const myClubIds = new Set(myClubsData?.memberships.map((m) => m.club.id) ?? []);

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        data-testid={`${testPrefix}-clubs-grid`}
      >
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-panel animate-pulse h-40" />
        ))}
      </div>
    );
  }

  if (clubs.length === 0) {
    return (
      <div className="text-center py-12 text-white/40" data-testid={`${testPrefix}-clubs-grid`}>
        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No clubs yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid={`${testPrefix}-clubs-grid`}>
      {clubs.map((club) => {
        const isMember = myClubIds.has(club.id);
        return (
          <div
            key={club.id}
            className="glass-panel hover:border-white/20"
            data-testid={`club-card-${club.id}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{clubIcon(club)}</span>
                <div>
                  <h3 className="font-bold text-white/90 text-sm">{club.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-white/40">{club.category}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-white/70">{club.memberCount}</div>
                <div className="text-[10px] text-white/40">members</div>
              </div>
            </div>

            <p className="text-xs text-white/50 mb-3 leading-relaxed">{club.description}</p>

            <div className="flex items-center justify-between mb-4 text-xs text-white/40">
              <span className="flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-celestial-gold/60" />
                {club.leader.username}
              </span>
            </div>

            {isMember ? (
              <div className="w-full py-2 text-xs font-medium rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center gap-1.5">
                ✓ Member
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={() => joinClub.mutate(club.id)}
                disabled={joinClub.isPending}
                data-testid={`join-button-${club.id}`}
              >
                <ChevronRight className="w-3.5 h-3.5" />
                {joinClub.isPending ? 'Joining…' : 'Join Club'}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
};
