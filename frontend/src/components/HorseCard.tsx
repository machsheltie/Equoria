import React, { useState } from 'react';
import { Clock, Zap, Shield, Heart, Star, Trophy } from 'lucide-react';

interface HorseCardProps {
  horseName: string;
  horseImage?: string;
  age: number;
  discipline: string;
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
  onClick?: () => void;
}

const HorseCard = ({ 
  horseName, 
  horseImage = "/placeholder.svg",
  age,
  discipline,
  isLegendary = false,
  cooldownHours = 0,
  stats = {
    speed: 85,
    stamina: 92,
    agility: 78,
    strength: 88,
    intelligence: 76,
    health: 95
  },
  onClick 
}: HorseCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);

  const getStatIcon = (statName: string) => {
    switch (statName) {
      case 'speed': return <Zap className="w-4 h-4" />;
      case 'stamina': return <Heart className="w-4 h-4" />;
      case 'agility': return <Star className="w-4 h-4" />;
      case 'strength': return <Shield className="w-4 h-4" />;
      case 'intelligence': return <Trophy className="w-4 h-4" />;
      case 'health': return <Heart className="w-4 h-4" />;
      default: return <Star className="w-4 h-4" />;
    }
  };

  const getStatColor = (value: number) => {
    if (value >= 90) return 'text-burnished-gold';
    if (value >= 75) return 'text-forest-green';
    if (value >= 60) return 'text-aged-bronze';
    return 'text-mystic-silver';
  };

  return (
    <div 
      className={`relative w-full max-w-sm mx-auto transition-all duration-300 cursor-pointer ${
        isHovered ? 'transform -translate-y-1' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Legendary gem pulse effect */}
      {isLegendary && (
        <div className="absolute -top-2 -right-2 z-20">
          <div className="w-8 h-8 bg-gradient-to-br from-burnished-gold to-aged-bronze rounded-full border-2 border-parchment magical-pulse">
            <div className="absolute inset-1 bg-gradient-to-br from-burnished-gold/60 to-transparent rounded-full" />
            <div className="absolute inset-0 sparkle-trail rounded-full" />
          </div>
        </div>
      )}

      {/* Outer gold border */}
      <div className={`absolute -inset-1 bg-gradient-to-br from-burnished-gold via-aged-bronze to-burnished-gold rounded-lg p-1 ${
        isHovered ? 'magical-glow' : ''
      }`}>
        <div className="absolute inset-0 parchment-texture rounded-lg" />
      </div>

      {/* Main card */}
      <div className="relative bg-parchment parchment-texture rounded-lg p-4 h-48 border border-aged-bronze overflow-hidden">
        {/* Embossed crest */}
        <div className="absolute top-2 left-2 w-8 h-8 bg-gradient-to-br from-aged-bronze to-saddle-leather rounded-full border border-burnished-gold opacity-80">
          <div className="absolute inset-1 bg-gradient-to-br from-burnished-gold/30 to-transparent rounded-full" />
        </div>

        {/* Horse image */}
        <div className="relative mb-3">
          <div className="w-20 h-16 mx-auto rounded border border-aged-bronze overflow-hidden bg-mystic-silver/20">
            <img 
              src={horseImage} 
              alt={horseName}
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Cooldown timer */}
          {cooldownHours > 0 && (
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
              <div className="bg-aged-bronze text-parchment px-2 py-1 rounded-full flex items-center space-x-1 text-xs">
                <Clock className="w-3 h-3" />
                <span>{cooldownHours}h</span>
              </div>
            </div>
          )}
        </div>

        {/* Horse info */}
        <div className="text-center mb-3">
          <h3 className="fantasy-title text-lg text-midnight-ink mb-1 leading-tight" style={{
            textShadow: '1px 1px 2px rgba(214, 166, 74, 0.3)',
            color: '#1F1B16'
          }}>
            {horseName}
          </h3>
          <div className="flex justify-center items-center space-x-2 text-xs">
            <span className="fantasy-body text-aged-bronze">Age {age}</span>
            <div className="w-1 h-1 bg-aged-bronze rounded-full" />
            <span className="fantasy-body text-aged-bronze">{discipline}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-6 gap-2 mt-auto">
          {Object.entries(stats).map(([statName, value]) => (
            <div 
              key={statName}
              className="relative flex flex-col items-center group"
              onMouseEnter={() => setHoveredStat(statName)}
              onMouseLeave={() => setHoveredStat(null)}
            >
              <div className={`transition-all duration-200 ${getStatColor(value)} ${
                hoveredStat === statName ? 'scale-110 magical-glow' : ''
              }`}>
                {getStatIcon(statName)}
              </div>
              <span className="text-xs fantasy-caption text-midnight-ink mt-1">
                {value}
              </span>
              
              {/* Tooltip */}
              {hoveredStat === statName && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-30">
                  <div className="bg-midnight-ink text-parchment px-2 py-1 rounded text-xs fantasy-body shadow-lg whitespace-nowrap">
                    {statName.charAt(0).toUpperCase() + statName.slice(1)}: {value}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                      <div className="border-4 border-transparent border-t-midnight-ink" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Decorative corner flourishes */}
        <div className="absolute top-1 right-1 w-4 h-4 border-r border-t border-burnished-gold opacity-40" />
        <div className="absolute bottom-1 left-1 w-4 h-4 border-l border-b border-burnished-gold opacity-40" />
        <div className="absolute bottom-1 right-1 w-4 h-4 border-r border-b border-burnished-gold opacity-40" />
      </div>
    </div>
  );
};

export default HorseCard;