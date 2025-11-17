# Rules Folder

**Purpose**: Development rules, coding standards, and project conventions for the Equoria platform.

**Last Updated**: 2025-01-14

---

## Files in This Folder

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| [generalRules.md](./generalRules.md) | Core development rules and standards | ~800 | Active |
| [.augmentignore](./.augmentignore) | Augment exclusion patterns | ~50 | Active |

**Total**: 2 files

---

## Quick Start

### Essential Rules

**Read first**: [generalRules.md](./generalRules.md)

**Key sections**:
1. Code Style Guidelines
2. Testing Requirements
3. Git Commit Standards
4. TypeScript Best Practices
5. Security Requirements

---

## General Rules Overview

### Code Style

**File**: [generalRules.md](./generalRules.md)

**Key Standards**:
- **TypeScript**: Strict mode, no `any` types
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Files**: camelCase for all files (except README.md)
- **Components**: Functional components with React.FC
- **Formatting**: Prettier with 2-space indentation

**Example**:
```typescript
// ✅ GOOD: Follows conventions
export const calculateTraitBonus = (trait: Trait): number => {
  return trait.value * trait.modifier;
};

export const HorseCard: React.FC<HorseCardProps> = ({ horse }) => {
  return <View>{/* Component UI */}</View>;
};

// ❌ BAD: Violates conventions
export const CalculateTraitBonus = (trait: any) => {  // Wrong casing, uses any
  return trait.value * trait.modifier
}

export function horseCard(props: any) {  // Wrong casing, any type
  return <View>{/* Component UI */}</View>
}
```

### Testing Requirements

**Mandatory**:
- Test-Driven Development (TDD): Write tests first
- Coverage: ≥95% for all new code
- Pass rate: 100% (no failing tests)
- No warnings: Zero act() warnings, memory leaks

**Test Pattern**:
```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  it('should render correctly', async () => {
    const { getByTestId } = renderWithProviders(<Component />);

    await waitFor(() => {
      expect(getByTestId('component')).toBeTruthy();
    });
  });
});
```

### Git Commit Standards

**Format**:
```
<type>(<scope>): <subject>

<body>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `test`: Test updates
- `docs`: Documentation
- `chore`: Maintenance
- `style`: Formatting

**Example**:
```
feat(auth): Implement login screen with form validation

## Overview
- Created LoginScreen component with email/password inputs
- Added form validation with real-time error display
- Integrated with auth.login mutation
- Navigation on successful login

## Changes
- Added LoginScreen.tsx (340 lines)
- Added LoginScreen.test.tsx (22 tests)
- Updated AuthNavigator to include LoginScreen

## Test Results
- 22/22 tests passing
- 100% coverage
- Zero warnings

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### TypeScript Best Practices

**Strict Mode**: Always enabled

**Type Safety**:
```typescript
// ✅ GOOD: Proper typing
interface User {
  id: string;
  email: string;
  username: string;
}

const getUser = (id: string): Promise<User> => {
  return api.get<User>(`/users/${id}`);
};

// ❌ BAD: Uses any
const getUser = (id: any): any => {
  return api.get(`/users/${id}`);
};
```

**Avoid `any`**:
```typescript
// ✅ GOOD: Use unknown and type guard
const parseJson = (json: string): unknown => {
  return JSON.parse(json);
};

const isUser = (obj: unknown): obj is User => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'email' in obj
  );
};

// ❌ BAD: Uses any
const parseJson = (json: string): any => {
  return JSON.parse(json);
};
```

### Security Requirements

**Authentication**:
- JWT tokens with refresh mechanism
- Secure token storage (SecureStore)
- HTTPS enforcement
- No tokens in logs or error messages

**Input Validation**:
- Validate all user input
- Sanitize data before display
- Parameterized queries (Prisma handles this)
- Rate limiting on API endpoints

**Data Protection**:
- No secrets in code
- Environment variables for config
- Encrypted data at rest (production)
- HTTPS for all API calls

---

## .augmentignore

**File**: [.augmentignore](./.augmentignore)

**Purpose**: Exclude files/folders from Augment AI analysis

**Common exclusions**:
```
# Dependencies
node_modules/
.next/

# Build outputs
dist/
build/
coverage/

# IDE
.vscode/
.idea/

# Environment
.env
.env.local

# Tests
**/__tests__/
**/*.test.ts
**/*.test.tsx
```

---

## Naming Conventions

### Files and Folders

**Standard**: camelCase for all files and folders

**Examples**:
```
✅ GOOD:
myComponent.tsx
groomSystem.md
apiSpecs.md
frontendArchitecture.md

❌ BAD:
my-component.tsx           (kebab-case)
groom_system.md            (snake_case)
API_SPECS.md               (UPPERCASE)
frontend-architecture.md   (kebab-case)
```

