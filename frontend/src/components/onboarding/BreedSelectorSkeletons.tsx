/**
 * BreedSelector loading placeholders (Equoria-2fzcy). Split out of BreedSelector.tsx,
 * which is at its file-size ceiling; each placeholder is one announced loading region.
 */

import React from 'react';
import { LoadingRegion } from '@/components/ui/state';

export function GridSkeleton() {
  return (
    <LoadingRegion label="Loading breeds" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[rgba(100,130,165,0.15)] bg-[rgba(10,22,50,0.4)] p-3 animate-pulse"
        >
          <div className="w-full aspect-square rounded-lg bg-[var(--bg-midnight)] mb-2" />
          <div className="h-3 rounded bg-[var(--celestial-navy-700)] w-3/4 mb-2" />
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-1 rounded-full bg-[var(--celestial-navy-700)]" />
            ))}
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
}

export function ListSkeleton() {
  return (
    <LoadingRegion label="Loading breeds" className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-xl border border-[rgba(100,130,165,0.15)] bg-[rgba(10,22,50,0.4)] animate-pulse"
        >
          <div className="w-12 h-12 rounded-lg bg-[var(--bg-midnight)] flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 rounded bg-[var(--celestial-navy-700)] w-1/3" />
            <div className="h-2 rounded bg-[var(--bg-midnight)] w-2/3" />
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
}
