/**
 * Cooldown Countdown Component
 *
 * Displays real-time countdown for training cooldowns
 * Updates every minute
 *
 * Story 4.5: Training Dashboard - Task 5
 */

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export interface CooldownCountdownProps {
  endsAt: string; // ISO timestamp
  className?: string;
}

/**
 * Calculate time remaining and format as "Xd Xh" or "Xh Xm" or "Xm"
 */
function formatTimeRemaining(endsAt: string): string {
  const now = new Date().getTime();
  const end = new Date(endsAt).getTime();
  const diff = end - now;

  if (diff <= 0) {
    return 'Ready now';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else {
    return `${minutes}m remaining`;
  }
}

const CooldownCountdown = ({ endsAt, className = '' }: CooldownCountdownProps) => {
  const [timeRemaining, setTimeRemaining] = useState(() => formatTimeRemaining(endsAt));

  useEffect(() => {
    // Update immediately
    setTimeRemaining(formatTimeRemaining(endsAt));

    // Update every minute
    const interval = setInterval(() => {
      setTimeRemaining(formatTimeRemaining(endsAt));
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [endsAt]);

  return (
    <div
      className={`flex items-center text-sm text-slate-600 ${className}`}
      data-testid="cooldown-countdown"
    >
      <Clock className="h-4 w-4 mr-1" aria-hidden="true" />
      <span>{timeRemaining}</span>
    </div>
  );
};

export default CooldownCountdown;
