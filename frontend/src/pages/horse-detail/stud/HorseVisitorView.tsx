/**
 * The one horse page in visitor mode (Equoria-q4uem.9).
 *
 * Owner rulings: q90 (2026-10-26) another player's horse is the same horse
 * page, read-only, showing public facts and revealed traits only, plus a
 * "Standing at stud" plaque with the fee, Public or Private, and the owner;
 * q91/q94 a stallion at stud carries "Breed to <name> (<fee>)"; q95/q107 a
 * stallion owner opening a requesting mare (…?request=<id>) sees her read-only
 * and accepts or rejects there.
 */

import React from 'react';
import { Link, useSearchParams } from 'react-router';
import { useStudRequests } from '@/hooks/api/useStuds';
import { humanizeTraitKey } from '@/hooks/useHorseTraits';
import { healthLabel } from '@/lib/healthWords';
import type { HorseVisit } from '@/lib/api/studs';
import BreedToStallion from './BreedToStallion';
import RequestAnswer from './RequestAnswer';
import { StarMark } from './StarMark';
import '@/styles/studBreeding.css';

const statOrder = [
  'speed',
  'stamina',
  'agility',
  'precision',
  'strength',
  'intelligence',
  'boldness',
];

function statLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

const StudPlaque: React.FC<{ horse: HorseVisit }> = ({ horse }) => {
  if (!horse.stud) return null;
  const isPublic = horse.stud.mode === 'public';
  return (
    <section className="stud-plaque" aria-labelledby={`stud-plaque-${horse.id}`}>
      <h2 id={`stud-plaque-${horse.id}`} className="stud-plaque__title">
        <StarMark /> Standing at stud
      </h2>
      {horse.owner && (
        <p className="stud-plaque__accent">
          {horse.name} stands with {horse.owner.username}.
        </p>
      )}
      <dl className="stud-plaque__terms">
        <div>
          <dt>Fee</dt>
          <dd className="stud-plaque__fee">{horse.stud.fee.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Booking</dt>
          <dd>
            <span className={`stud-mode stud-mode--${horse.stud.mode}`}>
              {isPublic ? 'Public Stud' : 'Private Stud'}
            </span>
          </dd>
        </div>
        {horse.owner && (
          <div>
            <dt>Owner</dt>
            <dd>{horse.owner.username}</dd>
          </div>
        )}
      </dl>
      <p className="stud-quiet">
        {isPublic
          ? 'Public Stud: the breeding happens at once.'
          : 'Private Stud: the owner is sent your request and replies.'}
      </p>
      {horse.sex === 'Stallion' && !horse.isOwn && (
        <BreedToStallion
          stallion={{ id: horse.id, name: horse.name, breed: horse.breed }}
          kind={horse.stud.mode}
          fee={horse.stud.fee}
          ownerName={horse.owner?.username ?? null}
        />
      )}
    </section>
  );
};

/** Accept / Reject when a stallion owner arrived from one of her requests. */
const RequestFromLink: React.FC<{ horse: HorseVisit; requestId: number }> = ({
  horse,
  requestId,
}) => {
  const incoming = useStudRequests({ role: 'incoming', damId: horse.id });
  const request = incoming.data?.requests.find(
    (row) => row.id === requestId && row.status === 'PENDING'
  );
  if (!request) return null;
  return (
    <section className="stud-visit__request" aria-label="Breeding request">
      <p className="stud-quiet">
        {request.counterparty.username} asks to breed {horse.name} to {request.sire.name} for{' '}
        {request.fee.toLocaleString()}.
      </p>
      <RequestAnswer
        requestId={request.id}
        mareName={horse.name}
        stallionName={request.sire.name}
        fee={request.fee}
        mareOwnerName={request.counterparty.username}
      />
    </section>
  );
};

const HorseVisitorView: React.FC<{ horse: HorseVisit }> = ({ horse }) => {
  const [params] = useSearchParams();
  const requestId = Number(params.get('request'));
  const traits = [
    ...horse.revealedTraits.positive.map((key) => ({ key, helps: true })),
    ...horse.revealedTraits.negative.map((key) => ({ key, helps: false })),
  ];
  const facts = [horse.breed, horse.sex, horse.age !== null ? `${horse.age} years` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="stud-visit" data-testid="horse-visitor-view">
      <div className="stud-visit__portrait">
        {horse.imageUrl ? (
          <img src={horse.imageUrl} alt={`Portrait of ${horse.name}`} />
        ) : (
          <div
            className="stud-visit__portrait-empty"
            role="img"
            aria-label={`No portrait of ${horse.name} yet`}
          />
        )}
      </div>
      <div className="stud-visit__body">
        <p className="stud-visit__facts">
          {facts}
          <span className="stud-visit__readonly">Visiting</span>
        </p>
        <h1 className="stud-visit__name">{horse.name}</h1>
        <p className="stud-quiet">
          {[horse.colorName, horse.owner ? `owned by ${horse.owner.username}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>

        <dl className="stud-visit__stats" aria-label="Stats">
          {statOrder
            .filter((key) => key in horse.stats)
            .map((key) => (
              <div key={key}>
                <dt>{statLabel(key)}</dt>
                <dd>{horse.stats[key]}</dd>
              </div>
            ))}
        </dl>

        <h2 className="stud-visit__heading">Revealed traits</h2>
        {traits.length === 0 ? (
          <p className="stud-quiet">No traits have been revealed yet.</p>
        ) : (
          <ul className="stud-traits">
            {traits.map(({ key, helps }) => (
              <li key={key} className={helps ? 'stud-trait' : 'stud-trait stud-trait--hinders'}>
                {humanizeTraitKey(key)}
                <span className="sr-only">{helps ? ' (helps)' : ' (hinders)'}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="stud-quiet stud-visit__lineage">
          {horse.sire ? (
            <>
              Sire{' '}
              <Link to={`/horses/${horse.sire.id}`} className="stud-link">
                {horse.sire.name}
              </Link>
            </>
          ) : (
            'Sire unrecorded'
          )}
          {' · '}
          {horse.dam ? (
            <>
              Dam{' '}
              <Link to={`/horses/${horse.dam.id}`} className="stud-link">
                {horse.dam.name}
              </Link>
            </>
          ) : (
            'Dam unrecorded'
          )}
          {' · '}Health {healthLabel(horse.displayedHealth)}
        </p>

        {requestId > 0 && <RequestFromLink horse={horse} requestId={requestId} />}
        <StudPlaque horse={horse} />
      </div>
    </article>
  );
};

export default HorseVisitorView;
