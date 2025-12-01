export const competitionSchemas = [
  {
    path: '/competition/events',
    method: 'get',
    summary: 'List competition events',
    responses: { 200: { description: 'Events returned' } },
    tags: ['competition'],
  },
  {
    path: '/competition/entries',
    method: 'post',
    summary: 'Enter competition',
    request: {
      body: {
        type: 'object',
        properties: {
          horseId: { type: 'string' },
          eventId: { type: 'string' },
          entryFee: { type: 'number' },
        },
        required: ['horseId', 'eventId'],
      },
    },
    responses: {
      201: {
        description: 'Entry created',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                entryId: { type: 'string' },
                status: { type: 'string' },
              },
            },
          },
        },
      },
    },
    tags: ['competition'],
  },
];
