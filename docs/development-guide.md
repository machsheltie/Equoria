# Equoria Development Guide

**Generated:** 2025-12-01
**Environment:** Node.js 18.x
**Package Manager:** npm

## Quick Start

### Prerequisites

- Node.js 18.x or higher
- PostgreSQL 15+
- Git

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd Equoria

# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Install database package dependencies
cd ../packages/database && npm install

# Generate Prisma client
npx prisma generate --schema=prisma/schema.prisma

# Run database migrations
npx prisma migrate deploy --schema=prisma/schema.prisma

# Seed the database (development)
cd ../../backend && npm run seed:test
```

### Environment Configuration

Create `.env` file in `backend/` directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/equoria

# JWT Authentication
JWT_SECRET=your-secure-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-secure-refresh-secret-min-32-chars

# Server
PORT=3001
NODE_ENV=development

# Optional: Allowed origins for CORS
ALLOWED_ORIGINS=http://localhost:3000
```

### Running the Application

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

Access points:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **API Docs:** http://localhost:3001/api-docs
- **Health Check:** http://localhost:3001/health

## Project Scripts

### Root Level

| Script | Description |
|--------|-------------|
| `npm install` | Install all dependencies |
| `npm test` | Run all tests |

### Backend (`backend/`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server (nodemon) |
| `npm start` | Start production server |
| `npm test` | Run Jest tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:integration` | Run integration tests |
| `npm run test:performance` | Run performance tests |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run seed:test` | Seed test database |
| `npm run seed:performance` | Seed performance test data |
| `npm run build` | Build for production |

### Frontend (`frontend/`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run Jest tests |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |

### Database (`packages/database/`)

| Script | Description |
|--------|-------------|
| `npx prisma generate` | Generate Prisma client |
| `npx prisma migrate deploy` | Apply migrations |
| `npx prisma migrate dev` | Create new migration |
| `npx prisma studio` | Open Prisma Studio GUI |
| `npx prisma validate` | Validate schema |

## CI/CD Pipeline

### GitHub Actions Workflow

**File:** `.github/workflows/ci-cd.yml`

Pipeline stages:
1. **Code Quality & Linting** - ESLint, Prettier checks
2. **Database Setup** - PostgreSQL, migrations
3. **Backend Tests** - Jest with coverage
4. **Integration Tests** - API integration tests
5. **Performance Tests** - Load and performance tests
6. **Frontend Tests** - React component tests
7. **Build Validation** - Production build verification
8. **Security Scanning** - npm audit
9. **Deployment Readiness** - Final validation (master only)

### Branch Strategy

| Branch | Purpose | CI Trigger |
|--------|---------|------------|
| `master` | Production-ready code | Full pipeline |
| `develop` | Integration branch | Full pipeline |
| `feature/*` | Feature development | PR checks |

### Pull Request Workflow

1. Create feature branch from `develop`
2. Make changes, commit frequently
3. Push and create PR to `develop`
4. CI runs automatically
5. Code review required
6. Merge after approval
7. CI runs on `develop`
8. Periodic merge `develop` → `master`

## Testing Strategy

### Test Categories

#### Unit Tests
- Individual function testing
- Component isolation
- Mock external dependencies

#### Integration Tests
- API endpoint testing with Supertest
- Database integration
- Service interaction

#### Performance Tests
- Response time benchmarks
- Load testing
- Memory usage monitoring

### Running Tests

```bash
# Backend tests
cd backend
npm test                    # All tests
npm test -- --watch         # Watch mode
npm test -- myTest.test.mjs # Specific file
npm run test:coverage       # With coverage

# Frontend tests
cd frontend
npm test
npm test -- --coverage --watchAll=false
```

### Coverage Targets

- **Statements:** 80%+
- **Branches:** 70%+
- **Functions:** 80%+
- **Lines:** 80%+

## Code Style

### ESLint Configuration

- Airbnb style guide base
- Custom rules for project needs
- Auto-fix on save recommended

### Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(auth): add email verification flow
fix(groom): correct salary calculation
docs(api): update endpoint documentation
test(horse): add breeding tests
```

## Database Management

### Migrations

```bash
# Create new migration
cd packages/database
npx prisma migrate dev --name add_new_field

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (development only!)
npx prisma migrate reset
```

### Schema Changes

1. Edit `packages/database/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name description`
3. Update related services/controllers
4. Add/update tests
5. Commit migration files

### Seeding

```bash
# Development seed
cd backend
npm run seed:test

# Performance testing seed
npm run seed:performance
```

## API Development

### Adding a New Endpoint

1. **Create Route** (`backend/routes/newRoute.mjs`)
```javascript
import express from 'express';
import { authenticate } from '../middleware/auth.mjs';
import * as controller from '../controllers/newController.mjs';

const router = express.Router();

router.get('/', authenticate, controller.getAll);
router.post('/', authenticate, controller.create);

export default router;
```

2. **Create Controller** (`backend/controllers/newController.mjs`)
```javascript
import * as service from '../services/newService.mjs';

export const getAll = async (req, res, next) => {
  try {
    const data = await service.getAll(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
```

3. **Create Service** (`backend/services/newService.mjs`)
```javascript
import prisma from '../../packages/database/prismaClient.mjs';

export const getAll = async (userId) => {
  return prisma.model.findMany({
    where: { userId }
  });
};
```

4. **Register Route** (in `backend/app.mjs`)
```javascript
import newRoutes from './routes/newRoute.mjs';
apiV1Router.use('/new', newRoutes);
```

5. **Add Tests**

### API Response Format

Success:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

Error:
```json
{
  "success": false,
  "message": "Error description",
  "errors": [{ "field": "...", "message": "..." }]
}
```

## Debugging

### Backend Debugging

```bash
# Enable verbose logging
NODE_ENV=development npm run dev

# Debug specific test
npm test -- --verbose myTest.test.mjs
```

### Frontend Debugging

- React DevTools browser extension
- Vite's built-in error overlay
- Console logging

### Database Debugging

```bash
# Open Prisma Studio
cd packages/database
npx prisma studio

# Check database connection
psql $DATABASE_URL
```

## Performance Monitoring

### Backend Metrics

- Response times logged via `performanceMonitoring` middleware
- Memory usage tracked via `memoryMonitoringMiddleware`
- Request/response logging via Winston

### Health Checks

```bash
# Check server health
curl http://localhost:3001/health

# Response includes:
# - Server status
# - Uptime
# - Environment
```

## Security Considerations

### Authentication
- JWT tokens with short expiration
- Refresh token rotation
- Secure cookie storage

### Input Validation
- express-validator for all inputs
- Prisma parameterized queries
- XSS prevention via escaping

### Rate Limiting
- 100 requests per 15 minutes (general)
- 5 requests per 15 minutes (auth endpoints)

### Headers
- Helmet.js security headers
- CORS whitelist configuration
- CSP directives

## Troubleshooting

### Common Issues

**Database connection failed:**
- Check `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- Verify database exists

**Tests failing with timeout:**
- Increase Jest timeout in config
- Check for unclosed connections
- Review async/await usage

**Build failures:**
- Clear node_modules and reinstall
- Check TypeScript errors
- Review ESLint output

**Port already in use:**
```bash
# Find process using port
lsof -i :3001
# Kill process
kill -9 <PID>
```

### Getting Help

- Check existing documentation in `docs/`
- Review GitHub issues
- Check CI/CD logs for failures
