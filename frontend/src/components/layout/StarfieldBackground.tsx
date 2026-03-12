/**
 * StarfieldBackground (Task 22-3)
 *
 * Pure-CSS starfield with 3 parallax layers — zero JS layout, no DOM star elements.
 * Stars are rendered via CSS box-shadow on 1×1 elements.
 * Reduced-motion: animation removed, static dots remain.
 *
 * Replaces the old JS-based StarField.tsx.
 */

export function StarfieldBackground() {
  return (
    <div className="starfield-bg" aria-hidden="true" data-testid="starfield-background">
      <div className="starfield-layer starfield-layer--sm" />
      <div className="starfield-layer starfield-layer--md" />
      <div className="starfield-layer starfield-layer--lg" />
    </div>
  );
}
