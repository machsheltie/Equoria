/**
 * Hall of Fame (Equoria-vb1n0, owner rulings 2026-10-28, q257-q259).
 *
 * The Hall of Fame is for the best of the best, not every retired horse, and
 * it opens no alternative view of the player's stable (the former Stable
 * Profile tab is gone: the player's page and her stable's page are one page,
 * /profile — Equoria-kgush). Two sections:
 *
 *   1. Nominees — this week's nominated horses (and any one-day run-off of a
 *      tied week). Each opens its horse page and has a Vote button; a player
 *      has one vote per round and may vote for her own horse.
 *   2. Hall of Fame Horses — every inducted horse with the date it joined.
 *
 * It started empty: "No one has earned the right to be in the hall of fame yet."
 * Vote counts are not shown. Authored CSS over tokens: styles/hallOfFame.css.
 */

import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ErrorState, InlineError, SectionLoading } from '@/components/ui/state';
import { useHallOfFame, useHallOfFameVote } from '@/hooks/api/useHallOfFame';
import type { HallOfFameRound } from '@/lib/api/hallOfFame';
import { userMessageFor } from '@/lib/http/userMessage';
import '@/styles/hallOfFame.css';

const dateFormat = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'America/New_York',
});

function horseLine(breedName: string | null, ownerName: string | null) {
  return [breedName, ownerName ? `owned by ${ownerName}` : null].filter(Boolean).join(' · ');
}

function NomineeRound({ round }: { round: HallOfFameRound }) {
  const vote = useHallOfFameVote();
  const hasVoted = round.myVoteCandidateId !== null;
  return (
    <div className="hall-of-fame__round" data-testid={`hof-round-${round.roundId}`}>
      <p className="hall-of-fame__round-note">
        {round.isRunoff
          ? 'A tie for the top: one day of voting decides between these horses.'
          : 'Voting closes when the week ends.'}{' '}
        Voting ends {dateFormat.format(new Date(round.endsAt))}.
      </p>
      <ul className="hall-of-fame__list">
        {round.nominees.map((nominee) => {
          const isMyVote = round.myVoteCandidateId === nominee.candidateId;
          return (
            <li
              key={nominee.candidateId}
              className="hall-of-fame__entry"
              data-testid={`hof-nominee-${nominee.horseId}`}
            >
              <div className="hall-of-fame__horse">
                <Link className="hall-of-fame__name" to={`/horses/${nominee.horseId}`}>
                  {nominee.horseName}
                </Link>
                <span className="hall-of-fame__meta">
                  {horseLine(nominee.breedName, nominee.ownerName)}
                </span>
              </div>
              {isMyVote ? (
                <span className="hall-of-fame__voted">Your vote</span>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={hasVoted || vote.isPending}
                  onClick={() => vote.mutate(nominee.candidateId)}
                  aria-label={`Vote for ${nominee.horseName}`}
                >
                  Vote
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {vote.isError && (
        <InlineError message={`Your vote was not counted. ${userMessageFor(vote.error).message}`} />
      )}
    </div>
  );
}

const HallOfFamePage = () => {
  const hall = useHallOfFame();

  return (
    <div className="hall-of-fame">
      <header className="hall-of-fame__hero">
        <h1 className="hall-of-fame__title">Hall of Fame</h1>
        <p className="hall-of-fame__lede">
          The best of the best. Each week the players choose one retired horse to join the horses
          honored here.
        </p>
      </header>

      {hall.isPending ? (
        <SectionLoading label="Opening the Hall of Fame" />
      ) : hall.isError ? (
        <ErrorState
          title="The Hall of Fame could not be opened"
          message={userMessageFor(hall.error).message}
          retry={{ label: 'Try Again', onClick: () => void hall.refetch() }}
        />
      ) : (
        <>
          <section className="hall-of-fame__section" aria-labelledby="hof-nominees">
            <h2 id="hof-nominees" className="hall-of-fame__heading">
              Nominees
            </h2>
            {hall.data.rounds.length === 0 ? (
              <p className="hall-of-fame__empty">
                No horses are up for a vote this week. A retired horse nominated by its owner
                appears here the week after.
              </p>
            ) : (
              hall.data.rounds.map((round) => <NomineeRound key={round.roundId} round={round} />)
            )}
          </section>

          <section className="hall-of-fame__section" aria-labelledby="hof-inductees">
            <h2 id="hof-inductees" className="hall-of-fame__heading">
              Hall of Fame Horses
            </h2>
            {hall.data.inductees.length === 0 ? (
              <p className="hall-of-fame__empty">
                No one has earned the right to be in the Hall of Fame yet.
              </p>
            ) : (
              <ul className="hall-of-fame__list">
                {hall.data.inductees.map((horse) => (
                  <li
                    key={horse.horseId}
                    className="hall-of-fame__entry"
                    data-testid={`hof-inductee-${horse.horseId}`}
                  >
                    <div className="hall-of-fame__horse">
                      <Link className="hall-of-fame__name" to={`/horses/${horse.horseId}`}>
                        {horse.horseName}
                      </Link>
                      <span className="hall-of-fame__meta">
                        {horseLine(horse.breedName, horse.ownerName)}
                      </span>
                    </div>
                    <span className="hall-of-fame__date">
                      Joined {dateFormat.format(new Date(horse.inductedAt))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default HallOfFamePage;
