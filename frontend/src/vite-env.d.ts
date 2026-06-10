/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /**
   * Local-dev opt-in to skip the login flow during UI review (Equoria-c3n0u).
   * Only honored when `import.meta.env.DEV === true`; statically false in
   * production builds so the auth bypass is tree-shaken out. See
   * `src/contexts/AuthContext.tsx`.
   */
  readonly VITE_DEV_BYPASS_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
