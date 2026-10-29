/**
 * GameNotifRow + renderers (extracted from MessagesPage — Equoria-w2kyx)
 *
 * The game-notification row family: a shared GameNotifShell (unread dot,
 * avatar, badge, timestamp layout) plus per-type renderers (stat gain,
 * foal born, groom retired, staff tickets, unknown) and the GameNotifRow dispatcher that
 * selects a renderer by notif.type. Kept together because they form one
 * cohesive notification-rendering unit.
 *
 * Migrated to canonical primitives (Equoria-o5hub community lane):
 * Surface panel rows (static — no hover lift), GameBadge type badges,
 * role-token icon tints. Unread indicators use the info role — the single
 * semantic unread treatment shared with MessageRow and the tab badges.
 */

import React from 'react';
import { Link } from 'react-router';
import { Circle, CheckCircle2, Clock } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { GameBadge, type GameBadgeProps } from '@/components/ui/game';
import type { GameNotification } from '@/lib/api-client';
import { groomSpecialtyLabel } from '@/lib/groomSpecialtyLabels';
import { relativeTime } from './constants';
import { StarMark } from '@/pages/horse-detail/stud/StarMark';

// Row shell shared across notification renderers — keeps unread dot, layout,
// and timestamp consistent so dispatch only varies the icon/label/body.
const GameNotifShell: React.FC<{
  notif: GameNotification;
  iconBg: string;
  emoji: string;
  /** An authored icon drawn in place of the emoji (the breeding star, q110). */
  icon?: React.ReactNode;
  badgeLabel: string;
  badgeVariant: GameBadgeProps['variant'];
  title: React.ReactNode;
  body: React.ReactNode;
}> = ({ notif, iconBg, emoji, icon, badgeLabel, badgeVariant, title, body }) => (
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
        {icon ?? <span className="text-xs">{emoji}</span>}
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
  // Equoria-nzl9e: the name opens the newborn's horse page (one horse page, 2026-10-16).
  const foalId =
    typeof p.foalId === 'number' && Number.isInteger(p.foalId) && p.foalId > 0 ? p.foalId : null;
  return (
    <GameNotifShell
      notif={notif}
      iconBg="bg-[var(--role-accent-bg)]"
      emoji="👶"
      badgeLabel="Foal Born"
      badgeVariant="default"
      title={
        foalId ? (
          <Link to={`/horses/${foalId}`} className="text-[var(--link-gold)] hover:underline">
            {foalName}
          </Link>
        ) : (
          foalName
        )
      }
      body={
        <p>
          Out of {damName} by {sireName}.
        </p>
      }
    />
  );
};

/**
 * Reads the horse names out of a groomRetired payload, defensively.
 *
 * Returns only entries that actually carry a usable name — a nameless horse
 * cannot be said out loud, and "and  is without a groom" is worse than falling
 * back to the count. The caller decides what to do with a short list.
 */
const retiredGroomHorseNames = (payload: Record<string, unknown>): string[] => {
  const raw = payload.horses;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((h) =>
      h && typeof h === 'object' && typeof (h as { name?: unknown }).name === 'string'
        ? ((h as { name: string }).name.trim() as string)
        : ''
    )
    .filter((name) => name.length > 0);
};

/**
 * "Moonflower", "Moonflower and Halcyon", "Moonflower, Halcyon and Bright Star",
 * "Moonflower, Halcyon, Bright Star and 2 more".
 *
 * Capped at three spoken names: past that the sentence stops being something a
 * player reads and starts being a list, and the roster is where a list belongs.
 */
const MAX_SPOKEN_HORSE_NAMES = 3;
const speakHorseNames = (names: string[], unnamed = 0): string => {
  // `unnamed` horses were left unattended but arrived without a usable name
  // (Equoria-d6ru2); they are spoken as a count so names and count always agree.
  const total = names.length + unnamed;
  if (total <= MAX_SPOKEN_HORSE_NAMES) {
    const parts =
      unnamed > 0 ? [...names, `${unnamed} other ${unnamed === 1 ? 'horse' : 'horses'}`] : names;
    if (parts.length <= 1) return parts[0] ?? '';
    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  }
  const spokenNames = names.slice(0, MAX_SPOKEN_HORSE_NAMES);
  const rest = total - spokenNames.length;
  return `${spokenNames.join(', ')} and ${rest} more`;
};

