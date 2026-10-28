/**
 * ReturningGrooms — grooms back for hire, on Groom Quarters' Hire tab (Equoria-266h7).
 *
 * Owner rulings 2026-10-28: released and unpaid grooms return to the hiring pool (q153),
 * where new grooms are also generated, at their current level with their reveals intact (q177); one click hires, the
 * weekly price on the button (q230). Reads GET /api/v1/groom-marketplace/free-agents
 * and hires through POST /api/v1/groom-marketplace/free-agents/hire.
 */

import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGroomPool, useHireGroomFromPool } from '@/hooks/api/useStaffPool';
import ReturningStaffCard from '@/components/common/ReturningStaffCard';
import GroomPersonalityBadge from './GroomPersonalityBadge';
import { groomSpecialtyTitle } from '@/lib/staffLabels';
import EmptyState from '@/components/ui/EmptyState';
import { SectionLoading, ErrorState } from '@/components/ui/state';
import { userMessageFor } from '@/lib/http/userMessage';
import { actionMessageFor, hireRefusalCodes, hireRefused } from '@/lib/http/actionMessage';
import type { PoolGroom } from '@/lib/api/staffPoolTypes';
import '@/styles/returningStaff.css';

const poolHireRefused = {
  ...hireRefused,
  404: 'That groom has already left the hiring list.',
  409: 'Another stable hired that groom a moment ago.',
};

const ReturningGrooms: React.FC = () => {
  const { user } = useAuth();
  const pool = useGroomPool();
  const hire = useHireGroomFromPool();
  // The groom the last Hire click was for: its card shows "Hiring..." and any refusal.
  const [hiringId, setHiringId] = useState<number | null>(null);
  const [joined, setJoined] = useState<string | null>(null);

  const handleHire = (groom: PoolGroom) => {
    hire.reset();
    setJoined(null);
    setHiringId(groom.id);
    hire.mutate(groom.id, {
      onSuccess: () => {
        setHiringId(null);
        setJoined(groom.name);
      },
    });
  };

  let body: React.ReactNode;
  if (pool.isPending) {
    body = <SectionLoading label="Loading grooms back for hire" minHeight="160px" />;
  } else if (pool.isError) {
    body = (
      <ErrorState
        title="The hiring list didn't load"
        message={userMessageFor(pool.error).message}
        retry={{ label: 'Try Again', onClick: () => void pool.refetch() }}
      />
    );
  } else if (pool.data.grooms.length === 0) {
    body = (
      <EmptyState
        variant="no-results"
        icon={<Users size={32} aria-hidden="true" />}
        title="No grooms are back for hire"
        description="When a stable lets a groom go or stops paying one, the groom comes back here."
      />
    );
  } else {
    const { grooms, total } = pool.data;
    body = (
      <>
        <ul className="returning-staff__list" data-testid="returning-grooms-list">
          {grooms.map((groom) => (
            <ReturningStaffCard
              key={groom.id}
              testId={`returning-groom-${groom.id}`}
              name={groom.name}
              starLevel={groom.starLevel}
              personality={<GroomPersonalityBadge personality={groom.personality} />}
              detail={groomSpecialtyTitle(groom.speciality)}
              growth={groom.growth}
              bio={groom.bio}
              weeklyPrice={groom.weeklyFee}
              affordable={(user?.money ?? 0) >= groom.weeklyFee}
              hiring={hire.isPending && hiringId === groom.id}
              disabled={hire.isPending}
              onHire={() => handleHire(groom)}
              errorMessage={
                hire.isError && hiringId === groom.id
                  ? actionMessageFor(hire.error, poolHireRefused, hireRefusalCodes('groom'))
                  : null
              }
            />
          ))}
        </ul>
        {total > grooms.length && (
          <p className="returning-staff__more">
            Showing {grooms.length} of the {total} grooms back for hire.
          </p>
        )}
      </>
    );
  }

  return (
    <section
      className="returning-staff"
      aria-labelledby="returning-grooms-heading"
      data-testid="returning-grooms"
    >
      <header>
        <h2 id="returning-grooms-heading" className="type-section-heading">
          Grooms Back for Hire
        </h2>
        <p className="returning-staff__intro">
          Grooms other stables let go, at the level they reached and with everything they have shown
          so far.
        </p>
      </header>
      <p role="status" className="returning-staff__intro">
        {joined ? `${joined} has joined your grooms.` : ''}
      </p>
      {body}
    </section>
  );
};

export default ReturningGrooms;
