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
        },
        required: ['sireId', 'damId'],
      },
    },
    responses: {
      201: {
        description: 'Breeding request created',
      },
    },
    tags: ['breeding'],
  },
];
