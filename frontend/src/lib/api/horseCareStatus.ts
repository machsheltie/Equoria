/**
 * Horse care status (GET /api/v1/horses/:id/overview), the server's verdicts for
 * the horse page's Current Status lines (Equoria-0l0tq): when the horse was last
 * shod, trained and groomed, and whether it can be trained or groomed now. The
 * verdicts come from the rules the train and groom actions apply; the page never
 * recomputes them. A verdict is null when the server could not read it.
 */

import { apiClient } from '@/lib/api-client';

export interface HorseCareStatus {
  lastShod: string | null;
  lastTrainedAt: string | null;
  lastGroomed: string | null;
  canTrainNow: boolean | null;
  canGroomToday: boolean | null;
}

export async function fetchHorseCareStatus(horseId: number): Promise<HorseCareStatus> {
  const overview = await apiClient.get<Partial<HorseCareStatus>>(
    `/api/v1/horses/${horseId}/overview`
  );
  return {
    lastShod: overview.lastShod ?? null,
    lastTrainedAt: overview.lastTrainedAt ?? null,
    lastGroomed: overview.lastGroomed ?? null,
    canTrainNow: overview.canTrainNow ?? null,
    canGroomToday: overview.canGroomToday ?? null,
  };
}
