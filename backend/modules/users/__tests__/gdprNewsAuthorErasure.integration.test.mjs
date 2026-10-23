/**
 * Equoria-wbt8l (security review 2026-10-23) — News posts and a staff
 * account's own data.
 *
 * A News post keeps a signature snapshot (authorName, authorRoleLabel) so it
 * stays readable after edits. That snapshot is personal data and must not
 * outlive the account:
 *   - eraseUserAccount() blanks the signature on every post the account wrote,
 *     inside the erasure transaction, and the author FK goes NULL with the
 *     user row (the page then signs the post "Equoria Staff");
 *   - buildUserDataExport() includes the posts the account wrote.
 * Posts by someone else are untouched.
 *
 * RED before the fix: the signature survives erasure and the export has no
 * News section.
 *
 * Real database, no mocks, id-scoped fail-loud cleanup.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { buildUserDataExport, eraseUserAccount } from '../services/gdprAccountService.mjs';

const PREFIX = 'TestFixture-wbt8l-gdpr';
const tag = () => randomBytes(6).toString('hex');

async function makeStaff(label, role) {
  const t = tag();
  return prisma.user.create({
    data: {
      username: `${PREFIX}-${label}-${t}`,
      email: `${PREFIX}-${label}-${t}@example.com`.toLowerCase(),
      password: 'irrelevant-not-a-login-test',
      firstName: 'wbt8l',
      lastName: label,
      money: 0,
      role,
      settings: {},
    },
  });
}

function letterBy(user, title) {
  return prisma.newsItem.create({
    data: {
      postType: 'adminLetter',
      title,
      body: 'A letter to the riders.',
      authorUserId: user.id,
      authorName: user.username,
      authorRoleLabel: 'Admin',
      publishAt: new Date(),
    },
  });
}

describe('Equoria-wbt8l — News posts in GDPR export and erasure', () => {
  const cleanup = createCleanupTracker();
  const userIds = [];
  const postIds = [];

  afterEach(async () => {
    cleanup.add(() => prisma.newsItem.deleteMany({ where: { id: { in: postIds } } }), 'news');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
    await cleanup.run();
    userIds.length = 0;
    postIds.length = 0;
  }, 30000);

  it('erasure removes the signature from the account’s posts and leaves other posts alone', async () => {
    const leaving = await makeStaff('leaving', 'admin');
    const staying = await makeStaff('staying', 'admin');
    userIds.push(leaving.id, staying.id);
    const theirs = await letterBy(leaving, `${PREFIX} theirs`);
    const other = await letterBy(staying, `${PREFIX} other`);
    postIds.push(theirs.id, other.id);

    await eraseUserAccount(leaving.id);

    const after = await prisma.newsItem.findUnique({ where: { id: theirs.id } });
    expect(after).not.toBeNull();
    expect(after.authorName).toBeNull();
    expect(after.authorRoleLabel).toBeNull();
    expect(after.authorUserId).toBeNull();
    expect(after.title).toBe(`${PREFIX} theirs`);

    const untouched = await prisma.newsItem.findUnique({ where: { id: other.id } });
    expect(untouched.authorName).toBe(staying.username);
    expect(untouched.authorRoleLabel).toBe('Admin');
    expect(untouched.authorUserId).toBe(staying.id);
  });

  it('the data export lists the posts the account wrote, and only those', async () => {
    const writer = await makeStaff('writer', 'admin');
    const someoneElse = await makeStaff('else', 'admin');
    userIds.push(writer.id, someoneElse.id);
    const mine = await letterBy(writer, `${PREFIX} mine`);
    const notMine = await letterBy(someoneElse, `${PREFIX} not mine`);
    postIds.push(mine.id, notMine.id);

    const exported = await buildUserDataExport(writer.id);

    expect(exported.newsPostsWritten.map(p => p.id)).toEqual([mine.id]);
    expect(exported.newsPostsWritten[0]).toMatchObject({
      title: `${PREFIX} mine`,
      authorName: writer.username,
      authorRoleLabel: 'Admin',
    });
  });
});
