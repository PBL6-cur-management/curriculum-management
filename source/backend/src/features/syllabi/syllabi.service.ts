import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CourseStatus,
  ProgramVersionStatus,
  SyllabusStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import {
  assertDirectEdit,
  EDIT_PATH,
  editPathFor,
} from '../../shared/authz/edit-path.js';
import {
  PERMISSIONS,
  type PermissionCode,
} from '../../shared/authz/permission-codes.js';
import { canEditCopy } from '../../shared/change-requests/request-draft.js';
import type { Env } from '../../shared/config/env.validation.js';
import { courseTarget } from '../../shared/courses/course-target.js';
import { CourseUsageReader } from '../../shared/courses/course-usage.reader.js';
import { AppException } from '../../shared/exception/app.exception.js';
import {
  ATTACHMENT_FILE_TYPES,
  BYTES_PER_MB,
} from '../../shared/files/attachment-types.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { programTarget } from '../../shared/programs/program-target.js';
import { revisionForItems } from '../../shared/syllabi/revision-for-items.js';
import { mapUniqueViolation } from '../../shared/prisma/unique-violation.js';
import { sanitizeRichText } from '../../shared/rich-text/sanitize-rich-text.js';
import {
  assertCourseVisible,
  assertDraftWrite,
  SYLLABUS_ACCESS_SELECT,
  SYLLABUS_COURSE_SELECT,
  seesDrafts,
  syllabusEditState,
  type SyllabusCourseRow,
} from './syllabus-access.js';
import type { AttachmentRulesDto } from './syllabus-attachment.dto.js';
import {
  SYLLABUS_INCLUDE,
  toSyllabusCourseDto,
  toSyllabusDto,
  type CourseSyllabusDto,
  type SyllabusDto,
} from './syllabus.dto.js';
import { SYLLABUS_ERRORS, SYLLABUS_LIMITS } from './syllabus.errors.js';
import {
  SYLLABUS_SECTION_FIELDS,
  type UpdateSyllabusDto,
} from './update-syllabus.dto.js';

// Adding a signed file to a published revision needs the same cell as editing the syllabus, over this course.
export function canAttachTo(
  access: AccessContext,
  course: SyllabusCourseRow,
): boolean {
  return (
    access.modeFor(PERMISSIONS.SYLLABUS_EDIT, courseTarget(course)) !== null
  );
}