/**
 * Equoria-m9lz1 — a groom has reached the end of their working years and the
 * game has retired them. This is the player's ONLY notice: the backend writes it
 * in the same transaction that ends the groom's assignments, so it arrives the
 * week it happens rather than ahead of it, and the player needs to know which
 * horses are now uncovered so they can take someone new on.
 *
 * It stays inside the established GameNotifShell family (same shell, same badge
 * vocabulary, same role tokens as Stat Gain and Foal Born) rather than inventing
 * a surface: the row's job is to name the person who left and who they left,
 * not to hold a ceremony. `warning`, not `success` or `destructive` — nothing
 * went wrong and nobody is at fault, but the player has something to do.
 *
 * THE ICON IS NOT A CANDLE (fix round 3, finding 6). It was 🕯️, and beside the
 * words "Groom Retired" a candle tells an attached player that someone has died.
 * Nobody has died; a person the player's stable relied on has finished a long
 * career. 🏵️ is a rosette — the thing you pin on someone at the end of a good
 * run — which is warm, unmistakably equestrian, and not funereal. It is also not
 * already spoken for by another row (🌾 stat gain, 👶 foal born, ✉️ unknown).
 *
 * THE HORSES ARE NAMED, not counted (same round). The row used to say "3 horses
 * are without a groom", which is a sentence about inventory in a game whose
 * premise is that the player knows all three by name. The backend now sends
 * `horses: [{ id, name }]`, scoped to this recipient, with
 * `horsesLeftUnattended` derived from that list's length. The count is still the
 * fallback — an older stored notification has no `horses` key, and this row must
 * keep rendering those honestly rather than pretending nobody was uncovered.
 *
 * The payload deliberately carries no retirement age. The game's hidden
 * retirement schedule is not disclosed before the week it takes effect, and this
 * row is the week it takes effect.
 *
 * The specialty goes through `groomSpecialtyLabel` and never reaches the
 * sentence raw. The first version of this row interpolated `p.speciality`
 * directly, so a player read "a long career in foal_care" — a database enum in
 * the one new sentence this feature added. See lib/groomSpecialtyLabels.ts for
 * why that is a label map rather than a formatter.
 */
const GroomRetiredRow: React.FC<{ notif: GameNotification }> = ({ notif }) => {
  const p = notif.payload ?? {};
  const groomName = typeof p.groomName === 'string' ? p.groomName : 'One of your grooms';
  // `null` when the payload carries no specialty, so the sentence drops the
  // clause entirely rather than reaching for a filler phrase.
  const speciality =
    typeof p.speciality === 'string' && p.speciality.trim() !== ''
      ? groomSpecialtyLabel(p.speciality)
      : null;
  const horseNames = retiredGroomHorseNames(p);
  const horseCount = typeof p.horsesLeftUnattended === 'number' ? p.horsesLeftUnattended : 0;

  // Named horses when the payload carries them; the old count sentence when it
  // does not (a notification stored before the names existed); and no clause at
  // all when the retirement left nobody uncovered.
  let uncovered: string;
  if (horseNames.length > 0) {
    const unnamed = Math.max(0, horseCount - horseNames.length);
    const total = horseNames.length + unnamed;
    uncovered = ` ${speakHorseNames(horseNames, unnamed)} ${total === 1 ? 'is' : 'are'} without a groom — take someone new on when you are ready.`;
  } else if (horseCount > 0) {
    uncovered = ` ${horseCount} ${horseCount === 1 ? 'horse is' : 'horses are'} without a groom — take someone new on when you are ready.`;
  } else {
    uncovered = ' Take someone new on when you are ready.';
  }

  return (
    <GameNotifShell
      notif={notif}
      iconBg="bg-[var(--role-warning-bg)]"
      emoji="🏵️"
      badgeLabel="Groom Retired"
      badgeVariant="warning"
      title={groomName}
      body={
        <p>
          {speciality
            ? `Has hung up their headcollar after a long career in ${speciality}.`
            : 'Has hung up their headcollar after a long career.'}
          {uncovered}
        </p>
      }
    />
  );
};

/**
 * Equoria-puj1e.1 — the Steward's Office bells. Only staff receive these: an
 * admin hears that a steward filed a ticket, and a steward hears that their
 * ticket has a reply or a new status. Payloads are `{ ticketId, category }` for
 * a filing and `{ ticketId, status? }` for an update (no status means a reply).
 * The note text never travels in a bell. These are the only rows that link
 * anywhere, because the ticket itself lives in the office, not in the bell.
 */
const TICKET_STATUS_WORDS: Record<string, string> = {
  open: 'open',
  inProgress: 'in progress',
  resolved: 'resolved',
  declined: 'declined',
};

const ticketLabel = (payload: Record<string, unknown>): string =>
  typeof payload.ticketId === 'number' ? `Ticket #${payload.ticketId}` : 'A ticket';

const StewardOfficeLink: React.FC = () => (
  <Link
    to="/steward"
    className="inline-flex min-h-[44px] items-center font-medium text-[var(--link-gold)] hover:underline"
  >
    Open the Steward&apos;s Office
  </Link>
);