**Exception**: `README.md` (always uppercase)

### Code

**Variables/Functions**: camelCase
```typescript
const userId = '123';
const calculateBonus = () => { ... };
```

**Components**: PascalCase
```typescript
export const LoginScreen: React.FC = () => { ... };
export const HorseCard: React.FC<Props> = ({ horse }) => { ... };
```

**Constants**: SCREAMING_SNAKE_CASE
```typescript
const API_BASE_URL = 'https://api.equoria.com';
const MAX_GROOM_LEVEL = 20;
```

**Types/Interfaces**: PascalCase
```typescript
interface User {
  id: string;
  email: string;
}

type AuthState = {
  isAuthenticated: boolean;
  user: User | null;
};
```

---

## Code Review Checklist

Before submitting code for review:

### Functionality
- [ ] Feature works as intended
- [ ] All acceptance criteria met
- [ ] Edge cases handled
- [ ] Error handling implemented

### Testing
- [ ] All tests passing (100%)
- [ ] Coverage ≥95%
- [ ] No test warnings
- [ ] Integration tests included

### Code Quality
- [ ] TypeScript strict mode passing
- [ ] No ESLint errors
- [ ] No console.log (use proper logging)
- [ ] Proper error messages
- [ ] Comments for complex logic

### Documentation
- [ ] JSDoc comments on exported functions
- [ ] README updated (if needed)
- [ ] CLAUDE.md updated (if significant change)
- [ ] Clear commit message

### Security
- [ ] Input validation
- [ ] No secrets in code
- [ ] Proper authentication/authorization
- [ ] No SQL injection risk
- [ ] XSS prevention

---

## Anti-Patterns (Things to Avoid)

### Testing
❌ **Wrapping render() in act()**
```typescript
// WRONG
await act(async () => {
  render(<Component />);
});

// CORRECT
render(<Component />);
await waitFor(() => { ... });
```

❌ **Using fake timers unnecessarily**
```typescript
// WRONG
jest.useFakeTimers();  // Interferes with React Query

// CORRECT
// Use real timers, wait with waitFor()
```

### TypeScript
❌ **Using `any` type**
```typescript
// WRONG
const data: any = fetchData();

// CORRECT
const data: User = fetchData();
// Or use unknown with type guard
```

❌ **Type assertions without validation**
```typescript
// WRONG
const user = data as User;  // Unsafe!

// CORRECT
if (isUser(data)) {
  const user = data;  // Type-safe
}
```

### React
❌ **Directly mutating state**
```typescript
// WRONG
state.user.name = 'New Name';

// CORRECT
dispatch(updateUser({ name: 'New Name' }));
```

❌ **Missing dependencies in useEffect**
```typescript
// WRONG
useEffect(() => {
  fetchData(userId);
}, []);  // Missing userId dependency

// CORRECT
useEffect(() => {
  fetchData(userId);
}, [userId]);
```

---

## How to Use This Folder

### Daily Development

1. **Before starting**: Review [generalRules.md](./generalRules.md)
2. **While coding**: Follow naming conventions
3. **Before commit**: Run checklist above
4. **During review**: Ensure all rules followed

### Onboarding New Developers

1. Read [generalRules.md](./generalRules.md) completely
2. Set up linting/formatting tools
3. Review code examples
4. Practice TDD methodology

### Updating Rules

**When to update**:
- New best practices discovered
- Team consensus on changes
- Tool/framework version updates
- Security requirements change

**Process**:
1. Propose change (discuss rationale)
2. Update [generalRules.md](./generalRules.md)
3. Notify team of changes
4. Update lint/tooling configs if needed

---

## Quality Gates

### Pre-Commit
- All tests passing
- No TypeScript errors
- No ESLint errors
- Proper commit message format

### Pre-Merge
- Code review approved
- All pre-commit checks passed
- Documentation updated
- No merge conflicts

### Pre-Deploy
- Full test suite passing (unit + integration + E2E)
- Security scan passed
- Performance benchmarks met
- Changelog updated

---

## Related Documentation

- **Architecture**: [../architecture/testing/testingArchitecture.md](../architecture/testing/testingArchitecture.md) - Testing strategy
- **Guides**: [../guides/development/security.md](../guides/development/security.md) - Security guidelines
- **Reference**: [../reference/productRequirementsDocument.md](../reference/productRequirementsDocument.md) - Requirements

---

## Enforcement

### Automated
- **ESLint**: Code style enforcement
- **TypeScript**: Type checking
- **Prettier**: Auto-formatting
- **Husky**: Pre-commit hooks
- **Jest**: Test coverage enforcement

### Manual
- **Code reviews**: Peer review all PRs
- **Architecture reviews**: For major changes
- **Security audits**: Regular security checks

---

**For complete .claude folder documentation, see [../README.md](../README.md)**
