/**
 * The one horse page in visitor mode (Equoria-q4uem.9).
 *
 * Owner rulings: q90 (2026-10-26) another player's horse is the same horse
 * page, read-only, showing public facts and revealed traits only, plus a
 * "Standing at stud" plaque with the fee, Public or Private, and the owner;
 * q91/q94 a stallion at stud carries "Breed to <name> (<fee>)"; q95/q107 a
 * stallion owner opening a requesting mare (…?request=<id>) sees her read-only
 * and accepts or rejects there.
 *
 * Owner rulings 2026-10-28: visitors see everything on a horse's page,
 * read-only (q205): the show record line under the name (q215 / q225), the
 * Horse Details (Breed above Age, Color with its shade), the Care Team, and
 * Trait Discovery chips (Hidden / gold / greyed Inactive; q174 / q213). Old
 * contract: public facts and a "Revealed traits" list only.
 */

import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useStudRequests } from '@/hooks/api/useStuds';
import { humanizeTraitKey, type HorseTrait } from '@/hooks/useHorseTraits';
import { healthLabel } from '@/lib/healthWords';
import { colorWithShade } from '@/lib/coatColor';
import { formatDate } from '@/lib/formatDate';
import { horseAgeWords } from '@/lib/horseAgeWords';
import { isStaffLevel } from '@/lib/staffLevels';
import StaffLevelStars from '@/components/common/StaffLevelStars';
import MarkingsPanel from '@/components/horse/MarkingsPanel';
import LiveTraitDetailModal from '@/components/traits/LiveTraitDetailModal';
import type { HorseVisit, VisitTrait } from '@/lib/api/studs';
import { ShowRecordLine } from '../ShowRecordLine';
import TraitDiscovery from '../genetics/TraitDiscovery';
import type { HorseMarkings } from '../HorseDetailPageTypes';
import BreedToStallion from './BreedToStallion';
import RequestAnswer from './RequestAnswer';
import { StarMark } from './StarMark';
import '@/styles/studBreeding.css';
import '@/styles/horseCare.css';

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

/** A server-named trait as the Trait Discovery chips read it. */
function chipTrait(trait: VisitTrait, valence: 'positive' | 'negative'): HorseTrait {
  return {
    key: trait.key,
    name: trait.label ?? humanizeTraitKey(trait.key),
    valence,
    description: trait.description ?? '',
  };
}

/** Revealed, dormant and a hidden count; an older reply sends revealed keys only. */
function discoveryOf(horse: HorseVisit) {
  const found = horse.traitDiscovery;
  if (found) {
    return {
      revealed: [
        ...found.positive.map((t) => chipTrait(t, 'positive')),
        ...found.negative.map((t) => chipTrait(t, 'negative')),
      ],
      dormant: found.dormant.map((t) =>
        chipTrait(t, t.type === 'negative' ? 'negative' : 'positive')
      ),
      hiddenCount: found.hiddenCount,
    };
  }
  const named = (key: string, valence: 'positive' | 'negative'): HorseTrait => ({
    key,
    name: humanizeTraitKey(key),
    valence,
    description: '',
  });
  return {
    revealed: [
      ...horse.revealedTraits.positive.map((key) => named(key, 'positive')),
      ...horse.revealedTraits.negative.map((key) => named(key, 'negative')),
    ],
    dormant: [],
    hiddenCount: 0,
  };
}

const noGlow: ReadonlySet<string> = new Set();
const sameToken = (value: string) => value;

/** One read-only ledger row, in the Horse Details style. */
const Row: React.FC<{ label: string; testId?: string; children: React.ReactNode }> = ({
  label,
  testId,
  children,
}) => (
  <div className="horse-status__row">
    <dt>{label}</dt>
    <dd data-testid={testId}>{children}</dd>
  </div>
);

const staffRoles = [
  { key: 'trainer', label: 'Assigned Trainer', none: 'No trainer assigned.' },
  { key: 'groom', label: 'Assigned Groom', none: 'No groom assigned.' },
  { key: 'rider', label: 'Assigned Rider', none: 'No rider assigned.' },
] as const;

/** The horse's Horse Details and Care Team, read-only (q205). */
const VisitorLedgers: React.FC<{ horse: HorseVisit }> = ({ horse }) => {
  const markings: HorseMarkings | null =
    horse.faceMarking || horse.legMarkings
      ? {
          faceMarking: horse.faceMarking ?? undefined,
          legMarkings: (horse.legMarkings ?? undefined) as HorseMarkings['legMarkings'],
        }
      : null;
  return (
    <>
      <section aria-labelledby={`visit-details-${horse.id}`}>
        <h2 id={`visit-details-${horse.id}`} className="stud-visit__heading">
          Horse Details
        </h2>
        <dl className="horse-status__record">
          <Row label="Breed">{horse.breed ?? 'not recorded'}</Row>
          <Row label="Age">{horseAgeWords(horse.age, horse.dateOfBirth)}</Row>
          <Row label="Date of Birth">
            {formatDate(
              horse.dateOfBirth,
              { month: 'long', day: 'numeric', year: 'numeric' },
              'Not recorded'
            )}
          </Row>
          <Row label="Gender">{horse.sex}</Row>
          <Row label="Color" testId="visit-color">
            {colorWithShade(horse.colorName, horse.shade)}
          </Row>
          <Row label="Markings">
            <MarkingsPanel markings={markings} inline />
          </Row>
          <Row label="Temperament">{horse.temperament ?? 'not recorded'}</Row>
          <Row label="Health">{healthLabel(horse.displayedHealth)}</Row>
        </dl>
      </section>
      {horse.careTeam && (
        <section aria-labelledby={`visit-care-team-${horse.id}`} data-testid="visit-care-team">
          <h2 id={`visit-care-team-${horse.id}`} className="stud-visit__heading">
            Care Team
          </h2>
          <dl className="horse-status__record">
            {staffRoles.map((role) => {
              const member = horse.careTeam?.[role.key] ?? null;
              return (
                <Row key={role.key} label={role.label}>
                  {member ? (
                    <span>
                      {member.name}{' '}
                      {isStaffLevel(member.starLevel) && (
                        <StaffLevelStars level={member.starLevel} />
                      )}
                    </span>
                  ) : (
                    role.none
                  )}
                </Row>
              );
            })}
          </dl>
        </section>
      )}
    </>
  );
};

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
  const discovery = discoveryOf(horse);
  const [selectedTrait, setSelectedTrait] = useState<HorseTrait | null>(null);
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
        {horse.showRecord && (
          <ShowRecordLine
            record={{
              wins: horse.showRecord.wins,
              secondPlaces: horse.showRecord.secondPlaces,
              thirdPlaces: horse.showRecord.thirdPlaces,
              winnings: horse.showRecord.winnings,
              points: horse.showRecord.points,
            }}
          />
        )}
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

        <VisitorLedgers horse={horse} />

        <TraitDiscovery
          revealed={discovery.revealed}
          dormant={discovery.dormant}
          hiddenCount={discovery.hiddenCount}
          glowTokens={noGlow}
          normalize={sameToken}
          onSelect={setSelectedTrait}
        />

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
        </p>

        {requestId > 0 && <RequestFromLink horse={horse} requestId={requestId} />}
        <StudPlaque horse={horse} />
      </div>
      <LiveTraitDetailModal
        isOpen={selectedTrait !== null}
        onClose={() => setSelectedTrait(null)}
        trait={selectedTrait}
      />
    </article>
  );
};

export default HorseVisitorView;
