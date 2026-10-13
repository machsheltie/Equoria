/**
 * RoleChangeDialog — confirm a promotion or revocation (Equoria-puj1e.1).
 *
 * A routine destructive/administrative confirmation on the shared GameDialog.
 * The reason is required (non-blank) and survives a failed attempt; the
 * dialog cannot be dismissed while the change is in flight.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Textarea } from '@/components/ui/form';
import {
  GameDialog,
  GameDialogContent,
  GameDialogDescription,
  GameDialogFooter,
  GameDialogHeader,
  GameDialogTitle,
} from '@/components/ui/game/GameDialog';
import { InlineError } from '@/components/ui/state';
import { useSetUserRole } from '@/hooks/api/useStaff';
import type { StaffMember } from '@/lib/api/staff';
import { staffErrorMessage } from './staffMessages';

export interface RoleChange {
  member: StaffMember;
  toRole: 'moderator' | 'user';
}

export interface RoleChangeDialogProps {
  change: RoleChange | null;
  onClose: () => void;
  /** The account with its new role, after the server accepted the change. */
  onChanged: (member: StaffMember) => void;
}

const ROLE_MESSAGES = {
  400: 'Write a reason first.',
  403: "This account's role can't be changed here.",
  404: 'That player no longer exists.',
  409: 'That account changed meanwhile, or it needs a verified email to become a moderator. Look it up again and retry.',
};

export function RoleChangeDialog({ change, onClose, onChanged }: RoleChangeDialogProps) {
  const [reason, setReason] = useState('');
  const setRole = useSetUserRole();
  const { reset } = setRole;

  // A new target starts with a blank reason and no stale error.
  const targetKey = change ? `${change.member.id}:${change.toRole}` : null;
  useEffect(() => {
    setReason('');
    reset();
  }, [targetKey, reset]);

  if (!change) {
    return null;
  }

  const { member, toRole } = change;
  const promoting = toRole === 'moderator';
  const trimmed = reason.trim();

  const confirm = () => {
    if (trimmed === '') {
      return;
    }
    setRole.mutate(
      { userId: member.id, role: toRole, reason: trimmed },
      {
        onSuccess: (updated) => {
          onChanged(updated);
          onClose();
        },
      }
    );
  };

  return (
    <GameDialog
      open
      onOpenChange={(open) => {
        if (!open && !setRole.isPending) {
          onClose();
        }
      }}
    >
      <GameDialogContent
        size="sm"
        onInteractOutside={(event) => {
          if (setRole.isPending) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (setRole.isPending) event.preventDefault();
        }}
      >
        <GameDialogHeader>
          <GameDialogTitle>
            {promoting
              ? `Make ${member.username} a moderator?`
              : `Revoke ${member.username}'s moderator role?`}
          </GameDialogTitle>
          <GameDialogDescription>
            {promoting
              ? 'They will check in by email before using any staff tool.'
              : 'Their staff access ends on their next request.'}{' '}
            Your reason goes in the ledger.
          </GameDialogDescription>
        </GameDialogHeader>

        <div className="py-4">
          <FormField label="Reason" required>
            {(field) => (
              <Textarea
                {...field}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={1000}
              />
            )}
          </FormField>
        </div>

        <GameDialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={setRole.isPending}>
            Cancel
          </Button>
          <div className="flex flex-col items-end gap-2">
            <Button
              variant={promoting ? 'default' : 'destructive'}
              onClick={confirm}
              pending={setRole.isPending}
              disabled={trimmed === ''}
            >
              {promoting ? 'Make moderator' : 'Revoke role'}
            </Button>
            {setRole.isError && (
              <InlineError message={staffErrorMessage(setRole.error, ROLE_MESSAGES)} />
            )}
          </div>
        </GameDialogFooter>
      </GameDialogContent>
    </GameDialog>
  );
}

export default RoleChangeDialog;
