# Groom Marketplace - Quick Reference Card

## 🚀 5-Minute Setup

### 1. Add Route

```tsx
import MarketplacePage from './pages/MarketplacePage';
<Route path="/marketplace" element={<MarketplacePage />} />;
```

### 2. Add Navigation

```tsx
import { Users } from 'lucide-react';
<Link to="/marketplace">
  <Users className="w-5 h-5" />
  Marketplace
</Link>;
```

### 3. Start Backend

```bash
cd backend && npm run dev
```

### 4. Test

- Navigate to `/marketplace`
- View grooms
- Click "Hire" (if you have funds)

---

## 📦 Component Props

### MarketplacePage

**Props**: None (uses hooks internally)

**Dependencies**:

- `useProfile()` - User authentication
- `groomsApi` - API client
- `FantasyButton` - Button component
- `FantasyModal` - Modal component

---

## 🎨 Design Tokens

### Colors

```css
--forest-green: 34 139 34;
--aged-bronze: 139 90 43;
--burnished-gold: 218 165 32;
--parchment: 255 248 220;
--midnight-ink: 25 25 35;
```

### Classes

- `.fantasy-title` - Page/section titles
- `.fantasy-body` - Body text
- `.fantasy-caption` - Small labels
- `.parchment-texture` - Background texture
- `.shimmer-effect` - Hover animation
- `.magical-glow` - Shadow glow

---

## 🔌 API Endpoints

### Get Marketplace

```typescript
GET / api / groom - marketplace;
Response: MarketplaceData;
```

### Hire Groom

```typescript
POST /api/groom-marketplace/hire
Body: { marketplaceId: string }
Response: { success: boolean, data: { groom, cost, remainingMoney } }
```

### Refresh Marketplace

```typescript
POST / api / groom - marketplace / refresh;
Body: {
  force: boolean;
}
Response: MarketplaceData;
```

---

## 🧪 Quick Tests

### Manual Test

1. Login as user
2. Go to `/marketplace`
3. Check grooms load
4. Click "Details" on a groom
5. Click "Hire" (if funds available)
6. Verify success notification
7. Click "Refresh" button

### Test User Setup

```sql
-- Add test money
UPDATE "User" SET money = 10000 WHERE id = 'your-user-id';
```

---

## 🐛 Troubleshooting

### No Grooms Showing

- Check backend is running
- Verify auth token is valid
- Check browser console for errors

### "Insufficient Funds"

- Add money to test user (see SQL above)
- Or lower session rates in backend config

### Styles Not Working

- Add fantasy colors to `tailwind.config.ts`
- Add CSS variables to `index.css`
- Rebuild Tailwind: `npm run build`

### Hire Button Not Working

- Check user is authenticated
- Verify marketplace data loaded
- Check browser console for errors

---

## 📱 Responsive Breakpoints

```css
Mobile:  < 768px  (1 column)
Tablet:  768px+   (2 columns)
Desktop: 1024px+  (3 columns)
```

---

## ⚡ Performance Tips

### Query Caching

```typescript
staleTime: 5 * 60 * 1000, // 5 minutes
```

### Lazy Loading

```typescript
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
```

---

## 🎯 Key Features

- ✅ Browse available grooms
- ✅ View detailed groom info
- ✅ Hire grooms (with validation)
- ✅ Refresh marketplace (free/paid)
- ✅ Real-time balance updates
- ✅ Success/error notifications
- ✅ Mobile responsive
- ✅ Fantasy-themed UI

---

## 📚 Full Documentation

- `MARKETPLACE_PAGE_README.md` - Complete docs
- `MARKETPLACE_INTEGRATION_GUIDE.md` - Setup guide
- `MARKETPLACE_PAGE_DELIVERY.md` - Delivery summary

---

## 🔗 Related Files

```
frontend/src/
├── pages/MarketplacePage.tsx
├── lib/api-client.ts (updated)
├── components/FantasyButton.tsx
├── components/FantasyModal.tsx
└── hooks/useAuth.ts
```

---

**Version**: 1.0.0
**Last Updated**: 2026-01-29
