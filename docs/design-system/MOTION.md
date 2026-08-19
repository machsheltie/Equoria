# Equoria Motion Policy

**Status:** Adopted 2026-06-10 · **Reviewed:** 2026-08-19
**Authority:** `PRODUCT.md` → `DESIGN.md` → this policy
**Tracking:** `Equoria-o5hub.9`
**Enforcement:** `frontend/src/components/ui/__tests__/motionPolicy.sentinel.test.ts`

Every transition/animation in the frontend belongs to exactly one class, and
each class has a defined reduced-motion behavior. `prefers-reduced-motion:
reduce` is the only switch — there is no app-level toggle.

**Motion principle:** motion marks interaction, spatial transition, or a
meaningful game event. It is not a generic polish layer applied to every card,
panel, metric, or page section. One authored arrival or reveal carries more
delight than scattered SaaS micro-interactions.

## Classification

| Class                             | Examples                                                                                                                       | Reduced-motion behavior                                                                                                                                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Essential state communication** | Loading spinners (`animate-spin`), progress value changes                                                                      | **Kept.** A spinner is the loading signal itself; removing it would hide important feedback (handoff §6.8 rule 3d).                                                                                                                                                                                                         |
| **Interaction feedback**          | Hover border/shadow shifts, focus rings, button `active:scale`, `glass-panel-interactive` lift                                 | **De-animated, not removed.** Duration tokens (`--duration-*`) zero out in `tokens.css`, so state changes become instant. The interactive lift `transform` is explicitly removed (`index.css` glass-panel-interactive block); focus rings are forced visible (WCAG 2.4.11).                                                 |
| **Decorative ambient motion**     | `magical-pulse`, `shimmer-effect`, `sparkle-trail`, `scroll-entrance`, skeleton sweep, Tailwind `animate-pulse`/`animate-ping` | **Off.** `animation: none` — elements render in their natural end state (skeletons stay solid; contextual feedback appears instantly). `animate-bounce` is retired, not an available ambient option.                                                                                                                        |
| **Celebration**                   | `CinematicMoment` entrance, `ribbon-unfurl`, `gold-corner-in`, gallop or other authored event motion                           | **Reduced alternative.** The content (horse, prize, placing, trait, progress value) still renders — only the transit/loop is removed. Token-driven entrances jump to their final frame; cinematic/event animations switch off while static payload remains. Celebration motion must not depend on a toast or bounce effect. |

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
6. **No bounce or elastic easing.** `animate-bounce`, spring-back cards,
   bouncing page regions, and fence-jump bounce treatments are retired by
   owner ruling. Use the expressive ease-out in `DESIGN.md` for earned moments.
7. **No toast-as-celebration.** Routine feedback stays contextual; meaningful
   events use an authored bounded moment whose information remains available.
8. **Avoid component-default motion.** A reusable component does not animate
   merely because it can. The route concept and event importance must justify it.

## Where the implementation lives

- `frontend/src/styles/tokens.css` — duration/ease tokens zeroed.
- `frontend/src/index.css` — per-feature guards (gallop loader,
  Epic 30-5 safety net, glass-panel-interactive) + the global policy block
  ("Motion policy: global reduced-motion rules").
- `frontend/src/lib/soundManager.ts` — sound respects reduced motion too.

## Changelog

| Date       | Change                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| 2026-06-10 | Initial motion classification and reduced-motion policy                                                         |
| 2026-08-19 | Removed toast/bounce approval, added event-weighted motion principle, and aligned authority with PRODUCT/DESIGN |
