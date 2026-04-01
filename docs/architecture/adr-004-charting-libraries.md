# ADR-004: Dual Charting Libraries (Chart.js + Recharts)

**Status:** Accepted
**Date:** 2026-02-02
**Deciders:** Frontend Team
**Epic:** 4 — Training System (Story 4.3)

---

## Context

The Equoria frontend uses two different charting libraries as of Epic 4:

1. **Chart.js** (via `react-chartjs-2`) — introduced in earlier epics for line and bar charts,
   primarily used for XP progression over time and historical score trend lines.

2. **Recharts** — added in Epic 4 Story 4.3 for the `ScoreRadarChart` component, which renders
   a 23-axis radar/spider chart showing discipline score distribution across all disciplines.

Each library was chosen for different chart types, but having two charting dependencies increases
bundle size and the maintenance surface area.

---

## Decision

**Keep both libraries, each for its intended chart type:**

- **Recharts** — radar/spider charts (`ScoreRadarChart`, discipline score distribution).
  Recharts has superior built-in support for `RadarChart` / `PolarGrid` / `PolarAngleAxis`
  with a more declarative React-friendly API that maps cleanly to our component architecture.

- **Chart.js** — time-series line charts (XP progression over time, score history timelines).
  Chart.js offers better animation and performance for dense time-series datasets and has
  more flexible axis configuration for date-based scales.

---

## Consequences

### Positive

- Each library is used where it excels; no compromises on chart quality.
- Existing components (`ScoreRadarChart`, XP history) do not require rewrites.

### Negative

- Slightly larger JavaScript bundle: ~170 kB (Chart.js minified) + ~150 kB (Recharts minified)
  ≈ 320 kB total for charting, vs ~170 kB if consolidated to one library.
- Two libraries to keep updated and patch independently.
- Developers must know which library to use for which chart type.

### Neutral

- Both libraries are maintained, well-documented, and have React wrappers.

---

## Chart Type Routing

| Use Case                                     | Library  | Component                   |
| -------------------------------------------- | -------- | --------------------------- |
| Radar / spider chart (discipline scores)     | Recharts | `ScoreRadarChart.tsx`       |
| Line chart / time-series (XP, score history) | Chart.js | `ScoreProgressionPanel.tsx` |
| Bar chart (stat comparisons)                 | Chart.js | (future)                    |
| New radar-style visualizations               | Recharts | (future)                    |

---

## Future Consideration

Evaluate consolidating to **Recharts-only** after Epic 6. Recharts added line/bar chart support
in v2+ that may cover all Chart.js use cases. If the bundle size becomes a concern during
Lighthouse CI audits (target: performance ≥ 0.6), this ADR should be revisited.

See: `docs/architecture/ARCH-01-Overview.md` for overall frontend architecture.
