import type { ApprovalStep } from '../api/changeRequests';

export interface LevelGroup {
  approvalLevel: number;
  levelName: string;
  rows: ApprovalStep[];
}

// Levels in order; only levels that have rows (an organisational request has just the last one).
export function groupByLevel(steps: readonly ApprovalStep[]): LevelGroup[] {
  const levels = new Map<number, LevelGroup>();
  for (const step of steps) {
    const held = levels.get(step.approvalLevel);
    if (held) held.rows.push(step);
    else
      levels.set(step.approvalLevel, {
        approvalLevel: step.approvalLevel,
        levelName: step.levelName,
        rows: [step],
      });
  }
  return [...levels.values()].sort((a, b) => a.approvalLevel - b.approvalLevel);
}

export interface MergedStep {
  step: ApprovalStep;
  // Programme or subject-group codes this one decision stands for, in order.
  scopes: string[];
}

const scopeOf = (step: ApprovalStep) =>
  step.forSubjectGroup?.groupCode ?? step.forProgram?.programCode ?? null;

// One person standing for many programmes (a director of six CNPM variants) has one row per programme (US-057 AC3).
// Rows that read the same apart from that code become one line listing every code.
export function mergeSameApprover(rows: readonly ApprovalStep[]): MergedStep[] {
  const merged = new Map<string, MergedStep>();
  for (const step of rows) {
    const key = JSON.stringify([
      step.approver?.id ?? step.id,
      step.action,
      step.isSkipped,
      step.skipReason,
      step.kind,
      step.performedBy?.id ?? null,
      step.remark,
      step.forSubjectGroup ? 'group' : 'program',
    ]);
    const scope = scopeOf(step);
    const held = merged.get(key);
    if (held) {
      if (scope && !held.scopes.includes(scope)) held.scopes.push(scope);
    } else merged.set(key, { step, scopes: scope ? [scope] : [] });
  }
  return [...merged.values()];
}
