/**
 * Clubs constants + helpers (extracted from ClubsPage — Equoria-m0ye2 / ClubsPage split)
 *
 * Tab config, discipline/breed emoji-icon maps, and the clubIcon() resolver.
 * Extracted verbatim so the page composition and its sub-components share
 * one source of truth. Uses JSX (tab icons) so this is a .tsx file.
 */

import React from 'react';
import { Shield, Star, Crown } from 'lucide-react';
import type { Club } from '@/lib/api-client';

export type ClubsTab = 'discipline' | 'breed' | 'my-club';

export const tabsConfig: { id: ClubsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'discipline', label: 'Discipline Clubs', icon: <Shield className="w-4 h-4" /> },
  { id: 'breed', label: 'Breed Clubs', icon: <Star className="w-4 h-4" /> },
  { id: 'my-club', label: 'My Club', icon: <Crown className="w-4 h-4" /> },
];

export const DISCIPLINE_ICONS: Record<string, string> = {
  Dressage: '🎭',
  'Show Jumping': '🚧',
  'Cross Country': '🌲',
  Western: '🤠',
  Endurance: '⚡',
};

export const BREED_ICONS: Record<string, string> = {
  Thoroughbred: '🏇',
  Arabian: '🌙',
  Warmblood: '🔵',
  Andalusian: '🌹',
  'Quarter Horse': '⭐',
  Friesian: '🖤',
  Mustang: '🌿',
  Paint: '🎨',
};

export function clubIcon(club: Club): string {
  if (club.type === 'discipline') return DISCIPLINE_ICONS[club.category] ?? '🏇';
  return BREED_ICONS[club.category] ?? '🐴';
}
