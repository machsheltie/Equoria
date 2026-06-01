/**
 * GameNotifRow + renderers (extracted from MessagesPage — Equoria-w2kyx)
 *
 * The game-notification row family: a shared GameNotifShell (unread dot,
 * avatar, badge, timestamp layout) plus per-type renderers (stat gain,
 * foal born, unknown) and the GameNotifRow dispatcher that selects a
 * renderer by notif.type. Kept together because they form one cohesive
 * notification-rendering unit.
 */

import React from 'react';
import { Circle, CheckCircle2, Clock } from 'lucide-react';
import type { GameNotification } from '@/lib/api-client';
import { relativeTime } from './constants';

// Row shell shared across notification renderers — keeps unread dot, layout,
// and timestamp consistent so dispatch only varies the icon/label/body.
const GameNotifShell: React.FC<{
  notif: GameNotification;
  iconBg: string;
  emoji: string;
  badgeLabel: string;
  badgeClass: string;
  title: string;
  body: React.ReactNode;
}> = ({ notif, iconBg, emoji, badgeLabel, badgeClass, title, body }) => (
  <div
    className={`group glass-panel hover:bg-white/8 ${
      !notif.isRead ? 'border-blue-500/20' : 'hover:border-white/20'
    }`}
    data-testid={`game-notif-${notif.id}`}
    data-notif-type={notif.type}
  >
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-1">
        {!notif.isRead ? (
          <Circle className="w-2 h-2 fill-blue-400 text-blue-400" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-white/15" />
        )}
      </div>

      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full ${iconBg} flex items-center justify-center border border-white/10`}
      >
        <span className="text-xs" aria-hidden="true">
          {emoji}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-semibold ${!notif.isRead ? 'text-white/90' : 'text-white/70'}`}
            >
              {title}
            </span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badgeClass}`}>
              {badgeLabel}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-white/30 flex-shrink-0">
            <Clock className="w-3 h-3" />
            {relativeTime(notif.createdAt)}
          </div>
        </div>
        <div className="text-sm text-white/70">{body}</div>
      </div>
    </div>
  </div>
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
      iconBg="bg-gradient-to-br from-blue-600 to-indigo-700"
      emoji="🌾"
      badgeLabel="Stat Gain"
      badgeClass="bg-blue-500/20 text-blue-400"
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
      iconBg="bg-gradient-to-br from-pink-600 to-rose-700"
      emoji="👶"
      badgeLabel="Foal Born"
      badgeClass="bg-pink-500/20 text-pink-300"
      title={foalName}
      body={
        <p>
          Out of {damName} by {sireName}.
        </p>
      }
    />
  );
};

const UnknownNotifRow: React.FC<{ notif: GameNotification }> = ({ notif }) => (
  <GameNotifShell
    notif={notif}
    iconBg="bg-gradient-to-br from-slate-600 to-slate-800"
    emoji="✉️"
    badgeLabel={String(notif.type || 'event')}
    badgeClass="bg-slate-500/20 text-slate-300"
    title="New notification"
    body={<p className="text-white/50">An update for your stable.</p>}
  />
);

export const GameNotifRow: React.FC<{ notif: GameNotification }> = ({ notif }) => {
  switch (notif.type) {
    case 'stat_gain':
      return <StatGainRow notif={notif} />;
    case 'foal_born':
      return <FoalBornRow notif={notif} />;
    default:
      return <UnknownNotifRow notif={notif} />;
  }
};
