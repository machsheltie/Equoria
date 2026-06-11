/**
 * ElectionCard (extracted from ClubsPage — ClubsPage split under Equoria-m0ye2)
 *
 * Renders one club election: status badge, member nominate form, and the
 * candidate list with per-candidate vote buttons. Owns its own nominate /
 * vote mutations and local form state.
 *
 * Migrated to canonical primitives (Equoria-o5hub community lane):
 * Surface panel/subtle, GameBadge status, canonical Input, role-token
 * colors. Action hierarchy (D-08): Nominate keeps the single gold primary
 * on the card; per-candidate Vote buttons are secondary.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/Surface';
import { GameBadge } from '@/components/ui/game';
import { Input } from '@/components/ui/form';
import { useVote, useNominate, useElectionResults } from '@/hooks/api/useClubs';
import type { ClubElection, ElectionCandidate } from '@/lib/api-client';

const statusVariant = (status: ClubElection['status']) => {
  if (status === 'open') return 'success' as const;
  if (status === 'upcoming') return 'warning' as const;
  return 'secondary' as const;
};

export const ElectionCard: React.FC<{ election: ClubElection; isMember: boolean }> = ({
  election,
  isMember,
}) => {
  const { data: resultsData } = useElectionResults(election.id);
  const vote = useVote(election.id);
  const nominate = useNominate(election.id);
  const [statement, setStatement] = useState('');
  const [showNominate, setShowNominate] = useState(false);

  const candidates: ElectionCandidate[] = resultsData?.candidates ?? [];

  return (
    <Surface variant="panel" className="mb-3" data-testid={`election-${election.id}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-semibold text-role-primary">{election.position}</span>
          <GameBadge variant={statusVariant(election.status)} className="ml-2 text-[10px]">
            {election.status}
          </GameBadge>
        </div>
        {isMember && election.status === 'open' && (
          <Button type="button" size="sm" onClick={() => setShowNominate((v) => !v)}>
            Nominate
          </Button>
        )}
      </div>

      {/* Nominate form */}
      {showNominate && (
        <div className="mb-3">
          <Input
            className="mb-2 text-xs"
            placeholder="Optional statement…"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            aria-label="Nomination statement"
          />
          <Button
            type="button"
            size="sm"
            disabled={nominate.isPending}
            onClick={() => {
              nominate.mutate(statement);
              setShowNominate(false);
              setStatement('');
            }}
          >
            {nominate.isPending ? 'Submitting…' : 'Submit Nomination'}
          </Button>
        </div>
      )}

      {/* Candidates */}
      {candidates.length > 0 ? (
        <div className="space-y-2">
          {candidates.map((c) => (
            <Surface
              key={c.id}
              variant="subtle"
              className="flex items-center justify-between text-xs text-role-secondary p-2"
            >
              <span className="font-medium break-words min-w-0">{c.user.username}</span>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-role-muted">{c.voteCount} votes</span>
                {isMember && election.status === 'open' && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={vote.isPending}
                    onClick={() => vote.mutate(c.id)}
                  >
                    Vote
                  </Button>
                )}
              </div>
            </Surface>
          ))}
        </div>
      ) : (
        <p className="text-xs text-role-muted">No candidates yet.</p>
      )}
    </Surface>
  );
};
