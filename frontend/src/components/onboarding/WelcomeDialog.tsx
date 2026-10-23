/**
 * WelcomeDialog — the one-time welcome note (Equoria-kd2dd)
 *
 * Owner ruling 2026-10-23: the first time a new player enters the game after
 * completing the three-step signup, a popup greets her ONCE:
 *
 *   Welcome <player name>!
 *   Please review the new player guide!      (a link to the Guide)
 *   [ Continue ]                             (loads the News page)
 *
 * "Once" is the server flag User.settings.welcomeSeen (see isWelcomePending for
 * who is owed the note). Every way out records the flag first and only then
 * moves on: Continue and Escape go to /news, the guide link goes to /guide. If
 * the save fails the note stays up and says so beside Continue, which retries;
 * a player is never let through with the flag unsaved, so it cannot be lost.
 *
 * Built from the existing GameDialog (ceremonial title) and the gold Button, the
 * one gold action on this surface. The native Dialog primitive owns the focus
 * trap, focus restore and Escape; outside clicks are refused so the note is
 * only left on purpose. Styling is authored CSS over tokens (welcome.css).
 */

import React from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import { useMarkWelcomeSeen } from '@/hooks/api/useOnboarding';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/state';
import { userMessageFor } from '@/lib/http/userMessage';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
} from '@/components/ui/game';
import { isWelcomePending } from './welcomePending';
import '@/styles/welcome.css';

const guidePath = '/guide';
const newsPath = '/news';

export function WelcomeDialog() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const markSeen = useMarkWelcomeSeen();

  const open = isWelcomePending(user);

  /** Record the flag, then (and only then) travel. A repeat press while saving is ignored. */
  const leaveTo = (path: string) => {
    if (markSeen.isPending) return;
    markSeen.mutate(undefined, { onSuccess: () => navigate(path) });
  };

  const onGuideLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Let a new-tab / new-window gesture behave like any link; the note stays up.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    leaveTo(guidePath);
  };

  return (
    <GameDialog
      open={open}
      // Escape is Continue. The X is hidden and outside clicks are refused, so the
      // only ways out are the two the owner ruled.
      onOpenChange={(next) => {
        if (!next) leaveTo(newsPath);
      }}
    >
      <GameDialogContent
        size="sm"
        hideCloseButton
        noDescription
        className="welcome-note"
        onInteractOutside={(event) => event.preventDefault()}
        data-testid="welcome-note"
      >
        <GameDialogHeader className="welcome-note__header">
          <GameDialogTitle variant="ceremonial" className="welcome-note__title">
            Welcome {user?.username}!
          </GameDialogTitle>
        </GameDialogHeader>

        <p className="welcome-note__invitation">
          <Link to={guidePath} className="welcome-note__guide-link" onClick={onGuideLinkClick}>
            Please review the new player guide!
          </Link>
        </p>

        <div className="welcome-note__actions">
          <Button size="lg" pending={markSeen.isPending} onClick={() => leaveTo(newsPath)}>
            Continue
          </Button>
          {markSeen.isError && (
            <InlineError
              className="welcome-note__error"
              message={`${userMessageFor(markSeen.error).message} Press Continue to try again.`}
            />
          )}
        </div>
      </GameDialogContent>
    </GameDialog>
  );
}

export default WelcomeDialog;
