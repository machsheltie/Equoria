export const adminSchemas = [
  {
    path: '/admin/metrics',
    method: 'get',
    summary: 'Admin metrics overview',
    responses: { 200: { description: 'Metrics returned' } },
    tags: ['admin'],
  },
];
