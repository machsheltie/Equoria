/**
 * ClubGrid (extracted from ClubsPage — ClubsPage split under Equoria-m0ye2)
 *
 * Renders a grid of club cards for a given list (discipline or breed),
 * including loading skeletons, an empty state, and a per-card Join button
 * (or "Member" badge). Owns the join mutation and computes membership from
 * useMyClubs.
 *
 * Migrated to canonical primitives (Equoria-o5hub community lane):
 * Surface panel cards, Skeleton loading, EmptyState, role-token colors.
 */

import React from 'react';
import { Users, Crown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/Surface';
import { Skeleton } from '@/components/ui/state';
import EmptyState from '@/components/ui/EmptyState';
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
          <Skeleton.Rect key={i} className="h-40" rounded="lg" />
        ))}
      </div>
    );
  }

  if (clubs.length === 0) {
    return (
      <div data-testid={`${testPrefix}-clubs-grid`}>
        <EmptyState
          variant="first-use"
          icon={<Users className="h-8 w-8 text-[var(--gold-400)]" aria-hidden="true" />}
          title="No clubs yet"
          description="Clubs will appear here once they are founded. Create one from the My Club tab."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid={`${testPrefix}-clubs-grid`}>
      {clubs.map((club) => {
        const isMember = myClubIds.has(club.id);
        return (
          <Surface key={club.id} variant="panel" data-testid={`club-card-${club.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl" aria-hidden="true">
                  {clubIcon(club)}
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold text-role-primary text-sm break-words">{club.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-role-muted">{club.category}</span>
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-role-secondary">{club.memberCount}</div>
                <div className="text-[10px] text-role-muted">members</div>
              </div>
            </div>

            <p className="text-xs text-role-muted mb-3 leading-relaxed break-words">
              {club.description}
            </p>

            <div className="flex items-center justify-between mb-4 text-xs text-role-muted">
              <span className="flex items-center gap-1 min-w-0">
                <Crown
                  className="w-3.5 h-3.5 flex-shrink-0 text-[var(--gold-400)]"
                  aria-hidden="true"
                />
                <span className="break-words min-w-0">{club.leader.username}</span>
              </span>
            </div>

            {isMember ? (
              <div className="w-full py-2 text-xs font-medium rounded-[var(--radius-md)] bg-[var(--role-success-bg)] border border-[var(--role-success-border)] text-[var(--role-success-text)] flex items-center justify-center gap-1.5">
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
          </Surface>
        );
      })}
    </div>
  );
};
