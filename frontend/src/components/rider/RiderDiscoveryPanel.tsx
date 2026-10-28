/**
 * RiderDiscoveryPanel — a hired rider's discoveries (Equoria-xlw03).
 *
 * Loads GET /api/v1/riders/:id/discovery: the rider's level, personality and only the
 * hidden items its level has revealed (owner rulings 2026-10-28, q160). Rendering is
 * shared with grooms (StaffDiscoveryPanel). Before this the panel always showed an empty
 * placeholder profile and a "competitions to the next reveal" hint (audit STAFF-08).
 */

import React from 'react';
import { useRiderDiscovery } from '@/hooks/api/useRiders';
import { SectionLoading, InlineError } from '@/components/ui/state';
import { userMessageFor } from '@/lib/http/userMessage';
import StaffDiscoveryPanel from '@/components/common/StaffDiscoveryPanel';

interface RiderDiscoveryPanelProps {
  riderId: number;
}

const RiderDiscoveryPanel: React.FC<RiderDiscoveryPanelProps> = ({ riderId }) => {
  const discovery = useRiderDiscovery(riderId);
  if (discovery.isLoading) {
    return <SectionLoading label="Loading discoveries" />;
  }
  if (discovery.error || !discovery.data) {
    return <InlineError message={userMessageFor(discovery.error).message} />;
  }
  return <StaffDiscoveryPanel growth={discovery.data} staffKind="rider" />;
};

export default RiderDiscoveryPanel;
