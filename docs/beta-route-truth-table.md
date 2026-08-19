# Equoria Beta Route Scope Projection

**Status:** active machine-read compatibility document
**Last verified:** 2026-08-19

This table exists because `frontend/src/config/__tests__/betaRouteScopeSync.test.ts` parses rows marked `beta-live`. Runtime behavior lives in `frontend/src/config/betaRouteScope.ts` and routing lives in `frontend/src/App.tsx`.

## Loading rule

Load this file only when changing beta route classification, router coverage, `BETA_SCOPE`, or the route-scope drift test. It does not authorize a feature, prove that a route is complete, or define product scope. Verify functionality against the live route, real API path, tests, and current issue state.

Every currently known route is `beta-live`; unknown paths also resolve to `beta-live` in the current runtime function. Changing that policy is a product/runtime decision, not a documentation-only edit.

| Route                       | Surface             | Runtime owner       | Router owner | Status    |
| --------------------------- | ------------------- | ------------------- | ------------ | --------- |
| `/login`                    | Authentication      | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/register`                 | Authentication      | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/verify-email`             | Authentication      | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/forgot-password`          | Authentication      | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/reset-password`           | Authentication      | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/onboarding`               | New-player flow     | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/`                         | Game entry          | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/stable`                   | Stable              | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/my-stable`                | Stable              | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/horses/:id`               | Horse detail        | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/horses/:id/equip`         | Horse equipment     | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/foals/:id`                | Foal detail         | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/profile`                  | Player profile      | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/settings`                 | Player settings     | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/bank`                     | Game economy        | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/leaderboards`             | Rankings            | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/training`                 | Training            | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/breeding`                 | Breeding            | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/competitions`             | Competitions        | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/competition-results`      | Competition results | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/conformation-shows`       | Conformation shows  | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/prizes`                   | Prizes              | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/world`                    | World hub           | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/grooms`                   | Staff               | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/riders`                   | Staff               | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/trainers`                 | Staff               | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/vet`                      | World service       | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/farrier`                  | World service       | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/feed-shop`                | World shop          | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/tack-shop`                | World shop          | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/marketplace`              | Marketplace         | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/marketplace/horses`       | Horse marketplace   | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/marketplace/horse-trader` | Horse trader        | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/inventory`                | Inventory           | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/message-board`            | Community           | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/message-board/:threadId`  | Community           | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/clubs`                    | Community           | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/messages`                 | Community           | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/crafting`                 | Crafting            | `betaRouteScope.ts` | `App.tsx`    | beta-live |
| `/community`                | Community hub       | `betaRouteScope.ts` | `App.tsx`    | beta-live |

## Verification

Run the focused drift guard after changing this file or `BETA_SCOPE`:

```bash
npm --prefix frontend run test:run -- src/config/__tests__/betaRouteScopeSync.test.ts
```

Then verify the affected real route and its API path. A matching table entry is not readiness evidence.
