/**
 * TransferLeadershipModal (extracted from ClubsPage — ClubsPage split under Equoria-m0ye2)
 *
 * President-only modal to transfer club leadership to another member. Loads
 * the club's members, excludes the current president, and drives the
 * transfer mutation with success / error states.
 *
 * Migrated to GameDialog (canonical dialog base, DECISIONS.md §8) under the
 * Equoria-o5hub community lane — replaces the page-local fixed-inset overlay
 * and its nested backdrop-blur. Form control + states use the canonical
 * Select / InlineError / role tokens.
 */

import React, { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
} from '@/components/ui/game';
import { Select } from '@/components/ui/form';
import { InlineError } from '@/components/ui/state';
import { useClub, useTransferLeadership } from '@/hooks/api/useClubs';
import type { ClubMembership } from '@/lib/api-client';

export const TransferLeadershipModal: React.FC<{
  membership: ClubMembership;
  onClose: () => void;
}> = ({ membership, onClose }) => {
  const { data: clubData } = useClub(membership.club.id);
  const transferLeadership = useTransferLeadership();
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Members of the club excluding the current president
  const otherMembers = (clubData?.club?.members ?? []).filter(
    (m) => m.user.id !== membership.club.leader.id
  );

  const handleTransfer = async () => {
    if (!selectedMemberId) return;
    setErrorMsg('');
    try {
      await transferLeadership.mutateAsync({
        clubId: membership.club.id,
        newPresidentId: selectedMemberId,
      });
      setSuccessMsg('Leadership transferred successfully.');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to transfer leadership.';
      setErrorMsg(msg);
    }
  };

  return (
    <GameDialog open onOpenChange={(open) => !open && onClose()}>
      <GameDialogContent size="sm" data-testid="transfer-leadership-modal">
        <GameDialogHeader>
          <GameDialogTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="w-4 h-4" aria-hidden="true" />
            Transfer Leadership
          </GameDialogTitle>
          <GameDialogDescription>
            Select a member to become the new president of{' '}
            <span className="text-role-secondary font-medium">{membership.club.name}</span>.
          </GameDialogDescription>
        </GameDialogHeader>

        <div className="pt-4">
          {successMsg ? (
            <div
              role="status"
              className="rounded-[var(--radius-md)] bg-[var(--role-success-bg)] border border-[var(--role-success-border)] text-[var(--role-success-text)] text-sm p-3 mb-4"
            >
              {successMsg}
            </div>
          ) : (
            <>
              {errorMsg && <InlineError message={errorMsg} className="mb-3" />}

              {otherMembers.length === 0 ? (
                <p className="text-xs text-role-muted mb-4">
                  No other members to transfer leadership to.
                </p>
              ) : (
                <Select
                  className="mb-4"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  data-testid="transfer-member-select"
                  aria-label="New president"
                >
                  <option value="">— Pick a member —</option>
                  {otherMembers.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.username} ({m.role})
                    </option>
                  ))}
                </Select>
              )}

              <div className="flex gap-3 justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedMemberId || transferLeadership.isPending}
                  onClick={handleTransfer}
                  data-testid="transfer-confirm-btn"
                >
                  {transferLeadership.isPending ? 'Transferring…' : 'Confirm Transfer'}
                </Button>
              </div>
            </>
          )}

          {successMsg && (
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </GameDialogContent>
    </GameDialog>
  );
};
