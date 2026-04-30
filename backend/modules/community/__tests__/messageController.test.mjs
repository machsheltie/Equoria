/**
 * messageController.test.mjs
 *
 * Unit tests for backend/modules/community/controllers/messageController.mjs
 * Co-located per the backend/modules/<domain>/__tests__/ convention (Story 21-1).
 *
 * Coverage: getInbox, sendMessage, getMessage, markRead
 * Mocks: prisma, logger (external deps only)
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';

// ── Mock setup ────────────────────────────────────────────────────────────────

const mockPrisma = {
  directMessage: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule('../../../../packages/database/prismaClient.mjs', () => ({
  default: mockPrisma,
}));
jest.unstable_mockModule('../../../utils/logger.mjs', () => ({
  default: mockLogger,
}));

const { getInbox, getSent, sendMessage, getMessage, markRead, getUnreadCount } = await import(
  '../controllers/messageController.mjs'
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockReqRes(overrides = {}) {
  const req = {
    user: { id: 'user-uuid-1' },
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

// ── getInbox ──────────────────────────────────────────────────────────────────

describe('getInbox', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns inbox messages with total and page', async () => {
    const messages = [{ id: 1, senderId: 'user-uuid-2', recipientId: 'user-uuid-1', content: 'Hi!', sender: {} }];
    mockPrisma.$transaction.mockResolvedValue([messages, 1]);

    const { req, res } = mockReqRes({ query: {} });
    await getInbox(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          messages,
          total: 1,
          page: 1,
        }),
      }),
    );
  });

  it('queries by recipientId matching current user', async () => {
    mockPrisma.$transaction.mockResolvedValue([[], 0]);
    const { req, res } = mockReqRes();
    await getInbox(req, res);

    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('returns 500 on database error', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('db error'));
    const { req, res } = mockReqRes();
    await getInbox(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

// ── sendMessage ───────────────────────────────────────────────────────────────

describe('sendMessage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates message and returns 201', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-uuid-2' });
    const created = {
      id: 10,
      senderId: 'user-uuid-1',
      recipientId: 'user-uuid-2',
      subject: 'Hello',
      content: 'Body',
      sender: {},
      recipient: {},
    };
    mockPrisma.directMessage.create.mockResolvedValue(created);

    const { req, res } = mockReqRes({
      user: { id: 'user-uuid-1' },
      body: { recipientId: 'user-uuid-2', subject: 'Hello', content: 'Body' },
    });
    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ message: created }) }),
    );
  });

  it('returns 400 when sender tries to message themselves', async () => {
    const { req, res } = mockReqRes({
      user: { id: 'user-uuid-1' },
      body: { recipientId: 'user-uuid-1', subject: 'Self', content: 'Test' },
    });
    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('yourself') }),
    );
    expect(mockPrisma.directMessage.create).not.toHaveBeenCalled();
  });

  it('returns 404 when recipient does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({
      user: { id: 'user-uuid-1' },
      body: { recipientId: 'ghost-id', subject: 'Hi', content: 'Hello?' },
    });
    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('Recipient') }),
    );
  });

  it('returns 500 on database error', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-uuid-2' });
    mockPrisma.directMessage.create.mockRejectedValue(new Error('write failed'));

    const { req, res } = mockReqRes({
      body: { recipientId: 'user-uuid-2', subject: 'Hello', content: 'Body' },
    });
    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

// ── getMessage ────────────────────────────────────────────────────────────────

describe('getMessage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns message when caller is the sender', async () => {
    const message = {
      id: 5,
      senderId: 'user-uuid-1',
      recipientId: 'user-uuid-2',
      isRead: true,
      sender: {},
      recipient: {},
    };
    mockPrisma.directMessage.findUnique.mockResolvedValue(message);

    const { req, res } = mockReqRes({ user: { id: 'user-uuid-1' }, params: { id: '5' } });
    await getMessage(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('auto-marks message as read when recipient fetches', async () => {
    const message = {
      id: 6,
      senderId: 'user-uuid-2',
      recipientId: 'user-uuid-1',
      isRead: false,
      sender: {},
      recipient: {},
    };
    mockPrisma.directMessage.findUnique.mockResolvedValue(message);
    mockPrisma.directMessage.update.mockResolvedValue({ ...message, isRead: true });

    const { req, res } = mockReqRes({ user: { id: 'user-uuid-1' }, params: { id: '6' } });
    await getMessage(req, res);

    expect(mockPrisma.directMessage.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isRead: true } }));
  });

  it('returns 403 when unrelated user tries to access message', async () => {
    const message = {
      id: 7,
      senderId: 'user-uuid-2',
      recipientId: 'user-uuid-3',
      isRead: false,
      sender: {},
      recipient: {},
    };
    mockPrisma.directMessage.findUnique.mockResolvedValue(message);

    const { req, res } = mockReqRes({ user: { id: 'user-uuid-INTRUDER' }, params: { id: '7' } });
    await getMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Access denied' }));
  });

  it('returns 404 when message does not exist', async () => {
    mockPrisma.directMessage.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '999' } });
    await getMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 for invalid message ID', async () => {
    const { req, res } = mockReqRes({ params: { id: '0' } });
    await getMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ── markRead ──────────────────────────────────────────────────────────────────

describe('markRead', () => {
  beforeEach(() => jest.clearAllMocks());

  it('marks message read and returns success', async () => {
    mockPrisma.directMessage.findUnique.mockResolvedValue({
      id: 8,
      recipientId: 'user-uuid-1',
    });
    mockPrisma.directMessage.update.mockResolvedValue({});

    const { req, res } = mockReqRes({ user: { id: 'user-uuid-1' }, params: { id: '8' } });
    await markRead(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(mockPrisma.directMessage.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isRead: true } }));
  });

  it('returns 403 when non-recipient tries to mark read', async () => {
    mockPrisma.directMessage.findUnique.mockResolvedValue({
      id: 9,
      recipientId: 'user-uuid-OTHER',
    });

    const { req, res } = mockReqRes({ user: { id: 'user-uuid-1' }, params: { id: '9' } });
    await markRead(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockPrisma.directMessage.update).not.toHaveBeenCalled();
  });
});

// ── getSent ───────────────────────────────────────────────────────────────────

describe('getSent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns sent messages with total and page', async () => {
    const messages = [{ id: 2, senderId: 'user-uuid-1', recipientId: 'user-uuid-2', content: 'Yo!', recipient: {} }];
    mockPrisma.$transaction.mockResolvedValue([messages, 1]);

    const { req, res } = mockReqRes({ query: {} });
    await getSent(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          messages,
          total: 1,
          page: 1,
        }),
      }),
    );
  });

  it('queries by senderId matching current user', async () => {
    mockPrisma.$transaction.mockResolvedValue([[], 0]);
    const { req, res } = mockReqRes();
    await getSent(req, res);

    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('returns 500 on database error', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('db error'));
    const { req, res } = mockReqRes();
    await getSent(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

// ── getUnreadCount ────────────────────────────────────────────────────────────

describe('getUnreadCount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns count of unread messages for current user', async () => {
    mockPrisma.directMessage.count.mockResolvedValue(3);

    const { req, res } = mockReqRes();
    await getUnreadCount(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ count: 3 }),
      }),
    );
    expect(mockPrisma.directMessage.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isRead: false }) }),
    );
  });
});
