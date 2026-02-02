# Equoria Project Context

**Purpose:** Concise AI agent guide for consistent implementation
**Source:** Architecture Decision Document (docs/architecture.md)
**Last Updated:** 2025-12-02

---

## Critical Rules (MUST Follow)

### API Calls
```typescript
// ALWAYS use centralized client - NEVER raw fetch()
import { apiRequest } from '@/lib/api';

// This ensures credentials: 'include' for cookie auth
const data = await apiRequest('/api/endpoint', { method: 'POST', body });
```

### TypeScript
- **No `any` types** - Find proper type or use `unknown`
- **No `@ts-ignore`** - Fix the type issue instead
- **Strict mode** - All new code must pass strict checks

### State Management
- **Server state:** React Query only (no Redux)
- **Form state:** useState + Zod validation
- **Auth state:** AuthContext provider

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + Vite | React 18, Vite 5 |
| State | TanStack Query | v5 |
| Styling | TailwindCSS | v3.x |
| UI | Radix UI | Latest |
| Validation | Zod | Latest |
| Backend | Node.js + Express | Node 20, Express 4 |
| Database | PostgreSQL + Prisma | PG 15+, Prisma 5 |

---

## File Organization

```
frontend/src/
├── components/
│   ├── training/      # Training feature components
│   ├── breeding/      # Breeding feature components
│   ├── auth/          # Auth-related components
│   ├── shared/        # Cross-cutting components
│   └── ui/            # Radix primitives
├── contexts/          # React contexts (AuthContext)
├── hooks/api/         # React Query hooks
├── lib/               # Utilities (api.ts, schemas.ts)
├── pages/             # Route-level components
├── types/             # TypeScript definitions
└── test/              # Test utilities, mocks, factories
```

### Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Components | PascalCase.tsx | `TrainingDashboard.tsx` |
| Hooks | use{Name}.ts | `useAuth.ts` |
| Tests | {Name}.test.tsx | `TrainingDashboard.test.tsx` |
| Types | {name}.ts | `horse.ts` |

---

## Implementation Patterns

### Component Pattern
```typescript
const Component: React.FC<Props> = ({ id }) => {
  const { data, isLoading, error } = useQuery({...});
  const { mutate, isPending } = useMutation({...});

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      {/* Render data */}
      <Button disabled={isPending} onClick={() => mutate(...)}>
        Action
      </Button>
    </div>
  );
};
```

### Form Pattern
```typescript
// 1. Define Zod schema
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// 2. Validate before API call
const result = schema.safeParse(formData);
if (!result.success) {
  setErrors(result.error.flatten().fieldErrors);
  return;
}

// 3. Submit via mutation
mutate(result.data);
```

### Query Key Pattern
```typescript
['horses']                    // All horses
['horses', horseId]           // Single horse
['training', horseId, 'status'] // Nested resource
['currentUser']               // Singleton
```

---

## Error Handling

| Error Type | Display Method |
|------------|----------------|
| Zod validation | Inline under field |
| API 4xx | Inline OR Toast |
| API 5xx | Toast only |
| Network | Toast + Retry |

---

## Testing Requirements

- **Location:** Colocated with source (`Component.test.tsx`)
- **Mocking:** MSW for API calls
- **Fixtures:** Factory functions in `test/factories/`
- **Coverage:** 80% minimum

```typescript
// Test pattern
describe('Component', () => {
  it('should render data when loaded', async () => {
    render(<Component />);
    await waitFor(() => {
      expect(screen.getByText('Expected')).toBeInTheDocument();
    });
  });
});
```

---

## Anti-Patterns (NEVER Do)

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| `fetch('/api/...')` | `apiRequest('/api/...')` |
| `any` type | Find proper type |
| `// @ts-ignore` | Fix the type |
| `useState` for API data | `useQuery` |
| Inline styles | Tailwind classes |
| `console.log` in prod | Remove or use logger |

---

## Import Order

```typescript
// 1. React
import React, { useState } from 'react';

// 2. External libraries
import { useQuery } from '@tanstack/react-query';

// 3. Internal modules (absolute)
import { apiRequest } from '@/lib/api';

// 4. Relative imports
import { Card } from './Card';

// 5. Types
import type { Horse } from '@/types';
```

---

## Quick Reference

| Question | Answer |
|----------|--------|
| Where do pages go? | `frontend/src/pages/` |
| Where do API hooks go? | `frontend/src/hooks/api/` |
| How to make API calls? | `apiRequest()` from `@/lib/api` |
| How to validate forms? | Zod schema + `safeParse()` |
| How to show loading? | `<Skeleton />` for lists, spinner for buttons |
| How to show errors? | Inline for forms, Toast for API errors |

---

## Backend API Response Format

```typescript
interface ApiResponse<T> {
  status: 'success' | 'error';
  message: string;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
}
```

---

## Authentication

- **Method:** HttpOnly cookies (backend manages tokens)
- **Frontend requirement:** `credentials: 'include'` on ALL requests
- **Token rotation:** Automatic (15-min access tokens)
- **Rate limiting:** 5 requests per 15 minutes on auth endpoints

---

*This file is auto-generated from the Architecture Decision Document*
*Update when architectural decisions change*
