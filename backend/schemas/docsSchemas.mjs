export const docsSchemas = [
  {
    path: '/docs',
    method: 'get',
    summary: 'API docs descriptor',
    responses: { 200: { description: 'Docs served' } },
    tags: ['docs'],
  },
];
