export const trainingSchemas = [
  {
    path: '/training/sessions',
    method: 'post',
    summary: 'Schedule training session',
    request: {
      body: {
        type: 'object',
        properties: {
          horseId: { type: 'string' },
          sessionType: { type: 'string' },
        },
        required: ['horseId', 'sessionType'],
      },
    },
    responses: { 201: { description: 'Session scheduled' } },
    tags: ['training'],
  },
  {
    path: '/training/sessions',
    method: 'get',
    summary: 'List training sessions',
    responses: { 200: { description: 'Sessions returned' } },
    tags: ['training'],
  },
];
