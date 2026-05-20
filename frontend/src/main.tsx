import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// One-time cleanup: remove orphaned urt-seen-<id> keys left by pre-L7 implementation.
// Safe: wrapped, idempotent, runs before React renders (Equoria-o7c0x C).
import { purgeOrphanedUrtSeenKeys } from './lib/traitEventSeen';
purgeOrphanedUrtSeenKeys();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
