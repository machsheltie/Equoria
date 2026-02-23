/**
 * TrainerPersonalityBadge — Compact personality type chip (Epic 13 — Story 13-1)
 *
 * Displays a trainer's personality as a small coloured badge with icon + label.
 * Used in TrainerList, MyTrainersDashboard, and horse-profile assigned-trainer display.
 *
 * Mirrors RiderPersonalityBadge.tsx for the Trainer System.
 */

import React from 'react';

// Trainer personality definitions — 5 types
export const TRAINER_PERSONALITIES: Record<
  string,
  { icon: string; label: string; badgeClass: string; description: string }
> = {
  focused: {
    icon: '🎯',
    label: 'Focused',
    badgeClass: 'bg-violet-900/50 text-violet-300',
    description: 'Methodical and precise. Excels with technically demanding disciplines.',
  },
  encouraging: {
    icon: '💪',
    label: 'Encouraging',
    badgeClass: 'bg-emerald-900/50 text-emerald-300',
    description: 'Builds confidence. Best with nervous or young horses.',
  },
  technical: {
    icon: '⚙️',
    label: 'Technical',
    badgeClass: 'bg-sky-900/50 text-sky-300',
    description: 'Data-driven approach. Optimises specific skill progression.',
  },
  competitive: {
    icon: '🏆',
    label: 'Competitive',
    badgeClass: 'bg-amber-900/50 text-amber-300',
    description: 'High-pressure style. Works best with bold, driven horses.',
  },
  patient: {
    icon: '🌿',
    label: 'Patient',
    badgeClass: 'bg-teal-900/50 text-teal-300',
    description: 'Slow and steady. Excellent with difficult or sensitive horses.',
  },
};

export const getTrainerPersonalityInfo = (personality: string) =>
  TRAINER_PERSONALITIES[personality] ?? {
    icon: '❓',
    label: personality,
    badgeClass: 'bg-white/10 text-white/50',
    description: 'Unknown personality type',
  };

interface TrainerPersonalityBadgeProps {
  personality: string;
  size?: 'sm' | 'md';
}

const TrainerPersonalityBadge: React.FC<TrainerPersonalityBadgeProps> = ({
  personality,
  size = 'md',
}) => {
  const info = getTrainerPersonalityInfo(personality);
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-semibold ${sizeClasses} ${info.badgeClass}`}
      title={info.description}
      data-testid="trainer-personality-badge"
    >
      <span>{info.icon}</span>
      <span>{info.label}</span>
    </span>
  );
};

export default TrainerPersonalityBadge;
