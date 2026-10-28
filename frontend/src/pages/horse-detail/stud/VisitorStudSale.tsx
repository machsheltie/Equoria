/**
 * The Stud / Sale tab's visitor actions (owner ruling q205 and the coordinator
 * directive 2026-10-28: a visitor sees the owner's horse page read-only, with
 * only the visitor's own actions, in the Stud / Sale area).
 *
 * Owner rulings carried over from the old visitor view: q90 the "Standing at
 * stud" plaque with the fee, Public or Private, and the owner; q91/q94 a
 * stallion at stud carries "Breed to <name> (<fee>)"; q95/q107 a stallion
 * owner arriving at a requesting mare (…?request=<id>) accepts or rejects
 * there. A horse listed for sale carries one-click "Buy <name> (<price>)"
 * (owner ruling 2026-10-26: the price on the button, no confirm page).
 */

import React, { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useStudRequests } from '@/hooks/api/useStuds';
import { useBuyHorse } from '@/hooks/api/useMarketplace';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/state';
import { userMessageFor } from '@/lib/http/userMessage';
import type { HorseVisit } from '@/lib/api/studs';
import BreedToStallion from './BreedToStallion';
import RequestAnswer from './RequestAnswer';
import { StarMark } from './StarMark';
import '@/styles/studBreeding.css';

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
  // Answered here: stay after the refetch so what happened, or the refusal,
  // is still said once the request is no longer pending (Equoria-e7tgc.10).
  const [answeredHere, setAnsweredHere] = useState(false);
  const request = incoming.data?.requests.find((row) => row.id === requestId);
  const pending = request?.status === 'PENDING';
  if (!request || !(pending || answeredHere)) return null;
  return (
    <section className="stud-request-link" aria-label="Breeding request">
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
        open={pending}
        onAnswer={() => setAnsweredHere(true)}
      />
    </section>
  );
};

/** One click buys a listed horse; a failure is said beside the button. */
const BuyHorseButton: React.FC<{ horse: HorseVisit; price: number }> = ({ horse, price }) => {
  const buy = useBuyHorse();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={() => buy.mutate(horse.id)}
        disabled={buy.isPending}
        aria-busy={buy.isPending}
      >
        {buy.isPending ? 'Buying…' : `Buy ${horse.name} (${price.toLocaleString()})`}
      </Button>
      {buy.isError && <InlineError message={userMessageFor(buy.error).message} />}
    </div>
  );
};

const VisitorStudSale: React.FC<{ horse: HorseVisit }> = ({ horse }) => {
  const [params] = useSearchParams();
  const requestId = Number(params.get('request'));
  return (
    <>
      {requestId > 0 && <RequestFromLink horse={horse} requestId={requestId} />}
      <StudPlaque horse={horse} />
      {horse.forSale && typeof horse.salePrice === 'number' && !horse.isOwn && (
        <BuyHorseButton horse={horse} price={horse.salePrice} />
      )}
    </>
  );
};

export default VisitorStudSale;
