/**
 * Accept or reject one Private Stud request (Equoria-q4uem.9).
 *
 * Owner rulings q95/q108 (2026-10-26/27): the stallion owner opens the mare
 * read-only, then accepts or rejects. Accepting moves the fee and puts the mare
 * in foal; rejecting tells the mare owner "declined", with no note.
 *
 * Equoria-e7tgc.10: after an answer the list refetches, so the request may no
 * longer be pending. The parent keeps this mounted for a request answered here
 * and passes `open={false}`: the buttons go, the line saying what happened (or
 * the refusal) stays.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/state';
import { useAnswerStudRequest } from '@/hooks/api/useStuds';
import { requestAnswerRefusal } from './studBreeding';

export interface RequestAnswerProps {
  requestId: number;
  mareName: string;
  stallionName: string;
  fee: number;
  mareOwnerName: string;
  /** False once the request is no longer pending: no buttons, only what happened. */
  open?: boolean;
  /** Told when the player presses Accept or Reject. */
  onAnswer?: () => void;
}

const RequestAnswer: React.FC<RequestAnswerProps> = ({
  requestId,
  mareName,
  stallionName,
  fee,
  mareOwnerName,
  open = true,
  onAnswer,
}) => {
  const answer = useAnswerStudRequest();
  const [said, setSaid] = useState<string | null>(null);

  const reply = (choice: 'approve' | 'reject') => {
    onAnswer?.();
    answer.mutate(
      { requestId, answer: choice },
      {
        onSuccess: () =>
          setSaid(
            choice === 'approve'
              ? `${mareName} is in foal to ${stallionName}. ${mareOwnerName} has been told.`
              : `You declined ${mareName}. ${mareOwnerName} has been told.`
          ),
      }
    );
  };

  if (said) {
    return (
      <p className="stud-breed__done-line" role="status">
        {said}
      </p>
    );
  }

  return (
    <div className="stud-answer">
      {open && (
        <div className="stud-answer__buttons">
          <Button type="button" disabled={answer.isPending} onClick={() => reply('approve')}>
            Accept {mareName} ({fee.toLocaleString()})
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={answer.isPending}
            onClick={() => reply('reject')}
          >
            Reject
          </Button>
        </div>
      )}
      {answer.isPending && (
        <p className="stud-quiet" role="status">
          Sending your answer…
        </p>
      )}
      {answer.isError && <InlineError message={requestAnswerRefusal(answer.error)} />}
    </div>
  );
};

export default RequestAnswer;
