/**
 * Need Help? staff directory (Equoria-vc5x1): who is on the team and whether
 * they are online. Online means the account made an authenticated request in
 * the last helpOnlineWindowMs (user_presence.lastActiveAt, stamped by
 * authenticateToken at most once a minute).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { MS_PER_MINUTE } from '../../../constants/time.mjs';

export const helpOnlineWindowMs = 5 * MS_PER_MINUTE;

const roleToSection = { owner: 'owner', admin: 'admin', moderator: 'moderator' };

export async function listHelpStaff(now = new Date()) {
  const staff = await prisma.user.findMany({
    where: { role: { in: Object.keys(roleToSection) } },
    select: { id: true, username: true, role: true },
    orderBy: { username: 'asc' },
  });
  const presence = await prisma.userPresence.findMany({
    where: { userId: { in: staff.map(person => person.id) } },
    select: { userId: true, lastActiveAt: true },
  });
  const lastActive = new Map(presence.map(row => [row.userId, row.lastActiveAt.getTime()]));
  const cutoff = now.getTime() - helpOnlineWindowMs;
  const sections = { owner: [], admin: [], moderator: [] };
  for (const person of staff) {
    sections[roleToSection[person.role]].push({
      id: person.id,
      username: person.username,
      online: (lastActive.get(person.id) ?? 0) >= cutoff,
    });
  }
  return sections;
}
