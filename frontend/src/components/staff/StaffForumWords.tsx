/**
 * StaffForumWords: the forum's blocked words and review words (Equoria-puj1e.3,
 * owner rulings q380 and q381). The Owner and Admins only; the office never
 * mounts it for a moderator, and the server refuses one anyway.
 *
 * A blocked word stops a new thread or reply from being posted (the player is
 * told it cannot be posted, never which word). A review word holds it for a
 * moderator in Held posts. Words match whole words only, ignoring capitals, so a
 * blocked "ass" leaves "class" alone. Adding or removing a word shows at once in
 * its list; every change is in the ledger.
 */

import React, { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form';
import { ErrorState, InlineError, SectionLoading } from '@/components/ui/state';
import { isCheckinRequired } from '@/hooks/api/useStaff';
import { useAddForumWord, useForumWords, useRemoveForumWord } from '@/hooks/api/useStaffContent';
import type { ForumWordEntry, ForumWordList } from '@/lib/api/staffContent';
import { userMessageFor } from '@/lib/http/userMessage';
import { staffErrorMessage } from './staffMessages';
import StaffSection from './StaffSection';

const addMessages = {
  400: 'Use a word or short phrase of letters and numbers.',
  409: 'That word is already on this list.',
};
const removeMessages = { 404: 'That word was already removed.' };

const listCopy: Record<ForumWordList, { title: string; hint: string; empty: string }> = {
  blocked: {
    title: 'Blocked words',
    hint: 'A post with one of these cannot be posted.',
    empty: 'No blocked words yet.',
  },
  review: {
    title: 'Review words',
    hint: 'A post with one of these waits for a moderator in Held posts.',
    empty: 'No review words yet.',
  },
};

function WordList({ list, words }: { list: ForumWordList; words: ForumWordEntry[] }) {
  const add = useAddForumWord();
  const remove = useRemoveForumWord();
  const [word, setWord] = useState('');
  const headingId = useId();
  const copy = listCopy[list];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (word.trim() === '' || add.isPending) return;
    remove.reset();
    add.mutate({ list, word: word.trim() }, { onSuccess: () => setWord('') });
  };

  return (
    <div aria-labelledby={headingId} role="group" data-testid={`forum-words-${list}`}>
      <h3 id={headingId} className="text-base font-semibold text-[var(--text-primary)]">
        {copy.title}
      </h3>
      <p className="mt-1 text-sm text-role-secondary">{copy.hint}</p>
      {words.length === 0 ? (
        <p className="mt-2 text-sm text-role-secondary">{copy.empty}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {words.map((entry) => (
            <li key={entry.id} className="flex items-center gap-1">
              <span className="text-[var(--text-primary)]">{entry.word}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${entry.word}`}
                pending={remove.isPending && remove.variables === entry.id}
                disabled={remove.isPending}
                onClick={() => {
                  add.reset();
                  remove.mutate(entry.id);
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3" noValidate>
        <FormField label={`Add to ${copy.title.toLowerCase()}`}>
          {(field) => (
            <Input
              {...field}
              value={word}
              onChange={(event) => setWord(event.target.value)}
              maxLength={50}
            />
          )}
        </FormField>
        <Button
          type="submit"
          variant="secondary"
          pending={add.isPending}
          disabled={word.trim() === ''}
        >
          Add
        </Button>
      </form>
      {add.isError && (
        <InlineError className="mt-2" message={staffErrorMessage(add.error, addMessages)} />
      )}
      {remove.isError && (
        <InlineError className="mt-2" message={staffErrorMessage(remove.error, removeMessages)} />
      )}
    </div>
  );
}

export interface StaffForumWordsProps {
  onCheckinRequired: () => void;
}

export function StaffForumWords({ onCheckinRequired }: StaffForumWordsProps) {
  const words = useForumWords();
  const lapsed = isCheckinRequired(words.error);
  useEffect(() => {
    if (lapsed) {
      onCheckinRequired();
    }
  }, [lapsed, onCheckinRequired]);

  let body: React.ReactNode;
  if (words.isPending) {
    body = <SectionLoading label="Loading the word lists" />;
  } else if (words.isError) {
    const { title, message } = userMessageFor(words.error);
    body = <ErrorState title={title} message={message} />;
  } else {
    body = (
      <div className="flex flex-col gap-8">
        <WordList list="blocked" words={words.data.blocked} />
        <WordList list="review" words={words.data.review} />
      </div>
    );
  }

  return (
    <StaffSection
      title="Forum words"
      intro="Whole words only, ignoring capitals: a blocked “ass” leaves “class” alone."
    >
      {body}
    </StaffSection>
  );
}

export default StaffForumWords;
