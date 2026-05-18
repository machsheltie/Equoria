/**
 * ConformationShowsPage (Equoria-e0cn → unified in Equoria-8g4n / 31F-FE-3)
 *
 * The conformation-show entry surface is now a tab inside
 * CompetitionBrowserPage so testers reach ridden and conformation shows from
 * one place. This page survives only as a thin redirect so the existing
 * /conformation-shows URL (bookmarks, in-app links, external references)
 * keeps working — it forwards to /competitions?tab=conformation, which
 * deep-links straight to the conformation tab.
 *
 * The real UI lives in `components/competition/ConformationShowsPanel.tsx`.
 */

import { Navigate } from 'react-router-dom';

const ConformationShowsPage = (): JSX.Element => (
  <Navigate to="/competitions?tab=conformation" replace />
);

export default ConformationShowsPage;
