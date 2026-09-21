/**
 * ScoreBreakdownRadar — the Stat Constellation (Equoria-d6a47)
 *
 * Successor to the Recharts RadarChart, per the owner ruling on Equoria-ij7ev
 * (2026-09-11): an authored inline-SVG stat constellation that also serves
 * the predicted foal profile in breeding (CompatibilityPreview), the scouting
 * view (CompetitionFieldPreview) and the competition results surface
 * (PerformanceBreakdownPanel).
 *
 * Each stat is a star on its own spoke of the night: the brighter and farther
 * out it sits, the higher the value. Faint lines trace the figure between the
 * stars the way a constellation is drawn, and every star carries its name and
 * value at the rim. A personal best, when supplied, is a second, hollow figure
 * in celestial blue beneath the gold one. There is no polar grid, no axis, no
 * legend chrome — the values are written on the sky and listed as text for
 * assistive technology.
 *
 * The file keeps its historical name so the barrel and the three call sites
 * are undisturbed.
 */

import React, { useId, useMemo } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ScoreBreakdownRadarProps {
  stats: Record<string, number>;
  personalBest?: Record<string, number>;
  maxValue?: number;
  title?: string;
  height?: number;
}

interface StarNode {
  key: string;
  slug: string;
  label: string;
  value: number;
  best?: number;
  angle: number;
  radius: number;
  bestRadius?: number;
  x: number;
  y: number;
}

// ── Geometry ───────────────────────────────────────────────────────────────────

const VIEW_WIDTH = 360;
const RIM_LABEL_OFFSET = 12;

/** Fixed star dust behind the figure — atmosphere, not data. */
const DUST: ReadonlyArray<readonly [number, number, number]> = [
  [0.06, 0.12, 1.1],
  [0.17, 0.82, 0.8],
  [0.28, 0.06, 0.7],
  [0.41, 0.93, 1.0],
  [0.53, 0.04, 0.6],
  [0.66, 0.9, 0.9],
  [0.78, 0.1, 1.2],
  [0.9, 0.3, 0.7],
  [0.95, 0.72, 1.0],
  [0.12, 0.45, 0.6],
  [0.86, 0.55, 0.6],
  [0.34, 0.5, 0.5],
];

