# Architecture Folder

**Purpose**: System architecture and technical design documentation for the Equoria platform.

**Last Updated**: 2025-01-14

---

## Folder Structure

```
architecture/
├── backend/           # Backend architecture (7 files)
├── frontend/          # Frontend architecture (3 files)
├── database/          # Database design (2 files)
└── testing/           # Testing architecture (3 files)
```

**Total**: 15 architecture documents across 4 domains

---

## Backend Architecture

**Folder**: [backend/](./backend/)

**Purpose**: Backend system architecture, API design, and layer patterns

| File | Purpose | Lines | Last Updated |
|------|---------|-------|--------------|
| [apiSpecs.md](./backend/apiSpecs.md) | REST API documentation | ~800 | 2025-01-10 |
| [backendOverview.md](./backend/backendOverview.md) | System architecture overview | ~600 | 2025-01-10 |
| [controllersLayer.md](./backend/controllersLayer.md) | Controller layer design | ~400 | 2025-01-10 |
| [modelsLayer.md](./backend/modelsLayer.md) | Data model layer design | ~500 | 2025-01-10 |
| [routesLayer.md](./backend/routesLayer.md) | API routes layer design | ~300 | 2025-01-10 |
| [utilsLayer.md](./backend/utilsLayer.md) | Utilities layer design | ~200 | 2025-01-10 |
| [architectureOverview.md](./backend/architectureOverview.md) | General architecture | ~450 | 2025-01-10 |

**Key Topics**: REST API, MVC pattern, layer separation, middleware, error handling

---

## Frontend Architecture

**Folder**: [frontend/](./frontend/)

**Purpose**: React Native mobile app architecture and UI design

| File | Purpose | Lines | Last Updated |
|------|---------|-------|--------------|
| [frontendArchitecture.md](./frontend/frontendArchitecture.md) | React Native architecture | ~700 | 2025-01-13 |
| [uiDesignOverview.md](./frontend/uiDesignOverview.md) | UI/UX design system | ~500 | 2025-01-10 |
| [horsePage.md](./frontend/horsePage.md) | Horse page implementation | ~400 | 2025-01-10 |

**Key Topics**: React Native, Redux, React Query, navigation, component patterns

---

## Database Architecture

**Folder**: [database/](./database/)

**Purpose**: Database schema and infrastructure design

| File | Purpose | Lines | Last Updated |
|------|---------|-------|--------------|
| [databaseSchema.md](./database/databaseSchema.md) | Complete database schema | ~1,200 | 2025-01-10 |
| [databaseInfrastructure.md](./database/databaseInfrastructure.md) | Database setup and migrations | ~350 | 2025-01-10 |

**Key Topics**: PostgreSQL, Prisma ORM, migrations, indexing, relationships

---

## Testing Architecture

**Folder**: [testing/](./testing/)

**Purpose**: Testing strategy and test plans

| File | Purpose | Lines | Last Updated |
|------|---------|-------|--------------|
| [testingArchitecture.md](./testing/testingArchitecture.md) | Overall testing strategy | ~600 | 2025-01-13 |
| [groomApiTestPlan.md](./testing/groomApiTestPlan.md) | Groom API test plans | ~400 | 2025-01-10 |
| [groomApiTests.postman_collection.json](./testing/groomApiTests.postman_collection.json) | Postman test collection | - | 2025-01-10 |

**Key Topics**: TDD, Jest, React Testing Library, E2E testing, test coverage

---

## Architecture Principles

### 1. Separation of Concerns
- **Backend**: Clear layer separation (routes → controllers → models → database)
- **Frontend**: Component-based architecture with hooks
- **Database**: Normalized schema with proper relationships

### 2. Type Safety
- **TypeScript**: Strict mode throughout
- **Prisma**: Type-safe database queries
- **Redux Toolkit**: Type-safe state management

### 3. Testability
- **TDD**: Write tests first
- **Mocking**: Proper mocking strategies
- **Coverage**: 95%+ target

### 4. Scalability
- **Modular**: Easy to add new features
- **Performance**: Optimized queries and rendering
- **Maintainable**: Clear patterns and documentation

---

## How to Use This Folder

### Finding Architecture Documentation

**By System**:
- Backend API design? → [backend/apiSpecs.md](./backend/apiSpecs.md)
- Frontend structure? → [frontend/frontendArchitecture.md](./frontend/frontendArchitecture.md)
- Database schema? → [database/databaseSchema.md](./database/databaseSchema.md)
- Testing strategy? → [testing/testingArchitecture.md](./testing/testingArchitecture.md)

**By Layer**:
- Controllers? → [backend/controllersLayer.md](./backend/controllersLayer.md)
- Models? → [backend/modelsLayer.md](./backend/modelsLayer.md)
- Routes? → [backend/routesLayer.md](./backend/routesLayer.md)
- UI Design? → [frontend/uiDesignOverview.md](./frontend/uiDesignOverview.md)

### Creating New Architecture Documentation

1. **Determine the domain**: backend / frontend / database / testing
2. **Use a template**:
   ```bash
   cp ../templates/architectureDoc.md architecture/domain/newDoc.md
   ```
3. **Document the design**:
   - System overview
   - Component relationships
   - Design decisions and rationale
   - Code examples
   - Testing approach

### Updating Architecture Documentation

**When to update**:
- New feature changes architecture
- Layer pattern modifications
- API endpoint additions
- Database schema changes
- Testing strategy updates

**How to update**:
1. Edit the relevant document
2. Update "Last Updated" date
3. Update this README if adding new files
4. Link to related documentation

---

## Architecture Decision Records (ADR)

Key architectural decisions made during development:

### ADR-001: Three-Tier Navigation Architecture
- **Date**: 2025-01-13
- **Decision**: RootNavigator → Auth/Main → Stack navigators
- **Rationale**: Clean separation, type safety, Redux-driven flow
- **Document**: [frontend/frontendArchitecture.md](./frontend/frontendArchitecture.md)

### ADR-002: Redux Toolkit + React Query
- **Date**: 2025-01-12
- **Decision**: Use both Redux Toolkit (sync state) and React Query (server state)
- **Rationale**: Clear separation of concerns, optimized caching
- **Document**: [frontend/frontendArchitecture.md](./frontend/frontendArchitecture.md)

### ADR-003: TDD Methodology
- **Date**: 2025-01-11
- **Decision**: Strict TDD (write tests first)
- **Rationale**: Higher code quality, better design, regression protection
- **Document**: [testing/testingArchitecture.md](./testing/testingArchitecture.md)

---

## Related Documentation

- **Game Design**: [../gameDesign/](../gameDesign/) - Feature specifications
- **Planning**: [../planning/](../planning/) - Implementation plans
- **Status**: [../status/](../status/) - Implementation progress
- **Quick Access**: [../QUICK_REFERENCE.md](../QUICK_REFERENCE.md) - Most accessed files

---

## Statistics

**Total Documents**: 15 files
- Backend: 7 files (~3,250 lines)
- Frontend: 3 files (~1,600 lines)
- Database: 2 files (~1,550 lines)
- Testing: 3 files (~1,000+ lines)

**Total Lines**: ~7,400 lines of architecture documentation

**Coverage**: All major systems documented

---

**For complete .claude folder documentation, see [../README.md](../README.md)**
