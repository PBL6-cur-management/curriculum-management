// A Draft has no version number yet. Shared because the programs, curriculum and courses screens all print it.
export const DRAFT_VERSION_LABEL = 'Nháp';
// The four states of a program version (PB-01), as every screen prints them.
export const VERSION_STATUS_LABELS = {
  DRAFT: 'Nháp',
  PENDING: 'Chờ hiệu lực',
  ACTIVE: 'Mới nhất',
  HISTORICAL: 'Lịch sử',
} as const;
export const VERSION_STATUS_COLORS = {
  DRAFT: 'default',
  PENDING: 'gold',
  ACTIVE: 'green',
  HISTORICAL: 'blue',
} as const;
export const versionLabel = (version: { versionNumber: string | null }) =>
  version.versionNumber ?? DRAFT_VERSION_LABEL;
export const versionWithDecision = (version: {
  versionNumber: string | null;
  decisionNumber?: string | null;
}) => {
  const base = versionLabel(version);
  return version.decisionNumber ? `${base} (${version.decisionNumber})` : base;
};
