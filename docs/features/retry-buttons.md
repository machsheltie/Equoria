# Retry Button Feature Documentation

**Version:** 1.0.0
**Last Updated:** 2025-12-11
**Status:** ✅ Implemented across 10+ components

---

## Overview

The Retry Button is a standardized error handling pattern used throughout the Equoria frontend to provide users with a clear, accessible way to recover from failed API requests. When a component encounters an error while fetching data from the backend API, it displays an error state with a retry button that allows users to re-attempt the request.

### Key Benefits

- **User Experience**: Provides immediate, actionable recovery from transient errors
- **Consistency**: Standardized pattern across all data-fetching components
- **Accessibility**: Semantic button element with clear labeling
- **React Query Integration**: Leverages built-in `refetch()` functionality

---

## Implementation Pattern

### Standard Error State Structure

All components using React Query hooks follow this pattern for error states:

```tsx
// Error state
if (isError || !data) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 shadow-sm">
      <div className="text-sm text-rose-800">
        {error?.message || 'Failed to fetch data'}
      </div>
      <button
        onClick={() => refetch()}
        className="mt-3 rounded-md bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
      >
        Retry
      </button>
    </div>
  );
}
```

### Key Elements

1. **Error Container**: Rose-tinted background (`bg-rose-50`) with rose border (`border-rose-200`)
2. **Error Message**: Dynamic error message from API or fallback message
3. **Retry Button**: Rose-colored button that calls `refetch()` from React Query hook
4. **Styling**: Consistent Tailwind CSS classes with hover states and focus rings

---

## React Query Integration

The retry button leverages React Query's `refetch()` function, which is automatically available from all query hooks:

```tsx
const { data, isLoading, isError, error, refetch } = useHorseXPHistory(horseId, options);

// In error state JSX:
<button onClick={() => refetch()}>
  Retry
</button>
```

### Automatic Behavior

When `refetch()` is called:
1. **State Reset**: React Query resets `isError` to `false`
2. **Loading State**: Component transitions to loading state (`isLoading: true`)
3. **Request Retry**: New API request is made with same parameters
4. **State Update**: On success, component re-renders with data; on failure, error state returns

---

## Components Using Retry Buttons

The retry button pattern is implemented in the following components:

### Horse Management Components

1. **RecentGains** (`components/horse/RecentGains.tsx`)
   - Hook: `useHorseXPHistory()`
   - Line: 147
   - Error: "Failed to fetch gains"

2. **StatProgressionChart** (`components/horse/StatProgressionChart.tsx`)
   - Hook: `useHorseXPHistory()`
   - Line: 180
   - Error: "Failed to fetch XP history"

3. **XPProgressBar** (`components/horse/XPProgressBar.tsx`)
   - Hook: `useHorseXPHistory()`
   - Line: 41
   - Error: Generic error message

4. **AgeUpCounter** (`components/horse/AgeUpCounter.tsx`)
   - Hook: `useHorseAge()`
   - Line: 56
   - Error: Age data fetch failure

5. **StatHistoryGraph** (`components/horse/StatHistoryGraph.tsx`)
   - Hook: `useHorseStats()`
   - Line: 233
   - Error: Stats history fetch failure

6. **TrainingRecommendations** (`components/horse/TrainingRecommendations.tsx`)
   - Hook: `useTrainingRecommendations()`
   - Line: 161
   - Error: Training recommendations fetch failure

### General Components

7. **HorseListView** (`components/HorseListView.tsx`)
   - Hook: `useHorses()`
   - Line: 259
   - Error: Horse list fetch failure

8. **MultiHorseComparison** (`components/MultiHorseComparison.tsx`)
   - Hook: `useHorses()` (query name: `horsesQuery`)
   - Line: 166
   - Error: Horse comparison data fetch failure

9. **EnhancedReportingInterface** (`components/EnhancedReportingInterface.tsx`)
   - Hook: `useMetrics()` (query name: `metricsQuery`)
   - Line: 221
   - Error: Metrics data fetch failure

### Training Components

10. **TrainingDashboard** (`components/training/TrainingDashboard.tsx`)
    - Hook: Training data hook
    - Line: 86
    - Error: Training dashboard data fetch failure

---

## Styling Standards

### Tailwind CSS Classes

**Error Container**:
```css
className="rounded-lg border border-rose-200 bg-rose-50 p-6 shadow-sm"
```

**Error Message**:
```css
className="text-sm text-rose-800"
```

**Retry Button**:
```css
className="mt-3 rounded-md bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
```

### Color Palette

