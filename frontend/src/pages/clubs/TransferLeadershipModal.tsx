/**
 * TransferLeadershipModal (extracted from ClubsPage — ClubsPage split under Equoria-m0ye2)
 *
 * President-only modal to transfer club leadership to another member. Loads
 * the club's members, excludes the current president, and drives the
 * transfer mutation with success / error states.
 */

import React, { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      data-testid="transfer-leadership-modal"
    >
      <div className="glass-panel w-full max-w-sm p-6 relative">
        <h3 className="text-base font-bold text-white/90 mb-1 flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-celestial-gold" />
          Transfer Leadership
        </h3>
        <p className="text-xs text-white/50 mb-4">
          Select a member to become the new president of{' '}
          <span className="text-white/70 font-medium">{membership.club.name}</span>.
        </p>

        {successMsg ? (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm p-3 mb-4">
            {successMsg}
          </div>
        ) : (
          <>
            {errorMsg && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 mb-3">
                {errorMsg}
              </div>
            )}

            {otherMembers.length === 0 ? (
              <p className="text-xs text-white/40 mb-4">
                No other members to transfer leadership to.
              </p>
            ) : (
              <select
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/40 mb-4"
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                data-testid="transfer-member-select"
              >
                <option value="">— Pick a member —</option>
                {otherMembers.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.username} ({m.role})
                  </option>
                ))}
              </select>
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
    </div>
  );
};
