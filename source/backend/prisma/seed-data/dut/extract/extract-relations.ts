import type { CourseRelationType } from '../../../../src/generated/prisma/client.js';
import {
  CYCLE_CHECKED_TYPES,
  findRequisiteCycle,
  type RequisiteEdge,
} from '../../../../src/shared/courses/requisite-graph.js';
import type { DutProgram } from './extract-frames.js';
import {
  pickRelationType,
  REQUISITE_TYPE_STRENGTH,
} from '../legacy-mapping.js';
export interface DutRelation {
  sourceCourseCode: string;
  targetCourseCode: string;
  relationType: CourseRelationType;
}
export function extractRelations(programs: readonly DutProgram[]): {
  relations: DutRelation[];
  conflictingPairs: number;
  cycleSkipped: DutRelation[];
} {
  const pairs = new Map<
    string,
    {
      sourceCourseCode: string;
      targetCourseCode: string;
      counts: Map<CourseRelationType, number>;
    }
  >();
  for (const program of programs)
    for (const version of program.versions)
      for (const row of version.requisites) {
        const key = `${row.sourceCourseCode}:${row.targetCourseCode}`;
        const pair = pairs.get(key) ?? {
          sourceCourseCode: row.sourceCourseCode,
          targetCourseCode: row.targetCourseCode,
          counts: new Map<CourseRelationType, number>(),
        };
        pair.counts.set(
          row.relationType,
          (pair.counts.get(row.relationType) ?? 0) + 1,
        );
        pairs.set(key, pair);
      }
  const candidates = [...pairs.values()].map((pair) => ({
    sourceCourseCode: pair.sourceCourseCode,
    targetCourseCode: pair.targetCourseCode,
    relationType: pickRelationType(pair.counts),
  }));
  candidates.sort(
    (left, right) =>
      REQUISITE_TYPE_STRENGTH[right.relationType] -
        REQUISITE_TYPE_STRENGTH[left.relationType] ||
      left.sourceCourseCode.localeCompare(right.sourceCourseCode) ||
      left.targetCourseCode.localeCompare(right.targetCourseCode),
  );
  const relations: DutRelation[] = [];
  const cycleSkipped: DutRelation[] = [];
  const edges: RequisiteEdge[] = [];
  for (const relation of candidates) {
    const edge = {
      sourceCourseId: relation.sourceCourseCode,
      targetCourseId: relation.targetCourseCode,
    };
    const checked = CYCLE_CHECKED_TYPES.includes(relation.relationType);
    if (checked && findRequisiteCycle(edges, edge)) {
      cycleSkipped.push(relation);
      continue;
    }
    relations.push(relation);
    if (checked) edges.push(edge);
  }
  return {
    relations,
    conflictingPairs: [...pairs.values()].filter((pair) => pair.counts.size > 1)
      .length,
    cycleSkipped,
  };
}
