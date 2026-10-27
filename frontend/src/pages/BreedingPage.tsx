/**
 * BreedingPage — the old Breeding Hall URL.
 *
 * Owner ruling q89 (2026-10-26): there is no Breeding Hall. Breeding happens
 * on a stallion's page ("Breed to <name>", then a mare), and stallions at stud
 * are found in the Marketplace search. The old /breeding link (and
 * /breeding?horseId=…) lands in the player's stable.
 */

import { Navigate } from 'react-router';

const BreedingPage = () => <Navigate to="/stable" replace />;

export default BreedingPage;
