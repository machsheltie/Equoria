/**
 * NeedHelpPage — the team a player can ask for help (Equoria-vc5x1)
 *
 * Owner request 2026-10-23: the "!" button in the top bar opens this page. It
 * lists the Owner / Head Admin, the Admins and the Moderators by name, each with
 * a glowing status mark that always carries the word Online or Offline (never
 * colour alone). A player picks anyone and writes to them through the ordinary
 * Messages system; the server enforces the anti-abuse rules and this page shows
 * its authored refusals.
 *
 * Composition: a title standing alone over the scene, then the team as three
 * open rolls separated by hairlines. No cards, no table. The compose field
 * opens under the person chosen.
 *
 * Authored CSS over tokens lives in styles/needHelp.css (the online/offline
 * colour pair is defined there once).
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Textarea } from '@/components/ui/form';
import { ErrorState, InlineError, SectionLoading } from '@/components/ui/state';
import { useAuth } from '@/contexts/AuthContext';
import { useHelpStaff } from '@/hooks/api/useHelp';
import { useSendMessage } from '@/hooks/api/useMessages';
import type { HelpStaffMember } from '@/lib/api-client';
import { userMessageFor } from '@/lib/http/userMessage';
import '@/styles/needHelp.css';

const helpSubject = 'Need Help?';
const maxHelpMessageLength = 10000;

/** Authored refusals for the server's help rules. The codes are never shown. */
const refusalCopy: Record<string, string> = {
  helpOpenConversation:
    'You already have a conversation open with someone on the team. Please wait for their reply before reaching out to someone else.',
  helpDuplicateContent:
    'You have already sent this same message to another member of the team. Please give them time to answer before sending it again.',
  helpCooldown:
    'You wrote to the team a moment ago. Please wait a little while before sending another message.',
};

function refusalMessage(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(refusalCopy, code)) {
    return refusalCopy[code];
  }
  return userMessageFor(error).message;
}

/** The glowing circular status pill: mark plus word, never colour alone. */
export const PresencePill: React.FC<{ online: boolean }> = ({ online }) => (
  <span className={`presence ${online ? 'presence--online' : 'presence--offline'}`}>
    <span className="presence__dot" aria-hidden="true" />
    <span>{online ? 'Online' : 'Offline'}</span>
  </span>
);

const Compose: React.FC<{ person: HelpStaffMember; onDone: () => void }> = ({ person, onDone }) => {
  const [content, setContent] = useState('');
  const [sent, setSent] = useState(false);
  const send = useSendMessage();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = content.trim();
    if (!text || send.isPending) return;
    send.mutate(
      { recipientId: person.id, subject: helpSubject, content: text },
      {
        onSuccess: () => {
          setContent('');
          setSent(true);
        },
      }
    );
  };

  if (sent) {
    return (
      <>
        <p className="need-help__sent" role="status">
          Your message has gone to {person.username}. Their reply will arrive in your Messages.
        </p>
        <Button type="button" variant="ghost" onClick={onDone}>
          Close
        </Button>
      </>
    );
  }

  return (
    <form className="need-help__compose" onSubmit={submit}>
      <FormField label={`Your message to ${person.username}`}>
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            value={content}
            maxLength={maxHelpMessageLength}
            onChange={(event) => {
              setContent(event.target.value);
            }}
          />
        )}
      </FormField>
      {send.isError && <InlineError message={refusalMessage(send.error)} />}
      <div>
        <Button type="submit" pending={send.isPending} disabled={!content.trim()}>
          Send message
        </Button>{' '}
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

const Roll: React.FC<{
  id: string;
  title: string;
  emptyText: string;
  people: HelpStaffMember[];
  selfId: string | undefined;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}> = ({ id, title, emptyText, people, selfId, selectedId, onSelect }) => (
  <section className="need-help__section" aria-labelledby={id}>
    <h2 className="need-help__heading" id={id}>
      {title}
    </h2>
    {people.length === 0 ? (
      <p className="need-help__note">{emptyText}</p>
    ) : (
      <ul className="need-help__people">
        {people.map((person) => (
          <li key={person.id} className="need-help__person">
            <div className="need-help__row">
              <span className="need-help__name">{person.username}</span>
              <PresencePill online={person.online} />
              {person.id !== selfId && (
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={`Message ${person.username}`}
                  aria-expanded={selectedId === person.id}
                  onClick={() => {
                    onSelect(selectedId === person.id ? null : person.id);
                  }}
                >
                  Message
                </Button>
              )}
            </div>
            {selectedId === person.id && (
              <Compose
                person={person}
                onDone={() => {
                  onSelect(null);
                }}
              />
            )}
          </li>
        ))}
      </ul>
    )}
  </section>
);

const NeedHelpPage: React.FC = () => {
  const { user } = useAuth();
  const staff = useHelpStaff();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selfId = user?.id === undefined ? undefined : String(user.id);

  let body: React.ReactNode;
  if (staff.isPending) {
    body = <SectionLoading label="Finding the team" />;
  } else if (staff.isError) {
    const copy = userMessageFor(staff.error);
    body = (
      <ErrorState
        title="Couldn't reach the team"
        message={copy.message}
        retry={{ label: 'Try Again', onClick: () => void staff.refetch() }}
      />
    );
  } else {
    const rollProps = { selfId, selectedId, onSelect: setSelectedId };
    body = (
      <>
        <Roll
          id="need-help-owner"
          title="Owner / Head Admin"
          emptyText="No one is listed here yet."
          people={staff.data.owner}
          {...rollProps}
        />
        <Roll
          id="need-help-admin"
          title="Admin"
          emptyText="No admins are listed yet."
          people={staff.data.admin}
          {...rollProps}
        />
        <Roll
          id="need-help-moderators"
          title="Moderators"
          emptyText="No moderators are listed yet."
          people={staff.data.moderator}
          {...rollProps}
        />
      </>
    );
  }

  return (
    <div className="need-help">
      <header className="need-help__hero">
        <h1 className="need-help__title">Need Help?</h1>
        <p className="need-help__lede">
          Choose someone from the team and write to them. You can have one conversation open at a
          time, so pick the person you would like to hear from.
        </p>
      </header>
      {body}
    </div>
  );
};

export default NeedHelpPage;
