# Frontend Architecture

**Purpose**: React Native mobile app architecture, UI design system, and component patterns.

**Stack**: React Native 0.81.5, TypeScript 5.x, Redux Toolkit, React Query, React Navigation v7

**Last Updated**: 2025-01-14

---

## Files in This Folder

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| [frontendArchitecture.md](./frontendArchitecture.md) | Complete React Native architecture | ~700 | Active |
| [uiDesignOverview.md](./uiDesignOverview.md) | UI/UX design system | ~500 | Active |
| [horsePage.md](./horsePage.md) | Horse page implementation details | ~400 | Active |

**Total**: 3 files, ~1,600 lines

---

## Quick Start

### New to Frontend?
1. Start with [frontendArchitecture.md](./frontendArchitecture.md)
2. Review UI patterns in [uiDesignOverview.md](./uiDesignOverview.md)
3. See example implementation in [horsePage.md](./horsePage.md)

### Need Specific Info?
- **Navigation patterns?** → [frontendArchitecture.md](./frontendArchitecture.md) (Navigation section)
- **State management?** → [frontendArchitecture.md](./frontendArchitecture.md) (Redux/React Query sections)
- **UI components?** → [uiDesignOverview.md](./uiDesignOverview.md)
- **Screen examples?** → [horsePage.md](./horsePage.md)

---

## Architecture Overview

### Core Stack

```
React Native 0.81.5
├── Navigation (React Navigation v7)
│   ├── RootNavigator
│   ├── AuthNavigator (auth flow)
│   └── MainNavigator (app flow)
├── State Management
│   ├── Redux Toolkit (sync state)
│   └── React Query (server state)
├── UI Components
│   ├── Common components (Screen, Loading, ErrorMessage)
│   └── Feature components
└── Screens
    ├── Authentication (Login, Register, ForgotPassword)
    └── Main (Dashboard, Profile, etc.)
```

### Key Principles

1. **Type Safety**: TypeScript strict mode, no `any` types
2. **TDD**: Tests written first, 95%+ coverage
3. **Component Reusability**: Shared components in `components/common/`
4. **State Separation**: Redux for sync state, React Query for server state
5. **Accessibility**: WCAG 2.1 AA compliance

---

## Navigation Architecture

### Three-Tier Structure

```
RootNavigator (Redux-driven)
├── AuthNavigator (when !isAuthenticated)
│   ├── LoginScreen
│   ├── RegisterScreen
│   └── ForgotPasswordScreen
└── MainNavigator (when isAuthenticated)
    └── TabNavigator
        ├── HomeScreen
        ├── SearchScreen
        ├── MyGroomsScreen
        └── ProfileScreen
```

### Type-Safe Navigation

```typescript
// Global type augmentation
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

// Type-safe navigation props
type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;

// Type-safe hooks
const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
```

---

## State Management

### Redux Toolkit (Sync State)

**Purpose**: Client-side state that doesn't come from server

**Slices**:
- `authSlice`: User authentication state
- `appSlice`: Global app state (theme, language, etc.)

**Usage**:
```typescript
import { useAppDispatch, useAppSelector } from '@/state/hooks';

const dispatch = useAppDispatch();
const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
```

### React Query (Server State)

**Purpose**: Data fetched from API with caching

**Features**:
- Automatic caching
- Background refetching
- Optimistic updates
- Retry logic

**Usage**:
```typescript
import { useLoginMutation } from '@/api/queries/auth';

const loginMutation = useLoginMutation();
await loginMutation.mutateAsync({ email, password });
```

---

## Component Patterns

### Common Components

**Location**: `src/components/common/`

**Components**:
- `Screen`: Base screen wrapper (safe area, keyboard, loading)
- `Loading`: Loading indicator (inline or fullscreen)
- `ErrorMessage`: Error display (with retry)

**Usage**:
```typescript
import { Screen, Loading, ErrorMessage } from '@/components/common';

const MyScreen = () => (
  <Screen>
    {isLoading && <Loading />}
    {error && <ErrorMessage error={error} onRetry={refetch} />}
    {/* Screen content */}
  </Screen>
);
```

