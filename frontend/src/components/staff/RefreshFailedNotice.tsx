/**
 * RefreshFailedNotice — a background refresh failed while the last good data
 * stays on screen (Steward's Office, Task 4 review carry-over).
 *
 * The data is kept, so nothing is lost; the notice says it may be out of date
 * and offers a retry. Shared copy only: the server's text is never shown.
 */

import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/state';
import { staffErrorMessage } from './staffMessages';

export interface RefreshFailedNoticeProps {
  /** What failed to refresh, as it reads in a sentence: "the tickets". */
  what: string;
  error: unknown;
  onRetry: () => void;
  pending: boolean;
}

export function RefreshFailedNotice({ what, error, onRetry, pending }: RefreshFailedNoticeProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <InlineError
        message={`Could not refresh ${what}; this may be out of date. ${staffErrorMessage(error)}`}
      />
      <Button variant="outline" size="sm" onClick={onRetry} pending={pending}>
        Try again
      </Button>
    </div>
  );
}

export default RefreshFailedNotice;
