# 7. Frontend Testing Strategy

### 7.1 Component Testing Best Practices

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ✅ GOOD - Wrap with necessary providers
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

test('HorseList displays horses from API', async () => {
  renderWithProviders(<HorseList />);

  await waitFor(() => {
    expect(screen.getByText('Thunderbolt')).toBeInTheDocument();
  });
});
```

### 7.2 Accessibility Testing

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('HorseCard has no accessibility violations', async () => {
  const { container } = render(<HorseCard horse={mockHorse} />);
  const results = await axe(container);

  expect(results).toHaveNoViolations();
});
```

**Required Standards:**
- WCAG 2.1 AA Compliance
- Keyboard Navigation
- Screen Reader Support
- Color Contrast (4.5:1 minimum)

### 7.3 Performance Testing

**Lighthouse CI Configuration:**
```json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 2000 }]
      }
    }
  }
}
```

---
