// Versions seeded from the school's legacy system were never given a decision number; the Khoa adds the real one later.
export const NO_DECISION_LABEL = 'Chưa có số quyết định';

export const formatDecisionNumber = (value: string | null | undefined) =>
  value?.trim() ? value : NO_DECISION_LABEL;
