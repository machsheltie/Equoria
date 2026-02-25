import React from 'react';
import { Clock, Zap, Shield, Heart, Star, Trophy, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface CareStatus {
  lastShod?: Date | string | null;
  lastFed?: Date | string | null;
  lastTrained?: Date | string | null;
  lastFoaled?: Date | string | null;
}

interface HorseCardProps {
  horseName: string;
  horseImage?: string;
  age: number;
  discipline: string;
  sex?: 'mare' | 'stallion' | 'gelding' | 'colt' | 'filly';
  isLegendary?: boolean;
  cooldownHours?: number;
  stats?: {
    speed: number;
    stamina: number;
    agility: number;
    strength: number;
    intelligence: number;
    health: number;
  };
  careStatus?: CareStatus;
  onClick?: () => void;
  className?: string;
}

const formatCareDate = (date: Date | string | null | undefined): string => {
  if (!date) return 'Never';
  const d = typeof date === 'string' ? new Date(date) : date;
  const daysAgo = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return '1d ago';
  return `${daysAgo}d ago`;
};

/**
 * Returns a CSS custom property color based on how long ago care was given.
 * @param date      - last care date (null/undefined = never cared for → error)
 * @param warnDays  - days until warning threshold
 * @param errorDays - days until error/overdue threshold
 */
const getCareUrgencyColor = (
  date: Date | string | null | undefined,
  warnDays: number,
  errorDays: number
): string => {
  if (!date) return 'var(--status-error)';
  const d = typeof date === 'string' ? new Date(date) : date;
  const daysAgo = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo >= errorDays) return 'var(--status-error)';
  if (daysAgo >= warnDays) return 'var(--status-warning)';
  return 'var(--status-success)';
};

const HorseCard = ({
  horseName,
  horseImage = '/placeholder.svg',
  age,
  discipline,
  sex,
  isLegendary = false,
  cooldownHours = 0,
  stats = {
    speed: 85,
    stamina: 92,
    agility: 78,
    strength: 88,
    intelligence: 76,
    health: 95,
  },
  careStatus,
  onClick,
  className,
}: HorseCardProps) => {
  const getStatIcon = (statName: string) => {
    switch (statName) {
      case 'speed':
        return <Zap className="w-3 h-3" />;
      case 'stamina':
        return <Heart className="w-3 h-3" />;
      case 'agility':
        return <Star className="w-3 h-3" />;
      case 'strength':
        return <Shield className="w-3 h-3" />;
      case 'intelligence':
        return <Trophy className="w-3 h-3" />;
      case 'health':
        return <Heart className="w-3 h-3" />;
      default:
        return <Star className="w-3 h-3" />;
    }
  };

  const getStatColor = (value: number) => {
    if (value >= 90) return 'text-celestial-gold';
    if (value >= 75) return 'text-emerald-400';
    if (value >= 60) return 'text-blue-400';
    return 'text-white/60';
  };

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-300 hover:shadow-lg cursor-pointer border-white/10 bg-black/40 backdrop-blur-md',
        isLegendary
          ? 'border-celestial-gold/50 shadow-[0_0_15px_rgba(255,215,0,0.15)]'
          : 'hover:border-white/20',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-0">
        {/* Image Section */}
        <div className="relative h-48 w-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
          <img
            src={horseImage}
            alt={horseName}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />

          {/* Legend Badge */}
          {isLegendary && (
            <div className="absolute top-2 right-2 z-20">
              <Badge
                variant="secondary"
                className="bg-celestial-gold/20 text-celestial-gold border-celestial-gold/50 backdrop-blur-md"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Legendary
              </Badge>
            </div>
          )}

          {/* Cooldown */}
          {cooldownHours > 0 && (
            <div className="absolute top-2 left-2 z-20">
              <Badge
                variant="secondary"
                className="bg-black/60 text-white border-white/10 backdrop-blur-md"
              >
                <Clock className="w-3 h-3 mr-1" />
                {cooldownHours}h
              </Badge>
            </div>
          )}

          {/* Name & Basic Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
            <h3 className="text-lg font-bold text-white mb-1 leading-none tracking-tight">
              {horseName}
            </h3>
            <div className="flex items-center space-x-2 text-xs text-white/80">
              <span className="bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm">
                {discipline}
              </span>
              <span>•</span>
              <span>{age} years</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-white/5">
          {Object.entries(stats)
            .slice(0, 3)
            .map(([statName, value]) => (
              <div key={statName} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/60">
                  <span className="flex items-center gap-1">
                    {getStatIcon(statName)}
                    {statName.slice(0, 3)}
                  </span>
                  <span className={getStatColor(value)}>{value}</span>
                </div>
                <Progress
                  value={value}
                  className="h-1 bg-white/10"
                  indicatorClassName={cn(
                    value >= 90
                      ? 'bg-celestial-gold'
                      : value >= 75
                        ? 'bg-emerald-500'
                        : 'bg-blue-500'
                  )}
                />
              </div>
            ))}
        </div>

        {/* Care Status Strip — urgency colors via --status-* tokens */}
        {careStatus && (
          <div
            className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 py-2 border-t border-white/5 bg-black/20"
            data-testid="care-status-strip"
          >
            {/* Shod: warn at 7d, error at 14d */}
            <div
              className="flex items-center justify-between text-[10px]"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>🔨 Shod</span>
              <span
                style={{ color: getCareUrgencyColor(careStatus.lastShod, 7, 14) }}
                data-testid="care-shod-date"
              >
                {formatCareDate(careStatus.lastShod)}
              </span>
            </div>
            {/* Fed: warn at 1d, error at 3d */}
            <div
              className="flex items-center justify-between text-[10px]"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>🌾 Fed</span>
              <span
                style={{ color: getCareUrgencyColor(careStatus.lastFed, 1, 3) }}
                data-testid="care-fed-date"
              >
                {formatCareDate(careStatus.lastFed)}
              </span>
            </div>
            {/* Trained: warn at 7d, error at 14d */}
            <div
              className="flex items-center justify-between text-[10px]"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>🏋️ Trained</span>
              <span
                style={{ color: getCareUrgencyColor(careStatus.lastTrained, 7, 14) }}
                data-testid="care-trained-date"
              >
                {formatCareDate(careStatus.lastTrained)}
              </span>
            </div>
            {/* Foaled: mare-only, informational — no urgency threshold */}
            {sex === 'mare' && (
              <div
                className="flex items-center justify-between text-[10px]"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>🐣 Foaled</span>
                <span style={{ color: 'var(--text-secondary)' }} data-testid="care-foaled-date">
                  {formatCareDate(careStatus.lastFoaled)}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HorseCard;