const StaffTicketRow: React.FC<{ notif: GameNotification }> = ({ notif }) => {
  const p = notif.payload ?? {};
  const ticket = typeof p.ticketId === 'number' ? `ticket #${p.ticketId}` : 'a ticket';
  const category =
    typeof p.category === 'string' && p.category.trim() !== '' ? ` (${p.category.trim()})` : '';
  return (
    <GameNotifShell
      notif={notif}
      iconBg="bg-[var(--role-accent-bg)]"
      emoji="🎫"
      badgeLabel="Ticket Filed"
      badgeVariant="default"
      title="Steward's Office"
      body={
        <>
          <p>
            A steward filed {ticket}
            {category}.
          </p>
          <StewardOfficeLink />
        </>
      }
    />
  );
};

const StaffTicketUpdateRow: React.FC<{ notif: GameNotification }> = ({ notif }) => {
  const p = notif.payload ?? {};
  const label = ticketLabel(p);
  const status = typeof p.status === 'string' ? p.status : null;
  let sentence: string;
  if (status === null) {
    sentence = `${label} has a reply.`;
  } else if (TICKET_STATUS_WORDS[status]) {
    sentence = `${label} is now ${TICKET_STATUS_WORDS[status]}.`;
  } else {
    sentence = `${label} has been updated.`;
  }
  return (
    <GameNotifShell
      notif={notif}
      iconBg="bg-[var(--role-accent-bg)]"
      emoji="🎫"
      badgeLabel="Ticket Update"
      badgeVariant="default"
      title="Steward's Office"
      body={
        <>
          <p>{sentence}</p>
          <StewardOfficeLink />
        </>
      }
    />
  );
};

/**
 * Equoria-or2ua: the one-week notice before a rider retires (owner ruling
 * 2026-10-23). It names the rider and the horses that ride with them. The
 * payload carries no age and no countdown, and this row invents none.
 */
const RiderRetiringRow: React.FC<{ notif: GameNotification }> = ({ notif }) => {
  const p = notif.payload ?? {};
  const riderName = typeof p.riderName === 'string' ? p.riderName : 'One of your riders';
  const horseNames = retiredGroomHorseNames(p);
  const withHorses =
    horseNames.length > 0 ? ` ${speakHorseNames(horseNames)} will need a new rider.` : '';
  return (
    <GameNotifShell
      notif={notif}
      iconBg="bg-[var(--role-warning-bg)]"
      emoji="🏵️"
      badgeLabel="Rider Retiring"
      badgeVariant="warning"
      title={riderName}
      body={<p>Retires within the week.{withHorses} Hire a replacement while there is time.</p>}
    />
  );
};

/**
 * The weekly pay moments for staff (grooms: Equoria-ypb7d.3; riders: Equoria-gafyt, owner
 * q111). Authored words only, never the stored type name. Payloads carry the staff
 * member's name and, when they leave, the horses they leave without.
 */
const StaffPayRow: React.FC<{
  notif: GameNotification;
  kind: 'groom' | 'rider';
  event: 'unpaid' | 'left';
}> = ({ notif, kind, event }) => {
  const p = notif.payload ?? {};
  const nameKey = kind === 'groom' ? 'groomName' : 'riderName';
  const name = typeof p[nameKey] === 'string' ? (p[nameKey] as string) : `One of your ${kind}s`;
  const work = kind === 'groom' ? 'work' : 'ride';
  const horseNames = retiredGroomHorseNames(p);
  if (event === 'unpaid') {
    return (
      <GameNotifShell
        notif={notif}
        iconBg="bg-[var(--role-warning-bg)]"
        emoji="🪙"
        badgeLabel={kind === 'groom' ? 'Groom Not Paid' : 'Rider Not Paid'}
        badgeVariant="warning"
        title={name}
        body={
          <p>
            Was not paid this week and cannot {work}. They leave your stable if next week&rsquo;s
            pay is missed too.
          </p>
        }
      />
    );
  }
  const without =
    horseNames.length > 0
      ? ` ${speakHorseNames(horseNames)} ${horseNames.length === 1 ? 'is' : 'are'} without a ${kind}.`
      : '';
  return (
    <GameNotifShell
      notif={notif}
      iconBg="bg-[var(--role-warning-bg)]"
      emoji="👋"
      badgeLabel={kind === 'groom' ? 'Groom Left' : 'Rider Left'}
      badgeVariant="warning"
      title={name}
      body={<p>Has left your stable after a full week without pay.{without}</p>}
    />
  );
};

