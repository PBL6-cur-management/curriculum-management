import type { Prisma } from '../../generated/prisma/client.js';
import {
  RELATION_TYPE_LABELS,
  VERSION_INFO_LABELS,
} from '../../shared/change-requests/diff/diff-labels.js';
import type { SnapshotEntry } from '../../shared/change-requests/diff/snapshot-entry.js';
import {
  entry,
  scalar,
} from '../../shared/change-requests/diff/snapshot-scalar.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { APPLIED_VERSION_ERRORS } from '../../shared/releases/applied-version.errors.js';
import { RELEASE_ERRORS } from '../../shared/releases/release.errors.js';
import { toSemesterDto } from '../../shared/releases/semester.dto.js';
import type { IssuedVersionDto } from './dto/version-comparison.dto.js';
import {
  RELEASED_SNAPSHOT_ENTITY,
  RELEASED_VERSION_INFO_FIELDS,
} from './version-comparison.constants.js';

export interface ReleasedProgramSnapshot {
  version: IssuedVersionDto;
  entries: SnapshotEntry[];
  pinsByCourseCode: ReadonlyMap<
    string,
    { courseId: string; syllabusId: string; revisionNumber: number }
  >;
}

export async function readReleasedVersionSnapshot(
  db: Prisma.TransactionClient,
  programId: string,
  versionId: string,
): Promise<ReleasedProgramSnapshot> {
  const version = await db.programVersion.findFirst({
    where: { id: versionId, programId },
    include: {
      effectiveSemester: true,
      electiveGroups: true,
      plos: true,
      curriculumItems: {
        include: {
          course: { select: { courseCode: true } },
          electiveGroup: { select: { groupCode: true } },
          syllabus: {
            select: {
              id: true,
              courseId: true,
              status: true,
              revisionNumber: true,
              sourceRequestId: true,
            },
          },
          requisites: {
            include: { sourceCourse: { select: { courseCode: true } } },
          },
          ploMappings: {
            include: {
              plo: { select: { ploCode: true } },
              cloLinks: { include: { clo: { select: { cloCode: true } } } },
            },
          },
        },
      },
    },
  });
  if (!version) throw new AppException(RELEASE_ERRORS.VERSION_NOT_FOUND);
  if (
    version.status === 'DRAFT' ||
    version.sourceRequestId !== null ||
    !version.versionNumber ||
    !version.decisionNumber ||
    !version.publishedAt ||
    !version.effectiveSemester
  ) {
    throw new AppException(APPLIED_VERSION_ERRORS.VERSION_NOT_ISSUED);
  }
  const entries: SnapshotEntry[] = [];
  const pinsByCourseCode = new Map<
    string,
    { courseId: string; syllabusId: string; revisionNumber: number }
  >();
  for (const field of RELEASED_VERSION_INFO_FIELDS) {
    entries.push(
      entry('VERSION_INFO', field, VERSION_INFO_LABELS[field], version.id, {
        value: scalar(version[field]),
      }),
    );
  }
  for (const group of version.electiveGroups) {
    entries.push(
      entry(
        'ELECTIVE_GROUP',
        group.groupCode,
        `${group.groupCode} ${group.groupName}`,
        group.id,
        {
          groupName: group.groupName,
          minCredits: scalar(group.minCredits),
          minCourses: scalar(group.minCourses),
        },
      ),
    );
  }
  for (const item of version.curriculumItems) {
    const syllabus = item.syllabus;
    if (
      item.courseNameSnapshot === null ||
      item.creditsSnapshot === null ||
      !syllabus ||
      syllabus.courseId !== item.courseId ||
      syllabus.status === 'DRAFT' ||
      syllabus.revisionNumber === null ||
      syllabus.sourceRequestId !== null
    ) {
      throw new AppException(APPLIED_VERSION_ERRORS.SNAPSHOT_INCOMPLETE);
    }
    const code = item.course.courseCode;
    const label = `${code} ${item.courseNameSnapshot}`;
    entries.push(
      entry('CURRICULUM_ITEM', code, label, item.id, {
        courseName: item.courseNameSnapshot,
        credits: scalar(item.creditsSnapshot),
        plannedSemester: scalar(item.plannedSemester),
        sortOrder: scalar(item.sortOrder),
        blockSymbol: item.blockSymbol,
        isElective: scalar(item.isElective),
        electiveGroup: item.electiveGroup?.groupCode ?? null,
        htDa: scalar(item.htDa),
        tqDa: scalar(item.tqDa),
        minStudiedScore: scalar(item.minStudiedScore),
        minTransferScore: scalar(item.minTransferScore),
        note: item.note,
      }),
    );
    entries.push(
      entry(RELEASED_SNAPSHOT_ENTITY.PINNED_SYLLABUS, code, label, item.id, {
        syllabusId: syllabus.id,
        revisionNumber: scalar(syllabus.revisionNumber),
      }),
    );
    pinsByCourseCode.set(code, {
      courseId: item.courseId,
      syllabusId: syllabus.id,
      revisionNumber: syllabus.revisionNumber,
    });
    for (const requisite of item.requisites) {
      const source = requisite.sourceCourse.courseCode;
      entries.push(
        entry(
          'CURRICULUM_REQUISITE',
          JSON.stringify([code, source, requisite.relationType]),
          `${code} ← ${source} (${RELATION_TYPE_LABELS[requisite.relationType]})`,
          requisite.id,
          { minScore: scalar(requisite.minScore) },
        ),
      );
    }
    for (const mapping of item.ploMappings) {
      const plo = mapping.plo.ploCode;
      entries.push(
        entry(
          'COURSE_PLO',
          JSON.stringify([code, plo]),
          `${code} — ${plo}`,
          mapping.id,
          { weight: scalar(mapping.weight) },
        ),
      );
      for (const link of mapping.cloLinks) {
        entries.push(
          entry(
            'CLO_PLO',
            JSON.stringify([code, link.clo.cloCode, plo]),
            `${code} — ${link.clo.cloCode} → ${plo}`,
            link.id,
            { linked: 'true' },
          ),
        );
      }
    }
  }
  for (const plo of version.plos) {
    entries.push(
      entry('PLO', plo.ploCode, plo.ploCode, plo.id, {
        description: plo.description,
        englishDescription: plo.englishDescription,
        competencyGroup: plo.competencyGroup,
        sortOrder: scalar(plo.sortOrder),
      }),
    );
  }
  return {
    version: {
      id: version.id,
      versionNumber: version.versionNumber,
      status: version.status,
      decisionNumber: version.decisionNumber,
      effectiveSemester: toSemesterDto(version.effectiveSemester),
    },
    entries,
    pinsByCourseCode,
  };
}
