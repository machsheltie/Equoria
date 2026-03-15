/**
 * StarfieldBackground (Task 22-3)
 *
 * Pure-CSS starfield with 3 parallax layers — zero JS layout, no DOM star elements.
 * Stars are rendered via CSS box-shadow on 1×1 elements.
 * Reduced-motion: animation removed, static dots remain.
 *
 * Density variants:
 *   - "dense" (default): hub, landing, onboarding — full starfield
 *   - "sparse": content-heavy pages — reduced star count via opacity
 */

interface StarfieldBackgroundProps {
  density?: 'dense' | 'sparse';
}

export function StarfieldBackground({ density = 'dense' }: StarfieldBackgroundProps) {
  const opacityClass = density === 'sparse' ? 'opacity-40' : 'opacity-100';

  return (
    <div
      className={`starfield-bg ${opacityClass}`}
      aria-hidden="true"
      data-testid="starfield-background"
    >
      <div className="starfield-layer starfield-layer--sm" />
      <div className="starfield-layer starfield-layer--md" />
      <div className="starfield-layer starfield-layer--lg" />
    </div>
  );
}
