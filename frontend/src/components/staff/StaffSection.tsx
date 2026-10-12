/**
 * StaffSection — one open area of the Steward's Office (Equoria-puj1e.1).
 *
 * A labelled region with an entity-voice heading and a quiet rule above it;
 * no panel, no card. The heading names the region for assistive technology.
 */

import React, { useId } from 'react';

export interface StaffSectionProps {
  title: string;
  /** One plain sentence under the heading. */
  intro?: string;
  children: React.ReactNode;
}

export function StaffSection({ title, intro, children }: StaffSectionProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="border-t border-[var(--border-muted)] pt-6">
      <h2 id={headingId} className="type-section-heading">
        {title}
      </h2>
      {intro && <p className="mt-1 text-sm text-role-secondary">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default StaffSection;
