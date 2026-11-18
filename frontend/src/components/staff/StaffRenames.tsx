/**
 * StaffRenames: a steward renames a horse, a show or a player
 * (Equoria-puj1e.3, owner ruling q375).
 *
 * A horse or show is found by its number first, so the steward sees the current
 * name and its owner before renaming. Every rename needs a reason and goes to the
 * ledger. The server applies the players' own naming rules and decides who may be
 * renamed (never the owner, oneself, or another steward); its refusals show beside
 * the control, with what was typed kept.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Input, Textarea } from '@/components/ui/form';
import { InlineError } from '@/components/ui/state';
import { isCheckinRequired } from '@/hooks/api/useStaff';
import {
  useLookupHorseName,
  useLookupShowName,
  useRenameHorse,
  useRenamePlayer,
  useRenameShow,
} from '@/hooks/api/useStaffContent';
import { staffErrorMessage } from './staffMessages';
import StaffSection from './StaffSection';

const renameMessages = {
  400: 'Check the new name and the reason.',
  403: 'You cannot rename what this account owns.',
  404: 'That no longer exists.',
  409: 'That name is taken, or it changed while you were renaming it.',
};

function ReasonField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <FormField label="Reason" required>
      {(field) => (
        <Textarea
          {...field}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={2}
          maxLength={1000}
        />
      )}
    </FormField>
  );
}

type Found = { id: number; name: string; owner: string | null };

/** Find a horse or show by number, then rename it. */
function RenameByNumber({
  kind,
  find,
  rename,
}: {
  kind: 'horse' | 'show';
  find: ReturnType<typeof useLookupHorseName> | ReturnType<typeof useLookupShowName>;
  rename: (id: number, name: string, reason: string) => Promise<unknown>;
}) {
  const [number, setNumber] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const label = kind === 'horse' ? 'Horse' : 'Show';

  const look = (event: React.FormEvent) => {
    event.preventDefault();
    const id = Number(number.trim());
    if (!Number.isInteger(id) || id <= 0) return;
    setFound(null);
    find.mutate(id, {
      onSuccess: (row) =>
        setFound({
          id: row.id,
          name: row.name,
          owner: 'ownerUsername' in row ? row.ownerUsername : row.hostUsername,
        }),
    });
  };

  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!found || name === '' || reason.trim() === '') return;
    setPending(true);
    setError(null);
    try {
      await rename(found.id, name, reason.trim());
      // The visible change is the name itself, shown above the form.
      setFound({ ...found, name });
      setName('');
      setReason('');
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={look} className="flex flex-wrap items-end gap-3" noValidate>
        <FormField label={`${label} number`} className="min-w-0 flex-1">
          {(field) => (
            <Input
              {...field}
              inputMode="numeric"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              autoComplete="off"
            />
          )}
        </FormField>
        <Button
          type="submit"
          variant="secondary"
          pending={find.isPending}
          disabled={number.trim() === ''}
        >
          {`Find ${kind}`}
        </Button>
      </form>
      {find.isError && (
        <InlineError
          message={staffErrorMessage(find.error, { 404: `No ${kind} has that number.` })}
        />
      )}
      {found && (
        <form onSubmit={confirm} className="flex flex-col gap-3" noValidate>
          <p className="text-[var(--text-primary)]">
            {found.name}
            {found.owner && (
              <span className="text-role-secondary">
                {kind === 'horse' ? `, owned by ${found.owner}` : `, hosted by ${found.owner}`}
              </span>
            )}
          </p>
          <FormField label="New name" required>
            {(field) => (
              <Input {...field} value={name} onChange={(event) => setName(event.target.value)} />
            )}
          </FormField>
          <ReasonField value={reason} onChange={setReason} />
          <div className="flex flex-col items-start gap-2">
            <Button type="submit" pending={pending} disabled={name === '' || reason.trim() === ''}>
              {`Rename ${kind}`}
            </Button>
            {error !== null && <InlineError message={staffErrorMessage(error, renameMessages)} />}
          </div>
        </form>
      )}
    </div>
  );
}

function RenamePlayer() {
  const rename = useRenamePlayer();
  const [username, setUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [reason, setReason] = useState('');
  const ready = username.trim() !== '' && newUsername.trim() !== '' && reason.trim() !== '';

  const confirm = (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    rename.mutate(
      { username: username.trim(), newUsername: newUsername.trim(), reason: reason.trim() },
      {
        onSuccess: () => {
          setUsername('');
          setNewUsername('');
          setReason('');
        },
      }
    );
  };

  return (
    <form onSubmit={confirm} className="flex flex-col gap-3" noValidate>
      <FormField label="Player's username now">
        {(field) => (
          <Input
            {...field}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="off"
          />
        )}
      </FormField>
      <FormField label="New username" required>
        {(field) => (
          <Input
            {...field}
            value={newUsername}
            onChange={(event) => setNewUsername(event.target.value)}
            autoComplete="off"
          />
        )}
      </FormField>
      <ReasonField value={reason} onChange={setReason} />
      <div className="flex flex-col items-start gap-2">
        <Button type="submit" pending={rename.isPending} disabled={!ready}>
          Rename player
        </Button>
        {rename.isError && (
          <InlineError
            message={staffErrorMessage(rename.error, {
              ...renameMessages,
              400: 'A username is 3 to 30 letters, numbers or underscores, and needs a reason.',
              404: 'No player goes by that name.',
            })}
          />
        )}
        {rename.isSuccess && (
          <p className="text-sm text-role-secondary">Now called {rename.data.username}.</p>
        )}
      </div>
    </form>
  );
}

export interface StaffRenamesProps {
  onCheckinRequired: () => void;
}

export function StaffRenames({ onCheckinRequired }: StaffRenamesProps) {
  const findHorse = useLookupHorseName();
  const findShow = useLookupShowName();
  const renameHorse = useRenameHorse();
  const renameShow = useRenameShow();

  const lapsed = isCheckinRequired(findHorse.error) || isCheckinRequired(findShow.error);
  useEffect(() => {
    if (lapsed) {
      onCheckinRequired();
    }
  }, [lapsed, onCheckinRequired]);

  return (
    <StaffSection
      title="Names"
      intro="Rename a horse, a show or a player whose name breaks the rules. Every rename is written to the ledger."
    >
      <div className="flex flex-col gap-8">
        <div>
          <h3 className="mb-2 text-[var(--text-primary)]">A horse</h3>
          <RenameByNumber
            kind="horse"
            find={findHorse}
            rename={(horseId, name, reason) => renameHorse.mutateAsync({ horseId, name, reason })}
          />
        </div>
        <div>
          <h3 className="mb-2 text-[var(--text-primary)]">A show</h3>
          <RenameByNumber
            kind="show"
            find={findShow}
            rename={(showId, name, reason) => renameShow.mutateAsync({ showId, name, reason })}
          />
        </div>
        <div>
          <h3 className="mb-2 text-[var(--text-primary)]">A player</h3>
          <RenamePlayer />
        </div>
      </div>
    </StaffSection>
  );
}

export default StaffRenames;
