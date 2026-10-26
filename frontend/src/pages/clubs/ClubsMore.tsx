/**
 * ClubsMore: the one quiet way to read on when a club list runs past a hundred
 * (Equoria-uob0o). A single secondary button that asks the server for the next
 * page by its cursor; if that read fails the clubs already shown stay put and
 * the failure is said in words beside the button. Renders nothing on the last page.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/state';
import { userMessageFor } from '@/lib/http/userMessage';

export interface ClubsMoreProps {
  /** Wired from the list query: `hasNextPage`. */
  hasMore: boolean;
  /** Wired from the list query: `isFetchNextPageError`. */
  failed?: boolean;
  error?: unknown;
  pending: boolean;
  onMore: () => void;
  /** What the next page holds, e.g. "clubs" or "elections". */
  noun: string;
  testId: string;
}

export const ClubsMore: React.FC<ClubsMoreProps> = ({
  hasMore,
  failed,
  error,
  pending,
  onMore,
  noun,
  testId,
}) => {
  if (!hasMore && !failed) return null;
  return (
    <div className="mt-4 flex flex-col items-center gap-2" data-testid={testId}>
      {failed && (
        <InlineError message={`More ${noun} didn't load. ${userMessageFor(error).message}`} />
      )}
      <Button type="button" variant="secondary" size="sm" onClick={onMore} pending={pending}>
        {`Show more ${noun}`}
      </Button>
    </div>
  );
};
