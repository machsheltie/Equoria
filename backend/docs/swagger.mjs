import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

/**
 * Swagger/OpenAPI Configuration
 * Comprehensive API documentation setup
 */

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Equoria API',
      version: '1.0.0',
      description: `
        🐎 **Equoria Horse Breeding & Competition Simulation API**

        A comprehensive RESTful API for managing horse breeding, competitions, and player progression in the Equoria game world.

        ## Features
        - 🏇 **Competition System**: Advanced horse competition simulation
        - 🧬 **Breeding Mechanics**: Complex genetic system for horse breeding
        - 📊 **Statistics Tracking**: Comprehensive stat system with 10+ attributes
        - 🏆 **Prize Distribution**: Dynamic prize allocation and stat gains
        - 🔒 **Security**: Enterprise-grade security with rate limiting and validation

        ## Authentication
        Currently, the API operates without authentication for development purposes.
        Authentication will be implemented in future versions.

        ## Rate Limiting
        - **General API**: 100 requests per 15 minutes
        - **Strict endpoints**: 20 requests per 15 minutes
        - **Auth endpoints**: 5 requests per 15 minutes

        ## Error Handling
        All endpoints return consistent error responses with proper HTTP status codes.
      `,
      contact: {
        name: 'Equoria Development Team',
        email: 'dev@equoria.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.equoria.com',
        description: 'Production server',
      },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
            stack: {
              type: 'string',
              description: 'Stack trace (development only)',
            },
          },
        },
        ValidationError: {
          type: 'object',
          required: ['success', 'message', 'errors'],
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Validation failed',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                  value: { type: 'string' },
                },
              },
            },
          },
        },
        Breed: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: {
              type: 'integer',
              description: 'Unique breed identifier',
              example: 1,
            },
            name: {
              type: 'string',
              description: 'Breed name',
              example: 'Arabian',
            },
            description: {
              type: 'string',
              description: 'Breed description',
              example: 'Known for endurance and intelligence',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        },
        Horse: {
          type: 'object',
          required: ['id', 'name', 'breedId'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique horse identifier',
            },
            name: {
              type: 'string',
              description: 'Horse name',
              example: 'Thunder',
            },
            breedId: {
              type: 'integer',
              description: 'Breed identifier',
              example: 1,
            },
            stats: {
              type: 'object',
              description: 'Horse statistics',
              properties: {
                speed: { type: 'integer', minimum: 1, maximum: 100 },
                stamina: { type: 'integer', minimum: 1, maximum: 100 },
                agility: { type: 'integer', minimum: 1, maximum: 100 },
                balance: { type: 'integer', minimum: 1, maximum: 100 },
                precision: { type: 'integer', minimum: 1, maximum: 100 },
                intelligence: { type: 'integer', minimum: 1, maximum: 100 },
                boldness: { type: 'integer', minimum: 1, maximum: 100 },
                flexibility: { type: 'integer', minimum: 1, maximum: 100 },
                obedience: { type: 'integer', minimum: 1, maximum: 100 },
                focus: { type: 'integer', minimum: 1, maximum: 100 },
              },
            },
          },
        },
        Competition: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Competition identifier',
            },
            name: {
              type: 'string',
              description: 'Competition name',
              example: 'Spring Championship',
            },
            discipline: {
              type: 'string',
              enum: ['dressage', 'jumping', 'racing', 'eventing'],
              description: 'Competition discipline',
            },
            entryFee: {
              type: 'number',
              description: 'Entry fee amount',
              example: 100,
            },
            prizes: {
              type: 'array',
              description: 'Prize distribution',
              items: {
                type: 'number',
              },
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Bad Request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationError' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        InternalError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        TooManyRequests: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        Unauthorized: {
          description: 'Unauthorized - Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        Forbidden: {
          description: 'Forbidden - Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./routes/*.js', './controllers/*.js', './docs/api/*.yaml'],
};

const specs = swaggerJSDoc(options);

export { specs, swaggerUi };
