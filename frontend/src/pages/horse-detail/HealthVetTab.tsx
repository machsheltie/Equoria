/**
 * HealthVetTab — current health status + (currently empty) vet
 * history + CTA to the vet clinic. Story 12-4.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Horse } from './HorseDetailPageTypes';

interface VetRecord {
  date: string;
  type: string;
  result: string;
  vet: string;
}

const vetHistory: VetRecord[] = [];

const HealthVetTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const healthColor =
    horse.healthStatus?.toLowerCase() === 'healthy'
      ? 'text-[var(--status-success)]'
      : horse.healthStatus?.toLowerCase().includes('injured')
        ? 'text-burnished-gold'
        : 'text-[var(--text-secondary)]';

  return (
    <div className="space-y-6" data-testid="health-vet-tab">
      {/* Current Status */}
      <div>
        <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-3">
          Current Health Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[var(--bg-midnight)] rounded-lg border border-[var(--glass-border)]">
            <p className="fantasy-caption text-[var(--text-secondary)] mb-1 text-xs uppercase tracking-wider">
              Status
            </p>
            <p className={`fantasy-title text-xl ${healthColor}`}>{horse.healthStatus}</p>
          </div>
          <div className="p-4 bg-[var(--bg-midnight)] rounded-lg border border-[var(--glass-border)]">
            <p className="fantasy-caption text-[var(--text-secondary)] mb-1 text-xs uppercase tracking-wider">
              Next Recommended Check
            </p>
            <p className="fantasy-body text-[var(--text-primary)]">6 weeks from last visit</p>
          </div>
        </div>
      </div>

      {/* Vet History */}
      <div>
        <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-3">
          Veterinary History
        </h3>
        {vetHistory.length === 0 ? (
          <div className="text-center py-8 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)]">
            <Stethoscope className="w-8 h-8 text-[var(--text-secondary)]/40 mx-auto mb-2" />
            <p className="fantasy-body text-[var(--text-secondary)]">No vet records on file.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vetHistory.map((record, idx) => (
              <div
                key={idx}
                className="p-4 bg-[var(--bg-midnight)] rounded-lg border border-[var(--glass-border)] hover:border-burnished-gold/40 transition-colors"
                data-testid={`vet-record-${idx}`}
              >
                <div className="flex items-start justify-between mb-1">
                  <p className="fantasy-title text-[var(--text-primary)] text-sm">{record.type}</p>
                  <span className="text-xs fantasy-caption text-[var(--text-secondary)] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(record.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="fantasy-body text-[var(--text-primary)] text-sm mb-1">
                  {record.result}
                </p>
                <p className="fantasy-caption text-[var(--text-secondary)] text-xs">
                  Vet: {record.vet}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Book Appointment CTA */}
      <div className="p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)] flex items-center justify-between">
        <div>
          <p className="fantasy-title text-[var(--text-primary)] text-sm">
            Need a Vet Appointment?
          </p>
          <p className="fantasy-body text-[var(--text-secondary)] text-sm">
            Visit the Vet Clinic to book a health check or treatment.
          </p>
        </div>
        <Button asChild>
          <Link to="/vet">Go to Vet Clinic</Link>
        </Button>
      </div>
    </div>
  );
};

export default HealthVetTab;
