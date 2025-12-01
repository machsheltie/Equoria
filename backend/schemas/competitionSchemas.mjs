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
        },
        required: ['horseId', 'eventId'],
      },
    },
    responses: { 201: { description: 'Entry created' } },
    tags: ['competition'],
  },
];
