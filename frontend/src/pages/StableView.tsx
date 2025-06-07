
import React, { useState } from 'react';
import { Coins, Star, Users, Plus, Settings } from 'lucide-react';
import HorseCard from '../components/HorseCard';
import { FantasyTabs } from '../components/FantasyTabs';

const StableView = () => {
  const [activeTab, setActiveTab] = useState('all');

  // Mock player data
  const playerStats = {
    coins: 2847,
    xp: 15392,
    level: 18,
    stableSlots: { used: 12, total: 25 }
  };

  // Mock horse data
  const horses = [
    {
      id: '1',
      name: 'Stormwind',
      age: 5,
      discipline: 'Jumping',
      category: 'stallion',
      isLegendary: true,
      cooldownHours: 0,
      stats: { speed: 95, stamina: 88, agility: 92, strength: 85, intelligence: 78, health: 96 }
    },
    {
      id: '2', 
      name: 'Moonbeam',
      age: 3,
      discipline: 'Dressage',
      category: 'mare',
      isLegendary: false,
      cooldownHours: 6,
      stats: { speed: 78, stamina: 92, agility: 95, strength: 72, intelligence: 88, health: 85 }
    },
    {
      id: '3',
      name: 'Shadowfire',
      age: 1,
      discipline: 'Racing',
      category: 'foal',
      isLegendary: true,
      cooldownHours: 0,
      stats: { speed: 88, stamina: 75, agility: 82, strength: 79, intelligence: 85, health: 90 }
    },
    {
      id: '4',
      name: 'Golden Dawn',
      age: 8,
      discipline: 'Trail',
      category: 'mare',
      isLegendary: false,
      cooldownHours: 2,
      stats: { speed: 82, stamina: 95, agility: 78, strength: 88, intelligence: 92, health: 88 }
    }
  ];

  const tabs = [
    { value: 'foals', label: 'Foals', icon: <Star className="w-4 h-4" /> },
    { value: 'mares', label: 'Mares', icon: <Users className="w-4 h-4" /> },
    { value: 'stallions', label: 'Stallions', icon: <Users className="w-4 h-4" /> },
    { value: 'retired', label: 'Retired', icon: <Settings className="w-4 h-4" /> },
    { value: 'all', label: 'All', icon: <Star className="w-4 h-4" /> }
  ];

  const filteredHorses = activeTab === 'all' 
    ? horses 
    : horses.filter(horse => horse.category === activeTab || (activeTab === 'stallions' && horse.category === 'stallion'));

  const getTabContent = () => (
    <div className="grid grid-cols-2 gap-4 p-4">
      {filteredHorses.map((horse) => (
        <HorseCard
          key={horse.id}
          horseName={horse.name}
          age={horse.age}
          discipline={horse.discipline}
          isLegendary={horse.isLegendary}
          cooldownHours={horse.cooldownHours}
          stats={horse.stats}
          onClick={() => console.log(`Viewing ${horse.name}`)}
        />
      ))}
    </div>
  );

  const tabsWithContent = tabs.map(tab => ({
    ...tab,
    content: getTabContent()
  }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-forest-green/20 to-parchment relative overflow-hidden">
      {/* Background overlay with stable atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-br from-forest-green/10 via-parchment/80 to-aged-bronze/20 pointer-events-none" />
      
      {/* Floating particles effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-burnished-gold/30 rounded-full animate-pulse" />
        <div className="absolute top-3/4 right-1/4 w-1.5 h-1.5 bg-burnished-gold/20 rounded-full animate-pulse animation-delay-200" />
        <div className="absolute bottom-1/3 left-1/4 w-0.5 h-0.5 bg-aged-bronze/40 rounded-full animate-pulse animation-delay-400" />
      </div>

      {/* Player Info Bar */}
      <div className="sticky top-0 z-20 bg-parchment/95 border-b-2 border-aged-bronze shadow-lg backdrop-blur-sm">
        <div className="absolute inset-0 parchment-texture opacity-30" />
        <div className="relative p-4">
          <div className="flex items-center justify-between">
            {/* Gold coins */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-burnished-gold to-aged-bronze rounded-full flex items-center justify-center">
                <Coins className="w-5 h-5 text-parchment" />
              </div>
              <span className="fantasy-title text-lg text-midnight-ink">
                {playerStats.coins.toLocaleString()}
              </span>
            </div>

            {/* XP and Level */}
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <div className="fantasy-caption text-xs text-aged-bronze mb-1">XP</div>
                <div className="w-24 h-2 bg-aged-bronze/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-burnished-gold to-aged-bronze magical-glow"
                    style={{ width: '65%' }}
                  />
                </div>
                <div className="fantasy-body text-xs text-midnight-ink mt-1">
                  {playerStats.xp.toLocaleString()}
                </div>
              </div>
              
              <div className="text-center">
                <div className="fantasy-caption text-xs text-aged-bronze">Level</div>
                <div className="fantasy-title text-xl text-burnished-gold">
                  {playerStats.level}
                </div>
              </div>
            </div>

            {/* Stable capacity */}
            <div className="text-center">
              <div className="fantasy-caption text-xs text-aged-bronze mb-1">Stable</div>
              <div className="fantasy-body text-sm text-midnight-ink">
                {playerStats.stableSlots.used}/{playerStats.stableSlots.total}
              </div>
              <div className="w-16 h-1 bg-aged-bronze/30 rounded-full overflow-hidden mt-1">
                <div 
                  className="h-full bg-forest-green"
                  style={{ width: `${(playerStats.stableSlots.used / playerStats.stableSlots.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Decorative border */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-aged-bronze via-burnished-gold to-aged-bronze" />
      </div>

      {/* Main content */}
      <div className="relative z-10 pb-20">
        <FantasyTabs 
          tabs={tabsWithContent}
          defaultValue="all"
          orientation="horizontal"
        />
      </div>

      {/* Action buttons */}
      <div className="fixed bottom-6 right-6 space-y-3 z-30">
        {/* Add Horse button */}
        <button className="group relative bg-gradient-to-br from-burnished-gold to-aged-bronze rounded-full p-4 shadow-lg hover:scale-110 transition-all duration-200 magical-glow">
          <div className="absolute inset-1 bg-gradient-to-br from-burnished-gold/30 to-transparent rounded-full" />
          <Plus className="w-6 h-6 text-parchment relative z-10" />
          
          {/* Wax seal effect */}
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-aged-bronze to-saddle-leather rounded-full border border-burnished-gold opacity-80 group-hover:animate-pulse" />
        </button>

        {/* Organize button */}
        <button className="group relative bg-gradient-to-br from-aged-bronze to-saddle-leather rounded-full p-3 shadow-lg hover:scale-110 transition-all duration-200">
          <div className="absolute inset-1 bg-gradient-to-br from-aged-bronze/30 to-transparent rounded-full" />
          <Settings className="w-5 h-5 text-parchment relative z-10" />
        </button>
      </div>

      {/* Decorative corner flourishes */}
      <div className="absolute top-20 left-2 w-8 h-8 border-l-2 border-t-2 border-burnished-gold/40 rounded-tl-lg pointer-events-none" />
      <div className="absolute top-20 right-2 w-8 h-8 border-r-2 border-t-2 border-burnished-gold/40 rounded-tr-lg pointer-events-none" />
    </div>
  );
};

export default StableView;