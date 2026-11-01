/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "username:password" of the public demo account; set only for the demo build. */
  readonly VITE_DEMO_LOGIN?: string;
  /** Comma-separated feature keys shown as "Sắp có" (see shared/config/demoFlags.ts). */
  readonly VITE_COMING_SOON?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
