# Backend API Documentation

**Skill:** `/backend-api`
**Purpose:** Load backend API layer documentation (controllers, routes, models)

---

## When to Use This Skill

Invoke this skill when:

- Creating new API endpoints
- Understanding existing routes
- Working on controllers or models
- Debugging API responses
- Planning API changes

---

## API Layer Structure

```
backend/
├── routes/         # API endpoint definitions
├── controllers/    # Business logic handlers
├── models/         # Data access layer (Prisma)
└── middleware/     # Auth, validation, rate limiting
```

---

## Quick References

### Controllers Documentation

```bash
cat .claude/docs/api/controllers-layer.md
```

### Routes Documentation

```bash
cat .claude/docs/api/routes-layer.md
```

### Models Documentation

```bash
cat .claude/docs/api/models-layer.md
```

### Utils Documentation

```bash
cat .claude/docs/api/utils-layer.md
```

---

## API Conventions

- Use camelCase for all JSON properties
- Return consistent error formats
- Include ownership validation on protected resources
- Apply rate limiting to sensitive endpoints
- Log high-sensitivity operations to audit trail

---

**Load full backend overview:**

```bash
cat .claude/docs/api/backend-overview.md
```
