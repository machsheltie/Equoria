/**
 * NotFoundPage — what the client shows at an address that is not a page.
 *
 * Owner ruling 2026-10-23 (Equoria-bvddn.35): a bad link shows an in-world
 * not-found page with a way home (it used to render nothing). App.tsx mounts
 * this as the catch-all route, and the Steward's Office gate renders the very
 * same element for anyone who is not staff (STAFF-CR-17), so /steward and any
 * random address stay indistinguishable — the ruling keeps that: both show this
 * page. Nothing on it may hint at the office, an error or a retry: nothing
 * failed, the address is simply not a page.
 *
 * Built from the existing ErrorCard (its outline Go Home action is the one way
 * out). Navigation goes through the router, so the trip home is one step with no
 * full reload.
 *
 * Eagerly imported on purpose: a lazy import would flash the Suspense loader
 * on one path and not the other.
 */

import { useNavigate } from 'react-router';
import { ErrorCard } from '@/components/ui/ErrorCard';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4" data-testid="not-found-page">
      <ErrorCard
        title="This trail leads nowhere"
        message="There is no page at this address — an old signpost, perhaps, or a path mistyped in the dark. Your horses are waiting back home."
        onGoHome={() => navigate('/')}
        goHomeLabel="Back to the stable yard"
      />
    </div>
  );
}
