/**
 * Need Help? staff directory (Equoria-vc5x1): who is on the team and whether
 * they are online. Online means the account made an authenticated request in
 * the last helpOnlineWindowMs (User.lastActiveAt, stamped by
 * authenticateToken at most once a minute).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

export const helpOnlineWindowMs = 5 * 60 * 1000;

const roleToSection = { owner: 'owner', admin: 'admin', moderator: 'moderator' };

export async function listHelpStaff(now = new Date()) {
  const staff = await prisma.user.findMany({
    where: { role: { in: Object.keys(roleToSection) } },
    select: { id: true, username: true, role: true, lastActiveAt: true },
    orderBy: { username: 'asc' },
  });
  const cutoff = now.getTime() - helpOnlineWindowMs;
  const sections = { owner: [], admin: [], moderator: [] };
  for (const person of staff) {
    sections[roleToSection[person.role]].push({
      id: person.id,
      username: person.username,
      online: person.lastActiveAt !== null && person.lastActiveAt.getTime() >= cutoff,
    });
  }
  return sections;
}
