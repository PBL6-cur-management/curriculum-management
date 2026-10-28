import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import {
  toAcademicResultDto,
  toEnrollmentDto,
  toIssuedVersionDto,
  toStudentDetailDto,
  toStudentSummaryDto,
  type EnrollmentRow,
  type ResultRow,
} from './students.mapper.js';

const semester = {
  id: 's1',
  semesterCode: '2025-1',
  academicYear: '2025-2026',
  termInYear: 1,
  startDate: new Date('2025-09-01T00:00:00.000Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
};
const cohort = { id: 'c1', cohortCode: 'K25', intakeYear: 2025 };
const stamp = new Date('2026-01-02T03:04:05.678Z');

const result = (over: Partial<ResultRow> = {}): ResultRow =>
  ({
    id: 'r1',
    studentId: 'st',
    course: { id: 'co', courseCode: 'IT101', courseName: 'Nhập môn' },
    semester,
    score10: new Prisma.Decimal('8.50'),
    score4: new Prisma.Decimal('3.50'),
    letterGrade: 'B+',
    status: 'PASSED',
    dataSource: 'EXCEL',
    revision: 2,
    updatedAt: stamp,
    ...over,
  }) as ResultRow;

describe('students mapper', () => {
  it('serialises result scores as exact decimal strings and keeps nulls explicit', () => {
    const dto = toAcademicResultDto(result());
    expect(dto.score10).toBe('8.5');
    expect(dto.score4).toBe('3.5');
    const empty = toAcademicResultDto(
      result({ score10: null, score4: null, letterGrade: null }),
    );
    expect(empty).toMatchObject({
      score10: null,
      score4: null,
      letterGrade: null,
    });
  });

  it('returns exactly the documented result keys', () => {
    expect(Object.keys(toAcademicResultDto(result())).sort()).toEqual(
      [
        'course',
        'dataSource',
        'id',
        'letterGrade',
        'revision',
        'score10',
        'score4',
        'semester',
        'status',
        'studentId',
        'updatedAt',
      ].sort(),
    );
  });

  it('never leaks account or storage fields through the student summary', () => {
    const dto = toStudentSummaryDto({
      id: 'st',
      studentCode: 'SV001',
      fullName: 'Nguyễn Văn A',
      cohort,
      cohortId: 'c1',
      major: 'IT',
      status: 'STUDYING',
      dataSource: 'EXCEL',
      userId: 'u1',
      updatedAt: stamp,
      createdAt: stamp,
    } as never);
    expect(Object.keys(dto).sort()).toEqual(
      [
        'cohort',
        'dataSource',
        'fullName',
        'id',
        'major',
        'status',
        'studentCode',
        'updatedAt',
      ].sort(),
    );
    expect(dto.updatedAt).toBe(stamp.toISOString());
  });

  it('adds the detail-only fields on top of the summary', () => {
    const dto = toStudentDetailDto(
      {
        id: 'st',
        studentCode: 'SV001',
        fullName: 'A',
        cohort,
        major: 'IT',
        status: 'STUDYING',
        dataSource: 'SCHOOL_DB',
        userId: null,
        updatedAt: stamp,
        admissionSemester: semester,
        statusSemester: semester,
      } as never,
      { enrollments: [], canManageEnrollments: false, enrollmentWarnings: [] },
    );
    expect(dto.userId).toBeNull();
    expect(dto.admissionSemester.startDate).toBe('2025-09-01');
    expect(dto.canManageEnrollments).toBe(false);
  });

  it('labels an enrollment with its own pinned version name and null end', () => {
    const row = {
      id: 'e1',
      studentId: 'st',
      program: { id: 'p1', programCode: 'KTPM' },
      cohort,
      appliedVersion: {
        id: 'v1',
        versionNumber: '1.0',
        status: 'ACTIVE',
        programName: 'Kỹ thuật phần mềm',
      },
      admissionVersionId: 'v1',
      cohortAssignmentId: null,
      fromSemester: semester,
      untilSemester: null,
      previousEnrollmentId: null,
      enrollmentType: 'PRIMARY',
      isException: true,
      basisDecision: 'QĐ 12',
      status: 'ACTIVE',
      createdAt: stamp,
      updatedAt: stamp,
    } as unknown as EnrollmentRow;
    const dto = toEnrollmentDto(row);
    expect(dto.program).toEqual({
      id: 'p1',
      programCode: 'KTPM',
      programName: 'Kỹ thuật phần mềm',
    });
    expect(dto.untilSemester).toBeNull();
    expect(dto.cohortAssignmentId).toBeNull();
  });

  it('refuses to show a draft or unnumbered version as issued', () => {
    expect(() =>
      toIssuedVersionDto({ id: 'v', versionNumber: '1', status: 'DRAFT' }),
    ).toThrowError();
    expect(() =>
      toIssuedVersionDto({ id: 'v', versionNumber: null, status: 'ACTIVE' }),
    ).toThrowError();
    expect(
      toIssuedVersionDto({ id: 'v', versionNumber: '1', status: 'PENDING' }),
    ).toEqual({ id: 'v', versionNumber: '1', status: 'PENDING' });
  });
});
