# Groom Marketplace - Integration Guide

## Quick Start

The Groom Marketplace page is now ready to use! Follow these steps to integrate it into your application.

---

## 1. Add Route to Your Router

### Using React Router v6

```tsx
// In your main routing file (e.g., App.tsx or routes.tsx)
import MarketplacePage from './pages/MarketplacePage';

// Add to your routes
<Route path="/marketplace" element={<MarketplacePage />} />;
```

### Complete Router Example

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MarketplacePage from './pages/MarketplacePage';
import HomePage from './pages/HomePage';
import StableView from './pages/StableView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/stable" element={<StableView />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        {/* Other routes */}
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 2. Add Navigation Link

### In Your Navigation Menu

```tsx
import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';

// Add to your navigation
<Link to="/marketplace" className="nav-link">
  <Users className="w-5 h-5" />
  <span>Groom Marketplace</span>
</Link>;
```

### Using FantasyButton

```tsx
import { useNavigate } from 'react-router-dom';
import FantasyButton from './components/FantasyButton';

function Navigation() {
  const navigate = useNavigate();

  return <FantasyButton onClick={() => navigate('/marketplace')}>Browse Grooms</FantasyButton>;
}
```

---

## 3. Required Backend Setup

### Ensure Backend is Running

```bash
# Start backend server (should be on port 3001)
cd backend
npm run dev
```

### Environment Variables

Verify your frontend `.env` file has the correct API URL:

```env
VITE_API_URL=http://localhost:3001
```

### Backend Routes

The following backend routes must be available:

- `GET /api/groom-marketplace` - Get marketplace
- `POST /api/groom-marketplace/refresh` - Refresh marketplace
- `POST /api/groom-marketplace/hire` - Hire groom
- `GET /api/groom-marketplace/stats` - Get stats
- `GET /api/users/:id` - Get user data

---

## 4. Authentication Required

The marketplace requires the user to be authenticated. Ensure:

1. **Login System**: User must be logged in
2. **JWT Cookies**: Authentication uses httpOnly cookies
3. **Profile Hook**: `useProfile()` hook returns valid user data

### Example Protected Route

```tsx
import { Navigate } from 'react-router-dom';
import { useProfile } from './hooks/useAuth';
import MarketplacePage from './pages/MarketplacePage';

function ProtectedMarketplace() {
  const { data, isLoading } = useProfile();

  if (isLoading) return <div>Loading...</div>;
  if (!data?.user) return <Navigate to="/login" />;

  return <MarketplacePage />;
}
```

---

## 5. Styling Requirements

### Tailwind Configuration

Ensure your `tailwind.config.ts` includes fantasy colors:

```typescript
module.exports = {
  theme: {
    extend: {
      colors: {
        'forest-green': 'rgb(var(--forest-green) / <alpha-value>)',
        'aged-bronze': 'rgb(var(--aged-bronze) / <alpha-value>)',
        'burnished-gold': 'rgb(var(--burnished-gold) / <alpha-value>)',
        'saddle-leather': 'rgb(var(--saddle-leather) / <alpha-value>)',
        parchment: 'rgb(var(--parchment) / <alpha-value>)',
        'midnight-ink': 'rgb(var(--midnight-ink) / <alpha-value>)',
      },
    },
  },
};
```

### CSS Variables

Add to your global CSS (e.g., `index.css` or `globals.css`):

```css
:root {
  --forest-green: 34 139 34; /* RGB values */
  --aged-bronze: 139 90 43;
  --burnished-gold: 218 165 32;
  --saddle-leather: 101 67 33;
  --parchment: 255 248 220;
  --midnight-ink: 25 25 35;
}
```

### Font Classes

```css
.fantasy-title {
  font-family: 'Cinzel', serif; /* Or your fantasy title font */
}

.fantasy-body {
  font-family: 'Lora', serif; /* Or your fantasy body font */
}

.fantasy-caption {
  font-family: 'Lora', serif;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
```

### Texture Classes

```css
.parchment-texture {
  background-image: url('/textures/parchment.png');
  background-blend-mode: multiply;
}

.shimmer-effect {
  background: linear-gradient(90deg, transparent 0%, rgba(218, 165, 32, 0.4) 50%, transparent 100%);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.magical-glow {
  box-shadow: 0 0 20px rgba(218, 165, 32, 0.3);
}
```

---

## 6. Testing the Integration

### Step-by-Step Test

1. **Start Backend**:

   ```bash
   cd backend
   npm run dev
   ```

2. **Start Frontend**:

   ```bash
   cd frontend
   npm run dev
   ```

3. **Login**: Ensure you're logged in with valid credentials

