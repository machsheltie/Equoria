export const horseSchemas = [
  {
    path: '/horses',
    method: 'get',
    summary: 'List horses',
    responses: {
      200: {
        description: 'List of horses',
        content: { 'application/json': { schema: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } } } },
      },
    },
    tags: ['horses'],
  },
  {
    path: '/horses',
    method: 'post',
    summary: 'Create horse',
    request: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          discipline: { type: 'string' },
        },
        required: ['name'],
      },
    },
    responses: {
      201: {
        description: 'Created',
        content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } } },
      },
    },
    tags: ['horses'],
  },
];
