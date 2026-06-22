import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Messages handlers (19B-2): inbox, sent, unread-count, detail, send, mark-read.
 * Registered after forum, before clubs. First-match-wins order preserved.
 */
export const messageHandlers = [
  // ── Messages (19B-2) ──────────────────────────────────────────────────────

  http.get(`${base}/api/v1/messages/inbox`, () =>
    HttpResponse.json({
      messages: [
        {
          id: 1,
          senderId: 'user-2',
          sender: { id: 'user-2', username: 'breeder99' },
          recipientId: 'user-1',
          recipient: { id: 'user-1', username: 'testuser' },
          subject: 'Interested in your mare',
          content: 'Hi! I saw your mare is listed for stud. Is she still available?',
          tag: 'breeding',
          isRead: false,
          createdAt: '2026-05-12T14:00:00Z',
        },
        {
          id: 2,
          senderId: 'user-3',
          sender: { id: 'user-3', username: 'horsepro' },
          recipientId: 'user-1',
          recipient: { id: 'user-1', username: 'testuser' },
          subject: 'Club invitation',
          content: 'Would you like to join the Dressage Enthusiasts club?',
          tag: undefined,
          isRead: true,
          createdAt: '2026-05-10T09:00:00Z',
        },
      ],
    })
  ),

  http.get(`${base}/api/v1/messages/sent`, () =>
    HttpResponse.json({
      messages: [
        {
          id: 3,
          senderId: 'user-1',
          sender: { id: 'user-1', username: 'testuser' },
          recipientId: 'user-4',
          recipient: { id: 'user-4', username: 'newrider' },
          subject: 'Welcome to the stable',
          content: 'Great to have you here! Let me know if you need tips.',
          tag: undefined,
          isRead: true,
          createdAt: '2026-05-11T11:00:00Z',
        },
      ],
    })
  ),

  http.get(`${base}/api/v1/messages/unread-count`, () => HttpResponse.json({ count: 1 })),

  http.get(`${base}/api/v1/messages/:id`, ({ params }) => {
    const id = Number(params.id);
    if (id === 999) {
      return HttpResponse.json({ success: false, message: 'Message not found' }, { status: 404 });
    }
    return HttpResponse.json({
      message: {
        id,
        senderId: 'user-2',
        sender: { id: 'user-2', username: 'breeder99' },
        recipientId: 'user-1',
        recipient: { id: 'user-1', username: 'testuser' },
        subject: 'Interested in your mare',
        content: 'Hi! I saw your mare is listed for stud. Is she still available?',
        tag: 'breeding',
        isRead: false,
        createdAt: '2026-05-12T14:00:00Z',
      },
    });
  }),

  http.post(`${base}/api/v1/messages`, async ({ request }) => {
    const body = (await request.json()) as {
      recipientId: string;
      subject: string;
      content: string;
      tag?: string;
    };
    const now = new Date().toISOString();
    return HttpResponse.json(
      {
        message: {
          id: 400,
          senderId: 'user-1',
          sender: { id: 'user-1', username: 'testuser' },
          recipientId: body.recipientId,
          recipient: { id: body.recipientId, username: 'recipient' },
          subject: body.subject,
          content: body.content,
          tag: body.tag,
          isRead: false,
          createdAt: now,
        },
      },
      { status: 201 }
    );
  }),

  http.patch(`${base}/api/v1/messages/:id/read`, () => HttpResponse.json({ success: true })),
];
