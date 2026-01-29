# Groom Marketplace Page - Documentation

## Overview

The **Groom Marketplace Page** (`MarketplacePage.tsx`) is a comprehensive, fantasy-themed interface for browsing and hiring grooms in the Equoria game. It features a medieval aesthetic with parchment textures, gold accents, and magical shimmer effects.

---

## Features

### 1. **Fantasy Design System Integration**

- **Color Scheme**: forest-green, parchment, aged-bronze, burnished-gold, saddle-leather
- **Effects**:
  - Shimmer effects on hover
  - Magical glow animations
  - Gold corner embellishments
  - Parchment textures
- **Typography**: Fantasy-themed fonts with medieval styling

### 2. **Marketplace Browsing**

- **Grid Layout**: Responsive grid (1 column mobile, 2 tablet, 3 desktop)
- **Groom Cards**: Each card displays:
  - Name and specialty
  - Skill level badge
  - Experience years
  - Personality trait
  - Biography preview
  - Pricing (daily rate + hiring cost)
  - Action buttons (Details, Hire)

### 3. **Groom Details Modal**

Opens when clicking "Details" button, showing:

- Full biography
- Complete stats breakdown
- Pricing breakdown (daily, weekly, hiring fee)
- Large "Hire" button

### 4. **Marketplace Refresh System**

- **Free Refresh**: Available after cooldown period
- **Premium Refresh**: Costs in-game currency (configurable)
- **Refresh Stats**: Displays total refreshes, last refresh date
- **Confirmation**: Prompts before spending money

### 5. **Hiring System**

- **Validation**: Checks user funds before hiring
- **Cost Display**: Shows hiring cost (1 week upfront)
- **Feedback**:
  - Success notification with remaining balance
  - Error notification for insufficient funds
  - Loading states during hire process
- **Auto-refresh**: Updates marketplace and user data after hire

### 6. **User Balance Display**

- Prominent money display in header
- Updates in real-time after transactions
- Formatted with locale-aware number display

---

## Component Structure

```
MarketplacePage
├── Page Header
│   ├── Title with icon
│   ├── Description
│   └── User balance display
├── Notification Banner
│   └── Success/Error messages
├── Marketplace Stats Grid
│   ├── Available grooms count
│   ├── Last refresh date
│   ├── Total refresh count
│   └── Refresh button
└── Grooms Grid
    └── GroomCard (for each groom)
        ├── Header (name, specialty, skill badge)
        ├── Stats (experience, personality)
        ├── Bio preview
        ├── Pricing
        ├── Action buttons
        └── DetailsModal
```

---

## Props & Interfaces

### MarketplaceGroom Interface

```typescript
interface MarketplaceGroom {
  marketplaceId: string;
  firstName: string;
  lastName: string;
  specialty: string;
  skillLevel: string; // 'novice', 'intermediate', 'advanced', 'expert'
  personality: string; // 'patient', 'energetic', 'gentle', 'strict'
  experience: number; // years
  sessionRate: number; // daily cost
  bio: string;
  availability: boolean;
}
```

### MarketplaceData Interface

```typescript
interface MarketplaceData {
  grooms: MarketplaceGroom[];
  lastRefresh: string; // ISO date
  nextFreeRefresh: string; // ISO date
  refreshCost: number; // cost in currency
  canRefreshFree: boolean;
  refreshCount: number;
}
```

---

## API Integration

### Endpoints Used

1. **GET /api/groom-marketplace**

   - Fetches marketplace data
   - Returns available grooms and refresh info

2. **POST /api/groom-marketplace/refresh**

   - Refreshes marketplace with new grooms
   - Body: `{ force: boolean }`

3. **POST /api/groom-marketplace/hire**

   - Hires a groom from marketplace
   - Body: `{ marketplaceId: string }`

4. **GET /api/groom-marketplace/stats**

   - Retrieves marketplace statistics
   - Returns distributions and config

5. **GET /api/users/:id**
   - Fetches user data (for balance display)

### React Query Integration

```typescript
// Marketplace data
useQuery({
  queryKey: ['marketplace'],
  queryFn: groomsApi.getMarketplace,
});

// Hire mutation
useMutation({
  mutationFn: groomsApi.hireGroom,
  onSuccess: () => {
    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    queryClient.invalidateQueries({ queryKey: ['user', userId] });
  },
});

// Refresh mutation
useMutation({
  mutationFn: (force: boolean) => groomsApi.refreshMarketplace(force),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['marketplace'] });
  },
});
```

---

## Styling Details

### Skill Level Badges

- **Expert**: Gold background, dark text (burnished-gold)
- **Advanced**: Forest green background, light text
- **Intermediate**: Bronze background, light text
- **Novice**: Saddle leather background, light text