function slugOf(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function labelOf(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function fix(n: number): string {
  return n.toFixed(1);
}

/** Four-point celestial star centred on (cx, cy) with reach `s`. */
function starPath(cx: number, cy: number, s: number): string {
  const i = s * 0.32;
  return [
    `M${fix(cx)},${fix(cy - s)}`,
    `L${fix(cx + i)},${fix(cy - i)}`,
    `L${fix(cx + s)},${fix(cy)}`,
    `L${fix(cx + i)},${fix(cy + i)}`,
    `L${fix(cx)},${fix(cy + s)}`,
    `L${fix(cx - i)},${fix(cy + i)}`,
    `L${fix(cx - s)},${fix(cy)}`,
    `L${fix(cx - i)},${fix(cy - i)}`,
    'Z',
  ].join(' ');
}

function figurePath(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${fix(p.x)},${fix(p.y)}`).join(' ') + ' Z';
}

export function buildConstellation(
  stats: Record<string, number>,
  personalBest: Record<string, number> | undefined,
  maxValue: number,
  height: number
): { nodes: StarNode[]; cx: number; cy: number; rMax: number; rMin: number } {
  const keys = Object.keys(stats);
  const n = keys.length;
  const cx = VIEW_WIDTH / 2;
  const cy = height / 2;
  const rMax = Math.max(24, Math.min(VIEW_WIDTH / 2 - 72, height / 2 - 40));
  const rMin = rMax * 0.16;

  const ratio = (v: number) => (maxValue > 0 ? Math.min(1, Math.max(0, v / maxValue)) : 0);
  const radiusOf = (v: number) => rMin + ratio(v) * (rMax - rMin);

  const nodes: StarNode[] = keys.map((key, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const value = stats[key] ?? 0;
    const radius = radiusOf(value);
    const best = personalBest ? (personalBest[key] ?? 0) : undefined;
    return {
      key,
      slug: slugOf(key) || `stat-${i}`,
      label: labelOf(key),
      value,
      best,
      angle,
      radius,
      bestRadius: best === undefined ? undefined : radiusOf(best),
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });

  return { nodes, cx, cy, rMax, rMin };
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ScoreBreakdownRadar({
  stats,
  personalBest,
  maxValue = 100,
  title,
  height = 280,
}: ScoreBreakdownRadarProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const titleId = `constellation-${uid}-title`;
  const glowId = `constellation-${uid}-glow`;

  const { nodes, cx, cy, rMax } = useMemo(
    () => buildConstellation(stats, personalBest, maxValue, height),
    [stats, personalBest, maxValue, height]
  );

  const currentFigure = figurePath(nodes);
  const bestFigure = personalBest
    ? figurePath(
        nodes.map((node) => ({
          x: cx + (node.bestRadius ?? 0) * Math.cos(node.angle),
          y: cy + (node.bestRadius ?? 0) * Math.sin(node.angle),
        }))
      )
    : '';

  return (
    <figure
      data-testid="stat-constellation"
      aria-labelledby={title ? titleId : undefined}
      className="w-full"
    >
      {title && (
        <figcaption
          id={titleId}
          className="mb-2 text-center text-sm font-semibold font-[var(--font-body)] text-[var(--text-primary)]"
        >
          {title}
        </figcaption>
      )}

      {nodes.length === 0 ? (
        <p
          data-testid="constellation-empty"
          className="py-6 text-center text-xs font-[var(--font-body)] text-[var(--text-secondary)]"
        >
          No stats to place in the sky yet.
        </p>
      ) : (
        <>
          <svg
            width="100%"
            height={height}
            viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            overflow="visible"
            aria-hidden="true"
            className="block overflow-visible"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <defs>
              <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="1.6" result="halo" />
                <feMerge>
                  <feMergeNode in="halo" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Star dust — the sky behind the figure */}
            {DUST.map(([fx, fy, r], i) => (
              <circle
                key={`dust-${i}`}
                cx={fix(fx * VIEW_WIDTH)}
                cy={fix(fy * height)}
                r={r}
                fill="var(--alpha-text-secondary-30)"
              />
            ))}

            {/* Spokes — one faint line of sight per stat */}
            {nodes.map((node) => (
              <line
                key={`spoke-${node.slug}`}
                x1={fix(cx)}
                y1={fix(cy)}
                x2={fix(cx + rMax * Math.cos(node.angle))}
                y2={fix(cy + rMax * Math.sin(node.angle))}
                stroke="var(--glass-border)"
                strokeWidth="1"
                strokeDasharray="1.5 3.5"
              />
            ))}

            {/* Personal best — the hollow figure beneath, celestial blue */}
            {personalBest && bestFigure && (
              <path
                d={bestFigure}
                fill="none"
                stroke="var(--electric-blue-400)"
                strokeOpacity="0.55"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
            )}

            {/* Current figure — the constellation lines, lantern gold */}
            {currentFigure && (
              <path
                d={currentFigure}
                fill="var(--alpha-gold-primary-6)"
                stroke="var(--gold-primary)"
                strokeOpacity="0.7"
                strokeWidth="1"
              />
            )}

            {/* Personal-best markers */}
            {personalBest &&
              nodes.map((node) => (
                <g
                  key={`best-${node.slug}`}
                  data-testid={`constellation-best-${node.slug}`}
                  data-value={node.best}
                >
                  <circle
                    cx={fix(cx + (node.bestRadius ?? 0) * Math.cos(node.angle))}
                    cy={fix(cy + (node.bestRadius ?? 0) * Math.sin(node.angle))}
                    r="3.2"
                    fill="var(--bg-night-sky)"
                    stroke="var(--electric-blue-400)"
                    strokeWidth="1.2"
                  />
                </g>
              ))}

            {/* Stars — one per stat, carrying name and value at the rim */}
            {nodes.map((node) => {
              const reach = 3.5 + 4.5 * ((node.radius - 0) / rMax);
              const cos = Math.cos(node.angle);
              const sin = Math.sin(node.angle);
              const rimX = cx + (rMax + RIM_LABEL_OFFSET) * cos;
              const rimY = cy + (rMax + RIM_LABEL_OFFSET) * sin;
              const anchor = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
              const [nameY, valueY] =
                sin < -0.25
                  ? [rimY - 11, rimY]
                  : sin > 0.25
                    ? [rimY + 9, rimY + 20]
                    : [rimY - 2, rimY + 10];

              return (
                <g
                  key={`star-${node.slug}`}
                  data-testid={`constellation-star-${node.slug}`}
                  data-stat={node.key}
                  data-value={node.value}
                  data-radius={fix(node.radius)}
                >
                  <title>{`${node.label}: ${formatValue(node.value)} of ${maxValue}`}</title>
                  <path
                    d={starPath(node.x, node.y, reach)}
                    fill="var(--gold-light)"
                    filter={`url(#${glowId})`}
                  />
                  <text
                    x={fix(rimX)}
                    textAnchor={anchor}
                    fontSize="10.5"
                    fill="var(--text-secondary)"
                  >
                    <tspan x={fix(rimX)} y={fix(nameY)}>
                      {node.label}
                    </tspan>
                    <tspan
                      x={fix(rimX)}
                      y={fix(valueY)}
                      fill="var(--text-primary)"
                      fontWeight="600"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatValue(node.value)}
                    </tspan>
                  </text>
                </g>
              );
            })}
          </svg>

          {personalBest && (
            <p
              data-testid="constellation-legend"
              className="mt-1 flex items-center justify-center gap-4 text-xs font-[var(--font-body)] text-[var(--text-secondary)]"
            >
              <span className="inline-flex items-center gap-1">
                <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                  <path d={starPath(6, 6, 5.5)} fill="var(--gold-light)" />
                </svg>
                current
              </span>
              <span className="inline-flex items-center gap-1">
                <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                  <circle
                    cx="6"
                    cy="6"
                    r="4"
                    fill="none"
                    stroke="var(--electric-blue-400)"
                    strokeWidth="1.5"
                  />
                </svg>
                personal best
              </span>
            </p>
          )}

          {/* The values as text, for assistive technology. */}
          <dl className="sr-only" data-testid="constellation-values">
            {nodes.map((node) => (
              <div key={`sr-${node.slug}`}>
                <dt>{node.label}</dt>
                <dd>
                  {formatValue(node.value)} of {maxValue}
                  {node.best !== undefined ? `, personal best ${formatValue(node.best)}` : ''}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </figure>
  );
}

export default ScoreBreakdownRadar;
