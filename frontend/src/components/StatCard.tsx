import React, { useState } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tooltip?: string;
}

const StatCard = ({ label, value, icon, tooltip }: StatCardProps) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative p-4 glass-panel hover:magical-glow transition-all duration-300 cursor-pointer group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => setShowTooltip(!showTooltip)}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="fantasy-caption text-[rgb(220,235,255)] opacity-80 mb-1">{label}</p>
          <p className="fantasy-header text-2xl font-bold text-[rgb(220,235,255)]">{value}</p>
        </div>
        {icon && (
          <div className="text-burnished-gold opacity-80 group-hover:opacity-100 transition-opacity">
            {icon}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && tooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-[var(--z-raised)]">
          <div className="bg-[rgba(5,15,40,0.95)] text-[rgb(220,235,255)] px-3 py-2 rounded-lg text-sm fantasy-body shadow-lg border border-[rgba(37,99,235,0.3)]">
            {tooltip}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="border-4 border-transparent border-t-[rgba(5,15,40,0.95)]" />
            </div>
          </div>
        </div>
      )}

      {/* Corner decorations */}
      <div className="absolute top-1 left-1 w-3 h-3 border-l border-t border-burnished-gold opacity-40" />
      <div className="absolute bottom-1 right-1 w-3 h-3 border-r border-b border-burnished-gold opacity-40" />
    </div>
  );
};

export default StatCard;
