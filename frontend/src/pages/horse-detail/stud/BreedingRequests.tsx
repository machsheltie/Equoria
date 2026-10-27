/**
 * "Breeding requests" on a horse's own Stud/Sale area (Equoria-q4uem.9).
 *
 * Owner ruling q105 (2026-10-27): the button sits on the stallion's page, in
 * its Stud/Sale area, with no link to the Marketplace. A stallion lists the
 * requests mares have sent him: the mare's name opens her read-only (q107,
 * revealed traits only) and the owner accepts or rejects (q95, no note q108).
 * A mare lists the requests she has sent, and her owner may withdraw a waiting
 * one (S8). Requests show only here, never as lines in the stable list (q109).
 */

import React, { useId, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { InlineError, SectionLoading } from '@/components/ui/state';
import { useAnswerStudRequest, useStudRequests } from '@/hooks/api/useStuds';
import type { StudRequest, StudRequestStatus } from '@/lib/api/studs';
import { userMessageFor } from '@/lib/http/userMessage';
import RequestAnswer from './RequestAnswer';
import { requestAnswerRefusal } from './studBreeding';

type Side = 'stallion' | 'mare';

const STATUS_WORDS: Record<Side, Record<StudRequestStatus, string>> = {
  stallion: {
    PENDING: 'Waiting on you',
    COMPLETED: 'Accepted',
    DECLINED: 'Declined',
    CANCELLED: 'Withdrawn',
  },
  mare: {
    PENDING: 'Waiting for a reply',
    COMPLETED: 'Accepted, in foal',
    DECLINED: 'Declined',
    CANCELLED: 'Withdrawn',
  },
};

const Withdraw: React.FC<{ requestId: number }> = ({ requestId }) => {
  const answer = useAnswerStudRequest();
  return (
    <div className="stud-answer">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={answer.isPending}
        onClick={() => answer.mutate({ requestId, answer: 'cancel' })}
      >
        {answer.isPending ? 'Withdrawing…' : 'Withdraw request'}
      </Button>
      {answer.isError && <InlineError message={requestAnswerRefusal(answer.error)} />}
    </div>
  );
};

const RequestEntry: React.FC<{ side: Side; request: StudRequest }> = ({ side, request }) => {
  const pending = request.status === 'PENDING';
  const fee = request.fee.toLocaleString();
  return (
    <li className="stud-request" data-status={request.status.toLowerCase()}>
      {side === 'stallion' ? (
        <>
          <h4 className="stud-request__name">
            {request.dam.id ? (
              <Link to={`/horses/${request.dam.id}?request=${request.id}`} className="stud-link">
                {request.dam.name}
              </Link>
            ) : (
              request.dam.name
            )}
          </h4>
          <p className="stud-quiet">
            Owned by {request.counterparty.username} · fee {fee}
          </p>
        </>
      ) : (
        <>
          <h4 className="stud-request__name">
            {request.dam.name} to {request.sire.name}
          </h4>
          <p className="stud-quiet">
            {request.counterparty.username} · fee {fee}
          </p>
        </>
      )}
      <p className="stud-request__status">{STATUS_WORDS[side][request.status]}</p>
      {pending && side === 'stallion' && (
        <>
          <p className="stud-quiet">Open {request.dam.name} to see her before you answer.</p>
          <RequestAnswer
            requestId={request.id}
            mareName={request.dam.name}
            stallionName={request.sire.name}
            fee={request.fee}
            mareOwnerName={request.counterparty.username}
          />
        </>
      )}
      {pending && side === 'mare' && <Withdraw requestId={request.id} />}
    </li>
  );
};

const RequestList: React.FC<{ side: Side; horseId: number; horseName: string }> = ({
  side,
  horseId,
  horseName,
}) => {
  const requests = useStudRequests(
    side === 'stallion'
      ? { role: 'incoming', sireId: horseId }
      : { role: 'outgoing', damId: horseId }
  );
  if (requests.isPending)
    return <SectionLoading label="Fetching breeding requests" minHeight="80px" />;
  if (requests.isError) {
    return (
      <div className="stud-breed__picker-error">
        <InlineError message={userMessageFor(requests.error).message} />
        <Button type="button" variant="secondary" size="sm" onClick={() => requests.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (requests.data.requests.length === 0) {
    return (
      <p className="stud-quiet">
        {side === 'stallion'
          ? `No mares have asked for ${horseName} yet.`
          : `${horseName} has not been sent to a private stud.`}
      </p>
    );
  }
  return (
    <ul className="stud-requests">
      {requests.data.requests.map((request) => (
        <RequestEntry key={request.id} side={side} request={request} />
      ))}
    </ul>
  );
};

export interface BreedingRequestsProps {
  side: Side;
  horseId: number;
  horseName: string;
}

const BreedingRequests: React.FC<BreedingRequestsProps> = ({ side, horseId, horseName }) => {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <section className="stud-requests-area">
      <Button
        type="button"
        variant="secondary"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((was) => !was)}
      >
        Breeding requests
      </Button>
      {open && (
        <div id={listId} className="stud-requests-area__list">
          <RequestList side={side} horseId={horseId} horseName={horseName} />
        </div>
      )}
    </section>
  );
};

export default BreedingRequests;
