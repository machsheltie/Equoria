# Backend Architecture

**Purpose**: Backend system architecture, API specifications, and layer design patterns.

**Stack**: Node.js, Fastify, Prisma, PostgreSQL

**Last Updated**: 2025-01-14

---

## Files in This Folder

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| [apiSpecs.md](./apiSpecs.md) | Complete REST API documentation | ~800 | Active |
| [backendOverview.md](./backendOverview.md) | System architecture overview | ~600 | Active |
| [architectureOverview.md](./architectureOverview.md) | General architecture patterns | ~450 | Active |
| [controllersLayer.md](./controllersLayer.md) | Controller layer design | ~400 | Active |
| [modelsLayer.md](./modelsLayer.md) | Data model layer design | ~500 | Active |
| [routesLayer.md](./routesLayer.md) | API routes layer design | ~300 | Active |
| [utilsLayer.md](./utilsLayer.md) | Utilities layer design | ~200 | Active |

**Total**: 7 files, ~3,250 lines

---

## Quick Navigation

### Start Here
- **New to backend?** → [backendOverview.md](./backendOverview.md)
- **Need API docs?** → [apiSpecs.md](./apiSpecs.md)
- **Understanding layers?** → [architectureOverview.md](./architectureOverview.md)

### By Layer
- **Routes** (API endpoints) → [routesLayer.md](./routesLayer.md)
- **Controllers** (business logic) → [controllersLayer.md](./controllersLayer.md)
- **Models** (data access) → [modelsLayer.md](./modelsLayer.md)
- **Utils** (helpers) → [utilsLayer.md](./utilsLayer.md)

---

## Architecture Overview

### Layer Separation

```
Client Request
      ↓
   Routes Layer (routing, validation)
      ↓
Controllers Layer (business logic)
      ↓
   Models Layer (data access)
      ↓
   Database (PostgreSQL)
```

### Key Principles

1. **Clear Responsibilities**: Each layer has a single, well-defined purpose
2. **Dependency Flow**: One-way dependencies (routes → controllers → models)
3. **Testability**: Each layer can be tested in isolation
4. **Type Safety**: TypeScript strict mode throughout

---

## API Endpoints

Full documentation in [apiSpecs.md](./apiSpecs.md).

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User authentication
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Token refresh
- `GET /auth/me` - Current user profile

### Users
- `GET /users/:id` - Get user profile
- `PUT /users/:id` - Update user profile
- `DELETE /users/:id` - Delete user account

### Horses
- `GET /horses` - List horses
- `POST /horses` - Create horse
- `GET /horses/:id` - Get horse details
- `PUT /horses/:id` - Update horse
- `DELETE /horses/:id` - Delete horse

### Grooms
- `GET /grooms` - List grooms
- `POST /grooms` - Hire groom
- `GET /grooms/:id` - Get groom details
- `PUT /grooms/:id` - Update groom
- `DELETE /grooms/:id` - Fire groom

---

## Technology Stack

### Core Framework
- **Fastify**: High-performance web framework
- **TypeScript**: Type-safe development
- **Prisma**: Modern ORM with type safety

### Authentication
- **JWT**: Stateless authentication
- **bcrypt**: Password hashing
- **refresh tokens**: Long-lived sessions

### Validation
- **Zod**: Runtime type validation
- **@fastify/multipart**: File uploads
- **@fastify/cors**: CORS handling

### Testing
- **Jest**: Test framework
- **Supertest**: API testing
- **Prisma Test Environment**: Isolated test database

---

## Development Patterns

### Controller Pattern

```typescript
// controllers/horseController.ts
export const createHorse = async (req: Request, res: Response) => {
  try {
    // 1. Validate input
    const data = validateHorseInput(req.body);

    // 2. Business logic
    const horse = await horseService.create(data);

    // 3. Return response
    return res.status(201).json({ horse });
  } catch (error) {
    return handleError(error, res);
  }
};
```

### Model Pattern

```typescript
// models/Horse.ts
export class HorseModel {
  static async findById(id: string) {
    return await prisma.horse.findUnique({
      where: { id },
      include: { owner: true, groom: true }
    });
  }

  static async create(data: CreateHorseInput) {
    return await prisma.horse.create({
      data,
      include: { owner: true }
    });
  }
}
```

### Route Pattern

```typescript
// routes/horses.ts
export const horseRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/', listHorses);
  fastify.post('/', { preHandler: [authenticate] }, createHorse);
  fastify.get('/:id', getHorse);
  fastify.put('/:id', { preHandler: [authenticate, authorize] }, updateHorse);
  fastify.delete('/:id', { preHandler: [authenticate, authorize] }, deleteHorse);
};
```

---

## Error Handling

### Standard Error Format

```typescript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  }
}
```

### Error Codes
- `VALIDATION_ERROR` - Invalid input data
- `AUTHENTICATION_ERROR` - Authentication failed
- `AUTHORIZATION_ERROR` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Resource conflict (e.g., duplicate email)
- `INTERNAL_ERROR` - Server error

---

## Security Best Practices

1. **Input Validation**: All inputs validated with Zod
2. **Authentication**: JWT with refresh token rotation
3. **Authorization**: Role-based access control
4. **SQL Injection**: Prevented by Prisma parameterized queries
5. **XSS**: Sanitized user input
6. **Rate Limiting**: API rate limits enforced
7. **CORS**: Configured for allowed origins only

---

## Testing Strategy

### Unit Tests
- Controllers: Business logic testing
- Models: Data access testing
- Utils: Helper function testing

### Integration Tests
- API endpoints: Full request/response testing
- Authentication flow: Token lifecycle testing
- Error handling: Error case validation

### Coverage Target
- **Overall**: 95%+
- **Controllers**: 100%
- **Models**: 100%
- **Routes**: 95%+

---

## Related Documentation

- **Database Schema**: [../database/databaseSchema.md](../database/databaseSchema.md)
- **Frontend Architecture**: [../frontend/frontendArchitecture.md](../frontend/frontendArchitecture.md)
- **Testing Architecture**: [../testing/testingArchitecture.md](../testing/testingArchitecture.md)
- **API Test Plan**: [../testing/groomApiTestPlan.md](../testing/groomApiTestPlan.md)

---

**For complete architecture documentation, see [../README.md](../README.md)**
