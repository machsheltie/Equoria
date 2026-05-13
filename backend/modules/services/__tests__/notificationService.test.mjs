import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createNotification } from '../../../utils/notificationService.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

describe('notificationService', () => {
  let user;

  beforeAll(async () => {
    const result = await createTestUser({
      username: `notif_svc_${Date.now()}`,
      email: `notif_svc_${Date.now()}@test.com`,
    });
    user = result.user;
  }, 30000);

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await cleanupTestData();
  }, 30000);

  it('inserts a Notification row for a valid userId', async () => {
    const payload = { horseName: 'TestHorse', stat: 'speed', amount: 1, feedName: 'Grain' };
    await createNotification(user.id, 'stat_gain', payload);

    const rows = await prisma.notification.findMany({
      where: { userId: user.id, type: 'stat_gain' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].isRead).toBe(false);
    expect(rows[0].payload).toMatchObject(payload);
  });

  it('does NOT throw when given a non-existent userId', async () => {
    await expect(createNotification('00000000-0000-0000-0000-000000000000', 'stat_gain', {})).resolves.toBeUndefined();
  });
});
