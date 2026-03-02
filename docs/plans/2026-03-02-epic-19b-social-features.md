# Epic 19B — Social Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Message Board, Direct Messages, and Clubs with Elections — three social features replacing mock data in existing frontend pages with live REST APIs and Prisma-backed storage.

**Architecture:** Three sequential Prisma migrations (one per feature). All endpoints mounted on `authRouter` in `backend/app.mjs` (authentication always required). React Query hooks replace `MOCK_*` constants in `MessageBoardPage.tsx`, `MessagesPage.tsx`, and `ClubsPage.tsx`. Pre-push hook (226 suites) must pass after each phase before starting the next.

**Tech Stack:** Node.js + Express + Prisma (backend), React 19 + React Query + TypeScript (frontend), Jest + Supertest (backend tests), MSW (frontend test mocks)

---

## Phase 1: Message Board (19B-1)

---

### Task 1: Add ForumThread + ForumPost models to Prisma schema

**Files:**

- Modify: `packages/database/prisma/schema.prisma`

**Step 1: Add enum + models**

Find the `model User {` block and add these relation fields to the User model (inside the existing User model, after the last field before `}`):

```prisma
  forumThreads     ForumThread[]    @relation("ForumThreads")
  forumPosts       ForumPost[]      @relation("ForumPosts")
```

Then at the end of the schema file, after the last model, add:

```prisma
enum BoardSection {
  general
  art
  sales
  services
  venting
}

model ForumThread {
  id             Int           @id @default(autoincrement())
  section        BoardSection
  title          String
  authorId       String
  author         User          @relation("ForumThreads", fields: [authorId], references: [id])
  tags           String[]
  isPinned       Boolean       @default(false)
  viewCount      Int           @default(0)
  lastActivityAt DateTime      @default(now())
  createdAt      DateTime      @default(now())
  posts          ForumPost[]
}

model ForumPost {
  id        Int         @id @default(autoincrement())
  threadId  Int
  thread    ForumThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  authorId  String
  author    User        @relation("ForumPosts", fields: [authorId], references: [id])
  content   String
  createdAt DateTime    @default(now())
}
```

**Step 2: Run migration**

```bash
cd packages/database
npx prisma migrate dev --name add_forum_models
```

Expected: `Your database is now in sync with your schema.`

**Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

**Step 4: Verify client has new models**

```bash
node -e "import('./prismaClient.mjs').then(m => console.log('forumThread' in m.default, 'forumPost' in m.default))"
```

Expected: `true true`

**Step 5: Commit**

```bash
cd ../..
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(19B-1): add ForumThread + ForumPost schema models"
```

---

### Task 2: Write failing integration tests for forum API

**Files:**

- Create: `backend/tests/integration/forumAPI.test.mjs`

**Step 1: Create the test file**

