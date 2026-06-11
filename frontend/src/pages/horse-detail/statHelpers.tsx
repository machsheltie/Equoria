/**
 * statHelpers — icon + color helpers shared across horse-detail tabs.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx so both the page
 * header (quick-stats summary) and the OverviewTab/DisciplinesTab
 * pull from a single canonical implementation.
 */

import React from 'react';
import {
  Activity,
  CheckCircle,
  Eye,
  Flame,
  Heart,
  Scale,
  Shield,
  Star,
  Target,
  Trophy,
  Wind,
  Zap,
} from 'lucide-react';

/** Tab identifiers exposed by HorseDetailPage. */
export type TabType =
  | 'overview'
  | 'disciplines'
  | 'genetics'
  | 'coat'
  | 'conformation'
  | 'gaits'
  | 'progression'
  | 'training'
  | 'competition'
  | 'pedigree'
  | 'health'
  | 'stud-sale'
  | 'tack';

/** Stat icon mapping for all 12 horse stats. */
export const getStatIcon = (statName: string): React.ReactNode => {
  switch (statName) {
    case 'precision':
      return <Target className="w-5 h-5" />;
    case 'strength':
      return <Shield className="w-5 h-5" />;
    case 'speed':
      return <Zap className="w-5 h-5" />;
    case 'agility':
      return <Star className="w-5 h-5" />;
    case 'endurance':
      return <Heart className="w-5 h-5" />;
    case 'intelligence':
      return <Trophy className="w-5 h-5" />;
    case 'stamina':
      return <Activity className="w-5 h-5" />;
    case 'balance':
      return <Scale className="w-5 h-5" />;
    case 'boldness':
      return <Flame className="w-5 h-5" />;
    case 'flexibility':
      return <Wind className="w-5 h-5" />;
    case 'obedience':
      return <CheckCircle className="w-5 h-5" />;
    case 'focus':
      return <Eye className="w-5 h-5" />;
    default:
      return <Star className="w-5 h-5" />;
  }
};

/** Color coding for stat / discipline values 0..100. */
export const getStatColor = (value: number): string => {
  if (value >= 90) return 'text-burnished-gold';
  if (value >= 75) return 'text-[var(--status-success)]';
  if (value >= 60) return 'text-[var(--text-secondary)]';
  return 'text-[var(--text-secondary)]';
};
