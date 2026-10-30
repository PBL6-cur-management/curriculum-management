import { Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import {
  EnrollmentType,
  Prisma,
  SyllabusStatus,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { toWireDecimal } from '../../shared/decimal/decimal.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { mimeForPath } from '../../shared/files/attachment-types.js';
import { FileStorageService } from '../../shared/files/file-storage.service.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { RegistrationEligibilityReader } from '../../shared/registration-eligibility/registration-eligibility.reader.js';
import { requireSemesterStart } from '../../shared/releases/semester-start.js';
import { AcademicResultsReader } from '../../shared/students/academic-results.reader.js';
import { bestAcademicResults } from '../../shared/students/best-academic-results.js';
import { enrollmentCoversWhere } from '../../shared/students/enrollment-period.js';
import { StudentAppliedVersionReader } from '../../shared/students/student-applied-version.reader.js';
import { STUDENT_ROLES } from '../../shared/students/student.constants.js';
import type {
  PortalContextQueryDto,
  PortalCourseDto,
  PortalCourseState,
  PortalCurriculumDto,
  PortalMeDto,
  PortalPloDto,
  PortalSemesterQueryDto,
  PortalSyllabusDto,
} from './dto/student-portal.dto.js';
import { PORTAL_ERRORS } from './student-portal.errors.js';

const REPEATABLE_READ = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
};

const MATERIAL_ORDER = [
  'SIGNED_SYLLABUS',
  'TEXTBOOK',
  'LECTURE_SLIDES',
  'OTHER',
];

// A row's pin counts only once issued: a draft or an unnumbered revision is not something to publish.
export function issuedPin(
  pin: {
    id: string;
    status: SyllabusStatus;
    revisionNumber: number | null;
  } | null,
): string | null {
  return pin &&
    pin.status !== SyllabusStatus.DRAFT &&
    pin.revisionNumber !== null
    ? pin.id
    : null;
}

// The latest semester already started; before any start date is known, the earliest dated one.
export async function defaultSemester(db: Prisma.TransactionClient) {
  const today = new Date();
  return (
    (await db.semester.findFirst({
      where: { startDate: { lte: today } },
      orderBy: { startDate: 'desc' },
    })) ??
    (await db.semester.findFirst({
      where: { startDate: { not: null } },
      orderBy: { startDate: 'asc' },
    }))
  );
}

// Every read is addressed by the session, never by a student id in the URL: one student cannot name another.
// Nothing here writes: no reconciliation, no saved audit, no missing context created.
@Injectable()
export class StudentPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: StudentAppliedVersionReader,
    private readonly results: AcademicResultsReader,
    private readonly eligibility: RegistrationEligibilityReader,
    private readonly files: FileStorageService,
  ) {}

  private async ownStudentId(
    db: Prisma.TransactionClient | PrismaService,
    access: AccessContext,
  ): Promise<string | null> {
    if (!access.assignments.some((a) => a.roleCode === STUDENT_ROLES.SELF)) {
      return null;
    }
    const row = await db.student.findUnique({
      where: { userId: access.userId },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  private async requireOwnStudentId(access: AccessContext): Promise<string> {
    const id = await this.ownStudentId(this.prisma, access);
    if (!id) throw new AppException(PORTAL_ERRORS.NO_STUDENT);
    return id;
  }

  async me(
    access: AccessContext,
    query: PortalSemesterQueryDto,
  ): Promise<PortalMeDto> {
    return this.prisma.$transaction(async (tx) => {
      const studentId = await this.ownStudentId(tx, access);
      if (!studentId) return { student: null, semester: null, programs: [] };
      const student = await tx.student.findUniqueOrThrow({
        where: { id: studentId },
        select: {
          id: true,
          studentCode: true,
          fullName: true,
          major: true,
          status: true,
          cohort: { select: { cohortCode: true } },
        },
      });
      const picked = query.semesterId
        ? await requireSemesterStart(tx, query.semesterId)
        : await defaultSemester(tx);
      const identity = {
        id: student.id,
        studentCode: student.studentCode,
        fullName: student.fullName,
        cohortCode: student.cohort.cohortCode,
        major: student.major,
        status: student.status,
      };
      if (!picked?.startDate)
        return { student: identity, semester: null, programs: [] };
      const enrollments = await tx.programEnrollment.findMany({
        where: {
          studentId,
          ...enrollmentCoversWhere({ ...picked, startDate: picked.startDate }),
        },
        select: {
          programId: true,
          enrollmentType: true,
          program: { select: { programCode: true } },
        },
      });
      const programs = [];
      // PRIMARY first, then second majors; a program the resolver cannot settle is left out rather than guessed.
      const ordered = [...enrollments].sort(
        (a, b) =>
          Number(a.enrollmentType !== EnrollmentType.PRIMARY) -
            Number(b.enrollmentType !== EnrollmentType.PRIMARY) ||
          a.program.programCode.localeCompare(b.program.programCode),
      );
      const seen = new Set<string>();
      for (const row of ordered) {
        if (seen.has(row.programId)) continue;
        seen.add(row.programId);
        const applied = await this.versions
          .forAccess(access, 'PROGRESS')
          .resolveForStudent(
            { studentId, programId: row.programId, semesterId: picked.id },
            tx,
          )
          .catch((error: unknown) => {
            if (error instanceof AppException) return null;
            throw error;
          });
        if (!applied) continue;
        const version = await tx.programVersion.findUniqueOrThrow({
          where: { id: applied.programVersionId },
          select: {
            programName: true,
            versionNumber: true,
            decisionNumber: true,
          },
        });
        programs.push({
          programId: row.programId,
          programCode: row.program.programCode,
          programName: version.programName,
          enrollmentType: row.enrollmentType,
          versionId: applied.programVersionId,
          versionNumber: version.versionNumber,
          decisionNumber: version.decisionNumber,
        });
      }
      return {
        student: identity,
        semester: { id: picked.id, semesterCode: picked.semesterCode },
        programs,
      };
    }, REPEATABLE_READ);
  }

  async curriculum(
    access: AccessContext,
    query: PortalContextQueryDto,
  ): Promise<PortalCurriculumDto> {
    const studentId = await this.requireOwnStudentId(access);
    return this.curriculumFor(access, { studentId, ...query });
  }

  // Shared with the dDUT API (F-21): the caller's access decides who may be read; the answer is the same.
  async curriculumFor(
    access: AccessContext,
    lookup: { studentId: string; programId: string; semesterId: string },
  ): Promise<PortalCurriculumDto> {
    return this.prisma.$transaction(async (tx) => {
      // F-18 decides completion (equivalents included); F-17 supplies the attempts. Nothing is re-evaluated here.
      const answer = await this.eligibility
        .forAccess(access)
        .evaluate(lookup, tx);
      const attempts = await this.results
        .forAccess(access, 'PROGRESS')
        .forStudent(lookup, tx);
      const best = new Map(
        bestAcademicResults(attempts).map((facts) => [facts.courseId, facts]),
      );
      const completed = new Map(
        answer.items.map((item) => [item.itemId, item.completed]),
      );
      const version = await tx.programVersion.findUniqueOrThrow({
        where: { id: answer.context.programVersionId },
        select: {
          programName: true,
          versionNumber: true,
          decisionNumber: true,
          totalCredits: true,
          curriculumItems: {
            orderBy: [{ plannedSemester: 'asc' }, { sortOrder: 'asc' }],
            select: {
              id: true,
              plannedSemester: true,
              isElective: true,
              blockSymbol: true,
              syllabusId: true,
              courseNameSnapshot: true,
              creditsSnapshot: true,
              electiveGroup: { select: { groupName: true } },
              course: {
                select: {
                  id: true,
                  courseCode: true,
                  courseName: true,
                  credits: true,
                },
              },
            },
          },
        },
      });
      const terms = new Map<number, PortalCourseDto[]>();
      const termCredits = new Map<number, Prisma.Decimal>();
      for (const item of version.curriculumItems) {
        const facts = best.get(item.course.id);
        const credits = item.creditsSnapshot ?? item.course.credits;
        let state: PortalCourseState = 'NOT_TAKEN';
        if (completed.get(item.id)) {
          state =
            facts?.hasPassedAttempt || facts?.isExempt
              ? 'PASSED'
              : 'PASSED_EQUIVALENT';
        } else if (facts?.hasInProgressAttempt) state = 'IN_PROGRESS';
        else if (facts && facts.attempts.length > 0) state = 'FAILED';
        const shown = facts?.bestScoredAttempt ?? null;
        terms.set(item.plannedSemester, [
          ...(terms.get(item.plannedSemester) ?? []),
          {
            itemId: item.id,
            courseId: item.course.id,
            courseCode: item.course.courseCode,
            courseName: item.courseNameSnapshot ?? item.course.courseName,
            credits: toWireDecimal(credits),
            isElective: item.isElective,
            groupName: item.electiveGroup?.groupName ?? null,
            blockSymbol: item.blockSymbol,
            state,
            attemptCount: facts?.attempts.length ?? 0,
            score10: shown?.score10 ?? null,
            score4: shown?.score4 ?? null,
            letterGrade: shown?.letterGrade ?? null,
            hasSyllabus: item.syllabusId !== null,
          },
        ]);
        if (!item.isElective) {
          termCredits.set(
            item.plannedSemester,
            (
              termCredits.get(item.plannedSemester) ?? new Prisma.Decimal(0)
            ).plus(credits),
          );
        }
      }
      return {
        programName: version.programName,
        versionNumber: version.versionNumber,
        decisionNumber: version.decisionNumber,
        totalCredits: toWireDecimal(version.totalCredits),
        terms: [...terms.entries()].map(([plannedSemester, courses]) => ({
          plannedSemester,
          credits: toWireDecimal(
            termCredits.get(plannedSemester) ?? new Prisma.Decimal(0),
          ),
          courses,
        })),
      };
    }, REPEATABLE_READ);
  }

  async plos(
    access: AccessContext,
    query: PortalContextQueryDto,
  ): Promise<PortalPloDto[]> {
    const studentId = await this.requireOwnStudentId(access);
    const applied = await this.versions
      .forAccess(access, 'PROGRESS')
      .resolveForStudent({ studentId, ...query });
    const rows = await this.prisma.pLO.findMany({
      where: { versionId: applied.programVersionId },
      orderBy: [{ sortOrder: 'asc' }, { ploCode: 'asc' }],
      select: { ploCode: true, description: true, competencyGroup: true },
    });
    return rows;
  }

  // The row's own pin, never the course's newest revision; a row released without an issued pin has nothing to show.
  private async pinnedSyllabusId(
    access: AccessContext,
    itemId: string,
    query: PortalContextQueryDto,
  ): Promise<string> {
    const studentId = await this.requireOwnStudentId(access);
    const applied = await this.versions
      .forAccess(access, 'PROGRESS')
      .resolveForStudent({ studentId, ...query });
    const item = await this.prisma.curriculumItem.findFirst({
      where: { id: itemId, versionId: applied.programVersionId },
      select: {
        syllabus: { select: { id: true, status: true, revisionNumber: true } },
      },
    });
    if (!item) throw new AppException(PORTAL_ERRORS.ITEM_NOT_FOUND);
    const pin = issuedPin(item.syllabus);
    if (!pin) throw new AppException(PORTAL_ERRORS.SYLLABUS_NOT_ISSUED);
    return pin;
  }

  async syllabus(
    access: AccessContext,
    itemId: string,
    query: PortalContextQueryDto,
  ): Promise<PortalSyllabusDto> {
    return this.syllabusProjection(
      await this.pinnedSyllabusId(access, itemId, query),
    );
  }

  // The allowlisted, issued view of one syllabus revision; never request, reviewer or draft fields.
  async syllabusProjection(syllabusId: string): Promise<PortalSyllabusDto> {
    const row = await this.prisma.syllabus.findUniqueOrThrow({
      where: { id: syllabusId },
      select: {
        revisionNumber: true,
        publishedAt: true,
        courseDescription: true,
        objectives: true,
        teachingMethods: true,
        assessmentMethods: true,
        references: true,
        course: {
          select: { courseCode: true, courseName: true, credits: true },
        },
        clos: {
          orderBy: [{ sortOrder: 'asc' }, { cloCode: 'asc' }],
          select: { cloCode: true, description: true },
        },
        weeklyContents: {
          orderBy: { sortOrder: 'asc' },
          select: { weekLabel: true, content: true },
        },
        assessmentComponents: {
          orderBy: { componentCode: 'asc' },
          select: {
            componentCode: true,
            componentName: true,
            weight: true,
            assessmentForm: true,
          },
        },
        attachments: {
          orderBy: { recordedAt: 'asc' },
          select: {
            id: true,
            fileName: true,
            materialKind: true,
            sizeBytes: true,
          },
        },
      },
    });
    return {
      courseCode: row.course.courseCode,
      courseName: row.course.courseName,
      credits: toWireDecimal(row.course.credits),
      revisionNumber: row.revisionNumber!,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      courseDescription: row.courseDescription,
      objectives: row.objectives,
      teachingMethods: row.teachingMethods,
      assessmentMethods: row.assessmentMethods,
      references: row.references,
      clos: row.clos,
      weeks: row.weeklyContents,
      assessments: row.assessmentComponents.map((component) => ({
        ...component,
        weight: toWireDecimal(component.weight),
      })),
      attachments: [...row.attachments].sort(
        (a, b) =>
          MATERIAL_ORDER.indexOf(a.materialKind) -
          MATERIAL_ORDER.indexOf(b.materialKind),
      ),
    };
  }

  async openAttachment(
    access: AccessContext,
    itemId: string,
    attachmentId: string,
    query: PortalContextQueryDto,
  ): Promise<{ stream: Readable; fileName: string; mime: string }> {
    const syllabusId = await this.pinnedSyllabusId(access, itemId, query);
    const row = await this.prisma.syllabusAttachment.findFirst({
      where: { id: attachmentId, syllabusId },
      select: { fileName: true, filePath: true },
    });
    if (!row) throw new AppException(PORTAL_ERRORS.ATTACHMENT_NOT_FOUND);
    const { stream } = await this.files.open(row.filePath);
    return { stream, fileName: row.fileName, mime: mimeForPath(row.filePath) };
  }
}
