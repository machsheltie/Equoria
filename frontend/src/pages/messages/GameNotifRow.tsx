/**
 * GameNotifRow + renderers (extracted from MessagesPage — Equoria-w2kyx)
 *
 * The game-notification row family: a shared GameNotifShell (unread dot,
 * avatar, badge, timestamp layout) plus per-type renderers (stat gain,
 * foal born, groom retired, unknown) and the GameNotifRow dispatcher that
 * selects a renderer by notif.type. Kept together because they form one
 * cohesive notification-rendering unit.
 *
 * Migrated to canonical primitives (Equoria-o5hub community lane):
 * Surface panel rows (static — no hover lift), GameBadge type badges,
 * role-token icon tints. Unread indicators use the info role — the single
 * semantic unread treatment shared with MessageRow and the tab badges.
 */

import React from 'react';
import { Circle, CheckCircle2, Clock } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { GameBadge, type GameBadgeProps } from '@/components/ui/game';
import type { GameNotification } from '@/lib/api-client';
import { relativeTime } from './constants';

// Row shell shared across notification renderers — keeps unread dot, layout,
// and timestamp consistent so dispatch only varies the icon/label/body.
const GameNotifShell: React.FC<{
  notif: GameNotification;
  iconBg: string;
  emoji: string;
  badgeLabel: string;
  badgeVariant: GameBadgeProps['variant'];
  title: string;
  body: React.ReactNode;
}> = ({ notif, iconBg, emoji, badgeLabel, badgeVariant, title, body }) => (
  <Surface
    variant="panel"
    className={!notif.isRead ? 'border-[var(--role-info-border)]' : undefined}
    data-testid={`game-notif-${notif.id}`}
    data-notif-type={notif.type}
  >
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-1">
        {!notif.isRead ? (
          <Circle className="w-2 h-2 fill-[var(--status-info)] text-[var(--status-info)]" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-role-disabled" />
        )}
      </div>

      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full ${iconBg} flex items-center justify-center border border-[var(--glass-border)]`}
        aria-hidden="true"
      >
        <span className="text-xs">{emoji}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span
              className={`text-sm font-semibold break-words min-w-0 ${
                !notif.isRead ? 'text-role-primary' : 'text-role-secondary'
              }`}
            >
              {title}
            </span>
            <GameBadge variant={badgeVariant} className="text-[10px]">
              {badgeLabel}
            </GameBadge>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-role-muted flex-shrink-0">
            <Clock className="w-3 h-3" aria-hidden="true" />
            {relativeTime(notif.createdAt)}
          </div>
        </div>
        <div className="text-sm text-role-secondary break-words">{body}</div>
      </div>
    </div>
  </Surface>
);

const StatGainRow: React.FC<{ notif: GameNotification }> = ({ notif }) => {
  const p = notif.payload ?? {};
  const horseName = typeof p.horseName === 'string' ? p.horseName : 'Unknown horse';
  const statRaw = typeof p.stat === 'string' && p.stat.length > 0 ? p.stat : 'stat';
  const statLabel = statRaw.charAt(0).toUpperCase() + statRaw.slice(1);
  const amount = typeof p.amount === 'number' ? p.amount : 0;
  const feedName = typeof p.feedName === 'string' ? p.feedName : 'feed';
  return (
    <GameNotifShell
      notif={notif}
      iconBg="bg-[var(--role-success-bg)]"
      emoji="🌾"
      badgeLabel="Stat Gain"
      badgeVariant="success"
      title={horseName}
      body={
        <p>
          +{amount} {statLabel} from {feedName}
        </p>
      }
    />
  );
};

const FoalBornRow: React.FC<{ notif: GameNotification }> = ({ notif }) => {
  const p = notif.payload ?? {};
  const foalName = typeof p.foalName === 'string' ? p.foalName : 'New foal';
  const damName = typeof p.damName === 'string' ? p.damName : 'an unknown dam';
  const sireName = typeof p.sireName === 'string' ? p.sireName : 'an unknown sire';
  return (
    <GameNotifShell
      notif={notif}
      iconBg="bg-[var(--role-accent-bg)]"
      emoji="👶"
      badgeLabel="Foal Born"
      badgeVariant="default"
      title={foalName}
      body={
        <p>
          Out of {damName} by {sireName}.
        </p>
      }
    />
  );
};

/**
 * Equoria-m9lz1 — a groom has reached the end of their working years and the
 * game has retired them. This is the player's ONLY warning: the backend writes
 * it in the same transaction that ends the groom's assignments, and the player
 * needs to know which horses are now uncovered so they can take someone new on.
 *
 * It stays inside the established GameNotifShell family (same shell, same badge
 * vocabulary, same role tokens as Stat Gain and Foal Born) rather than inventing
 * a surface: the row's job is to name the person who left and what it left
 * uncovered, not to hold a ceremony. `warning`, not `success` or `destructive` —
 * nothing went wrong and nobody is at fault, but the player has something to do.
 *
 * The payload deliberately carries no retirement age. The game's hidden
 * retirement schedule is not disclosed before the week it takes effect, and this
 * row is the week it takes effect.
 */
const GroomRetiredRow: React.FC<{ notif: GameNotification }> = ({ notif }) => {
  const p = notif.payload ?? {};
  const groomName = typeof p.groomName === 'string' ? p.groomName : 'One of your grooms';
  const speciality = typeof p.speciality === 'string' ? p.speciality : null;
  const horses = typeof p.horsesLeftUnattended === 'number' ? p.horsesLeftUnattended : 0;
  return (
    <GameNotifShell
      notif={notif}
      iconBg="bg-[var(--role-warning-bg)]"
      emoji="🕯️"
      badgeLabel="Groom Retired"
      badgeVariant="warning"
      title={groomName}
      body={
        <p>
          {speciality
            ? `Has hung up their headcollar after a long career in ${speciality}.`
            : 'Has hung up their headcollar after a long career.'}
          {horses > 0
            ? ` ${horses} ${horses === 1 ? 'horse is' : 'horses are'} without a groom — take someone new on when you are ready.`
            : ' Take someone new on when you are ready.'}
        </p>
      }
    />
  );
};

const UnknownNotifRow: React.FC<{ notif: GameNotification }> = ({ notif }) => (
  <GameNotifShell
    notif={notif}
    iconBg="bg-[var(--role-neutral-bg)]"
    emoji="✉️"
    badgeLabel={String(notif.type || 'event')}
    badgeVariant="secondary"
    title="New notification"
    body={<p className="text-role-muted">An update for your stable.</p>}
  />
);

export const GameNotifRow: React.FC<{ notif: GameNotification }> = ({ notif }) => {
  switch (notif.type) {
    case 'stat_gain':
      return <StatGainRow notif={notif} />;
    case 'foal_born':
      return <FoalBornRow notif={notif} />;
    case 'groom_retired':
      return <GroomRetiredRow notif={notif} />;
    default:
      return <UnknownNotifRow notif={notif} />;
  }
};
