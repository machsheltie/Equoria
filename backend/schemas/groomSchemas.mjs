export const groomSchemas = [
  {
    path: '/grooms',
    method: 'get',
    summary: 'List grooms',
    responses: { 200: { description: 'Grooms returned' } },
    tags: ['grooms'],
  },
  {
    path: '/grooms/hire',
    method: 'post',
    summary: 'Hire groom',
    request: {
      body: {
        type: 'object',
        properties: {
          groomId: { type: 'string' },
          horseId: { type: 'string' },
        },
        required: ['groomId'],
      },
    },
    responses: { 201: { description: 'Groom hired' } },
    tags: ['grooms'],
  },
];
