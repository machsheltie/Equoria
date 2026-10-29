/**
 * GroomReleaseButton — Release on a groom card when the groom roster is full
 * (owner ruling 2026-10-29, q285, Equoria-hwboq).
 *
 * One click releases the groom to the hiring pool: no confirmation, no receipt. The
 * limit and the working-groom count come from the server (GET /api/v1/grooms/roster-cap);
 * with room on the roster the button is not shown. A refusal is shown under it.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/state';
import { actionMessageFor } from '@/lib/http/actionMessage';
import { useGroomRosterLimit, useReleaseGroom } from '@/hooks/api/useGrooms';

// A release that finds the groom already gone (another tab, the weekly pass).
const releaseRefused = { 404: 'That groom has already left your stable.' };

interface GroomReleaseButtonProps {
  groomId: number;
  groomName: string;
}

const GroomReleaseButton: React.FC<GroomReleaseButtonProps> = ({ groomId, groomName }) => {
  const rosterLimit = useGroomRosterLimit();
  const release = useReleaseGroom();
  const rosterFull =
    rosterLimit.data !== undefined && rosterLimit.data.activeGrooms >= rosterLimit.data.rosterCap;
  if (!rosterFull) return null;

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
