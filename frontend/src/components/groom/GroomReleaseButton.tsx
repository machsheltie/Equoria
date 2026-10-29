/**
 * GroomReleaseButton — Release on every hired groom's card (Equoria-hwboq).
 *
 * Owner ruling 2026-10-29 (q299, superseding q285's "only when the roster is full"): a
 * groom can be released any time, like riders. One click releases the groom to the
 * hiring pool: no confirmation, no receipt. A refusal is shown under it.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/state';
import { actionMessageFor } from '@/lib/http/actionMessage';
import { useReleaseGroom } from '@/hooks/api/useGrooms';

// A release that finds the groom already gone (another tab, the weekly pass).
const releaseRefused = { 404: 'That groom has already left your stable.' };

interface GroomReleaseButtonProps {
  groomId: number;
  groomName: string;
}

const GroomReleaseButton: React.FC<GroomReleaseButtonProps> = ({ groomId, groomName }) => {
  const release = useReleaseGroom();

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          release.reset();
          release.mutate(groomId);
        }}
        disabled={release.isPending}
        aria-busy={release.isPending || undefined}
        aria-label={`Release ${groomName}`}
        className="w-full mt-3"
        data-testid={`release-groom-${groomId}`}
      >
        {release.isPending ? 'Releasing...' : 'Release'}
      </Button>
      {release.isError && (
        <InlineError message={actionMessageFor(release.error, releaseRefused)} className="mt-2" />
      )}
    </>
  );
};

export default GroomReleaseButton;
