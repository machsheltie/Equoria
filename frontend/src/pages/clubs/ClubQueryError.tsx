/**
 * ClubQueryError — a failed club read inside a card or list row (Equoria-1rsb7).
 *
 * FRONTEND_ASYNC_STATE_DOCTRINE §1: a failed fetch is an error with a retry, never
 * an empty state. Copy comes from `userMessageFor` (class-mapped, never the
 * server's words); retry is offered only where retrying can help. Sized for a
 * single election card or club row, where a full `ErrorState` panel would
 * swamp the content around it.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/state';
import { userMessageFor } from '@/lib/http/userMessage';

export const ClubQueryError: React.FC<{
  error: unknown;
  onRetry: () => void;
  className?: string;
}> = ({ error, onRetry, className }) => {
  const { message, retryable } = userMessageFor(error);
  return (
    <div className={className}>
      <InlineError message={message} />
      {retryable && (
        <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
};

export default ClubQueryError;
