/**
 * Need Help? guardrails (Equoria-vc5x1, owner request 2026-10-23).
 *
 * A player may message any staff member (owner, admin, moderator) through the
 * ordinary Messages system. So that nobody can spam a staff member or blast
 * one message to the whole team, every player-to-staff message passes three
 * rules, enforced here on the server inside the send transaction:
 *
 *   1. helpOpenConversation: one open help conversation per player across all
 *      staff. A conversation is open from the player's latest help message to
 *      a staff member until that member replies, or helpConversationOpenMs
 *      passes.
 *   2. helpDuplicateContent: the same text (ignoring case and spacing) is not
 *      sent to a second staff member within helpDuplicateWindowMs.
 *   3. helpCooldown: helpMessageCooldownMs between a player's help messages.
 *
 * The numbers are OWNER CHOICES. These are conservative defaults awaiting her
 * ruling; change them here and nowhere else.
 *
 * Concurrency: the sender's User row is locked FOR UPDATE first, so two
 * parallel sends from one player run one after the other and the second sees
 * the first. The precondition spans several rows, so a guarded updateMany
 * cannot express it.
 *
 * Refusal text is authored for players; the `code` is for the client and tests.
 */

import { helpTag } from './helpConstants.mjs';

// Local spans: the shared constants/time.mjs names are snake_case, which the
// camelCase ratchet (Equoria-pjvp8) does not allow in new files.
const msPerMinute = 60_000;
const msPerDay = 24 * 60 * msPerMinute;
const msPerWeek = 7 * msPerDay;

export const helpMessageCooldownMs = 10 * msPerMinute;
export const helpDuplicateWindowMs = msPerDay;
export const helpConversationOpenMs = msPerWeek;

const userSelect = { id: true, username: true };
/** Most recent help messages inspected per send; far above any honest player. */
const recentHelpMessagesLimit = 200;

export function normalizeHelpContent(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

function refusal(status, code, message, extra = {}) {
  return { refused: { status, code, message, ...extra } };
}

/**
 * Check the three rules and, when they all pass, store the help message.
 * Must run on a transaction client. Returns `{ message }` or `{ refused }`.
 */
export async function sendHelpMessageTx(tx, { senderId, recipient, subject, content, now }) {
  // Lock order: the sender's User row first (serialises this player's sends).
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${senderId} FOR UPDATE`;

  const since = new Date(now.getTime() - Math.max(helpDuplicateWindowMs, helpConversationOpenMs));
  const recent = await tx.directMessage.findMany({
    where: { senderId, tag: helpTag, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: recentHelpMessagesLimit,
    select: { recipientId: true, content: true, createdAt: true },
  });

  // Rule 1: one open conversation, with someone else.
  const openWindowStart = now.getTime() - helpConversationOpenMs;
  const latestPerStaff = new Map();
  for (const m of recent) {
    if (m.createdAt.getTime() >= openWindowStart && !latestPerStaff.has(m.recipientId)) {
      latestPerStaff.set(m.recipientId, m.createdAt);
    }
  }
  for (const [staffId, sentAt] of latestPerStaff) {
    if (staffId === recipient.id) {
      continue;
    }
    const replies = await tx.directMessage.count({
      where: { senderId: staffId, recipientId: senderId, createdAt: { gt: sentAt } },
    });
    if (replies === 0) {
      const other = await tx.user.findUnique({ where: { id: staffId }, select: userSelect });
      const name = other?.username ?? 'another member of the team';
      return refusal(
        409,
        'helpOpenConversation',
        `You already have a conversation open with ${name}. Please wait for their reply before reaching out to someone else on the team.`,
      );
    }
  }

  // Rule 2: the same words to a second staff member.
  const normalized = normalizeHelpContent(content);
  const duplicateStart = now.getTime() - helpDuplicateWindowMs;
  const duplicated = recent.some(
    m =>
      m.recipientId !== recipient.id &&
      m.createdAt.getTime() >= duplicateStart &&
      normalizeHelpContent(m.content) === normalized,
  );
  if (duplicated) {
    return refusal(
      409,
      'helpDuplicateContent',
      'You have already sent this same message to another member of the team. Please give them time to answer before sending it again.',
    );
  }

  // Rule 3: a pause between help messages.
  const latest = recent[0];
  if (latest) {
    const waitMs = latest.createdAt.getTime() + helpMessageCooldownMs - now.getTime();
    if (waitMs > 0) {
      const minutes = Math.max(1, Math.ceil(waitMs / msPerMinute));
      return refusal(
        429,
        'helpCooldown',
        `You wrote to the team a moment ago. Please wait about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} before sending another message.`,
        { retryAfterSeconds: Math.ceil(waitMs / 1000) },
      );
    }
  }

  const message = await tx.directMessage.create({
    data: { senderId, recipientId: recipient.id, subject, content, tag: helpTag },
    include: { sender: { select: userSelect }, recipient: { select: userSelect } },
  });
  return { message };
}