@Injectable()
export class SyllabiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: CourseUsageReader,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // Always answers for a visible course: both revisions may be null ("chưa có đề cương", US-038 AC3).
  // With requestId the answer shows that request's working copy as the Draft; the published revision is unchanged.
  async forCourse(
    courseId: string,
    access: AccessContext,
    requestId?: string,
    versionId?: string,
  ): Promise<CourseSyllabusDto> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: SYLLABUS_COURSE_SELECT,
    });
    assertCourseVisible(course, access);
    if (versionId) return this.forVersion(course, versionId, access);
    const revisions = await this.prisma.syllabus.findMany({
      where: {
        courseId,
        status: { in: [SyllabusStatus.PUBLISHED, SyllabusStatus.DRAFT] },
        sourceRequestId: null,
      },
      include: SYLLABUS_INCLUDE,
    });
    const copy = requestId
      ? await this.findCopy(courseId, requestId, access)
      : null;
    const copyEditable = (permission: PermissionCode) =>
      copy !== null &&
      copy.sourceRequest !== null &&
      canEditCopy(access, permission, courseTarget(course), copy.sourceRequest);
    const state = await syllabusEditState(this.prisma, course);
    const editPath = copy
      ? copyEditable(PERMISSIONS.SYLLABUS_EDIT)
        ? EDIT_PATH.DIRECT
        : EDIT_PATH.VIA_REQUEST
      : editPathFor(
          access,
          PERMISSIONS.SYLLABUS_EDIT,
          courseTarget(course),
          state,
        );
    const gradingEditPath = copy
      ? copyEditable(PERMISSIONS.GRADING_FORMULA_EDIT)
        ? EDIT_PATH.DIRECT
        : access.modeFor(
              PERMISSIONS.GRADING_FORMULA_EDIT,
              courseTarget(course),
            ) !== null
          ? EDIT_PATH.VIA_REQUEST
          : null
      : editPathFor(
          access,
          PERMISSIONS.GRADING_FORMULA_EDIT,
          courseTarget(course),
          state,
        );
    const published =
      revisions.find((row) => row.status === SyllabusStatus.PUBLISHED) ?? null;
    const draft = copy
      ? copy
      : seesDrafts(access)
        ? (revisions.find((row) => row.status === SyllabusStatus.DRAFT) ?? null)
        : null;
    const hasAnyRevision = revisions.length > 0 || state.released;
    const canDeleteFrom = (uploadedById: string) =>
      uploadedById === access.userId && editPath === EDIT_PATH.DIRECT;
    return {
      course: toSyllabusCourseDto(course),
      programsUsing: await this.usage.programsUsing(courseId),
      published: published && toSyllabusDto(published, () => false),
      draft: draft && toSyllabusDto(draft, canDeleteFrom),
      canCreate:
        copy === null &&
        !hasAnyRevision &&
        course.status !== CourseStatus.CANCELLED &&
        editPath === EDIT_PATH.DIRECT,
      canEditClos: copy
        ? copyEditable(PERMISSIONS.CLO_EDIT)
        : draft !== null &&
          editPathFor(
            access,
            PERMISSIONS.CLO_EDIT,
            courseTarget(course),
            state,
          ) === EDIT_PATH.DIRECT,
      editPath,
      gradingEditPath,
      canEditGradingFormula:
        draft !== null && gradingEditPath === EDIT_PATH.DIRECT,
      attachmentRules: this.attachmentRules(),
      canAttachToPublished: published !== null && canAttachTo(access, course),
      version: null,
    };
  }

  // The revision a released version pins is what that version's viewers read (US-074, US-079): never today's Published
  // by default, and a Historical revision is shown as such. A version row with no pin reads like a Draft does.
  private async forVersion(
    course: SyllabusCourseRow,
    versionId: string,
    access: AccessContext,
  ): Promise<CourseSyllabusDto> {
    const version = await this.prisma.programVersion.findFirst({
      where: {
        id: versionId,
        sourceRequestId: null,
        curriculumItems: { some: { courseId: course.id } },
      },
      select: {
        id: true,
        status: true,
        versionNumber: true,
        program: { select: { id: true, facultyId: true, programCode: true } },
        curriculumItems: {
          where: { courseId: course.id },
          select: { id: true, courseId: true, syllabusId: true },
        },
      },
    });
    if (
      !version ||
      (version.status === ProgramVersionStatus.DRAFT && !seesDrafts(access))
    ) {
      throw new AppException(SYLLABUS_ERRORS.SYLLABUS_NOT_FOUND);
    }
    access.assertCan(PERMISSIONS.PROGRAM_VIEW, programTarget(version.program));
    const [item] = version.curriculumItems;
    const revision = (await revisionForItems(this.prisma, [item])).get(item.id);
    const row = revision
      ? await this.prisma.syllabus.findUniqueOrThrow({
          where: { id: revision.id },
          include: SYLLABUS_INCLUDE,
        })
      : null;
    return {
      course: toSyllabusCourseDto(course),
      programsUsing: await this.usage.programsUsing(course.id),
      published: row && toSyllabusDto(row, () => false),
      draft: null,
      canCreate: false,
      canEditClos: false,
      editPath: null,
      gradingEditPath: null,
      canEditGradingFormula: false,
      attachmentRules: this.attachmentRules(),
      canAttachToPublished: row !== null && canAttachTo(access, course),
      version: {
        id: version.id,
        programId: version.program.id,
        programCode: version.program.programCode,
        versionNumber: version.versionNumber,
      },
    };
  }

  // DC-01: the first revision, as a Draft. Any existing revision makes this a conflict.
  async create(
    courseId: string,
    access: AccessContext,
  ): Promise<CourseSyllabusDto> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: SYLLABUS_COURSE_SELECT,
    });
    assertCourseVisible(course, access);
    assertDirectEdit(
      access,
      PERMISSIONS.SYLLABUS_EDIT,
      courseTarget(course),
      await syllabusEditState(this.prisma, course),
    );
    if (course.status === CourseStatus.CANCELLED) {
      throw new AppException(SYLLABUS_ERRORS.COURSE_CANCELLED);
    }
    if (
      (await this.prisma.syllabus.count({
        where: { courseId, sourceRequestId: null },
      })) > 0
    ) {
      throw new AppException(SYLLABUS_ERRORS.SYLLABUS_ALREADY_EXISTS);
    }
    try {
      await this.prisma.syllabus.create({
        data: {
          courseId,
          revisionNumber: SYLLABUS_LIMITS.FIRST_REVISION,
          status: SyllabusStatus.DRAFT,
        },
      });
    } catch (error) {
      throw mapUniqueViolation(
        error,
        SYLLABUS_ERRORS.SYLLABUS_ALREADY_EXISTS,
        'courseId',
      );
    }
    return this.forCourse(courseId, access);
  }

  // DC-02: only the sections present in the body change; each is sanitized, empty becomes null.
  async update(
    syllabusId: string,
    dto: UpdateSyllabusDto,
    access: AccessContext,
  ): Promise<SyllabusDto> {
    const row = await this.prisma.syllabus.findUnique({
      where: { id: syllabusId },
      select: SYLLABUS_ACCESS_SELECT,
    });
    await assertDraftWrite(this.prisma, access, row);
    const data: Prisma.SyllabusUpdateInput = {};
    for (const field of SYLLABUS_SECTION_FIELDS) {
      if (dto[field] !== undefined) {
        data[field] = sanitizeRichText(dto[field]);
      }
    }
    const updated = await this.prisma.syllabus.update({
      where: { id: syllabusId },
      data,
      include: SYLLABUS_INCLUDE,
    });
    return toSyllabusDto(
      updated,
      (uploadedById) => uploadedById === access.userId,
    );
  }

  // The copy of one request on this course, visible like any Draft (D18).
  private async findCopy(
    courseId: string,
    requestId: string,
    access: AccessContext,
  ) {
    const copy = seesDrafts(access)
      ? await this.prisma.syllabus.findFirst({
          where: { courseId, sourceRequestId: requestId },
          include: SYLLABUS_INCLUDE,
        })
      : null;
    if (!copy) {
      throw new AppException(SYLLABUS_ERRORS.SYLLABUS_NOT_FOUND);
    }
    return copy;
  }

  attachmentRules(): AttachmentRulesDto {
    return {
      maxBytes:
        this.config.get('ATTACHMENT_MAX_MB', { infer: true }) * BYTES_PER_MB,
      fileTypes: ATTACHMENT_FILE_TYPES,
    };
  }
}