- **Background**: Rose 50 (`bg-rose-50`)
- **Border**: Rose 200 (`border-rose-200`)
- **Text**: Rose 800 (`text-rose-800`)
- **Button**: Rose 600 (`bg-rose-600`)
- **Button Hover**: Rose 700 (`hover:bg-rose-700`)
- **Focus Ring**: Rose 500 (`focus:ring-rose-500`)

### Accessibility Features

- **Semantic Button**: Uses `<button>` element (not `<div>` or `<a>`)
- **Clear Label**: "Retry" text is explicit and actionable
- **Focus Ring**: Visible focus indicator with 2px offset (`focus:ring-2 focus:ring-offset-2`)
- **Color Contrast**: Rose 600 on white meets WCAG AA standards
- **Keyboard Accessible**: Standard button is keyboard-navigable by default

---

## Testing Strategy

### Component Tests

All components with retry buttons include tests for:

1. **Error State Rendering**: Verify retry button appears when `isError: true`
2. **Refetch Invocation**: Verify `refetch()` is called when button is clicked
3. **Loading Transition**: Verify component transitions to loading state after retry

### Example Test (AgeUpCounter)

```tsx
it('should show retry button on error', async () => {
  const mockRefetch = vi.fn();
  vi.mocked(useHorseAge).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: true,
    error: { message: 'Age fetch failed' },
    refetch: mockRefetch,
  } as any);

  render(<AgeUpCounter horseId={1} />);

  const retryButton = screen.getByRole('button', { name: /retry/i });
  await user.click(retryButton);

  expect(mockRefetch).toHaveBeenCalledOnce();
});
```

### Testing Checklist

- [x] Retry button renders in error state
- [x] Button is accessible (role, label)
- [x] `refetch()` is called on click
- [x] Component transitions to loading state
- [x] Error message is displayed clearly
- [x] Focus ring is visible on keyboard focus

---

## Complete Implementation Example

Here's a complete example from `RecentGains.tsx`:

```tsx
import React, { useMemo, useState } from 'react';
import { useHorseXPHistory } from '@/hooks/api/useHorseXP';

interface RecentGainsProps {
  horseId: number;
}

const RecentGains: React.FC<RecentGainsProps> = ({ horseId }) => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('7days');

  const {
    data: historyData,
    isLoading,
    isError,
    error,
    refetch
  } = useHorseXPHistory(horseId, {
    limit: TIME_RANGE_LIMITS[selectedRange],
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-center text-sm text-slate-600">
          Loading recent gains...
        </div>
      </div>
    );
  }

  // Error state with retry button
  if (isError || !historyData) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <div className="text-sm text-rose-800">
          {error?.message || 'Failed to fetch gains'}
        </div>
        <button
          onClick={() => refetch()}
          className="mt-3 rounded-md bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  // Success state - render data
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {/* Component content */}
    </div>
  );
};

export default RecentGains;
```

---

## Best Practices

### DO ✅

- Use the standardized error container styling
- Include dynamic error messages from API when available
- Call `refetch()` directly from React Query hook
- Provide fallback error messages
- Use semantic `<button>` element
- Include focus ring for accessibility
- Test retry button functionality

### DON'T ❌

- Implement custom retry logic (use React Query's `refetch()`)
- Omit error messages (always show user what went wrong)
- Use `<div>` or `<a>` for retry button
- Forget accessibility features (focus ring, semantic HTML)
- Skip testing retry functionality
- Use inconsistent styling across components

---

## Future Enhancements

### Potential Improvements

1. **Retry Counter**: Display number of retry attempts
2. **Exponential Backoff**: Implement retry delays for failed requests
3. **Offline Detection**: Show different message when offline
4. **Error Categorization**: Different styles for different error types (network vs server)
5. **Retry Animation**: Visual feedback during retry attempt
6. **Retry Configuration**: Allow customizing retry behavior per component

### Related Features

- **Loading Skeletons**: Shown during initial load and retry
- **Toast Notifications**: Could supplement retry button for transient errors
- **Error Boundaries**: Catch component-level errors separate from API errors

---

## References

- **React Query Docs**: [Refetching](https://tanstack.com/query/latest/docs/react/guides/window-focus-refetching)
- **Tailwind CSS**: [Rose Color Palette](https://tailwindcss.com/docs/customizing-colors#color-palette-reference)
- **WCAG 2.1**: [Focus Visible (2.4.7)](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-11 | Initial documentation of retry button feature across 10+ components |

---

**Maintained by**: Equoria Frontend Team
**Related Documentation**:
- [React Query Integration Guide](../technical/react-query-guide.md)
- [Component Testing Standards](../technical/testing-standards.md)
- [Tailwind CSS Style Guide](../technical/tailwind-guide.md)
