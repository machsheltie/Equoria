export const breedingSchemas = [
  {
    path: '/breeding/requests',
    method: 'post',
    summary: 'Create breeding request',
    request: {
      body: {
        type: 'object',
        properties: {
          sireId: { type: 'string' },
          damId: { type: 'string' },
          notes: { type: 'string' },
          targetTraits: { type: 'array', items: { type: 'string' } },
        },
        required: ['sireId', 'damId'],
      },
    },
    responses: {
      201: {
        description: 'Breeding request created',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                requestId: { type: 'string' },
                status: { type: 'string' },
              },
            },
          },
        },
      },
    },
    tags: ['breeding'],
  },
];