### Screen Components

**Location**: `src/screens/`

**Pattern**:
```typescript
import React from 'react';
import { Screen } from '@/components/common';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<StackParamList, 'ScreenName'>;

export const ScreenName: React.FC<Props> = ({ navigation, route }) => {
  // State and logic

  return (
    <Screen>
      {/* Screen UI */}
    </Screen>
  );
};
```

---

## UI Design System

Full documentation in [uiDesignOverview.md](./uiDesignOverview.md).

### Colors
- **Primary**: #007AFF (iOS blue)
- **Secondary**: #5856D6 (iOS purple)
- **Success**: #34C759 (iOS green)
- **Warning**: #FF9500 (iOS orange)
- **Error**: #FF3B30 (iOS red)

### Typography
- **Heading**: SF Pro Display (iOS), Roboto (Android)
- **Body**: SF Pro Text (iOS), Roboto (Android)
- **Mono**: SF Mono (iOS), Roboto Mono (Android)

### Spacing
- **xs**: 4px
- **sm**: 8px
- **md**: 16px
- **lg**: 24px
- **xl**: 32px

---

## Testing Strategy

### Current Coverage
- **Overall**: 96.09% (479 tests)
- **Navigation**: 100% (132 tests)
- **Authentication**: 100% (81 tests)
- **Common Components**: 100% (98 tests)
- **API Client**: 91.78% (60 tests)

### Test Patterns
```typescript
import { render, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/utils';

describe('ComponentName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render correctly', async () => {
    const { getByTestId } = renderWithProviders(<Component />);

    await waitFor(() => {
      expect(getByTestId('component')).toBeTruthy();
    });
  });
});
```

---

## Performance Best Practices

### Optimization Techniques
1. **Memoization**: Use `React.memo()` for expensive components
2. **useCallback**: Memoize callbacks passed to children
3. **useMemo**: Memoize expensive calculations
4. **FlatList**: Use for long lists (virtualization)
5. **Image Optimization**: Use appropriate image sizes
6. **Code Splitting**: Lazy load screens with React.lazy()

### Performance Targets
- **Initial Load**: <2s
- **Screen Transitions**: <200ms
- **API Calls**: <500ms (excluding network)
- **Form Validation**: <50ms

---

## Accessibility

### WCAG 2.1 AA Compliance

**Requirements**:
- Touch targets ≥44x44pt
- Color contrast ≥4.5:1
- Screen reader support
- Keyboard navigation
- Focus indicators

**Implementation**:
```typescript
<TouchableOpacity
  accessible={true}
  accessibilityLabel="Login button"
  accessibilityRole="button"
  accessibilityHint="Double tap to log in"
>
  <Text>Login</Text>
</TouchableOpacity>
```

---

## Development Workflow

### Creating a New Screen

1. **Create component file**: `src/screens/feature/ScreenName.tsx`
2. **Write tests first**: `src/screens/feature/__tests__/ScreenName.test.tsx`
3. **Implement screen**: Follow RED-GREEN-REFACTOR TDD
4. **Add to navigator**: Update appropriate navigator file
5. **Test navigation**: Ensure screen accessible

### Creating a New Component

1. **Create component file**: `src/components/common/ComponentName.tsx`
2. **Write tests first**: `src/components/common/__tests__/ComponentName.test.tsx`
3. **Implement component**: TDD methodology
4. **Export from index**: Add to `src/components/common/index.ts`
5. **Document usage**: Add JSDoc comments

---

## Related Documentation

- **Backend API**: [../backend/apiSpecs.md](../backend/apiSpecs.md)
- **Testing Strategy**: [../testing/testingArchitecture.md](../testing/testingArchitecture.md)
- **Database Schema**: [../database/databaseSchema.md](../database/databaseSchema.md)
- **Navigation Docs**: In-repo documentation at `src/navigation/`

---

**For complete architecture documentation, see [../README.md](../README.md)**
