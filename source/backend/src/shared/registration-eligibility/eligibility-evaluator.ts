import { Prisma } from '../../generated/prisma/client.js';
import {
  completionEvidence,
  prerequisiteCandidates,
  prerequisiteThreshold,
  priorEvidence,
} from './academic-evidence.js';
import {
  buildCorequisiteGraph,
  corequisitePaths,
} from './corequisite-graph.js';
import {
  ELIGIBILITY_REASON_PRIORITY,
  ELIGIBILITY_WARNING_PRIORITY,
  compareCodepoints,
} from './eligibility.constants.js';
import {
  eligibilityReason,
  eligibilityStatusText,
  eligibilityWarning,
} from './eligibility-reasons.js';
import type {
  AcademicEvidence,
  EligibilityEvaluationContext,
  EligibilityEvaluationOptions,
  EligibilityReason,
  RegistrationEligibilityAnswer,
} from './eligibility.types.js';

function evidenceFields(evidence: AcademicEvidence | null) {
  return {
    evidenceCourse: evidence?.course ?? null,
    evidenceResultId: evidence?.attempt.id ?? null,
    actualScore4: evidence?.attempt.score4 ?? null,
    actualStatus: evidence?.attempt.status ?? null,
  };
}
export function evaluateEligibility(
  context: EligibilityEvaluationContext,
  options: EligibilityEvaluationOptions,
): Pick<RegistrationEligibilityAnswer, 'items' | 'warnings'> {
  const rows = [...context.rows].sort(
    (left, right) =>
      left.plannedSemester - right.plannedSemester ||
      left.sortOrder - right.sortOrder ||
      compareCodepoints(left.itemId, right.itemId),
  );
  const rowsByCourse = new Map(rows.map((row) => [row.course.id, row]));
  const completed = new Map(
    [...context.courses.keys()].map((id) => [
      id,
      completionEvidence(context, id),
    ]),
  );
  const compareCourses = (left: string, right: string) =>
    compareCodepoints(
      context.courses.get(left)!.course.courseCode,
      context.courses.get(right)!.course.courseCode,
    ) || compareCodepoints(left, right);
  const unfinished = rows.filter((row) => !completed.get(row.course.id));
  const blockers = new Map<string, EligibilityReason[]>();
  const requirements = new Map<string, readonly string[]>();
  const warnings = new Map(
    context.warnings.map((warning) => [
      `${warning.code}:${warning.course.id}`,
      warning,
    ]),
  );
  for (const row of unfinished) {
    const direct: EligibilityReason[] = [];
    const concurrent = new Set<string>();
    for (const edge of row.requisites) {
      const source = context.courses.get(edge.sourceCourseId)!.course;
      const facts = {
        relationType: edge.relationType,
        requiredCourse: source,
        path: [row.course, source],
      };
      if (edge.relationType === 'COREQUISITE') {
        if (completed.get(source.id)) continue;
        if (rowsByCourse.has(source.id)) concurrent.add(source.id);
        else {
          direct.push(
            eligibilityReason('COREQUISITE_RULES_UNAVAILABLE', facts, options),
          );
          const warning = eligibilityWarning(
            'EXTERNAL_COREQUISITE_RULES_UNAVAILABLE',
            source,
          );
          warnings.set(`${warning.code}:${source.id}`, warning);
        }
      } else if (edge.relationType === 'PRIOR') {
        if (!priorEvidence(context, source.id))
          direct.push(
            eligibilityReason('PRIOR_RESULT_MISSING', facts, options),
          );
      } else {
        const candidates = prerequisiteCandidates(context, source.id);
        const threshold = prerequisiteThreshold(edge, rowsByCourse);
        const sufficient = candidates.some(
          (candidate) =>
            threshold === null ||
            threshold.isZero() ||
            (candidate.attempt.score4 !== null &&
              new Prisma.Decimal(candidate.attempt.score4).gte(threshold)),
        );
        if (sufficient) continue;
        const evidence = candidates[0] ?? null;
        const code = !evidence
          ? 'PREREQUISITE_NOT_PASSED'
          : evidence.attempt.score4 === null
            ? 'PREREQUISITE_SCORE_MISSING'
            : 'PREREQUISITE_SCORE_TOO_LOW';
        direct.push(
          eligibilityReason(
            code,
            {
              ...facts,
              ...evidenceFields(evidence),
              requiredScore4: threshold?.toString() ?? null,
            },
            options,
          ),
        );
      }
    }
    blockers.set(row.course.id, direct);
    requirements.set(row.course.id, [...concurrent].sort(compareCourses));
  }
  const graph = buildCorequisiteGraph(
    unfinished.map((row) => row.course.id),
    requirements,
  );
  const components = new Map(
    graph.components.map((component) => [component.id, component]),
  );
  const depths = new Map<string, number>();
  graph.dependencyFirstOrder.forEach((id) =>
    depths.set(
      id,
      1 +
        Math.max(
          0,
          ...components
            .get(id)!
            .dependencyComponentIds.map((dependency) =>
              depths.get(dependency)!,
            ),
        ),
    ),
  );
  const items = rows.map((row) => {
    const base = {
      itemId: row.itemId,
      course: row.course,
      credits: row.credits.toString(),
      catalogStatus: row.catalogStatus,
      plannedSemester: row.plannedSemester,
    };
    const evidence = completed.get(row.course.id);
    if (evidence)
      return {
        ...base,
        completed: true,
        eligibility: null,
        statusText: eligibilityStatusText(true, null),
        reasons: [
          eligibilityReason(
            evidence.course.id === row.course.id
              ? 'COURSE_COMPLETED'
              : 'EQUIVALENT_COMPLETED',
            evidenceFields(evidence),
            options,
          ),
        ],
        requiredConcurrentCourses: [],
      };
    const paths = corequisitePaths(requirements, row.course.id);
    const reachable = [...paths.keys()]
      .filter((id) => id !== row.course.id)
      .sort(compareCourses);
    const reasons = [...blockers.get(row.course.id)!];
    const seen = new Set<string>();
    for (const via of requirements.get(row.course.id) ?? []) {
      const withoutOrigin = new Map(
        [...requirements].map(([id, targets]) => [
          id,
          targets.filter((target) => target !== row.course.id),
        ]),
      );
      const viaPaths = corequisitePaths(withoutOrigin, via);
      for (const leafId of reachable) {
        const route = viaPaths.get(leafId) ?? [];
        if (!route.length) continue;
        for (const leaf of blockers.get(leafId) ?? []) {
          const key = `${via}:${leaf.code}:${leaf.requiredCourse?.id}:${leaf.evidenceResultId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const pathIds = [row.course.id, ...route];
          if (leaf.requiredCourse && !pathIds.includes(leaf.requiredCourse.id))
            pathIds.push(leaf.requiredCourse.id);
          reasons.push(
            eligibilityReason(
              'COREQUISITE_INELIGIBLE',
              {
                relationType: 'COREQUISITE',
                requiredCourse: leaf.requiredCourse,
                evidenceCourse: leaf.evidenceCourse,
                evidenceResultId: leaf.evidenceResultId,
                requiredScore4: leaf.requiredScore4,
                actualScore4: leaf.actualScore4,
                actualStatus: leaf.actualStatus,
                causeCode: leaf.code,
                viaCourse: context.courses.get(via)!.course,
                path: pathIds.map((id) => context.courses.get(id)!.course),
              },
              options,
            ),
          );
        }
      }
    }
    const originComponent = graph.componentOfCourse.get(row.course.id)!;
    if (depths.get(originComponent)! > options.maxDepth) {
      let boundary = originComponent;
      const boundaryPath = [row.course.id];
      for (let level = 0; level < options.maxDepth; level++) {
        const dependencies = components.get(boundary)!.dependencyComponentIds;
        const next = [...dependencies].sort(
          (left, right) =>
            depths.get(right)! - depths.get(left)! ||
            compareCodepoints(left, right),
        )[0];
        const component = components.get(boundary)!;
        const exit = [...component.courseIds]
          .sort(compareCourses)
          .flatMap((source) =>
            (requirements.get(source) ?? [])
              .filter((target) => graph.componentOfCourse.get(target) === next)
              .map((target) => ({ source, target })),
          )[0];
        const inside = new Map(
          component.courseIds.map((id) => [
            id,
            (requirements.get(id) ?? []).filter(
              (target) => graph.componentOfCourse.get(target) === boundary,
            ),
          ]),
        );
        const route = corequisitePaths(
          inside,
          boundaryPath[boundaryPath.length - 1],
        ).get(exit.source)!;
        boundaryPath.push(...route.slice(1), exit.target);
        boundary = next;
      }
      const boundaryCourse = boundaryPath[boundaryPath.length - 1];
      reasons.push(
        eligibilityReason(
          'COREQUISITE_DEPTH_LIMIT',
          {
            relationType: 'COREQUISITE',
            requiredCourse: context.courses.get(boundaryCourse)!.course,
            path: boundaryPath.map((id) => context.courses.get(id)!.course),
          },
          options,
        ),
      );
    }
    const eligibility = reasons.length
      ? ('INELIGIBLE' as const)
      : reachable.length
        ? ('CONDITIONAL' as const)
        : ('ELIGIBLE' as const);
    if (eligibility === 'CONDITIONAL')
      reachable.forEach((id) =>
        reasons.push(
          eligibilityReason(
            'COREQUISITE_REQUIRED',
            {
              relationType: 'COREQUISITE',
              requiredCourse: context.courses.get(id)!.course,
              path: paths
                .get(id)!
                .map((courseId) => context.courses.get(courseId)!.course),
            },
            options,
          ),
        ),
      );
    reasons.sort(
      (left, right) =>
        ELIGIBILITY_REASON_PRIORITY[left.code] -
          ELIGIBILITY_REASON_PRIORITY[right.code] ||
        ELIGIBILITY_REASON_PRIORITY[left.causeCode ?? left.code] -
          ELIGIBILITY_REASON_PRIORITY[right.causeCode ?? right.code] ||
        compareCodepoints(
          left.requiredCourse?.courseCode ?? '',
          right.requiredCourse?.courseCode ?? '',
        ) ||
        compareCodepoints(
          left.requiredCourse?.id ?? '',
          right.requiredCourse?.id ?? '',
        ) ||
        compareCodepoints(
          left.viaCourse?.id ?? '',
          right.viaCourse?.id ?? '',
        ) ||
        compareCodepoints(
          left.evidenceResultId ?? '',
          right.evidenceResultId ?? '',
        ),
    );
    return {
      ...base,
      completed: false,
      eligibility,
      statusText: eligibilityStatusText(false, eligibility),
      reasons,
      requiredConcurrentCourses:
        eligibility === 'CONDITIONAL'
          ? reachable.map((id) => context.courses.get(id)!.course)
          : [],
    };
  });
  return {
    items,
    warnings: [...warnings.values()].sort(
      (left, right) =>
        ELIGIBILITY_WARNING_PRIORITY[left.code] -
          ELIGIBILITY_WARNING_PRIORITY[right.code] ||
        compareCourses(left.course.id, right.course.id),
    ),
  };
}
