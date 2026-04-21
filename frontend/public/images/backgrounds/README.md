# Painted Background Scenes (Story 22.3)

Each sub-folder holds 6 WebP variants (one per viewport ratio) plus optional JPEG fallbacks.

```
{scene}/
├── bg-21.9.webp   — ultrawide
├── bg-16.9.webp   — laptops/desktops
├── bg-3.2.webp    — MacBooks, Surface
├── bg-4.3.webp    — iPads, older monitors
├── bg-1.1.webp    — tablet split-view, foldables
└── bg-9.16.webp   — phones (portrait)
```

## Current state

| Scene          | Art status       |
| -------------- | ---------------- |
| `auth`         | ✅ Committed     |
| `hub`          | ⏳ In production |
| `stable`       | ⏳ In production |
| `horse-detail` | ⏳ In production |
| `training`     | ⏳ In production |
| `competition`  | ⏳ In production |
| `breeding`     | ⏳ In production |
| `world`        | ⏳ In production |
| `default`      | ⏳ In production |

JPEG fallbacks are deferred pending art generation. Until a scene's art
lands, the `useResponsiveBackground` hook (frontend/src/hooks/useResponsiveBackground.ts)
falls back to the generic `/images/bg-{ratio}.webp` pair already shipped.

## Registration

When adding a new scene's art, do TWO things:

1. Commit the six `bg-{ratio}.webp` files into `{scene}/`.
2. Add the scene key to the `SCENES_WITH_ART` set in
   `frontend/src/hooks/useResponsiveBackground.ts` so the router
   stops falling back to generic.
