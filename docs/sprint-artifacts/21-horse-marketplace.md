# Epic 21: Horse Marketplace

**Epic Number:** 21
**Title:** Horse Marketplace
**Priority:** P1
**Status:** in_progress
**Created Date:** 2026-03-06
**Target Completion:** TBD

---

## Epic Overview

Players can buy and sell horses between each other via a marketplace. The `forSale` and `salePrice` fields already exist on the `Horse` model. This epic adds the API layer, purchase transaction logic, and complete frontend UI.

**Core flow:**

1. Seller marks a horse for sale with a price (from HorseDetailPage)
2. Buyer browses `/marketplace`, filters by breed/age/price
3. Buyer clicks "Buy Now" → confirms → coins transfer atomically, horse changes owner
4. Both parties see the transaction in their history

---

## Stories

### Story 21-1: Backend — Marketplace API

**Priority:** P0
**Estimated effort:** Medium

**New Prisma model:**

```prisma
model HorseSale {
  id          Int      @id @default(autoincrement())
  horseId     Int
  horse       Horse    @relation(fields: [horseId], references: [id])
  sellerId    String
  seller      User     @relation("HorseSalesSold", fields: [sellerId], references: [id])
  buyerId     String
  buyer       User     @relation("HorseSalesBought", fields: [buyerId], references: [id])
  salePrice   Int
  horseName   String   // snapshot at time of sale
  soldAt      DateTime @default(now())

  @@index([sellerId])
  @@index([buyerId])
  @@index([soldAt])
}
```

**Endpoints:**

| Method   | Path                                | Description                                                                           |
| -------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| `GET`    | `/api/v1/marketplace`               | Browse listings (filter: breed, minAge, maxAge, minPrice, maxPrice, discipline, sort) |
| `POST`   | `/api/v1/marketplace/list`          | List horse for sale `{ horseId, price }`                                              |
| `DELETE` | `/api/v1/marketplace/list/:horseId` | Delist horse (owner only)                                                             |
| `POST`   | `/api/v1/marketplace/buy/:horseId`  | Purchase horse (atomic transaction)                                                   |
| `GET`    | `/api/v1/marketplace/my-listings`   | Seller's active listings                                                              |
| `GET`    | `/api/v1/marketplace/history`       | Buyer/seller transaction history                                                      |

**Acceptance Criteria:**

- [x] `HorseSale` model added to schema + migration applied
- [x] `GET /api/v1/marketplace` returns paginated horses with `forSale: true`, excludes requester's own horses, supports query filters
- [x] `POST /api/v1/marketplace/list` sets `forSale: true`, `salePrice`, validates ownership + horse is not already listed
- [x] `DELETE /api/v1/marketplace/list/:horseId` sets `forSale: false`, `salePrice: 0`, validates ownership
- [x] `POST /api/v1/marketplace/buy/:horseId` is atomic: deducts buyer coins, credits seller coins, sets `userId` to buyer, sets `forSale: false`, creates `HorseSale` record
- [x] Buy endpoint rejects: buyer owns horse, buyer has insufficient funds, horse not for sale
- [x] `GET /api/v1/marketplace/my-listings` returns seller's active listings
- [x] `GET /api/v1/marketplace/history` returns user's buy + sell history from `HorseSale`
- [x] All endpoints protected by `authenticateToken`
- [x] Backend tests for all endpoints (happy path + error cases)

---

### Story 21-2: Marketplace Browse Page

**Priority:** P0
**Estimated effort:** Medium

**Route:** `/marketplace`

**Acceptance Criteria:**

- [x] `/marketplace` page accessible from MainNavigation (icon: ShoppingCart)
- [x] Horse listing cards show: name, breed, age, sex, key stats (speed/stamina/agility), asking price, seller username
- [x] Filter panel: breed (dropdown), min/max age, min/max price, sort (Price: Low→High, Price: High→Low, Newest, Youngest)
- [x] Loading skeleton while fetching
- [x] Empty state: "No horses listed for sale right now. Check back soon!"
- [x] Own horses excluded from browse results
- [x] Clicking a listing card opens `MarketplaceDetailModal` with full horse stats + Buy Now button

---

### Story 21-3: List a Horse for Sale (Seller Flow)

**Priority:** P0
**Estimated effort:** Small

**Acceptance Criteria:**

- [x] "List for Sale" button added to HorseDetailPage action bar (only shown if horse is owned by current user and not already listed)
- [x] Clicking opens `ListForSaleModal`: price input (min 100, max 9,999,999 coins), confirm button
- [x] "Delist" button shown on HorseDetailPage when `forSale: true` (replaces "List for Sale")
- [x] HorseDetailPage shows "For Sale — X coins" badge when `forSale: true`
- [x] Toast on list success: "Your horse is now listed for X coins"
- [x] Toast on delist success: "Listing removed"
- [x] Seller cannot list a horse they don't own
- [x] `useListHorse` and `useDelistHorse` hooks in `useMarketplace.ts`

---

### Story 21-4: Purchase Flow (Buyer)

**Priority:** P0
**Estimated effort:** Medium

**Acceptance Criteria:**

- [x] `MarketplaceDetailModal` shows full horse profile: stats, breed, age, sex, traits, seller name, asking price
- [x] "Buy Now" button disabled if viewer is the seller or has insufficient funds (with tooltip explaining why)
- [x] Clicking "Buy Now" opens confirmation step within modal: "You are about to spend X coins. Your balance: Y coins. Remaining: Z coins."
- [x] On confirm → POST buy → success: CinematicMoment ("🐴 Horse Acquired!"), horse appears in user's stable
- [x] On confirm → POST buy → failure (funds changed, already sold): error toast with reason
- [x] `useBuyHorse` hook in `useMarketplace.ts`
- [x] User balance in header updates after purchase (invalidate `['profile']` query)

---

### Story 21-5: My Listings & Sale History

**Priority:** P1
**Estimated effort:** Small

**Acceptance Criteria:**

- [x] "My Listings" tab on `/marketplace` showing seller's active listings with Delist button per row
- [x] "Sale History" tab on `/marketplace` showing completed transactions (bought + sold), with date, horse name, price, counterparty
- [x] Empty states for both tabs
- [x] `useMyListings` and `useSaleHistory` hooks

---

## Technical Considerations

### No breaking changes

All additions are new endpoints and a new model. `forSale`/`salePrice` already on `Horse` — no migration for those fields.

### Purchase atomicity

Use Prisma `$transaction` to ensure money deduction, money credit, and horse ownership transfer all succeed or all fail.

### Preventing race conditions

Check `forSale: true` inside the transaction. If another buyer already purchased, the `forSale` will be `false` and the transaction rejects cleanly.

### Cache invalidation

After buy: invalidate `['marketplace']`, `['horses']`, `['profile']` (for balance update).

### Test priorities

- 21-1: Full backend test suite — happy path + all error cases
- 21-4: Transaction atomicity test (concurrent buy attempts)

---

## Definition of Done

Epic 21 is complete when:

1. All 5 stories' ACs checked
2. Backend tests passing for all marketplace endpoints
3. Frontend builds clean (`npm run build`)
4. Horse can be listed, browsed, purchased end-to-end
5. Sale history records created on purchase
6. All tests green, pushed to master