/** Equoria-w47x7: a steward's warning, in the steward's own words. */
const ConductWarningRow: React.FC<{ notif: GameNotification }> = ({ notif }) => {
  const reason = typeof notif.payload?.reason === 'string' ? notif.payload.reason : null;
  return (
    <GameNotifShell
      notif={notif}
      iconBg="bg-[var(--role-warning-bg)]"
      emoji="⚠️"
      badgeLabel="Warning"
      badgeVariant="warning"
      title="A warning from the stewards"
      body={
        <>
          <p>The stewards have warned your account.</p>
          {reason && <p className="text-role-muted">{reason}</p>}
        </>
      }
    />
  );
};

/**
 * Equoria-q4uem.9: breeding at stud, said in plain words. A gold star for now
 * (owner ruling q110, 2026-10-27). Decline reasons are read as codes for the
 * wording only; no stored code or server message reaches the screen.
 */
const studBadges: Record<string, string> = {
  studBooked: 'Stud Booking',
  studRequestReceived: 'Breeding Request',
  studRequestApproved: 'Request Accepted',
  studRequestDeclined: 'Request Declined',
  studRequestCancelled: 'Request Withdrawn',
};

function studSentence(notif: GameNotification): string {
  const p = notif.payload ?? {};
  const text = (value: unknown, fallback: string) =>
    typeof value === 'string' && value.length > 0 ? value : fallback;
  const dam = text(p.damName, 'a mare');
  const sire = text(p.sireName, 'your stallion');
  const fee = typeof p.fee === 'number' ? p.fee.toLocaleString() : null;
  switch (notif.type) {
    case 'studBooked':
      return `${text(p.mareOwnerName, 'A player')} bred ${dam} to ${sire}.${fee ? ` You earned ${fee}.` : ''}`;
    case 'studRequestReceived':
      return `${text(p.mareOwnerName, 'A player')} asks to breed ${dam} to ${sire}.`;
    case 'studRequestApproved':
      return `Accepted. ${dam} is in foal to ${sire}, due in 7 days.`;
    case 'studRequestDeclined':
      // The old server's REJECTED covers the minutes a deploy serves this
      // client against the old server (Equoria-pjvp8 phase 6 removes it).
      return p.declineReason === 'rejected' || p.declineReason === 'REJECTED'
        ? `The request for ${dam} to ${sire} was declined.`
        : `The request for ${dam} to ${sire} could not go ahead.`;
    default:
      return `The request for ${dam} to ${sire} was withdrawn.`;
  }
}

const StudNotifRow: React.FC<{ notif: GameNotification }> = ({ notif }) => (
  <GameNotifShell
    notif={notif}
    iconBg="bg-[var(--role-accent-bg)]"
    emoji=""
    icon={<StarMark />}
    badgeLabel={studBadges[notif.type] ?? 'Breeding'}
    badgeVariant="default"
    title="At stud"
    body={<p>{studSentence(notif)}</p>}
  />
);

const UnknownNotifRow: React.FC<{ notif: GameNotification }> = ({ notif }) => (
  <GameNotifShell
    notif={notif}
    iconBg="bg-[var(--role-neutral-bg)]"
    emoji="✉️"
    badgeLabel="Notice"
    badgeVariant="secondary"
    title="New notification"
    body={<p className="text-role-muted">An update for your stable.</p>}
  />
);

export const GameNotifRow: React.FC<{ notif: GameNotification }> = ({ notif }) => {
  switch (notif.type) {
    case 'statGain':
      return <StatGainRow notif={notif} />;
    case 'foalBorn':
      return <FoalBornRow notif={notif} />;
    case 'groomRetired':
      return <GroomRetiredRow notif={notif} />;
    case 'riderRetiring':
      return <RiderRetiringRow notif={notif} />;
    case 'groomFeeUnpaid':
      return <StaffPayRow notif={notif} kind="groom" event="unpaid" />;
    case 'groomReleased':
      return <StaffPayRow notif={notif} kind="groom" event="left" />;
    case 'riderFeeUnpaid':
      return <StaffPayRow notif={notif} kind="rider" event="unpaid" />;
    case 'riderReleased':
      return <StaffPayRow notif={notif} kind="rider" event="left" />;
    case 'staffTicket':
      return <StaffTicketRow notif={notif} />;
    case 'staffTicketUpdate':
      return <StaffTicketUpdateRow notif={notif} />;
    case 'studBooked':
    case 'studRequestReceived':
    case 'studRequestApproved':
    case 'studRequestDeclined':
    case 'studRequestCancelled':
      return <StudNotifRow notif={notif} />;
    case 'conductWarning':
      return <ConductWarningRow notif={notif} />;
    default:
      return <UnknownNotifRow notif={notif} />;
  }
};
