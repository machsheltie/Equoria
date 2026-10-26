/**
 * FoalLinkRedirect: an old /foals/:id link lands on the horse's own page.
 *
 * One horse page for life (owner rulings 2026-10-16 and q71, 2026-10-26;
 * Equoria-jaeot): a foal is a horse, the separate foal page is gone, and only
 * what the player can do changes with age.
 */

import { Navigate, useParams } from 'react-router';

const FoalLinkRedirect = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/horses/${id ?? ''}`} replace />;
};

export default FoalLinkRedirect;