### Personality Colors

- **Patient**: Blue (calming)
- **Energetic**: Orange (vibrant)
- **Gentle**: Green (soothing)
- **Strict**: Red (firm)

### Card Hover Effects

- Shadow elevation (lg → 2xl)
- Shimmer overlay (opacity 0 → 30%)
- Title color shift (midnight-ink → forest-green)
- Smooth transitions (300ms)

---

## Responsive Design

### Breakpoints

- **Mobile (< 768px)**: 1 column grid, stacked layout
- **Tablet (768px - 1024px)**: 2 column grid
- **Desktop (> 1024px)**: 3 column grid

### Touch Optimizations

- Large tap targets (48px minimum)
- No hover-dependent functionality
- Modal scrolling on small screens

---

## Accessibility

- **Semantic HTML**: Proper heading hierarchy
- **ARIA Labels**: Descriptive button labels
- **Keyboard Navigation**: Full keyboard support
- **Focus States**: Visible focus indicators
- **Color Contrast**: WCAG AA compliant

---

## Error Handling

### Loading States

- Full-page loading spinner with message
- Individual card loading states during hire
- Refresh button spinner animation

### Error States

- Network errors: Red banner with retry prompt
- Insufficient funds: Specific error message with amounts
- Empty marketplace: Friendly message with refresh option

### Success States

- Green banner with success message
- Auto-dismiss after 3-5 seconds
- Updated balance display

---

## Performance Optimizations

1. **React Query Caching**: 5-minute stale time for marketplace data
2. **Conditional Rendering**: Only render visible cards
3. **Optimistic Updates**: Immediate UI feedback
4. **Query Invalidation**: Smart refetching only when needed
5. **Memoization**: Expensive calculations cached

---

## Usage Example

```tsx
import MarketplacePage from './pages/MarketplacePage';

// In your router
<Route path="/marketplace" element={<MarketplacePage />} />

// Or as standalone
<MarketplacePage />
```

---

## Customization

### Changing Marketplace Size

Backend configuration (`MARKETPLACE_CONFIG` in groomMarketplace service):

```javascript
DEFAULT_MARKETPLACE_SIZE: 6, // Number of grooms displayed
```

### Adjusting Refresh Costs

```javascript
PREMIUM_REFRESH_COST: 500, // Cost in currency
REFRESH_INTERVAL_HOURS: 24, // Free refresh cooldown
```

### Modifying Hiring Costs

Hiring cost is calculated as:

```javascript
const hiringCost = groom.sessionRate * 7; // 1 week upfront
```

Adjust multiplier in `GroomCard` component.

---

## Future Enhancements

### Planned Features

1. **Filtering/Sorting**:

   - Filter by skill level
   - Sort by price, experience
   - Search by name/specialty

2. **Favorites System**:

   - Bookmark grooms
   - Get notifications when favorites appear

3. **Comparison Tool**:

   - Compare multiple grooms side-by-side
   - Stat comparison charts

4. **Advanced Stats**:

   - Success rate predictions
   - Compatibility scores with horses
   - Historical performance data

5. **Seasonal Events**:
   - Special grooms during events
   - Limited-time discounts
   - Holiday-themed marketplace

---

## Testing Recommendations

### Unit Tests

- Test skill badge color logic
- Test personality color mapping
- Test hiring cost calculation

### Integration Tests

- Test marketplace loading
- Test hire workflow
- Test refresh workflow
- Test error handling

### E2E Tests

- Complete hire flow (Playwright)
- Marketplace refresh flow
- Insufficient funds scenario
- Empty marketplace state

---

## Dependencies

### Required Packages

```json
{
  "@tanstack/react-query": "^5.x",
  "lucide-react": "^0.x",
  "react": "^19.x",
  "react-dom": "^19.x"
}
```

### Internal Dependencies

- `FantasyButton` component
- `FantasyModal` component
- `groomsApi` from api-client
- `useProfile` hook

---

## Troubleshooting

### Common Issues

**Issue**: Marketplace not loading

- **Solution**: Check authentication (requires valid JWT token)

**Issue**: Hire button disabled

- **Solution**: Verify user has sufficient funds

**Issue**: Refresh not working

- **Solution**: Check refresh cooldown timer

**Issue**: Styles not applying

- **Solution**: Ensure Tailwind config includes fantasy colors

---

## Credits

**Design System**: Fantasy Medieval Theme
**Icons**: Lucide React
**State Management**: React Query
**Backend API**: Express + Prisma

---

**Version**: 1.0.0
**Last Updated**: 2026-01-29
**Author**: Equoria Development Team
