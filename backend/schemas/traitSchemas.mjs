export const traitSchemas = [
  {
    path: '/traits',
    method: 'get',
    summary: 'List traits',
    responses: {
      200: { description: 'Traits returned' },
    },
    tags: ['traits'],
  },
  {
    path: '/trait-discovery',
    method: 'get',
    summary: 'Trait discovery status',
    responses: {
      200: { description: 'Discovery info returned' },
    },
    tags: ['traits'],
  },
];
