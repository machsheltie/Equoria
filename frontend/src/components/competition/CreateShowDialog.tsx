/**
 * CreateShowDialog: hosting a show (Equoria-oey96.13).
 *
 * Owner rulings 2026-10-23: a basic player may host ten shows a week; the prize
 * is ten times the entry fee, taken from the host when the show is made; the host
 * receives all the entry fees when the show is judged. A show is judged one week
 * after it is made (competition bible), so there is no date to pick.
 *
 * Three steps in one dialog: the details, a confirmation that states the exact
 * prize and the balance afterwards (money moves are stated before and receipted
 * after, PRODUCT.md), then the receipt. The server owns every number; the
 * balance check here only saves a round trip, and a server refusal is shown in
 * authored words.
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
import Currency from '@/components/ui/Currency';
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
import type { HostedShow } from '@/lib/api/showsApi';

const maxLevel = 20;
const maxEntryFee = 100_000;
const prizeMultiplier = 10;
const msPerWeek = 7 * 24 * 60 * 60 * 1000;
const levels = Array.from({ length: maxLevel }, (_, i) => String(i + 1));

type Step = 'details' | 'confirm' | 'receipt';

interface FieldErrors {
  name?: string;
  discipline?: string;
  entryFee?: string;
}

export interface CreateShowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const Money = ({ amount, testId }: { amount: number; testId: string }) => (
  <span data-testid={testId}>
    <Currency amount={amount} />
  </span>
);

const CreateShowDialog = ({ open, onOpenChange }: CreateShowDialogProps): JSX.Element => {
  const { user } = useAuth();
  const hosting = useShowHosting(open);
  const disciplines = useDisciplines();
  const createShow = useCreateShow();

  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [level, setLevel] = useState('1');
  const [entryFee, setEntryFee] = useState<string>('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [hosted, setHosted] = useState<HostedShow | null>(null);

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

  const review = () => {
    const next: FieldErrors = {};
    if (name.trim().length < 2) next.name = 'Give your show a name of at least two characters.';
    if (discipline === '') next.discipline = 'Choose a discipline.';
    if (!feeIsValid) next.entryFee = 'The entry fee is a whole number of coins, from 0 to 100,000.';
    else if (cannotCover) next.entryFee = createShowRefusalCodes.insufficientFunds;
    setErrors(next);
    if (Object.keys(next).length === 0) {
      createShow.reset();
      setStep('confirm');
    }
  };

  const host = () => {
    createShow.mutate(
      { name: name.trim(), discipline, level: Number(level), entryFee: fee },
      {
        onSuccess: ({ show }) => {
          setHosted(show);
          setStep('receipt');
        },
      }
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

            {step === 'details' && (
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
                  description="Coins each entrant pays. You receive all of them when the show is judged."
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

                {prize !== null && (
                  <p
                    className="text-sm text-[var(--text-secondary)]"
                    data-testid="create-show-balance-hint"
                  >
                    The prize is ten times the entry fee: <Currency amount={prize} />
                    {prize > 0 && balance !== undefined && (
                      <>
                        , taken from your <Currency amount={balance} /> when you host.
                      </>
                    )}
                  </p>
                )}

                <p className="text-sm text-[var(--text-muted)]">
                  Your show is judged one week after you host it, on {judgedOn}.
                </p>

                {weekIsFull && (
                  <InlineError message={`${createShowRefusalCodes.weeklyShowLimitReached}`} />
                )}
              </div>
            )}

            {step === 'confirm' && prize !== null && (
              <div className="space-y-4" data-testid="create-show-confirm">
                <dl className="space-y-2 rounded-lg bg-[var(--alpha-bg-midnight-50)] p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--text-secondary)]">Show</dt>
                    <dd className="text-right font-medium text-[var(--text-primary)]">
                      {name.trim()}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--text-secondary)]">Discipline</dt>
                    <dd className="text-right text-[var(--text-primary)]">{discipline}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--text-secondary)]">Level</dt>
                    <dd className="text-right text-[var(--text-primary)]">{level}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--text-secondary)]">Entry fee</dt>
                    <dd className="text-right text-[var(--text-primary)]">
                      <Currency amount={fee} zeroLabel="Free" />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--text-secondary)]">Judged</dt>
                    <dd className="text-right text-[var(--text-primary)]">{judgedOn}</dd>
                  </div>
                </dl>

                <div className="rounded-lg border border-[var(--gold-400)]/40 bg-[var(--alpha-gold-primary-10)] p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="font-medium text-[var(--text-primary)]">
                      Prize taken from you now
                    </span>
                    <span className="font-bold text-[var(--text-primary)]">
                      <Money amount={prize} testId="create-show-prize" />
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between gap-4 text-[var(--text-secondary)]">
                    <span>Your coins now</span>
                    <Money amount={balance ?? Number.NaN} testId="create-show-balance-now" />
                  </div>
                  <div className="flex justify-between gap-4 text-[var(--text-secondary)]">
                    <span>Your coins after hosting</span>
                    <Money
                      amount={balance === undefined ? Number.NaN : balance - prize}
                      testId="create-show-balance-after"
                    />
                  </div>
                  <p className="mt-3 text-[var(--text-secondary)]">
                    {prize > 0
                      ? 'The prize is paid to the winners when the show is judged. You receive all the entry fees.'
                      : 'With no entry fee there is no prize, and no coins are taken. You receive all the entry fees, if there are any.'}
                  </p>
                </div>

                {submitError && <InlineError message={submitError} />}
              </div>
            )}

            {step === 'receipt' && hosted && (
              <div className="space-y-3" data-testid="create-show-receipt">
                <p className="text-[var(--text-primary)]">
                  <span className="font-semibold">{hosted.name}</span> is open in the Arena.
                </p>
                <div className="rounded-lg bg-[var(--alpha-bg-midnight-50)] p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-[var(--text-secondary)]">
                      Taken from your coins for the prize
                    </span>
                    <Money amount={hosted.prize} testId="create-show-receipt-taken" />
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[var(--text-secondary)]">Your coins now</span>
                    <Money amount={balance ?? Number.NaN} testId="create-show-receipt-balance" />
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[var(--text-secondary)]">Judged</span>
                    <span className="text-[var(--text-primary)]">{formatDate(hosted.runDate)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </GameDialogBody>

        <GameDialogFooter>
          {step === 'details' && (
            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="button" onClick={review} disabled={weekIsFull}>
                Review Show
              </Button>
            </div>
          )}
          {step === 'confirm' && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('details')}
                disabled={createShow.isPending}
              >
                Change Details
              </Button>
              <Button type="button" onClick={host} pending={createShow.isPending}>
                Host This Show
              </Button>
            </div>
          )}
          {step === 'receipt' && (
            <Button type="button" onClick={close}>
              Done
            </Button>
          )}
        </GameDialogFooter>
      </GameDialogContent>
    </GameDialog>
  );
};

export default CreateShowDialog;
