import { Injectable } from '@nestjs/common';
import {
  CourseRelationType,
  CourseStatus,
  SyllabusStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import { toWireDecimal } from '../../shared/decimal/decimal.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { INTEGRATION_ERRORS } from '../../shared/integration-access/integration.errors.js';
import { toSkipTake } from '../../shared/pagination/page.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import type {
  DdutCourseCatalogPageDto,
  DdutCourseCatalogQueryDto,
  DdutCourseDetailDto,
  DdutCourseRelationDto,
  DdutMetaDto,
} from './dto/ddut-api.dto.js';

const decimalOrNull = (value: Prisma.Decimal | null): string | null =>
  value === null ? null : toWireDecimal(value);

const meta = (): DdutMetaDto => ({
  apiVersion: 'v1',
  evaluatedAt: new Date().toISOString(),
});

@Injectable()
export class DdutCoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog(
    query: DdutCourseCatalogQueryDto,
  ): Promise<DdutCourseCatalogPageDto> {
    const where: Prisma.CourseWhereInput = {
      status: query.status ?? { not: CourseStatus.CANCELLED },
      ...(query.facultyCode && {
        ownerFaculty: {
          unitCode: { equals: query.facultyCode, mode: 'insensitive' },
        },
      }),
      ...(query.search && {
        OR: [
          { courseCode: { contains: query.search, mode: 'insensitive' } },
          { courseName: { contains: query.search, mode: 'insensitive' } },
          { englishName: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        select: {
          courseCode: true,
          courseName: true,
          englishName: true,
          credits: true,
          courseType: true,
          status: true,
          updatedAt: true,
          ownerFaculty: { select: { unitCode: true, unitName: true } },
          ownerGroup: { select: { groupCode: true, groupName: true } },
          syllabi: {
            where: {
              status: SyllabusStatus.PUBLISHED,
              revisionNumber: { not: null },
            },
            orderBy: { revisionNumber: 'desc' },
            take: 1,
            select: { revisionNumber: true },
          },
        },
        orderBy: { courseCode: 'asc' },
        ...toSkipTake(query),
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      meta: meta(),
      items: rows.map((row) => ({
        courseCode: row.courseCode,
        courseName: row.courseName,
        englishName: row.englishName,
        credits: toWireDecimal(row.credits),
        courseType: row.courseType,
        status: row.status,
        ownerFacultyCode: row.ownerFaculty.unitCode,
        ownerFacultyName: row.ownerFaculty.unitName,
        ownerGroupCode: row.ownerGroup?.groupCode ?? null,
        ownerGroupName: row.ownerGroup?.groupName ?? null,
        latestSyllabusRevision: row.syllabi[0]?.revisionNumber ?? null,
        updatedAt: row.updatedAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async courseDetail(courseCode: string): Promise<DdutCourseDetailDto> {
    const code = courseCode.trim();
    if (!code) throw new AppException(INTEGRATION_ERRORS.COURSE_NOT_FOUND);
    const row = await this.prisma.course.findFirst({
      where: {
        courseCode: { equals: code, mode: 'insensitive' },
        status: { not: CourseStatus.CANCELLED },
      },
      select: {
        courseCode: true,
        courseName: true,
        englishName: true,
        credits: true,
        courseType: true,
        status: true,
        updatedAt: true,
        ownerFaculty: { select: { unitCode: true, unitName: true } },
        ownerGroup: { select: { groupCode: true, groupName: true } },
        equivalenceGroup: { select: { groupCode: true } },
        syllabi: {
          where: {
            status: SyllabusStatus.PUBLISHED,
            revisionNumber: { not: null },
          },
          orderBy: { revisionNumber: 'desc' },
          take: 1,
          select: {
            revisionNumber: true,
            publishedAt: true,
            documentNumber: true,
            signedDate: true,
            courseDescription: true,
            englishDescription: true,
            objectives: true,
            teachingMethods: true,
            assessmentMethods: true,
            references: true,
            failingScore: true,
            effectiveSemester: { select: { semesterCode: true } },
            clos: {
              orderBy: [{ sortOrder: 'asc' }, { cloCode: 'asc' }],
              select: {
                cloCode: true,
                description: true,
                englishDescription: true,
                cognitiveLevel: true,
              },
            },
            assessmentComponents: {
              orderBy: { componentCode: 'asc' },
              select: {
                componentCode: true,
                componentName: true,
                weight: true,
                assessmentForm: true,
                isConditional: true,
                conditionThreshold: true,
                failingScore: true,
                mappings: {
                  select: { clo: { select: { cloCode: true } } },
                },
              },
            },
          },
        },
        relationsAsTarget: {
          orderBy: [{ relationType: 'asc' }, { sourceCourse: { courseCode: 'asc' } }],
          select: {
            relationType: true,
            minScore: true,
            sourceCourse: { select: { courseCode: true, courseName: true } },
          },
        },
        relationsAsSource: {
          where: { relationType: CourseRelationType.REPLACEMENT },
          orderBy: [{ targetCourse: { courseCode: 'asc' } }],
          select: {
            relationType: true,
            minScore: true,
            targetCourse: { select: { courseCode: true, courseName: true } },
          },
        },
      },
    });
    if (!row) throw new AppException(INTEGRATION_ERRORS.COURSE_NOT_FOUND);

    const published = row.syllabi[0] ?? null;
    const relations: DdutCourseRelationDto[] = [
      ...row.relationsAsTarget.map((rel) => ({
        relationType: rel.relationType,
        sourceCourseCode: rel.sourceCourse.courseCode,
        sourceCourseName: rel.sourceCourse.courseName,
        targetCourseCode: row.courseCode,
        targetCourseName: row.courseName,
        minScore: decimalOrNull(rel.minScore),
      })),
      ...row.relationsAsSource.map((rel) => ({
        relationType: rel.relationType,
        sourceCourseCode: row.courseCode,
        sourceCourseName: row.courseName,
        targetCourseCode: rel.targetCourse.courseCode,
        targetCourseName: rel.targetCourse.courseName,
        minScore: decimalOrNull(rel.minScore),
      })),
    ];

    return {
      meta: meta(),
      courseCode: row.courseCode,
      courseName: row.courseName,
      englishName: row.englishName,
      credits: toWireDecimal(row.credits),
      courseType: row.courseType,
      status: row.status,
      ownerFacultyCode: row.ownerFaculty.unitCode,
      ownerFacultyName: row.ownerFaculty.unitName,
      ownerGroupCode: row.ownerGroup?.groupCode ?? null,
      ownerGroupName: row.ownerGroup?.groupName ?? null,
      equivalenceGroupCode: row.equivalenceGroup?.groupCode ?? null,
      updatedAt: row.updatedAt.toISOString(),
      latestPublishedSyllabus: published
        ? {
            revisionNumber: published.revisionNumber!,
            publishedAt: published.publishedAt?.toISOString() ?? null,
            effectiveSemesterCode:
              published.effectiveSemester?.semesterCode ?? null,
            documentNumber: published.documentNumber,
            signedDate: published.signedDate?.toISOString().slice(0, 10) ?? null,
            courseDescription: published.courseDescription,
            englishDescription: published.englishDescription,
            objectives: published.objectives,
            teachingMethods: published.teachingMethods,
            assessmentMethods: published.assessmentMethods,
            references: published.references,
            failingScore: decimalOrNull(published.failingScore),
            clos: published.clos,
          }
        : null,
      gradingFormula: published
        ? published.assessmentComponents.map((component) => ({
            componentCode: component.componentCode,
            componentName: component.componentName,
            weight: toWireDecimal(component.weight),
            assessmentForm: component.assessmentForm,
            isConditional: component.isConditional,
            conditionThreshold: decimalOrNull(component.conditionThreshold),
            failingScore: decimalOrNull(component.failingScore),
            cloCodes: component.mappings
              .map((mapping) => mapping.clo.cloCode)
              .sort(),
          }))
        : [],
      relations,
    };
  }
}
