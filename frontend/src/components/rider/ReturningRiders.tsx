/**
 * ReturningRiders — riders back for hire, on the Rider Hall's Hire tab (Equoria-266h7).
 *
 * Owner rulings 2026-10-28: released and unpaid riders return to a hiring pool (q153)
 * at their current level with their reveals intact (q177); one click hires, the
 * weekly price on the button (q230). Reads GET /api/v1/riders/free-agents and hires
 * through POST /api/v1/riders/free-agents/hire.
 */

import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHireRiderFromPool, useRiderPool } from '@/hooks/api/useStaffPool';
import ReturningStaffCard from '@/components/common/ReturningStaffCard';
import RiderPersonalityBadge from './RiderPersonalityBadge';
import EmptyState from '@/components/ui/EmptyState';
import { SectionLoading, ErrorState } from '@/components/ui/state';
import { userMessageFor } from '@/lib/http/userMessage';
import { actionMessageFor, hireRefusalCodes, hireRefused } from '@/lib/http/actionMessage';
import type { PoolRider } from '@/lib/api/staffPoolTypes';
import '@/styles/returningStaff.css';

const poolHireRefused = {
  ...hireRefused,
  404: 'That rider has already left the hiring list.',
  409: 'Another stable hired that rider a moment ago.',
};

const ReturningRiders: React.FC = () => {
  const { user } = useAuth();
  const pool = useRiderPool();
  const hire = useHireRiderFromPool();
  // The rider the last Hire click was for: its card shows "Hiring..." and any refusal.
  const [hiringId, setHiringId] = useState<number | null>(null);
  const [joined, setJoined] = useState<string | null>(null);

  const handleHire = (rider: PoolRider) => {
    hire.reset();
    setJoined(null);
    setHiringId(rider.id);
    hire.mutate(rider.id, {
      onSuccess: () => {
        setHiringId(null);
        setJoined(rider.name);
      },
    });
  };

  let body: React.ReactNode;
  if (pool.isPending) {
    body = <SectionLoading label="Loading riders back for hire" minHeight="160px" />;
  } else if (pool.isError) {
    body = (
      <ErrorState
        title="The hiring list didn't load"
        message={userMessageFor(pool.error).message}
        retry={{ label: 'Try Again', onClick: () => void pool.refetch() }}
      />
    );
  } else if (pool.data.riders.length === 0) {
    body = (
      <EmptyState
        variant="no-results"
        icon={<Users size={32} aria-hidden="true" />}
        title="No riders are back for hire"
        description="When a stable lets a rider go, the rider comes back here."
      />
    );
  } else {
    const { riders, total } = pool.data;
    body = (
      <>
        <ul className="returning-staff__list" data-testid="returning-riders-list">
          {riders.map((rider) => (
            <ReturningStaffCard
              key={rider.id}
              testId={`returning-rider-${rider.id}`}
              name={rider.name}
              starLevel={rider.starLevel}
              personality={<RiderPersonalityBadge personality={rider.personality} size="sm" />}
              detail={rider.specialityLabel}
              growth={rider.growth}
              bio={rider.bio}
              weeklyPrice={rider.weeklyRate}
              affordable={(user?.money ?? 0) >= rider.weeklyRate}
              hiring={hire.isPending && hiringId === rider.id}
              disabled={hire.isPending}
              onHire={() => handleHire(rider)}
              errorMessage={
                hire.isError && hiringId === rider.id
                  ? actionMessageFor(hire.error, poolHireRefused, hireRefusalCodes('rider'))
                  : null
              }
            />
          ))}
        </ul>
        {total > riders.length && (
          <p className="returning-staff__more">
            Showing the {riders.length} riders who came back most recently, of {total}.
          </p>
        )}
      </>
    );
  }

  return (
    <section
      className="returning-staff"
      aria-labelledby="returning-riders-heading"
      data-testid="returning-riders"
    >
      <header>
        <h2 id="returning-riders-heading" className="type-section-heading">
          Riders Back for Hire
        </h2>
        <p className="returning-staff__intro">
          Riders other stables let go, at the level they reached and with everything they have shown
          so far.
        </p>
      </header>
      <p role="status" className="returning-staff__intro">
        {joined ? `${joined} has joined your riders.` : ''}
      </p>
      {body}
    </section>
  );
};

export default ReturningRiders;
