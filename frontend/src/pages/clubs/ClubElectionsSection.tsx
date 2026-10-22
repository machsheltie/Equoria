/**
 * ClubElectionsSection (extracted from ClubsPage — ClubsPage split under Equoria-m0ye2)
 *
 * For a single club, loads its elections and renders the active (non-closed)
 * ones as ElectionCards. Loading, a failed fetch (error with retry) and a
 * successful empty list are three different states (Equoria-1rsb7): the empty
 * message appears only after the request succeeded.
 */

import React from 'react';
import { useClubElections } from '@/hooks/api/useClubs';
import { SectionLoading } from '@/components/ui/state';
import { ElectionCard } from './ElectionCard';
import { ClubQueryError } from './ClubQueryError';

export const ClubElectionsSection: React.FC<{
  clubId: number;
  clubName: string;
  isMember: boolean;
}> = ({ clubId, clubName, isMember }) => {
  const query = useClubElections(clubId);

  // A background refetch that fails keeps the elections already on screen; only a
  // read with nothing to show is an error or a loading state.
  if (!query.data && !query.isError) {
    return <SectionLoading label={`Loading elections in ${clubName}`} minHeight="48px" />;
  }

  if (!query.data) {
    return (
      <div className="mb-3">
        <p className="text-xs text-role-secondary mb-1 font-medium break-words">{clubName}</p>
        <ClubQueryError error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const active = query.data.elections.filter((e) => e.status !== 'closed');

  if (active.length === 0) {
    return (
      <p className="text-xs text-role-muted mb-3">
        No active elections in <span className="text-role-secondary">{clubName}</span>.
      </p>
    );
  }

  return (
    <div className="mb-4">
      <p className="text-xs text-role-secondary mb-2 font-medium break-words">{clubName}</p>
      {active.map((election) => (
        <ElectionCard key={election.id} election={election} isMember={isMember} />
      ))}
    </div>
  );
};
