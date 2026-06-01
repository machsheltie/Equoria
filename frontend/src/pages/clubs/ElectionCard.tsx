/**
 * ElectionCard (extracted from ClubsPage — ClubsPage split under Equoria-m0ye2)
 *
 * Renders one club election: status badge, member nominate form, and the
 * candidate list with per-candidate vote buttons. Owns its own nominate /
 * vote mutations and local form state.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useVote, useNominate, useElectionResults } from '@/hooks/api/useClubs';
import type { ClubElection, ElectionCandidate } from '@/lib/api-client';

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
    <div className="glass-panel mb-3" data-testid={`election-${election.id}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-semibold text-white/80">{election.position}</span>
          <span
            className={`ml-2 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
              election.status === 'open'
                ? 'bg-emerald-500/15 text-emerald-400'
                : election.status === 'upcoming'
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-white/10 text-white/40'
            }`}
          >
            {election.status}
          </span>
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
          <input
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40 mb-2"
            placeholder="Optional statement…"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
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
            <div
              key={c.id}
              className="flex items-center justify-between text-xs text-white/60 p-2 rounded bg-white/3 border border-white/8"
            >
              <span className="font-medium">{c.user.username}</span>
              <div className="flex items-center gap-3">
                <span className="text-white/40">{c.voteCount} votes</span>
                {isMember && election.status === 'open' && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={vote.isPending}
                    onClick={() => vote.mutate(c.id)}
                  >
                    Vote
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-white/30">No candidates yet.</p>
      )}
    </div>
  );
};