4. **Navigate**: Go to `/marketplace` route

5. **Test Actions**:
   - View available grooms
   - Click "Details" on a groom
   - Hire a groom (if you have funds)
   - Refresh marketplace

### Expected Results

- ✅ Marketplace loads with grooms
- ✅ User balance displays correctly
- ✅ Details modal opens/closes
- ✅ Hire button works (with valid funds)
- ✅ Refresh updates grooms list
- ✅ Notifications appear on actions

---

## 7. Common Issues & Solutions

### Issue: "Failed to load marketplace"

**Causes**:

- Backend not running
- Wrong API URL in `.env`
- Authentication not working

**Solutions**:

1. Check backend is running on port 3001
2. Verify `VITE_API_URL` in `.env`
3. Check browser console for errors
4. Verify user is logged in

### Issue: "Insufficient funds" when hiring

**Causes**:

- User doesn't have enough money
- Session rate too high

**Solutions**:

1. Add test money via backend:
   ```javascript
   await prisma.user.update({
     where: { id: userId },
     data: { money: 10000 },
   });
   ```
2. Lower session rates in marketplace config

### Issue: Styles not applying

**Causes**:

- Tailwind config missing colors
- CSS variables not defined
- Font classes not imported

**Solutions**:

1. Check `tailwind.config.ts` has fantasy colors
2. Add CSS variables to global stylesheet
3. Import fantasy fonts in `index.html`

### Issue: Components not found

**Causes**:

- FantasyButton or FantasyModal missing
- Wrong import paths

**Solutions**:

1. Verify components exist in `src/components/`
2. Check import paths are correct
3. Ensure components are exported properly

---

## 8. Optional Enhancements

### Add to Dashboard

```tsx
// In your main dashboard
import { Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FantasyButton from './components/FantasyButton';

function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="dashboard">
      {/* Other dashboard content */}

      <div className="quick-actions">
        <FantasyButton onClick={() => navigate('/marketplace')}>
          <Users className="w-4 h-4 inline mr-2" />
          Visit Marketplace
        </FantasyButton>
      </div>
    </div>
  );
}
```

### Add Notification Badge

```tsx
// Show unread marketplace updates
import { useQuery } from '@tanstack/react-query';
import { groomsApi } from './lib/api-client';

function MarketplaceLink() {
  const { data: marketplace } = useQuery({
    queryKey: ['marketplace'],
    queryFn: groomsApi.getMarketplace,
  });

  const hasNewGrooms = marketplace?.refreshCount === 1;

  return (
    <Link to="/marketplace" className="relative">
      <Users className="w-5 h-5" />
      {hasNewGrooms && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
      )}
    </Link>
  );
}
```

---

## 9. Mobile Considerations

### Responsive Breakpoints

The page is fully responsive with breakpoints at:

- **Mobile**: < 768px (1 column)
- **Tablet**: 768px - 1024px (2 columns)
- **Desktop**: > 1024px (3 columns)

### Touch Optimizations

- Large tap targets (minimum 48px)
- No hover-only interactions
- Modal scrolling enabled
- Swipe gestures supported (future)

---

## 10. Performance Tips

### Query Configuration

```tsx
// Adjust stale time for your needs
useQuery({
  queryKey: ['marketplace'],
  queryFn: groomsApi.getMarketplace,
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});
```

### Lazy Loading

```tsx
// Lazy load marketplace page
import { lazy, Suspense } from 'react';

const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));

// In routes
<Route
  path="/marketplace"
  element={
    <Suspense fallback={<LoadingSpinner />}>
      <MarketplacePage />
    </Suspense>
  }
/>;
```

---

## Summary Checklist

Before launching the marketplace:

- [ ] Backend running on correct port
- [ ] Routes added to router
- [ ] Navigation links added
- [ ] Tailwind config includes fantasy colors
- [ ] CSS variables defined
- [ ] Fantasy fonts imported
- [ ] Authentication working
- [ ] User has test money
- [ ] Components (FantasyButton, FantasyModal) exist
- [ ] API endpoints accessible
- [ ] Tested hiring flow
- [ ] Tested refresh flow
- [ ] Mobile responsiveness verified

---

## Next Steps

1. Add marketplace link to main navigation
2. Test with real users
3. Monitor error rates
4. Gather feedback
5. Implement filtering/sorting (see README for ideas)

---

**Integration Complete!** 🎉

Your Groom Marketplace is ready to go. If you encounter any issues, refer to the troubleshooting section or check the main `MARKETPLACE_PAGE_README.md` for detailed documentation.

---

**Need Help?**

- Check browser console for errors
- Review backend logs for API issues
- Verify all dependencies installed
- Ensure authentication is working
