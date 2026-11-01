// Build-time switches for the public demo (deploy/demo.env → frontend Dockerfile build args).
// Dev and real deployments leave them unset, so the app behaves as before.

export const COMING_SOON_FEATURES = [
  'school-sync',
  'integration-clients',
  'email-reminders',
  'backups',
] as const;

export type ComingSoonFeature = (typeof COMING_SOON_FEATURES)[number];

export interface DemoLogin {
  username: string;
  password: string;
}

export function parseDemoLogin(raw: string | undefined): DemoLogin | null {
  const separator = raw?.indexOf(':') ?? -1;
  if (!raw || separator <= 0 || separator === raw.length - 1) return null;
  return {
    username: raw.slice(0, separator),
    password: raw.slice(separator + 1),
  };
}

export function parseComingSoon(
  raw: string | undefined,
): ReadonlySet<ComingSoonFeature> {
  const known = new Set<string>(COMING_SOON_FEATURES);
  return new Set(
    (raw ?? '')
      .split(',')
      .map((key) => key.trim())
      .filter((key): key is ComingSoonFeature => known.has(key)),
  );
}

export function demoLogin(): DemoLogin | null {
  return parseDemoLogin(import.meta.env.VITE_DEMO_LOGIN);
}

export function isComingSoon(feature: ComingSoonFeature): boolean {
  return parseComingSoon(import.meta.env.VITE_COMING_SOON).has(feature);
}
