export const authSchemas = [
  {
    path: '/auth/login',
    method: 'post',
    summary: 'Authenticate user',
    request: {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
        required: ['email', 'password'],
      },
    },
    responses: {
      200: {
        description: 'Authenticated',
        content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' } } } } },
      },
    },
    tags: ['auth'],
  },
  {
    path: '/auth/register',
    method: 'post',
    summary: 'Register user',
    request: {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['email', 'password'],
      },
    },
    responses: {
      201: {
        description: 'Created',
        content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, email: { type: 'string' } } } } },
      },
    },
    tags: ['auth'],
  },
];
