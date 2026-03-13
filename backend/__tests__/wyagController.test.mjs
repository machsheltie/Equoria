/**
 * wyagController.test.mjs
 *
 * Unit tests for the WhileYouWereGone (WYAG) controller.
 * Tests the GET /api/v1/while-you-were-gone endpoint logic.
 *
 * Mocks: prisma (competitionResult, directMessage, foalDevelopment), logger
 * Tests: auth, empty events, competition results, messages, foal milestones,
 *        priority sorting, max 8 items, since param, invalid since, error handling
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';

// ── Mock setup ───────────────────────────────────────────────────────────────

const mockPrisma = {
  competitionResult: { findMany: jest.fn() },
  directMessage: { findMany: jest.fn() },
  foalDevelopment: { findMany: jest.fn() },
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule('../db/index.mjs', () => ({ default: mockPrisma }));
jest.unstable_mockModule('../utils/logger.mjs', () => ({ default: mockLogger }));

const { getWhileYouWereGone } = await import('../controllers/wyagController.mjs');

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockReqRes(overrides = {}) {
  const req = {
    user: { id: 'test-user-id' },
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getWhileYouWereGone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.competitionResult.findMany.mockResolvedValue([]);
    mockPrisma.directMessage.findMany.mockResolvedValue([]);
    mockPrisma.foalDevelopment.findMany.mockResolvedValue([]);
  });

  it('returns 401 when user is not authenticated', async () => {
    const { req, res } = createMockReqRes({ user: null });
    await getWhileYouWereGone(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Authentication required' }),
    );
  });

  it('returns empty items when no events exist', async () => {
    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.items).toEqual([]);
    expect(body.data.hasMore).toBe(false);
  });

  it('returns since as ISO string in response', async () => {
    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    const body = res.json.mock.calls[0][0];
    expect(typeof body.data.since).toBe('string');
    // Should be a valid ISO date
    expect(isNaN(new Date(body.data.since).getTime())).toBe(false);
  });

  it('defaults since to 4 hours ago when not provided', async () => {
    const before = Date.now() - 4 * 60 * 60 * 1000;
    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    const body = res.json.mock.calls[0][0];
    const sinceMs = new Date(body.data.since).getTime();
    const after = Date.now() - 4 * 60 * 60 * 1000;
    // since should be approximately 4 hours ago (within 1 second tolerance)
    expect(sinceMs).toBeGreaterThanOrEqual(before - 1000);
    expect(sinceMs).toBeLessThanOrEqual(after + 1000);
  });

  it('uses provided since query parameter', async () => {
    const sinceDate = '2026-03-01T10:00:00.000Z';
    const { req, res } = createMockReqRes({ query: { since: sinceDate } });
    await getWhileYouWereGone(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.since).toBe(sinceDate);
  });

  it('returns 400 for invalid since timestamp', async () => {
    const { req, res } = createMockReqRes({ query: { since: 'not-a-date' } });
    await getWhileYouWereGone(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Invalid since timestamp' }),
    );
  });

  it('returns competition-result items with priority 1', async () => {
    const ts = new Date('2026-03-01T12:00:00.000Z');
    mockPrisma.competitionResult.findMany.mockResolvedValue([
      {
        id: 'cr-1',
        placement: '1',
        prize: 500,
        createdAt: ts,
        horse: { name: 'Thunder' },
        show: { name: 'Spring Cup' },
      },
    ]);
    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    const body = res.json.mock.calls[0][0];
    const item = body.data.items[0];
    expect(item.type).toBe('competition-result');
    expect(item.priority).toBe(1);
    expect(item.title).toContain('Thunder');
    expect(item.title).toContain('Spring Cup');
    expect(item.description).toContain('1');
    expect(item.description).toContain('500');
    expect(item.actionUrl).toBe('/competitions');
    expect(item.metadata.resultId).toBe('cr-1');
  });

  it('returns message items with priority 3', async () => {
    const ts = new Date('2026-03-01T14:00:00.000Z');
    mockPrisma.directMessage.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        content: 'Hello, want to trade horses?',
        createdAt: ts,
        sender: { username: 'FarmFriend' },
      },
    ]);
    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    const body = res.json.mock.calls[0][0];
    const item = body.data.items[0];
    expect(item.type).toBe('message');
    expect(item.priority).toBe(3);
    expect(item.title).toContain('FarmFriend');
    expect(item.description).toContain('Hello');
    expect(item.actionUrl).toBe('/messages');
  });

  it('returns foal-milestone items with priority 2', async () => {
    const ts = new Date('2026-03-01T13:00:00.000Z');
    mockPrisma.foalDevelopment.findMany.mockResolvedValue([
      {
        foalId: 'foal-1',
        bondScore: 50,
        lastInteractionAt: ts,
        foal: { name: 'Baby Star' },
      },
    ]);
    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    const body = res.json.mock.calls[0][0];
    const item = body.data.items[0];
    expect(item.type).toBe('foal-milestone');
    expect(item.priority).toBe(2);
    expect(item.title).toContain('Baby Star');
    expect(item.actionUrl).toBe('/grooms');
    expect(item.metadata.foalId).toBe('foal-1');
  });

  it('sorts items by priority then by timestamp descending', async () => {
    const early = new Date('2026-03-01T10:00:00.000Z');
    const late = new Date('2026-03-01T14:00:00.000Z');

    mockPrisma.competitionResult.findMany.mockResolvedValue([
      {
        id: 'cr-1',
        placement: '2',
        prize: 100,
        createdAt: early,
        horse: { name: 'A' },
        show: { name: 'Show A' },
      },
    ]);
    mockPrisma.directMessage.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        content: 'Hi',
        createdAt: late,
        sender: { username: 'User1' },
      },
    ]);
    mockPrisma.foalDevelopment.findMany.mockResolvedValue([
      {
        foalId: 'f-1',
        bondScore: 30,
        lastInteractionAt: late,
        foal: { name: 'Foal' },
      },
    ]);

    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    const body = res.json.mock.calls[0][0];
    const types = body.data.items.map(i => i.type);
    // Priority order: competition (1), foal (2), message (3)
    expect(types).toEqual(['competition-result', 'foal-milestone', 'message']);
  });

  it('limits output to 8 items maximum', async () => {
    // Generate 10 competition results
    const results = Array.from({ length: 10 }, (_, i) => ({
      id: `cr-${i}`,
      placement: `${i + 1}`,
      prize: 0,
      createdAt: new Date(),
      horse: { name: `Horse${i}` },
      show: { name: `Show${i}` },
    }));
    mockPrisma.competitionResult.findMany.mockResolvedValue(results);

    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.items.length).toBeLessThanOrEqual(8);
  });

  it('sets hasMore to true when items exceed MAX_ITEMS', async () => {
    const results = Array.from({ length: 10 }, (_, i) => ({
      id: `cr-${i}`,
      placement: '1',
      prize: 0,
      createdAt: new Date(),
      horse: { name: `H${i}` },
      show: { name: `S${i}` },
    }));
    mockPrisma.competitionResult.findMany.mockResolvedValue(results);

    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.hasMore).toBe(true);
  });

  it('sets hasMore to false when items fit within limit', async () => {
    mockPrisma.competitionResult.findMany.mockResolvedValue([
      { id: 'cr-1', placement: '1', prize: 0, createdAt: new Date(), horse: { name: 'H' }, show: { name: 'S' } },
    ]);
    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.hasMore).toBe(false);
  });

  it('gracefully handles competitionResult query failure', async () => {
    mockPrisma.competitionResult.findMany.mockRejectedValue(new Error('Table missing'));
    mockPrisma.directMessage.findMany.mockResolvedValue([
      { id: 'msg-1', content: 'Hi', createdAt: new Date(), sender: { username: 'X' } },
    ]);
    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    // Should still have message item
    expect(body.data.items.some(i => i.type === 'message')).toBe(true);
  });

  it('gracefully handles directMessage query failure', async () => {
    mockPrisma.directMessage.findMany.mockRejectedValue(new Error('Table missing'));
    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
  });

  it('gracefully handles foalDevelopment query failure', async () => {
    mockPrisma.foalDevelopment.findMany.mockRejectedValue(new Error('Table missing'));
    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
  });

  it('returns 500 on unexpected top-level error', async () => {
    // Simulate error in the outer try block by making req.user getter throw
    const { res } = createMockReqRes();
    const badReq = {
      get user() {
        throw new Error('Unexpected');
      },
      query: {},
    };
    await getWhileYouWereGone(badReq, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Failed to fetch activity summary' }),
    );
  });

  it('handles horse name fallback when horse is null', async () => {
    mockPrisma.competitionResult.findMany.mockResolvedValue([
      {
        id: 'cr-1',
        placement: '3',
        prize: 50,
        createdAt: new Date(),
        horse: null,
        show: { name: 'Cup' },
      },
    ]);
    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.items[0].title).toContain('Your horse');
  });

  it('handles show name fallback when show is null', async () => {
    mockPrisma.competitionResult.findMany.mockResolvedValue([
      {
        id: 'cr-1',
        placement: '1',
        prize: 100,
        createdAt: new Date(),
        horse: { name: 'Thunder' },
        show: null,
      },
    ]);
    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.items[0].title).toContain('a show');
  });

  it('truncates message content to 80 characters in description', async () => {
    const longContent = 'A'.repeat(200);
    mockPrisma.directMessage.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        content: longContent,
        createdAt: new Date(),
        sender: { username: 'Bob' },
      },
    ]);
    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.items[0].description.length).toBeLessThanOrEqual(80);
  });

  it('uses bondingLevel fallback when bondScore is undefined', async () => {
    mockPrisma.foalDevelopment.findMany.mockResolvedValue([
      {
        foalId: 'f-1',
        bondScore: undefined,
        bondingLevel: 42,
        lastInteractionAt: new Date(),
        foal: { name: 'Foaly' },
      },
    ]);
    const { req, res } = createMockReqRes();
    await getWhileYouWereGone(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.items[0].description).toContain('42');
  });
});
