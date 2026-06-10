# Equoria Motion Policy (D-28, Equoria-o5hub.9)

**Status:** Adopted 2026-06-10
**Tracking:** `Equoria-o5hub.9` · **Decisions:** `docs/design-system/DECISIONS.md`
**Enforcement:** `frontend/src/components/ui/__tests__/motionPolicy.sentinel.test.ts`

Every transition/animation in the frontend belongs to exactly one class, and
each class has a defined reduced-motion behavior. `prefers-reduced-motion:
reduce` is the only switch — there is no app-level toggle.

## Classification

| Class                             | Examples                                                                                                                                                                | Reduced-motion behavior                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Essential state communication** | Loading spinners (`animate-spin`), progress value changes                                                                                                               | **Kept.** A spinner is the loading signal itself; removing it would hide important feedback (handoff §6.8 rule 3d).                                                                                                                                                                                                                                                  |
| **Interaction feedback**          | Hover border/shadow shifts, focus rings, button `active:scale`, `glass-panel-interactive` lift                                                                          | **De-animated, not removed.** Duration tokens (`--duration-*`) zero out in `tokens.css`, so state changes become instant. The interactive lift `transform` is explicitly removed (`index.css` glass-panel-interactive block); focus rings are forced visible (WCAG 2.4.11).                                                                                          |
| **Decorative ambient motion**     | `starfield-bg` twinkle, `magical-pulse`, `shimmer-effect`, `sparkle-trail`, `scroll-entrance`, skeleton sweep, Tailwind `animate-pulse`/`animate-bounce`/`animate-ping` | **Off.** `animation: none` — elements render in their natural end state (stars stay visible, skeletons stay solid, toasts appear instantly).                                                                                                                                                                                                                         |
| **Celebration**                   | `CinematicMoment` entrance, reward toasts, `ribbon-unfurl`, `gold-corner-in`, gallop loader, `fence-jump` bounce                                                        | **Reduced alternative.** The content (prize, level, progress value) still renders — only the transit/loop is removed. `ribbon-unfurl`/`gold-corner-in` use zeroed duration tokens with `forwards` fill (jump to final frame); cinematic/reward/gallop/fence animations are switched off in the `index.css` reduced-motion blocks while their static content remains. |

## Rules for new code

1. **No hover translation/lift on static content.** The lift lives only on
   `Surface(interactive)` / `.glass-panel-interactive` (D-05). Static cards
   never move or glow on hover (`Equoria-o5hub.26` removed the residue).
2. **Drive durations through tokens.** Use `var(--duration-*)` and
   `var(--ease-*)`; they zero out automatically under reduced motion. A
   hardcoded duration needs its own reduced-motion guard and a comment.
3. **Looping decorative animation must have a reduced-motion guard.** Add the
   class to the policy block in `index.css` (or use a duration token).
4. **Celebrations need a reduced alternative, not deletion.** The information
   the celebration carries must remain visible with motion off.
5. **Never remove focus indicators with motion.** The safety-net block forces
   `:focus-visible` outlines under reduced motion.

## Where the implementation lives

- `frontend/src/styles/tokens.css` — duration/ease tokens zeroed.
- `frontend/src/index.css` — per-feature guards (starfield, gallop loader,
  Epic 30-5 safety net, glass-panel-interactive) + the global policy block
  ("Motion policy: global reduced-motion rules").
- `frontend/src/lib/soundManager.ts` — sound respects reduced motion too.
