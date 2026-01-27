# Frontend Development Guide

**Skill:** `/frontend-guide`
**Purpose:** Load frontend development patterns and best practices

---

## When to Use This Skill

Invoke this skill when:

- Building React components
- Implementing pages or layouts
- Setting up state management (React Query)
- Working with React Router v6
- TypeScript type definitions
- Form validation and error handling

---

## Quick Frontend Overview

### Tech Stack

- **React 19** - Latest React with concurrent features
- **TypeScript** - Strict mode, zero `any` types
- **Tailwind CSS** - Utility-first styling
- **React Query** - Server state management
- **React Router v6** - Client-side routing
- **Vite** - Fast build tool and dev server

### Current Status

- ✅ Foundation: React 19 + TypeScript + Tailwind
- ✅ State Management: React Query configured
- ✅ Routing: React Router v6 setup
- ✅ Testing: 115+ tests (Vitest + React Testing Library)
- ✅ Components: 19 major components (6,424 lines)
- ⚠️ Missing: Authentication UI, Training UI, Breeding UI, Real API integration

---

## Documentation Locations

### Frontend Architecture

```bash
# Frontend architecture overview
cat .claude/docs/FRONTEND_ARCHITECTURE.md

# Tech stack documentation
cat .claude/docs/TECH_STACK_DOCUMENTATION.md
```

### Implementation Details

- Components: `/frontend/src/components/`
- Pages: `/frontend/src/pages/`
- Hooks: `/frontend/src/hooks/`
- API client: `/frontend/src/lib/api-client.ts`
- Types: `/frontend/src/types/`

---

## Key Concepts

### Component Structure (TDD Approach)

```typescript
// 1. Write test first (RED)
// MyComponent.test.tsx
describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});

// 2. Implement component (GREEN)
// MyComponent.tsx
export function MyComponent() {
  return <div>Hello</div>;
}

// 3. Refactor and add features
```

### React Query Setup

```typescript
// API integration with React Query
import { useQuery, useMutation } from '@tanstack/react-query';

// Fetch data
const { data, isLoading, error } = useQuery({
  queryKey: ['horses'],
  queryFn: fetchHorses,
});

// Mutate data
const mutation = useMutation({
  mutationFn: updateHorse,
  onSuccess: () => {
    queryClient.invalidateQueries(['horses']);
  },
});
```

### TypeScript Patterns

```typescript
// Strict type definitions
interface Horse {
  id: string;
  name: string;
  age: number;
  stats: HorseStats;
}

// No `any` types allowed
// Use proper types or `unknown` with type guards
```

### Form Validation

```typescript
// React Hook Form + Zod validation
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(3),
  age: z.number().min(0),
});

const { register, handleSubmit } = useForm({
  resolver: zodResolver(schema),
});
```

---

## Common Tasks

### Creating New Page

1. Load `/frontend-guide` skill
2. Create component file in `/frontend/src/pages/`
3. Write tests first (TDD)
4. Implement component
5. Add route to React Router
6. Connect to API with React Query

### Building New Component

1. Write test first (`ComponentName.test.tsx`)
2. Create component file (`ComponentName.tsx`)
3. Implement with TypeScript types
4. Style with Tailwind CSS
5. Ensure accessibility (WCAG 2.1 AA)
6. Verify tests pass

### API Integration

1. Define TypeScript types for API responses
2. Create React Query hooks
3. Implement error handling
4. Add loading states
5. Write tests with MSW mocking

---

## Browser Game Design Patterns

### Old-School Text/Graphics Style

- Text-heavy interfaces (like Horseland, Ludus Equinus)
- Table-based layouts for horse lists
- Stats displayed as text/numbers
- Minimal graphics, focus on data
- Fast page loads (optimized for older browsers)

### UI Patterns

```typescript
// Horse list table
<table className="w-full border-collapse">
  <thead>
    <tr>
      <th>Name</th>
      <th>Age</th>
      <th>Stats</th>
    </tr>
  </thead>
  <tbody>
    {horses.map(horse => (
      <tr key={horse.id}>
        <td>{horse.name}</td>
        <td>{horse.age}</td>
        <td>{horse.stats.speed}</td>
      </tr>
    ))}
  </tbody>
</table>
```

---

## Testing Standards

### Component Testing

```typescript
// Use React Testing Library
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('button click triggers action', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);

  const button = screen.getByRole('button', { name: /submit/i });
  await user.click(button);

  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument();
  });
});
```

### API Mocking with MSW

```typescript
// Mock API requests
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/horses', (req, res, ctx) => {
    return res(ctx.json([{ id: '1', name: 'Thunder' }]));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## Priority Tasks (Remaining 40%)

### 1. Authentication Pages (3-4 hours)

- Login page with form validation
- Registration page with password strength
- Password reset flow
- JWT token integration

### 2. Training UI (4-5 hours)

- Training session management
- Progress tracking display
- Discipline selection
- Cooldown visualization

### 3. Breeding UI (4-5 hours)

- Horse pairing interface
- Breeding records display
- Offspring predictions
- Breeding cooldown tracking

### 4. API Integration (6-8 hours)

- Replace mock data with real API calls
- Connect to 130+ backend endpoints
- Error handling and loading states
- Token refresh mechanism

---

**Load full documentation:**

```bash
cat .claude/docs/FRONTEND_ARCHITECTURE.md
cat .claude/docs/TECH_STACK_DOCUMENTATION.md
```
