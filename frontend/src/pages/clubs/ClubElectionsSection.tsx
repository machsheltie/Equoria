/**
 * ClubElectionsSection (extracted from ClubsPage — ClubsPage split under Equoria-m0ye2)
 *
 * For a single club, loads its elections and renders the active (non-closed)
 * ones as ElectionCards. Shows an empty message when the club has no active
 * elections.
 */

import React from 'react';
import { useClubElections } from '@/hooks/api/useClubs';
import { ElectionCard } from './ElectionCard';

export const ClubElectionsSection: React.FC<{
  clubId: number;
  clubName: string;
  isMember: boolean;
}> = ({ clubId, clubName, isMember }) => {
  const { data } = useClubElections(clubId);
  const elections = data?.elections ?? [];
  const active = elections.filter((e) => e.status !== 'closed');

  if (active.length === 0) {
    return (
      <p className="text-xs text-white/30 mb-3">
        No active elections in <span className="text-white/50">{clubName}</span>.
      </p>
    );
  }

  return (
    <div className="mb-4">
      <p className="text-xs text-white/50 mb-2 font-medium">{clubName}</p>
      {active.map((election) => (
        <ElectionCard key={election.id} election={election} isMember={isMember} />
      ))}
    </div>
  );
};