```javascript
/**
 * Forum API Integration Tests (19B-1)
 * Tests for GET/POST forum threads and posts.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestUser, cleanupTestData } from '../helpers/testAuth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import app from '../../app.mjs';

describe('💬 INTEGRATION: Forum API', () => {
  let testUser;
  let authToken;
  let createdThreadId;

  beforeAll(async () => {
    const timestamp = Date.now();
    const userData = await createTestUser({
      username: `testuser_forum_${timestamp}`,
      email: `forum-test-${timestamp}@test.com`,
    });
    testUser = userData.user;
    authToken = userData.token;
  });

  afterAll(async () => {
    try {
      await prisma.forumPost.deleteMany({ where: { authorId: testUser?.id } });
      await prisma.forumThread.deleteMany({ where: { authorId: testUser?.id } });
    } catch {
      /* ignore */
    }
    await cleanupTestData();
  });

  describe('Authentication', () => {
    it('should require auth for creating threads', async () => {
      const res = await request(app).post('/api/forum/threads').send({
        section: 'general',
        title: 'Test',
        content: 'Hello',
        tags: [],
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/forum/threads', () => {
    it('should create a thread', async () => {
      const res = await request(app)
        .post('/api/forum/threads')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          section: 'general',
          title: 'My test thread',
          content: 'First post!',
          tags: ['guide'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.thread.title).toBe('My test thread');
      expect(res.body.data.thread.section).toBe('general');
      expect(res.body.data.firstPost.content).toBe('First post!');
      createdThreadId = res.body.data.thread.id;
    });

    it('should reject missing title', async () => {
      const res = await request(app)
        .post('/api/forum/threads')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ section: 'general', content: 'oops' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid section', async () => {
      const res = await request(app)
        .post('/api/forum/threads')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ section: 'invalid', title: 'Test', content: 'test' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/forum/threads', () => {
    it('should list threads for a section', async () => {
      const res = await request(app)
        .get('/api/forum/threads?section=general')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.threads)).toBe(true);
      expect(res.body.data.threads.length).toBeGreaterThan(0);
    });

    it('should return pinned threads first', async () => {
      const res = await request(app)
        .get('/api/forum/threads?section=general')
        .set('Authorization', `Bearer ${authToken}`);
      const threads = res.body.data.threads;
      const pinnedIndexes = threads.map((t, i) => (t.isPinned ? i : -1)).filter((i) => i >= 0);
      const unpinnedIndexes = threads.map((t, i) => (!t.isPinned ? i : -1)).filter((i) => i >= 0);
      if (pinnedIndexes.length > 0 && unpinnedIndexes.length > 0) {
        expect(Math.max(...pinnedIndexes)).toBeLessThan(Math.min(...unpinnedIndexes));
      }
    });

    it('should include replyCount on each thread', async () => {
      const res = await request(app)
        .get('/api/forum/threads?section=general')
        .set('Authorization', `Bearer ${authToken}`);
      const thread = res.body.data.threads.find((t) => t.id === createdThreadId);
      expect(thread).toBeDefined();
      expect(typeof thread.replyCount).toBe('number');
    });
  });

  describe('GET /api/forum/threads/:id', () => {
    it('should return thread with posts', async () => {
      const res = await request(app)
        .get(`/api/forum/threads/${createdThreadId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.thread.id).toBe(createdThreadId);
      expect(Array.isArray(res.body.data.posts)).toBe(true);
      expect(res.body.data.posts.length).toBe(1);
    });

    it('should return 404 for non-existent thread', async () => {
      const res = await request(app)
        .get('/api/forum/threads/99999999')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/forum/threads/:id/posts', () => {
    it('should add a reply to a thread', async () => {
      const res = await request(app)
        .post(`/api/forum/threads/${createdThreadId}/posts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Great thread!' });

      expect(res.status).toBe(201);
      expect(res.body.data.post.content).toBe('Great thread!');
    });

    it('should reject empty content', async () => {
      const res = await request(app)
        .post(`/api/forum/threads/${createdThreadId}/posts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/forum/threads/:id/view', () => {
    it('should increment viewCount', async () => {
      const before = await prisma.forumThread.findUnique({ where: { id: createdThreadId } });
      await request(app)
        .post(`/api/forum/threads/${createdThreadId}/view`)
        .set('Authorization', `Bearer ${authToken}`);
      const after = await prisma.forumThread.findUnique({ where: { id: createdThreadId } });
      expect(after.viewCount).toBe(before.viewCount + 1);
    });
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
cd backend
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/integration/forumAPI.test.mjs --no-coverage
```

Expected: FAIL — `Cannot find module '../../app.mjs'` or route 404s (routes not yet registered)

---

### Task 3: Implement forumController.mjs

**Files:**

- Create: `backend/controllers/forumController.mjs`

```javascript
/**
 * Forum Controller (19B-1)
 * Handles CRUD for ForumThread and ForumPost.
 *
 * Routes:
 *   GET  /api/forum/threads           → list threads by section, pinned first
 *   GET  /api/forum/threads/:id       → thread detail with posts
 *   POST /api/forum/threads           → create thread (first post included)
 *   POST /api/forum/threads/:id/posts → reply to thread
 *   POST /api/forum/threads/:id/view  → increment viewCount
 *   PATCH /api/forum/threads/:id/pin  → toggle isPinned (admin)
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

const VALID_SECTIONS = ['general', 'art', 'sales', 'services', 'venting'];
const THREADS_PER_PAGE = 20;

/**
 * GET /api/forum/threads?section=&page=
 * Returns threads for a section, pinned first, then by lastActivityAt desc.
 */
export async function getThreads(req, res) {
  const { section, page = '1' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const skip = (pageNum - 1) * THREADS_PER_PAGE;

  const where = section && VALID_SECTIONS.includes(section) ? { section } : {};

  try {
    const [threads, total] = await Promise.all([
      prisma.forumThread.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { lastActivityAt: 'desc' }],
        skip,
        take: THREADS_PER_PAGE,
        include: {
          author: { select: { id: true, username: true } },
          _count: { select: { posts: true } },
        },
      }),
      prisma.forumThread.count({ where }),
    ]);

    const shaped = threads.map((t) => ({
      id: t.id,
      section: t.section,
      title: t.title,
      author: t.author,
      tags: t.tags,
      isPinned: t.isPinned,
      viewCount: t.viewCount,
      replyCount: t._count.posts,
      lastActivityAt: t.lastActivityAt,
      createdAt: t.createdAt,
    }));

    return res.json({ success: true, data: { threads: shaped, total, page: pageNum } });
  } catch (error) {
    logger.error(`[forumController.getThreads] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch threads' });
  }
}

/**
 * GET /api/forum/threads/:id
 * Returns a single thread with all its posts.
 */
export async function getThread(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || id <= 0) return res.status(400).json({ success: false, message: 'Invalid thread ID' });

  try {
    const thread = await prisma.forumThread.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true } },
        posts: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, username: true } } },
        },
      },
    });

    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });

    const { posts, ...threadData } = thread;
    return res.json({ success: true, data: { thread: threadData, posts } });
  } catch (error) {
    logger.error(`[forumController.getThread] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch thread' });
  }
}

/**
 * POST /api/forum/threads
 * Creates a thread and its first post atomically.
 * Body: { section, title, content, tags? }
 */
export async function createThread(req, res) {
  const { section, title, content, tags = [] } = req.body;
  const authorId = req.user.id;

  try {
    const [thread, firstPost] = await prisma.$transaction(async (tx) => {
      const t = await tx.forumThread.create({
        data: { section, title, authorId, tags },
        include: { author: { select: { id: true, username: true } } },
      });
      const p = await tx.forumPost.create({
        data: { threadId: t.id, authorId, content },
        include: { author: { select: { id: true, username: true } } },
      });
      return [t, p];
    });

    logger.info(`[forumController.createThread] User ${authorId} created thread ${thread.id}`);
    return res.status(201).json({ success: true, data: { thread, firstPost } });
  } catch (error) {
    logger.error(`[forumController.createThread] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create thread' });
  }
}

/**
 * POST /api/forum/threads/:id/posts
 * Adds a reply to a thread and updates lastActivityAt.
 * Body: { content }
 */
export async function createPost(req, res) {
  const threadId = parseInt(req.params.id, 10);
  const { content } = req.body;
  const authorId = req.user.id;

  if (!threadId || threadId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid thread ID' });

  try {
    const thread = await prisma.forumThread.findUnique({ where: { id: threadId } });
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });

    const [post] = await prisma.$transaction([
      prisma.forumPost.create({
        data: { threadId, authorId, content },
        include: { author: { select: { id: true, username: true } } },
      }),
      prisma.forumThread.update({
        where: { id: threadId },
        data: { lastActivityAt: new Date() },
      }),
    ]);

    return res.status(201).json({ success: true, data: { post } });
  } catch (error) {
    logger.error(`[forumController.createPost] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create post' });
  }
}

/**
 * POST /api/forum/threads/:id/view
 * Increments viewCount by 1.
 */
export async function incrementView(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || id <= 0) return res.status(400).json({ success: false, message: 'Invalid thread ID' });

  try {
    await prisma.forumThread.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
    return res.json({ success: true });
  } catch (error) {
    logger.error(`[forumController.incrementView] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update view count' });
  }
}

/**
 * PATCH /api/forum/threads/:id/pin
 * Toggles isPinned. Admin only (enforced in routes).
 */
export async function pinThread(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || id <= 0) return res.status(400).json({ success: false, message: 'Invalid thread ID' });

  try {
    const thread = await prisma.forumThread.findUnique({ where: { id } });
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });

    const updated = await prisma.forumThread.update({
      where: { id },
      data: { isPinned: !thread.isPinned },
    });
    return res.json({ success: true, data: { isPinned: updated.isPinned } });
  } catch (error) {
    logger.error(`[forumController.pinThread] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update pin status' });
  }
}
```

---

### Task 4: Implement forumRoutes.mjs

**Files:**

- Create: `backend/routes/forumRoutes.mjs`

```javascript
/**
 * Forum Routes (19B-1)
 * All forum endpoints under /api/forum.
 *
 *   GET    /threads              → list threads (paginated, section-filtered)
 *   GET    /threads/:id          → thread detail with posts
 *   POST   /threads              → create thread + first post
 *   POST   /threads/:id/posts    → reply
 *   POST   /threads/:id/view     → increment view count
 *   PATCH  /threads/:id/pin      → toggle pin (admin only)
 */

import express from 'express';
import { body, query, validationResult } from 'express-validator';
import logger from '../utils/logger.mjs';
import { requireRole } from '../middleware/auth.mjs';
import {
  getThreads,
  getThread,
  createThread,
  createPost,
  incrementView,
  pinThread,
} from '../controllers/forumController.mjs';

const router = express.Router();

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[forumRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res
      .status(400)
      .json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

const VALID_SECTIONS = ['general', 'art', 'sales', 'services', 'venting'];

router.get(
  '/threads',
  [
    query('section').optional().isIn(VALID_SECTIONS).withMessage('Invalid section'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    handleValidation,
  ],
  getThreads
);

router.get('/threads/:id', getThread);

router.post(
  '/threads',
  [
    body('section')
      .isIn(VALID_SECTIONS)
      .withMessage('section must be one of: ' + VALID_SECTIONS.join(', ')),
    body('title')
      .trim()
      .notEmpty()
      .withMessage('title is required')
      .isLength({ max: 200 })
      .withMessage('title max 200 chars'),
    body('content').trim().notEmpty().withMessage('content is required'),
    body('tags').optional().isArray().withMessage('tags must be an array'),
    handleValidation,
  ],
  createThread
);

router.post(
  '/threads/:id/posts',
  [body('content').trim().notEmpty().withMessage('content is required'), handleValidation],
  createPost
);

router.post('/threads/:id/view', incrementView);

router.patch('/threads/:id/pin', requireRole('admin'), pinThread);

export default router;
```

---

### Task 5: Register forum routes in app.mjs

**Files:**

- Modify: `backend/app.mjs`

**Step 1: Add import** (after the last route import, around line 89):

```javascript
import forumRoutes from './routes/forumRoutes.mjs';
```

**Step 2: Register on authRouter** (after `authRouter.use('/inventory', inventoryRoutes);`, around line 154):

```javascript
authRouter.use('/forum', forumRoutes);
```

**Step 3: Run the tests**

```bash
cd backend
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/integration/forumAPI.test.mjs --no-coverage
```

Expected: all tests PASS

**Step 4: Commit**

```bash
cd ..
git add backend/controllers/forumController.mjs backend/routes/forumRoutes.mjs backend/app.mjs backend/tests/integration/forumAPI.test.mjs
git commit -m "feat(19B-1): forum controller, routes, and integration tests"
```

---

### Task 6: Add forumApi to api-client.ts + implement useForum.ts hook

**Files:**

- Modify: `frontend/src/lib/api-client.ts`
- Create: `frontend/src/hooks/api/useForum.ts`

**Step 1: Add types + forumApi to api-client.ts** (add near end of file, before last export):

```typescript
// ── Forum Types ───────────────────────────────────────────────────────────────

export interface ForumAuthor {
  id: string;
  username: string;
}

export interface ForumThread {
  id: number;
  section: 'general' | 'art' | 'sales' | 'services' | 'venting';
  title: string;
  author: ForumAuthor;
  tags: string[];
  isPinned: boolean;
  viewCount: number;
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
}

export interface ForumPost {
  id: number;
  threadId: number;
  author: ForumAuthor;
  content: string;
  createdAt: string;
}

export interface ForumThreadDetail {
  thread: ForumThread;
  posts: ForumPost[];
}

export interface ForumThreadsResponse {
  threads: ForumThread[];
  total: number;
  page: number;
}

// ── Forum API ─────────────────────────────────────────────────────────────────

export const forumApi = {
  getThreads: (section?: string, page = 1) => {
    const params = new URLSearchParams({ page: String(page) });
    if (section) params.set('section', section);
    return apiClient.get<ForumThreadsResponse>(`/api/forum/threads?${params}`);
  },
  getThread: (id: number) => apiClient.get<ForumThreadDetail>(`/api/forum/threads/${id}`),
  createThread: (payload: { section: string; title: string; content: string; tags?: string[] }) =>
    apiClient.post<{ thread: ForumThread; firstPost: ForumPost }>('/api/forum/threads', payload),
  createPost: (threadId: number, content: string) =>
    apiClient.post<{ post: ForumPost }>(`/api/forum/threads/${threadId}/posts`, { content }),
  incrementView: (threadId: number) =>
    apiClient.post<void>(`/api/forum/threads/${threadId}/view`, {}),
};
```

**Step 2: Create `frontend/src/hooks/api/useForum.ts`**

```typescript
/**
 * useForum hooks (19B-1)
 * Provides forum data via React Query.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { forumApi } from '@/lib/api-client';

export function useForumThreads(section?: string, page = 1) {
  return useQuery({
    queryKey: ['forum', 'threads', section, page],
    queryFn: () => forumApi.getThreads(section, page),
    staleTime: 60_000,
  });
}

export function useForumThread(id: number) {
  return useQuery({
    queryKey: ['forum', 'thread', id],
    queryFn: () => forumApi.getThread(id),
    staleTime: 2 * 60_000,
    enabled: !!id,
  });
}

export function useCreateThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { section: string; title: string; content: string; tags?: string[] }) =>
      forumApi.createThread(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['forum', 'threads', variables.section] });
    },
  });
}

export function useCreatePost(threadId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => forumApi.createPost(threadId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum', 'thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['forum', 'threads'] });
    },
  });
}
```

---

### Task 7: Wire MessageBoardPage.tsx to live data

**Files:**

- Modify: `frontend/src/pages/MessageBoardPage.tsx`

**Step 1: Replace mock import with hook**

Remove the `MOCK_THREADS` constant at the top of the file.

Add import at the top:

```typescript
import { useForumThreads, useCreateThread } from '@/hooks/api/useForum';
import type { ForumThread } from '@/lib/api-client';
```

**Step 2: Replace mock data with hook in the component body**

Find where `MOCK_THREADS` is filtered/used and replace with:

```typescript
const { data, isLoading } = useForumThreads(activeSection);
const threads = data?.threads ?? [];
const createThread = useCreateThread();
```

**Step 3: Add loading state** — wrap thread list render:

```tsx
{isLoading ? (
  <div className="text-center py-8 text-gray-400">Loading threads…</div>
) : threads.length === 0 ? (
  <div className="text-center py-8 text-gray-400">No threads yet. Be the first to post!</div>
) : (
  /* existing thread card render using `threads` instead of filtered MOCK_THREADS */
)}
```

**Step 4: Enable "New Post" button** — find the disabled PlusCircle button and replace `disabled` with:

```tsx
onClick={() => setShowNewThread(true)}
```

Add a minimal inline state + form for new thread (after the button):

```tsx
const [showNewThread, setShowNewThread] = useState(false);
const [newTitle, setNewTitle] = useState('');
const [newContent, setNewContent] = useState('');

{
  showNewThread && (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-space-dark border border-celestial-primary/30 rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-lg font-semibold text-white mb-4">New Thread</h2>
        <input
          className="w-full bg-space-darker border border-white/10 rounded px-3 py-2 text-white mb-3"
          placeholder="Title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <textarea
          className="w-full bg-space-darker border border-white/10 rounded px-3 py-2 text-white mb-4 h-32"
          placeholder="Content"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
        />
        <div className="flex gap-3 justify-end">
          <button
            className="px-4 py-2 text-gray-400 hover:text-white"
            onClick={() => setShowNewThread(false)}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-celestial-primary text-white rounded hover:bg-celestial-primary/80 disabled:opacity-50"
            disabled={!newTitle.trim() || !newContent.trim() || createThread.isPending}
            onClick={async () => {
              await createThread.mutateAsync({
                section: activeSection,
                title: newTitle.trim(),
                content: newContent.trim(),
              });
              setShowNewThread(false);
              setNewTitle('');
              setNewContent('');
            }}
          >
            {createThread.isPending ? 'Posting…' : 'Post Thread'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 5: Verify build**

```bash
cd frontend
npx vite build 2>&1 | tail -5
```

Expected: `✓ built in Xs`

**Step 6: Commit phase 1**

```bash
cd ..
git add frontend/src/lib/api-client.ts frontend/src/hooks/api/useForum.ts frontend/src/pages/MessageBoardPage.tsx
git commit -m "feat(19B-1): wire MessageBoardPage to live forum API"
```

---

### Task 8: Push phase 1 (pre-push hook runs all 226 suites)

```bash
git push origin master
```

Expected: all 226+ suites pass, push succeeds. Fix any failures before proceeding to Phase 2.

---

## Phase 2: Direct Messages (19B-2)

---

### Task 9: Add DirectMessage model to schema

**Files:**

- Modify: `packages/database/prisma/schema.prisma`

**Step 1: Add relation fields to User model** (inside existing User model):

```prisma
  sentMessages     DirectMessage[] @relation("SentMessages")
  receivedMessages DirectMessage[] @relation("ReceivedMessages")
```

**Step 2: Add model** (at end of schema file):

```prisma
model DirectMessage {
  id          Int      @id @default(autoincrement())
  senderId    String
  sender      User     @relation("SentMessages", fields: [senderId], references: [id])
  recipientId String
  recipient   User     @relation("ReceivedMessages", fields: [recipientId], references: [id])
  subject     String
  content     String
  tag         String?
  isRead      Boolean  @default(false)
  createdAt   DateTime @default(now())
}
```

**Step 3: Run migration**

```bash
cd packages/database
npx prisma migrate dev --name add_direct_message_model
npx prisma generate
cd ../..
```

**Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(19B-2): add DirectMessage schema model"
```

---

### Task 10: Write failing tests + implement messageController.mjs

**Files:**

- Create: `backend/tests/integration/messageAPI.test.mjs`
- Create: `backend/controllers/messageController.mjs`

**Step 1: Create tests**

```javascript
/**
 * Direct Message API Integration Tests (19B-2)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestUser, cleanupTestData } from '../helpers/testAuth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import app from '../../app.mjs';

describe('📬 INTEGRATION: Messages API', () => {
  let sender, senderToken, recipient, recipientToken;
  let sentMessageId;

  beforeAll(async () => {
    const ts = Date.now();
    const s = await createTestUser({ username: `sender_${ts}`, email: `sender_${ts}@test.com` });
    const r = await createTestUser({
      username: `recipient_${ts}`,
      email: `recipient_${ts}@test.com`,
    });
    sender = s.user;
    senderToken = s.token;
    recipient = r.user;
    recipientToken = r.token;
  });

  afterAll(async () => {
    try {
      await prisma.directMessage.deleteMany({
        where: { OR: [{ senderId: sender?.id }, { senderId: recipient?.id }] },
      });
    } catch {
      /* ignore */
    }
    await cleanupTestData();
  });

  describe('Authentication', () => {
    it('should require auth for all message endpoints', async () => {
      const [a, b, c] = await Promise.all([
        request(app).get('/api/messages/inbox'),
        request(app).post('/api/messages').send({}),
        request(app).get('/api/messages/unread-count'),
      ]);
      expect(a.status).toBe(401);
      expect(b.status).toBe(401);
      expect(c.status).toBe(401);
    });
  });

  describe('POST /api/messages', () => {
    it('should send a message', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ recipientId: recipient.id, subject: 'Hello!', content: 'Want to trade horses?' });

      expect(res.status).toBe(201);
      expect(res.body.data.message.subject).toBe('Hello!');
      expect(res.body.data.message.isRead).toBe(false);
      sentMessageId = res.body.data.message.id;
    });

    it('should reject sending to self', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ recipientId: sender.id, subject: 'Hi me', content: 'test' });
      expect(res.status).toBe(400);
    });

    it('should reject missing subject', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ recipientId: recipient.id, content: 'no subject' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/messages/inbox', () => {
    it('should return received messages for recipient', async () => {
      const res = await request(app)
        .get('/api/messages/inbox')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      const msgs = res.body.data.messages;
      expect(msgs.some((m) => m.id === sentMessageId)).toBe(true);
    });
  });

  describe('GET /api/messages/unread-count', () => {
    it('should return unread count for recipient', async () => {
      const res = await request(app)
        .get('/api/messages/unread-count')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBeGreaterThan(0);
    });
  });

  describe('GET /api/messages/sent', () => {
    it('should return sent messages for sender', async () => {
      const res = await request(app)
        .get('/api/messages/sent')
        .set('Authorization', `Bearer ${senderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.messages.some((m) => m.id === sentMessageId)).toBe(true);
    });
  });

  describe('GET /api/messages/:id', () => {
    it('should return message and mark it read', async () => {
      const res = await request(app)
        .get(`/api/messages/${sentMessageId}`)
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message.isRead).toBe(true);
    });

    it('should block access to messages not yours', async () => {
      const other = await createTestUser({
        username: `other_${Date.now()}`,
        email: `other_${Date.now()}@test.com`,
      });
      const res = await request(app)
        .get(`/api/messages/${sentMessageId}`)
        .set('Authorization', `Bearer ${other.token}`);
      expect(res.status).toBe(403);
    });
  });
});
```

**Step 2: Run tests to confirm they fail (routes not yet registered)**

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/integration/messageAPI.test.mjs --no-coverage
```

Expected: FAIL

**Step 3: Implement messageController.mjs**

```javascript
/**
 * Message Controller (19B-2)
 * Handles DirectMessage inbox, sent, compose, and mark-read.
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

const USER_SELECT = { id: true, username: true };

/** GET /api/messages/inbox */
export async function getInbox(req, res) {
  const userId = req.user.id;
  try {
    const messages = await prisma.directMessage.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: USER_SELECT } },
    });
    return res.json({ success: true, data: { messages } });
  } catch (error) {
    logger.error(`[messageController.getInbox] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch inbox' });
  }
}

/** GET /api/messages/sent */
export async function getSent(req, res) {
  const userId = req.user.id;
  try {
    const messages = await prisma.directMessage.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
      include: { recipient: { select: USER_SELECT } },
    });
    return res.json({ success: true, data: { messages } });
  } catch (error) {
    logger.error(`[messageController.getSent] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch sent messages' });
  }
}

/** GET /api/messages/unread-count */
export async function getUnreadCount(req, res) {
  const userId = req.user.id;
  try {
    const count = await prisma.directMessage.count({
      where: { recipientId: userId, isRead: false },
    });
    return res.json({ success: true, data: { count } });
  } catch (error) {
    logger.error(`[messageController.getUnreadCount] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
  }
}

/** GET /api/messages/:id — marks as read for recipient */
export async function getMessage(req, res) {
  const id = parseInt(req.params.id, 10);
  const userId = req.user.id;
  if (!id || id <= 0)
    return res.status(400).json({ success: false, message: 'Invalid message ID' });

  try {
    const message = await prisma.directMessage.findUnique({
      where: { id },
      include: {
        sender: { select: USER_SELECT },
        recipient: { select: USER_SELECT },
      },
    });

    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    if (message.senderId !== userId && message.recipientId !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Auto-mark as read when recipient fetches
    if (message.recipientId === userId && !message.isRead) {
      await prisma.directMessage.update({ where: { id }, data: { isRead: true } });
      message.isRead = true;
    }

    return res.json({ success: true, data: { message } });
  } catch (error) {
    logger.error(`[messageController.getMessage] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch message' });
  }
}

/** POST /api/messages — compose + send */
export async function sendMessage(req, res) {
  const { recipientId, subject, content, tag } = req.body;
  const senderId = req.user.id;

  if (senderId === recipientId) {
    return res.status(400).json({ success: false, message: 'Cannot send a message to yourself' });
  }

  try {
    const recipientExists = await prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipientExists)
      return res.status(404).json({ success: false, message: 'Recipient not found' });

    const message = await prisma.directMessage.create({
      data: { senderId, recipientId, subject, content, tag },
      include: {
        sender: { select: USER_SELECT },
        recipient: { select: USER_SELECT },
      },
    });

    logger.info(`[messageController.sendMessage] ${senderId} → ${recipientId}`);
    return res.status(201).json({ success: true, data: { message } });
  } catch (error) {
    logger.error(`[messageController.sendMessage] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
}

/** PATCH /api/messages/:id/read */
export async function markRead(req, res) {
  const id = parseInt(req.params.id, 10);
  const userId = req.user.id;
  if (!id || id <= 0)
    return res.status(400).json({ success: false, message: 'Invalid message ID' });

  try {
    const message = await prisma.directMessage.findUnique({ where: { id } });
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    if (message.recipientId !== userId)
      return res.status(403).json({ success: false, message: 'Access denied' });

    await prisma.directMessage.update({ where: { id }, data: { isRead: true } });
    return res.json({ success: true });
  } catch (error) {
    logger.error(`[messageController.markRead] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to mark message as read' });
  }
}
```

---

### Task 11: Implement messageRoutes.mjs + register + verify

**Files:**

- Create: `backend/routes/messageRoutes.mjs`
- Modify: `backend/app.mjs`

**Step 1: Create routes**

```javascript
/**
 * Message Routes (19B-2)
 * All direct message endpoints under /api/messages.
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import logger from '../utils/logger.mjs';
import {
  getInbox,
  getSent,
  getUnreadCount,
  getMessage,
  sendMessage,
  markRead,
} from '../controllers/messageController.mjs';

const router = express.Router();

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[messageRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res
      .status(400)
      .json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

router.get('/inbox', getInbox);
router.get('/sent', getSent);
router.get('/unread-count', getUnreadCount);
router.get('/:id', getMessage);

router.post(
  '/',
  [
    body('recipientId').notEmpty().withMessage('recipientId is required'),
    body('subject').trim().notEmpty().withMessage('subject is required').isLength({ max: 200 }),
    body('content').trim().notEmpty().withMessage('content is required'),
    body('tag').optional().isString(),
    handleValidation,
  ],
  sendMessage
);

router.patch('/:id/read', markRead);

export default router;
```

**Step 2: Register in app.mjs** (after forum route registration):

```javascript
import messageRoutes from './routes/messageRoutes.mjs';
// ...
authRouter.use('/messages', messageRoutes);
```

**Step 3: Run tests**

```bash
cd backend
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/integration/messageAPI.test.mjs --no-coverage
```

Expected: all PASS

**Step 4: Commit**

```bash
cd ..
git add backend/controllers/messageController.mjs backend/routes/messageRoutes.mjs backend/app.mjs backend/tests/integration/messageAPI.test.mjs
git commit -m "feat(19B-2): direct message controller, routes, and integration tests"
```

---

### Task 12: Add messagesApi + useMessages hook + wire MessagesPage

**Files:**

- Modify: `frontend/src/lib/api-client.ts`
- Create: `frontend/src/hooks/api/useMessages.ts`
- Modify: `frontend/src/pages/MessagesPage.tsx`
- Modify: `frontend/src/components/MainNavigation.tsx`

**Step 1: Add to api-client.ts**

```typescript
// ── Message Types ─────────────────────────────────────────────────────────────

export interface DirectMessage {
  id: number;
  sender: { id: string; username: string };
  recipient: { id: string; username: string };
  subject: string;
  content: string;
  tag?: string;
  isRead: boolean;
  createdAt: string;
}

// ── Messages API ──────────────────────────────────────────────────────────────

export const messagesApi = {
  getInbox: () => apiClient.get<{ messages: DirectMessage[] }>('/api/messages/inbox'),
  getSent: () => apiClient.get<{ messages: DirectMessage[] }>('/api/messages/sent'),
  getUnreadCount: () => apiClient.get<{ count: number }>('/api/messages/unread-count'),
  getMessage: (id: number) => apiClient.get<{ message: DirectMessage }>(`/api/messages/${id}`),
  sendMessage: (payload: { recipientId: string; subject: string; content: string; tag?: string }) =>
    apiClient.post<{ message: DirectMessage }>('/api/messages', payload),
  markRead: (id: number) => apiClient.patch<void>(`/api/messages/${id}/read`, {}),
};
```

**Step 2: Create `frontend/src/hooks/api/useMessages.ts`**

```typescript
/**
 * useMessages hooks (19B-2)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi } from '@/lib/api-client';

export function useInbox() {
  return useQuery({
    queryKey: ['messages', 'inbox'],
    queryFn: () => messagesApi.getInbox(),
    staleTime: 30_000,
  });
}

export function useSentMessages() {
  return useQuery({
    queryKey: ['messages', 'sent'],
    queryFn: () => messagesApi.getSent(),
    staleTime: 30_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: () => messagesApi.getUnreadCount(),
    staleTime: 30_000,
    select: (data) => data.count,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      recipientId: string;
      subject: string;
      content: string;
      tag?: string;
    }) => messagesApi.sendMessage(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'sent'] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'unread-count'] });
    },
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => messagesApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'unread-count'] });
    },
  });
}
```

**Step 3: Wire MessagesPage.tsx**

- Remove `MOCK_INBOX` and `MOCK_SENT` constants
- Add imports: `import { useInbox, useSentMessages, useSendMessage } from '@/hooks/api/useMessages';`
- Replace mock arrays: `const { data: inboxData, isLoading: inboxLoading } = useInbox();` and `const inboxMessages = inboxData?.messages ?? [];`
- Enable "Compose" button with a simple modal (same pattern as MessageBoardPage compose modal above)
- Compose modal fields: `recipientId` (text input for username/ID), `subject`, `content`, `tag?`

**Step 4: Wire MainNavigation.tsx bell badge**

Find the bell icon in `MainNavigation.tsx` and add:

```typescript
import { useUnreadCount } from '@/hooks/api/useMessages';

// Inside the component:
const unreadCount = useUnreadCount();

// On the bell Link element, add a badge:
<Link to="/messages" className="relative">
  <Bell className="w-5 h-5" />
  {(unreadCount.data ?? 0) > 0 && (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
      {unreadCount.data}
    </span>
  )}
</Link>
```

**Step 5: Verify build + commit**

```bash
cd frontend && npx vite build 2>&1 | tail -3 && cd ..
git add frontend/src/lib/api-client.ts frontend/src/hooks/api/useMessages.ts frontend/src/pages/MessagesPage.tsx frontend/src/components/MainNavigation.tsx
git commit -m "feat(19B-2): wire MessagesPage + nav unread badge to live API"
```

---

### Task 13: Push phase 2

```bash
git push origin master
```

Expected: all suites pass, push succeeds.

---

## Phase 3: Clubs + Elections (19B-3)

---

### Task 14: Add Club / ClubMembership / ClubElection / ClubCandidate / ClubBallot models

**Files:**

- Modify: `packages/database/prisma/schema.prisma`

**Step 1: Add relation fields to User model**:

```prisma
  clubsLed        Club[]          @relation("ClubsLed")
  clubMemberships ClubMembership[] @relation("ClubMemberships")
  candidacies     ClubCandidate[] @relation("ElectionCandidacies")
  ballots         ClubBallot[]    @relation("CastBallots")
```

**Step 2: Add enums + models at end of file**:

```prisma
enum ClubType {
  discipline
  breed
}

enum ClubRole {
  member
  officer
  president
}

enum ElectionStatus {
  upcoming
  open
  closed
}

model Club {
  id          Int              @id @default(autoincrement())
  name        String           @unique
  type        ClubType
  category    String
  description String
  leaderId    String
  leader      User             @relation("ClubsLed", fields: [leaderId], references: [id])
  createdAt   DateTime         @default(now())
  members     ClubMembership[]
  elections   ClubElection[]
}

model ClubMembership {
  id       Int      @id @default(autoincrement())
  clubId   Int
  club     Club     @relation(fields: [clubId], references: [id], onDelete: Cascade)
  userId   String
  user     User     @relation("ClubMemberships", fields: [userId], references: [id])
  role     ClubRole @default(member)
  joinedAt DateTime @default(now())
  @@unique([clubId, userId])
}

model ClubElection {
  id         Int               @id @default(autoincrement())
  clubId     Int
  club       Club              @relation(fields: [clubId], references: [id])
  position   String
  status     ElectionStatus    @default(upcoming)
  startsAt   DateTime
  endsAt     DateTime
  candidates ClubCandidate[]
}

model ClubCandidate {
  id         Int          @id @default(autoincrement())
  electionId Int
  election   ClubElection @relation(fields: [electionId], references: [id])
  userId     String
  user       User         @relation("ElectionCandidacies", fields: [userId], references: [id])
  statement  String
  ballots    ClubBallot[]
  @@unique([electionId, userId])
}

model ClubBallot {
  id          Int           @id @default(autoincrement())
  candidateId Int
  candidate   ClubCandidate @relation(fields: [candidateId], references: [id])
  voterId     String
  voter       User          @relation("CastBallots", fields: [voterId], references: [id])
  electionId  Int
  createdAt   DateTime      @default(now())
  @@unique([electionId, voterId])
}
```

**Step 3: Migrate**

```bash
cd packages/database
npx prisma migrate dev --name add_clubs_elections_models
npx prisma generate
cd ../..
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(19B-3): add Club, ClubMembership, ClubElection, ClubCandidate, ClubBallot models"
```

---

### Task 15: Write failing tests + implement clubController.mjs

**Files:**

- Create: `backend/tests/integration/clubAPI.test.mjs`
- Create: `backend/controllers/clubController.mjs`

**Step 1: Create tests**

```javascript
/**
 * Club API Integration Tests (19B-3)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestUser, cleanupTestData } from '../helpers/testAuth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import app from '../../app.mjs';

describe('🏇 INTEGRATION: Club API', () => {
  let leader, leaderToken, member, memberToken;
  let createdClubId, createdElectionId;

  beforeAll(async () => {
    const ts = Date.now();
    const l = await createTestUser({ username: `leader_${ts}`, email: `leader_${ts}@test.com` });
    const m = await createTestUser({ username: `member_${ts}`, email: `member_${ts}@test.com` });
    leader = l.user;
    leaderToken = l.token;
    member = m.user;
    memberToken = m.token;
  });

  afterAll(async () => {
    try {
      const clubs = await prisma.club.findMany({ where: { leaderId: leader?.id } });
      for (const club of clubs) {
        await prisma.clubBallot.deleteMany({
          where: { candidate: { election: { clubId: club.id } } },
        });
        await prisma.clubCandidate.deleteMany({ where: { election: { clubId: club.id } } });
        await prisma.clubElection.deleteMany({ where: { clubId: club.id } });
        await prisma.clubMembership.deleteMany({ where: { clubId: club.id } });
      }
      await prisma.club.deleteMany({ where: { leaderId: leader?.id } });
    } catch {
      /* ignore */
    }
    await cleanupTestData();
  });

  describe('POST /api/clubs', () => {
    it('should create a club and auto-add leader as president', async () => {
      const res = await request(app)
        .post('/api/clubs')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({
          name: `Test Club ${Date.now()}`,
          type: 'discipline',
          category: 'Dressage',
          description: 'For dressage lovers',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.club.leaderId).toBe(leader.id);
      createdClubId = res.body.data.club.id;

      const membership = await prisma.clubMembership.findFirst({
        where: { clubId: createdClubId, userId: leader.id },
      });
      expect(membership.role).toBe('president');
    });

    it('should reject duplicate club name', async () => {
      const clubName = `Dup Club ${Date.now()}`;
      await request(app)
        .post('/api/clubs')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ name: clubName, type: 'breed', category: 'Thoroughbred', description: 'Test' });
      const res = await request(app)
        .post('/api/clubs')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ name: clubName, type: 'breed', category: 'Thoroughbred', description: 'Test' });
      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/clubs', () => {
    it('should list all clubs', async () => {
      const res = await request(app)
        .get('/api/clubs')
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.clubs)).toBe(true);
    });

    it('should filter by type', async () => {
      const res = await request(app)
        .get('/api/clubs?type=discipline')
        .set('Authorization', `Bearer ${memberToken}`);
      const clubs = res.body.data.clubs;
      expect(clubs.every((c) => c.type === 'discipline')).toBe(true);
    });
  });

  describe('POST /api/clubs/:id/join + DELETE /api/clubs/:id/leave', () => {
    it('should join a club as member', async () => {
      const res = await request(app)
        .post(`/api/clubs/${createdClubId}/join`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(201);
      expect(res.body.data.membership.role).toBe('member');
    });

    it('should reject joining twice', async () => {
      const res = await request(app)
        .post(`/api/clubs/${createdClubId}/join`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(409);
    });

    it('should leave a club', async () => {
      const res = await request(app)
        .delete(`/api/clubs/${createdClubId}/leave`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Club Elections', () => {
    beforeAll(async () => {
      // re-join member so they can participate in election
      await request(app)
        .post(`/api/clubs/${createdClubId}/join`)
        .set('Authorization', `Bearer ${memberToken}`);
    });

    it('should create an election (president only)', async () => {
      const res = await request(app)
        .post(`/api/clubs/${createdClubId}/elections`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({
          position: 'Club Secretary',
          startsAt: new Date(Date.now() - 1000).toISOString(),
          endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      expect(res.status).toBe(201);
      createdElectionId = res.body.data.election.id;
    });

    it('should block election creation by regular member', async () => {
      const res = await request(app)
        .post(`/api/clubs/${createdClubId}/elections`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          position: 'Fake Officer',
          startsAt: new Date().toISOString(),
          endsAt: new Date().toISOString(),
        });
      expect(res.status).toBe(403);
    });

    it('should self-nominate for election', async () => {
      const res = await request(app)
        .post(`/api/clubs/elections/${createdElectionId}/nominate`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ statement: 'I will work hard!' });
      expect(res.status).toBe(201);
    });

    it('should cast a vote', async () => {
      const candidateRes = await prisma.clubCandidate.findFirst({
        where: { electionId: createdElectionId, userId: member.id },
      });
      const res = await request(app)
        .post(`/api/clubs/elections/${createdElectionId}/vote`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ candidateId: candidateRes.id });
      expect(res.status).toBe(201);
    });

    it('should enforce one vote per election', async () => {
      const candidateRes = await prisma.clubCandidate.findFirst({
        where: { electionId: createdElectionId },
      });
      const res = await request(app)
        .post(`/api/clubs/elections/${createdElectionId}/vote`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ candidateId: candidateRes.id });
      expect(res.status).toBe(409);
    });

    it('should return election results', async () => {
      const res = await request(app)
        .get(`/api/clubs/elections/${createdElectionId}/results`)
        .set('Authorization', `Bearer ${leaderToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.candidates)).toBe(true);
      expect(res.body.data.candidates[0].voteCount).toBeDefined();
    });
  });
});
```

**Step 2: Implement `backend/controllers/clubController.mjs`**

```javascript
/**
 * Club Controller (19B-3)
 * Handles clubs, membership, and elections with voting.
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

const USER_SELECT = { id: true, username: true };

/** GET /api/clubs?type=&category= */
export async function getClubs(req, res) {
  const { type, category } = req.query;
  const where = {};
  if (type) where.type = type;
  if (category) where.category = category;

  try {
    const clubs = await prisma.club.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        leader: { select: USER_SELECT },
        _count: { select: { members: true } },
      },
    });
    const shaped = clubs.map((c) => ({ ...c, memberCount: c._count.members, _count: undefined }));
    return res.json({ success: true, data: { clubs: shaped } });
  } catch (error) {
    logger.error(`[clubController.getClubs] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch clubs' });
  }
}

/** GET /api/clubs/mine */
export async function getMyClubs(req, res) {
  const userId = req.user.id;
  try {
    const memberships = await prisma.clubMembership.findMany({
      where: { userId },
      include: {
        club: {
          include: { leader: { select: USER_SELECT }, _count: { select: { members: true } } },
        },
      },
    });
    return res.json({ success: true, data: { memberships } });
  } catch (error) {
    logger.error(`[clubController.getMyClubs] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch clubs' });
  }
}

/** GET /api/clubs/:id */
export async function getClub(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || id <= 0) return res.status(400).json({ success: false, message: 'Invalid club ID' });
  try {
    const club = await prisma.club.findUnique({
      where: { id },
      include: {
        leader: { select: USER_SELECT },
        members: { include: { user: { select: USER_SELECT } }, orderBy: { joinedAt: 'asc' } },
      },
    });
    if (!club) return res.status(404).json({ success: false, message: 'Club not found' });
    return res.json({ success: true, data: { club } });
  } catch (error) {
    logger.error(`[clubController.getClub] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch club' });
  }
}

/** POST /api/clubs */
export async function createClub(req, res) {
  const { name, type, category, description } = req.body;
  const leaderId = req.user.id;
  try {
    const existing = await prisma.club.findUnique({ where: { name } });
    if (existing)
      return res.status(409).json({ success: false, message: 'Club name already taken' });

    const club = await prisma.$transaction(async (tx) => {
      const c = await tx.club.create({ data: { name, type, category, description, leaderId } });
      await tx.clubMembership.create({
        data: { clubId: c.id, userId: leaderId, role: 'president' },
      });
      return c;
    });

    logger.info(`[clubController.createClub] User ${leaderId} created club ${club.id}`);
    return res.status(201).json({ success: true, data: { club } });
  } catch (error) {
    logger.error(`[clubController.createClub] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create club' });
  }
}

/** POST /api/clubs/:id/join */
export async function joinClub(req, res) {
  const clubId = parseInt(req.params.id, 10);
  const userId = req.user.id;
  if (!clubId || clubId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid club ID' });
  try {
    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) return res.status(404).json({ success: false, message: 'Club not found' });

    const existing = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (existing) return res.status(409).json({ success: false, message: 'Already a member' });

    const membership = await prisma.clubMembership.create({
      data: { clubId, userId, role: 'member' },
    });
    return res.status(201).json({ success: true, data: { membership } });
  } catch (error) {
    logger.error(`[clubController.joinClub] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to join club' });
  }
}

/** DELETE /api/clubs/:id/leave */
export async function leaveClub(req, res) {
  const clubId = parseInt(req.params.id, 10);
  const userId = req.user.id;
  if (!clubId || clubId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid club ID' });
  try {
    const membership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership) return res.status(404).json({ success: false, message: 'Not a member' });
    if (membership.role === 'president') {
      return res
        .status(400)
        .json({ success: false, message: 'President cannot leave — transfer leadership first' });
    }
    await prisma.clubMembership.delete({ where: { clubId_userId: { clubId, userId } } });
    return res.json({ success: true });
  } catch (error) {
    logger.error(`[clubController.leaveClub] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to leave club' });
  }
}

/** GET /api/clubs/:id/elections */
export async function getElections(req, res) {
  const clubId = parseInt(req.params.id, 10);
  if (!clubId || clubId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid club ID' });
  try {
    const elections = await prisma.clubElection.findMany({
      where: { clubId },
      orderBy: { startsAt: 'desc' },
      include: { _count: { select: { candidates: true } } },
    });
    return res.json({ success: true, data: { elections } });
  } catch (error) {
    logger.error(`[clubController.getElections] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch elections' });
  }
}

/** POST /api/clubs/:id/elections — officer/president only */
export async function createElection(req, res) {
  const clubId = parseInt(req.params.id, 10);
  const userId = req.user.id;
  const { position, startsAt, endsAt } = req.body;
  if (!clubId || clubId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid club ID' });
  try {
    const membership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership || !['officer', 'president'].includes(membership.role)) {
      return res
        .status(403)
        .json({ success: false, message: 'Only officers and presidents can create elections' });
    }
    const now = new Date();
    const status = new Date(startsAt) <= now ? 'open' : 'upcoming';
    const election = await prisma.clubElection.create({
      data: { clubId, position, startsAt: new Date(startsAt), endsAt: new Date(endsAt), status },
    });
    return res.status(201).json({ success: true, data: { election } });
  } catch (error) {
    logger.error(`[clubController.createElection] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create election' });
  }
}

/** POST /api/clubs/elections/:id/nominate */
export async function nominate(req, res) {
  const electionId = parseInt(req.params.id, 10);
  const userId = req.user.id;
  const { statement = '' } = req.body;
  if (!electionId || electionId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid election ID' });
  try {
    const election = await prisma.clubElection.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, message: 'Election not found' });
    if (election.status === 'closed')
      return res.status(400).json({ success: false, message: 'Election is closed' });

    const existing = await prisma.clubCandidate.findUnique({
      where: { electionId_userId: { electionId, userId } },
    });
    if (existing) return res.status(409).json({ success: false, message: 'Already nominated' });

    const candidate = await prisma.clubCandidate.create({
      data: { electionId, userId, statement },
    });
    return res.status(201).json({ success: true, data: { candidate } });
  } catch (error) {
    logger.error(`[clubController.nominate] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to nominate' });
  }
}

/** POST /api/clubs/elections/:id/vote */
export async function vote(req, res) {
  const electionId = parseInt(req.params.id, 10);
  const voterId = req.user.id;
  const { candidateId } = req.body;
  if (!electionId || electionId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid election ID' });
  try {
    const election = await prisma.clubElection.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, message: 'Election not found' });
    if (election.status !== 'open')
      return res.status(400).json({ success: false, message: 'Election is not open' });

    const candidate = await prisma.clubCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate || candidate.electionId !== electionId) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid candidate for this election' });
    }

    try {
      const ballot = await prisma.clubBallot.create({ data: { electionId, candidateId, voterId } });
      return res.status(201).json({ success: true, data: { ballot } });
    } catch (uniqueError) {
      if (uniqueError.code === 'P2002')
        return res.status(409).json({ success: false, message: 'Already voted in this election' });
      throw uniqueError;
    }
  } catch (error) {
    if (error.status)
      return res.status(error.status).json({ success: false, message: error.message });
    logger.error(`[clubController.vote] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to cast vote' });
  }
}

/** GET /api/clubs/elections/:id/results */
export async function getElectionResults(req, res) {
  const electionId = parseInt(req.params.id, 10);
  if (!electionId || electionId <= 0)
    return res.status(400).json({ success: false, message: 'Invalid election ID' });
  try {
    const election = await prisma.clubElection.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, message: 'Election not found' });

    const candidates = await prisma.clubCandidate.findMany({
      where: { electionId },
      include: {
        user: { select: USER_SELECT },
        _count: { select: { ballots: true } },
      },
      orderBy: { ballots: { _count: 'desc' } },
    });

    const shaped = candidates.map((c) => ({
      id: c.id,
      user: c.user,
      statement: c.statement,
      voteCount: c._count.ballots,
    }));

    return res.json({ success: true, data: { election, candidates: shaped } });
  } catch (error) {
    logger.error(`[clubController.getElectionResults] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch results' });
  }
}
```

---

### Task 16: Implement clubRoutes.mjs + register + verify

**Files:**

- Create: `backend/routes/clubRoutes.mjs`
- Modify: `backend/app.mjs`

**Step 1: Create routes**

```javascript
/**
 * Club Routes (19B-3)
 * All club + election endpoints under /api/clubs.
 */

import express from 'express';
import { body, query, validationResult } from 'express-validator';
import logger from '../utils/logger.mjs';
import {
  getClubs,
  getMyClubs,
  getClub,
  createClub,
  joinClub,
  leaveClub,
  getElections,
  createElection,
  nominate,
  vote,
  getElectionResults,
} from '../controllers/clubController.mjs';

const router = express.Router();

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[clubRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res
      .status(400)
      .json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

router.get(
  '/',
  [query('type').optional().isIn(['discipline', 'breed']), handleValidation],
  getClubs
);
router.get('/mine', getMyClubs);
router.get('/:id', getClub);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 100 }),
    body('type').isIn(['discipline', 'breed']).withMessage('type must be discipline or breed'),
    body('category').trim().notEmpty().withMessage('category is required'),
    body('description').trim().notEmpty().withMessage('description is required'),
    handleValidation,
  ],
  createClub
);

router.post('/:id/join', joinClub);
router.delete('/:id/leave', leaveClub);
router.get('/:id/elections', getElections);

router.post(
  '/:id/elections',
  [
    body('position').trim().notEmpty().withMessage('position is required'),
    body('startsAt').isISO8601().withMessage('startsAt must be a valid date'),
    body('endsAt').isISO8601().withMessage('endsAt must be a valid date'),
    handleValidation,
  ],
  createElection
);

router.post(
  '/elections/:id/nominate',
  [body('statement').optional().isString(), handleValidation],
  nominate
);

router.post(
  '/elections/:id/vote',
  [
    body('candidateId').isInt({ min: 1 }).withMessage('candidateId must be a positive integer'),
    handleValidation,
  ],
  vote
);

router.get('/elections/:id/results', getElectionResults);

export default router;
```

**Step 2: Register in app.mjs**

```javascript
import clubRoutes from './routes/clubRoutes.mjs';
// ...
authRouter.use('/clubs', clubRoutes);
```

**Step 3: Run tests**

```bash
cd backend
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/integration/clubAPI.test.mjs --no-coverage
```

Expected: all PASS

**Step 4: Commit**

```bash
cd ..
git add backend/controllers/clubController.mjs backend/routes/clubRoutes.mjs backend/app.mjs backend/tests/integration/clubAPI.test.mjs
git commit -m "feat(19B-3): clubs + elections controller, routes, and integration tests"
```

---

### Task 17: Add clubsApi + useClubs hook + wire ClubsPage + CommunityPage

**Files:**

- Modify: `frontend/src/lib/api-client.ts`
- Create: `frontend/src/hooks/api/useClubs.ts`
- Modify: `frontend/src/pages/ClubsPage.tsx`
- Modify: `frontend/src/pages/CommunityPage.tsx`

**Step 1: Add to api-client.ts**

```typescript
// ── Club Types ────────────────────────────────────────────────────────────────

export type ClubType = 'discipline' | 'breed';
export type ClubRole = 'member' | 'officer' | 'president';
export type ElectionStatus = 'upcoming' | 'open' | 'closed';

export interface Club {
  id: number;
  name: string;
  type: ClubType;
  category: string;
  description: string;
  leader: { id: string; username: string };
  memberCount: number;
  createdAt: string;
}

export interface ClubMembership {
  id: number;
  club: Club;
  role: ClubRole;
  joinedAt: string;
}

export interface ClubElection {
  id: number;
  clubId: number;
  position: string;
  status: ElectionStatus;
  startsAt: string;
  endsAt: string;
}

export interface ElectionCandidate {
  id: number;
  user: { id: string; username: string };
  statement: string;
  voteCount: number;
}

// ── Clubs API ─────────────────────────────────────────────────────────────────

export const clubsApi = {
  getClubs: (type?: ClubType, category?: string) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (category) params.set('category', category);
    return apiClient.get<{ clubs: Club[] }>(`/api/clubs?${params}`);
  },
  getMyClubs: () => apiClient.get<{ memberships: ClubMembership[] }>('/api/clubs/mine'),
  getClub: (id: number) =>
    apiClient.get<{ club: Club & { members: ClubMembership[] } }>(`/api/clubs/${id}`),
  createClub: (payload: { name: string; type: ClubType; category: string; description: string }) =>
    apiClient.post<{ club: Club }>('/api/clubs', payload),
  joinClub: (id: number) =>
    apiClient.post<{ membership: ClubMembership }>(`/api/clubs/${id}/join`, {}),
  leaveClub: (id: number) => apiClient.delete<void>(`/api/clubs/${id}/leave`),
  getElections: (clubId: number) =>
    apiClient.get<{ elections: ClubElection[] }>(`/api/clubs/${clubId}/elections`),
  createElection: (
    clubId: number,
    payload: { position: string; startsAt: string; endsAt: string }
  ) => apiClient.post<{ election: ClubElection }>(`/api/clubs/${clubId}/elections`, payload),
  nominate: (electionId: number, statement: string) =>
    apiClient.post<void>(`/api/clubs/elections/${electionId}/nominate`, { statement }),
  vote: (electionId: number, candidateId: number) =>
    apiClient.post<void>(`/api/clubs/elections/${electionId}/vote`, { candidateId }),
  getResults: (electionId: number) =>
    apiClient.get<{ election: ClubElection; candidates: ElectionCandidate[] }>(
      `/api/clubs/elections/${electionId}/results`
    ),
};
```

**Step 2: Create `frontend/src/hooks/api/useClubs.ts`**

```typescript
/**
 * useClubs hooks (19B-3)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clubsApi, ClubType } from '@/lib/api-client';

export function useClubs(type?: ClubType, category?: string) {
  return useQuery({
    queryKey: ['clubs', type, category],
    queryFn: () => clubsApi.getClubs(type, category),
    staleTime: 5 * 60_000,
  });
}

export function useMyClubs() {
  return useQuery({
    queryKey: ['clubs', 'mine'],
    queryFn: () => clubsApi.getMyClubs(),
    staleTime: 2 * 60_000,
  });
}

export function useClub(id: number) {
  return useQuery({
    queryKey: ['clubs', id],
    queryFn: () => clubsApi.getClub(id),
    enabled: !!id,
    staleTime: 2 * 60_000,
  });
}

export function useJoinClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => clubsApi.joinClub(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

export function useLeaveClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => clubsApi.leaveClub(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

export function useCreateClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      type: ClubType;
      category: string;
      description: string;
    }) => clubsApi.createClub(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

export function useClubElections(clubId: number) {
  return useQuery({
    queryKey: ['clubs', clubId, 'elections'],
    queryFn: () => clubsApi.getElections(clubId),
    enabled: !!clubId,
    staleTime: 2 * 60_000,
  });
}

export function useNominate(electionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (statement: string) => clubsApi.nominate(electionId, statement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

export function useVote(electionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidateId: number) => clubsApi.vote(electionId, candidateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

export function useElectionResults(electionId: number) {
  return useQuery({
    queryKey: ['elections', electionId, 'results'],
    queryFn: () => clubsApi.getResults(electionId),
    enabled: !!electionId,
    staleTime: 60_000,
  });
}
```

**Step 3: Wire ClubsPage.tsx**

- Remove mock club arrays
- Import `useClubs`, `useMyClubs`, `useJoinClub`, `useLeaveClub`, `useClubElections`, `useVote`
- Replace mock club cards with `useClubs()` data
- Enable join/leave buttons wired to mutations
- Elections tab: use `useClubElections(selectedClubId)` — requires selecting a club first

**Step 4: Wire CommunityPage.tsx stats**

Replace the hardcoded stats (`Active threads: 142`, `Unread: 3`, etc.) with live data:

```typescript
import { useForumThreads } from '@/hooks/api/useForum';
import { useUnreadCount } from '@/hooks/api/useMessages';
import { useClubs } from '@/hooks/api/useClubs';

// Inside CommunityPage component:
const { data: threadsData } = useForumThreads();
const unreadCount = useUnreadCount();
const { data: clubsData } = useClubs();

// Then in the stats arrays, replace hardcoded values:
// { label: 'Active threads', value: String(threadsData?.total ?? '…') }
// { label: 'Unread', value: String(unreadCount.data ?? '…') }
// { label: 'Discipline clubs', value: String(clubsData?.clubs.filter(c => c.type === 'discipline').length ?? '…') }
```

**Step 5: Verify build + commit phase 3**

```bash
cd frontend && npx vite build 2>&1 | tail -3 && cd ..
git add frontend/src/lib/api-client.ts frontend/src/hooks/api/useClubs.ts frontend/src/pages/ClubsPage.tsx frontend/src/pages/CommunityPage.tsx
git commit -m "feat(19B-3): wire ClubsPage + CommunityPage to live clubs and elections API"
```

---

### Task 18: Push phase 3 (Epic 19B complete)

```bash
git push origin master
```

Expected: all suites pass. Epic 19B is complete — three social features live.

---

## Summary

| Phase | Backend files                                | Frontend files                                             | Tests                 |
| ----- | -------------------------------------------- | ---------------------------------------------------------- | --------------------- |
| 19B-1 | `forumController.mjs`, `forumRoutes.mjs`     | `useForum.ts`, `MessageBoardPage.tsx`                      | `forumAPI.test.mjs`   |
| 19B-2 | `messageController.mjs`, `messageRoutes.mjs` | `useMessages.ts`, `MessagesPage.tsx`, `MainNavigation.tsx` | `messageAPI.test.mjs` |
| 19B-3 | `clubController.mjs`, `clubRoutes.mjs`       | `useClubs.ts`, `ClubsPage.tsx`, `CommunityPage.tsx`        | `clubAPI.test.mjs`    |
