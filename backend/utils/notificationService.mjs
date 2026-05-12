import prisma from '../db/index.mjs';
import logger from './logger.mjs';

export async function createNotification(userId, type, payload) {
  try {
    await prisma.notification.create({ data: { userId, type, payload } });
  } catch (err) {
    logger.error(`[notificationService] failed to create notification: ${err.message}`);
  }
}
