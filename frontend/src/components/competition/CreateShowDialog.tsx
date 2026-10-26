/**
 * CreateShowDialog: hosting a show (Equoria-oey96.13, simplified Equoria-o08zw).
 *
 * Owner rulings 2026-10-23: a basic player may host ten shows a week; the prize
 * is ten times the entry fee, taken from the host when the show is made; the host
 * receives all the entry fees when the show is judged. A show is judged one week
 * after it is made (competition bible), so there is no date to pick.
 *
 * Owner ruling 2026-10-26: "This is just a game." One form, one click. The prize
 * is stated on the button; there is no balance preview, confirm step or receipt.
 * The server owns every number; the balance check here only saves a round trip,
 * and a server refusal is shown in authored words.
 */

import { type JSX, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';
import { Button } from '@/components/ui/button';
import { FormField, Input, NumberInput, Select } from '@/components/ui/form';
import { InlineError } from '@/components/ui/state';
import { useAuth } from '@/contexts/AuthContext';
import { useDisciplines } from '@/hooks/api/useCompetitions';
import { useCreateShow, useShowHosting } from '@/hooks/api/useShowHosting';
import { formatDate } from '@/lib/formatDate';
import {
  actionMessageFor,
  createShowRefusalCodes,
  createShowRefused,
} from '@/lib/http/actionMessage';
import { userMessageFor } from '@/lib/http/userMessage';

const maxLevel = 20;
const maxEntryFee = 100_000;
const prizeMultiplier = 10;
const msPerWeek = 7 * 24 * 60 * 60 * 1000;
const levels = Array.from({ length: maxLevel }, (_, i) => String(i + 1));

interface FieldErrors {
  name?: string;
  discipline?: string;
  entryFee?: string;
}

export interface CreateShowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateShowDialog = ({ open, onOpenChange }: CreateShowDialogProps): JSX.Element => {
  const { user } = useAuth();
  const hosting = useShowHosting(open);
  const disciplines = useDisciplines();
  const createShow = useCreateShow();

  const [name, setName] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [level, setLevel] = useState('1');
  const [entryFee, setEntryFee] = useState<string>('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const balance = user?.money;
  const fee = Number(entryFee);
  const feeIsValid =
    entryFee.trim() !== '' && Number.isInteger(fee) && fee >= 0 && fee <= maxEntryFee;
  const prize = feeIsValid ? prizeMultiplier * fee : null;
  const cannotCover = prize !== null && balance !== undefined && prize > balance;
  const weekIsFull =
    hosting.data !== undefined && hosting.data.hostedThisWeek >= hosting.data.weeklyLimit;
  const judgedOn = useMemo(() => formatDate(new Date(Date.now() + msPerWeek)), []);
  const submitError = createShow.isError
    ? actionMessageFor(createShow.error, createShowRefused, createShowRefusalCodes)
    : undefined;

  const host = () => {
    const next: FieldErrors = {};
    if (name.trim().length < 2) next.name = 'Give your show a name of at least two characters.';
    if (discipline === '') next.discipline = 'Choose a discipline.';
    if (!feeIsValid) next.entryFee = 'The entry fee is a whole number of coins, from 0 to 100,000.';
    else if (cannotCover) next.entryFee = createShowRefusalCodes.insufficientFunds;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    createShow.mutate(
      { name: name.trim(), discipline, level: Number(level), entryFee: fee },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const close = () => {
    if (!createShow.isPending) onOpenChange(false);
  };

  const weeklyCount = hosting.data
    ? `${hosting.data.hostedThisWeek} of ${hosting.data.weeklyLimit} shows this week`
    : null;

  return (
    <GameDialog open={open} onOpenChange={(next) => !next && close()}>
      <GameDialogContent size="md" data-testid="create-show-dialog">
        <GameDialogHeader>
          <GameDialogTitle>Host a Show</GameDialogTitle>
          <GameDialogDescription>
            Choose a discipline and a level, set the entry fee, and open your own show to the Arena.
          </GameDialogDescription>
        </GameDialogHeader>

        <GameDialogBody>
          <div className="space-y-5 pt-2">
            <div
              className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
              data-testid="create-show-weekly-count"
            >
              <Trophy className="h-4 w-4 text-[var(--gold-400)]" aria-hidden="true" />
              {weeklyCount ? (
                <span>{weeklyCount}</span>
              ) : hosting.isError ? (
                <span className="flex items-center gap-2">
                  <InlineError message="This week's count didn't load." />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => hosting.refetch()}
                  >
                    Try Again
                  </Button>
                </span>
              ) : (
                <span role="status">Counting this week&rsquo;s shows&hellip;</span>
              )}
            </div>

            <div className="space-y-4" data-testid="create-show-details">
              <FormField label="Show name" required error={errors.name}>
                {(field) => (
                  <Input
                    {...field}
                    value={name}
                    maxLength={60}
                    autoComplete="off"
                    onChange={(e) => setName(e.target.value)}
                  />
                )}
              </FormField>

              <FormField label="Discipline" required error={errors.discipline}>
                {(field) => (
                  <Select
                    {...field}
                    value={discipline}
                    placeholder="Choose a discipline"
                    onChange={(e) => setDiscipline(e.target.value)}
                    options={(disciplines.data?.disciplines ?? []).map((d) => ({
                      value: d,
                      label: d,
                    }))}
                  />
                )}
              </FormField>
              {disciplines.isError && (
                <div className="flex items-center gap-2">
                  <InlineError message={userMessageFor(disciplines.error).message} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => disciplines.refetch()}
                  >
                    Try Again
                  </Button>
                </div>
              )}

              <FormField label="Level" description="Only horses at this level can enter.">
                {(field) => (
                  <Select
                    {...field}
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    options={levels.map((l) => ({ value: l, label: l }))}
                  />
                )}
              </FormField>

              <FormField
                label="Entry fee"
                required
                description="Coins each entrant pays. You receive all of them when the show is judged. The prize is ten times the entry fee, paid by you now."
                error={errors.entryFee}
              >
                {(field) => (
                  <NumberInput
                    {...field}
                    min={0}
                    max={maxEntryFee}
                    value={entryFee}
                    onChange={(v) => setEntryFee(String(v))}
                  />
                )}
              </FormField>

              <p className="text-sm text-[var(--text-muted)]">
                Your show is judged one week after you host it, on {judgedOn}.
              </p>

              {weekIsFull && (
                <InlineError message={`${createShowRefusalCodes.weeklyShowLimitReached}`} />
              )}
              {submitError && <InlineError message={submitError} />}
            </div>
          </div>
        </GameDialogBody>

        <GameDialogFooter>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={close}
              disabled={createShow.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={host}
              pending={createShow.isPending}
              disabled={weekIsFull}
            >
              {prize === null
                ? 'Host Show'
                : prize === 0
                  ? 'Host Show (free)'
                  : `Host Show (prize ${prize.toLocaleString('en-US')})`}
            </Button>
          </div>
        </GameDialogFooter>
      </GameDialogContent>
    </GameDialog>
  );
};

export default CreateShowDialog;
