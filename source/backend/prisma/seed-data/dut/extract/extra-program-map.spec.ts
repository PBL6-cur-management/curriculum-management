import { describe, expect, it } from 'vitest';
import {
  CourseRelationType,
  DegreeLevel,
} from '../../../../src/generated/prisma/client.js';
import type { DutVersion } from './extract-frames.js';
import {
  buildTrackShowcase,
  classifyExtraFrame,
  EXTRA_FACULTY_CODES,
  groupExtraFrames,
  inferGraduateSemesterCode,
} from './extra-program-map.js';

function majorRow(
  overrides: Partial<{
    MaNganh: string;
    TenNganh: string;
    Kyhieu: string;
    SoHK: string;
    CapDT: string;
    LoaiCTDT: string;
    KyBDau: string;
    InUse: string;
  }> = {},
) {
  return {
    MaNganh: '1064020',
    TenNganh: 'Kỹ thuật điện tử - viễn thông K2020',
    Kyhieu: '7520207',
    SoHK: '8',
    CapDT: 'CD01',
    LoaiCTDT: 'CN',
    KyBDau: '2010',
    InUse: '1',
    ...overrides,
  };
}

describe('inferGraduateSemesterCode', () => {
  it('infers chronological semester codes from K-cohort labels including underscore suffixes', () => {
    expect(inferGraduateSemesterCode('Khoa học máy tính (K44_NC)')).toBe(
      '2210',
    );
    expect(inferGraduateSemesterCode('Khoa học máy tính (K46_ƯD)')).toBe(
      '2310',
    );
    expect(inferGraduateSemesterCode('Kỹ thuật điện tử (K48_ƯD)')).toBe('2410');
    expect(inferGraduateSemesterCode('Kỹ thuật điện tử (K49_ƯD)')).toBe('2420');
    expect(inferGraduateSemesterCode('Kiến trúc (K50_NC)')).toBe('2510');
    expect(inferGraduateSemesterCode('Kiến trúc (K51_ƯD)')).toBe('2520');
    expect(inferGraduateSemesterCode('Kiến trúc (K52_NC)')).toBe('2610');
    expect(inferGraduateSemesterCode('Khoa học máy tính')).toBeNull();
  });
});

describe('classifyExtraFrame & groupExtraFrames', () => {
  it('classifies DTVT, CTTT, KTMT, Architecture, and graduate frames into clean program codes', () => {
    const cases = [
      {
        row: majorRow({
          MaNganh: '1064035',
          TenNganh: 'Vi điện tử - thiết kế vi mạch K2024',
          Kyhieu: '7520207A',
          SoHK: '9',
          LoaiCTDT: 'KS',
          KyBDau: '2410',
        }),
        expectedCode: 'DTVT-KS-VIMACH',
        expectedFaculty: EXTRA_FACULTY_CODES.DTVT,
        expectedDegree: DegreeLevel.ENGINEER,
      },
      {
        row: majorRow({
          MaNganh: '1064055',
          TenNganh: 'Kỹ sư tài năng KT Điện tử-VT K2026',
          Kyhieu: '7520207TN',
          SoHK: '10',
          LoaiCTDT: '',
          KyBDau: '2610',
        }),
        expectedCode: 'DTVT-KS-KSTN',
        expectedFaculty: EXTRA_FACULTY_CODES.DTVT,
        expectedDegree: DegreeLevel.ENGINEER,
      },
      {
        row: majorRow({
          MaNganh: '1064037',
          TenNganh: 'Kỹ thuật điện tử - viễn thông K2020CLC_Kỹ sư_KTDT',
          Kyhieu: '7520207',
          SoHK: '10',
          LoaiCTDT: 'KS',
          KyBDau: '2010',
        }),
        expectedCode: 'DTVT-KS-CLC-KTDT',
        expectedFaculty: EXTRA_FACULTY_CODES.DTVT,
        expectedDegree: DegreeLevel.ENGINEER,
      },
      {
        row: majorRow({
          MaNganh: '1231025',
          TenNganh: 'CTTT - Ðiện tử - viễn thông K2020 - ĐT',
          Kyhieu: '7520207VM',
          SoHK: '8',
          LoaiCTDT: 'CN',
          KyBDau: '2010',
        }),
        expectedCode: 'DTVT-CTTT-CN-DT',
        expectedFaculty: EXTRA_FACULTY_CODES.DTVT,
        expectedDegree: DegreeLevel.BACHELOR,
      },
      {
        row: majorRow({
          MaNganh: '1065001',
          TenNganh: 'Kỹ thuật máy tính K2020',
          Kyhieu: '7480106',
          SoHK: '8',
          LoaiCTDT: 'CN',
          KyBDau: '2010',
        }),
        expectedCode: 'KTMT-CN',
        expectedFaculty: EXTRA_FACULTY_CODES.DTVT,
        expectedDegree: DegreeLevel.BACHELOR,
      },
      {
        row: majorRow({
          MaNganh: '1065013',
          TenNganh: 'Kỹ thuật máy tính K2026',
          Kyhieu: '7480106',
          SoHK: '9',
          LoaiCTDT: '',
          KyBDau: '2610',
        }),
        expectedCode: 'KTMT-KS-K26',
        expectedFaculty: EXTRA_FACULTY_CODES.DTVT,
        expectedDegree: DegreeLevel.ENGINEER,
      },
      {
        row: majorRow({
          MaNganh: '1211009',
          TenNganh: 'Kiến trúc K2020CLC',
          Kyhieu: '7580101',
          SoHK: '10',
          LoaiCTDT: 'KS',
          KyBDau: '2010',
        }),
        expectedCode: 'KTR-KS-CLC',
        expectedFaculty: EXTRA_FACULTY_CODES.KTR,
        expectedDegree: DegreeLevel.ENGINEER,
      },
      {
        row: majorRow({
          MaNganh: '1212014',
          TenNganh: 'Kiến trúc (K52_ƯD)',
          Kyhieu: '8580101',
          SoHK: '4',
          CapDT: 'CD02',
          LoaiCTDT: '',
          KyBDau: '',
        }),
        expectedCode: 'KTR-THS-UD',
        expectedFaculty: EXTRA_FACULTY_CODES.KTR,
        expectedDegree: DegreeLevel.MASTER,
      },
      {
        row: majorRow({
          MaNganh: '1022023',
          TenNganh: 'Khoa học máy tính (K52_NC)',
          Kyhieu: '8480101',
          SoHK: '4',
          CapDT: 'CD02',
          LoaiCTDT: '',
          KyBDau: '',
        }),
        expectedCode: 'CNTT-THS-NC',
        expectedFaculty: EXTRA_FACULTY_CODES.CNTT,
        expectedDegree: DegreeLevel.MASTER,
      },
    ];

    for (const c of cases) {
      const assigned = classifyExtraFrame(c.row, 50);
      expect(assigned).not.toBeNull();
      expect(assigned!.programCode).toBe(c.expectedCode);
      expect(assigned!.facultyUnitCode).toBe(c.expectedFaculty);
      expect(assigned!.degreeLevel).toBe(c.expectedDegree);
    }
  });

  it('skips 0-row frames, nouse frames, pre-2020 undergrad frames, and deduplicates same-semester collisions', () => {
    const majors = [
      majorRow({
        MaNganh: '1231008',
        TenNganh: 'CTTT - Ðiện tử - viễn thông K2023',
        KyBDau: '2310',
      }),
      majorRow({
        MaNganh: '1231029',
        TenNganh: 'CTTT - Ðiện tử - viễn thông K2023',
        KyBDau: '2310',
      }),
      majorRow({
        MaNganh: '1231041',
        TenNganh: 'CTTT - Ðiện tử - viễn thông K2023_Kỹ sư ĐT_nouse',
        LoaiCTDT: 'KS',
        SoHK: '10',
        KyBDau: '2310',
      }),
      majorRow({
        MaNganh: '1064052',
        TenNganh: 'Kỹ thuật điện tử - viễn thông K2025',
        KyBDau: '2510',
      }),
      majorRow({
        MaNganh: '1064008',
        TenNganh: 'Kỹ thuật điện tử và viễn thông K2017',
        KyBDau: '1710',
      }),
    ];
    const rowCounts = new Map([
      ['1231008', 70],
      ['1231029', 70],
      ['1231041', 127],
      ['1064052', 0],
      ['1064008', 83],
    ]);

    const result = groupExtraFrames(majors, rowCounts);
    expect(result.programs).toHaveLength(1);
    expect(result.programs[0].programCode).toBe('DTVT-CTTT-CN');
    expect(result.programs[0].frames.map((f) => f.frameCode)).toEqual([
      '1231029',
    ]);
    expect(result.deduplicatedFrames).toEqual(['1231008']);
  });
});

describe('buildTrackShowcase', () => {
  function makeVersion(
    frameCode: string,
    extraItems: DutVersion['items'],
    extraGroups: DutVersion['groups'] = [],
    requisites: DutVersion['requisites'] = [],
  ): DutVersion {
    return {
      frameCode,
      programName: `CNTT K2023 ${frameCode}`,
      majorCode: '7480201',
      majorName: 'Công nghệ Thông tin',
      semesterCount: 8,
      totalCredits: '130',
      compulsoryCredits: '124',
      electiveCredits: '6',
      startSemesterCode: '2310',
      cohortCode: 'K2023',
      groups: [
        {
          groupCode: 'HK1-TC1',
          groupName: 'Tự chọn chung HK1',
          minCourses: null,
          minCredits: '2',
        },
        ...extraGroups,
      ],
      items: [
        {
          courseCode: 'CORE1',
          plannedSemester: 1,
          sortOrder: 1,
          isElective: false,
          groupCode: null,
          htDa: false,
          tqDa: false,
          note: null,
        },
        {
          courseCode: 'CORE2',
          plannedSemester: 2,
          sortOrder: 1,
          isElective: false,
          groupCode: null,
          htDa: false,
          tqDa: false,
          note: null,
        },
        {
          courseCode: 'CE1',
          plannedSemester: 1,
          sortOrder: 2,
          isElective: true,
          groupCode: 'HK1-TC1',
          htDa: false,
          tqDa: false,
          note: null,
        },
        {
          courseCode: 'CE2',
          plannedSemester: 1,
          sortOrder: 3,
          isElective: true,
          groupCode: 'HK1-TC1',
          htDa: false,
          tqDa: false,
          note: null,
        },
        ...extraItems,
      ],
      requisites: [
        {
          targetCourseCode: 'CORE2',
          sourceCourseCode: 'CORE1',
          relationType: CourseRelationType.PREREQUISITE,
        },
        ...requisites,
      ],
    };
  }

  it('computes exact course intersection, track differences, unique group codes, and track credits', () => {
    const credits = new Map([
      ['CORE1', '3'],
      ['CORE2', '3'],
      ['CE1', '2'],
      ['CE2', '2'],
      ['SE1', '4'],
      ['SE_E1', '2'],
      ['SE_E2', '2'],
      ['SEC1', '3'],
      ['SEC2', '2'],
      ['SEC_E1', '3'],
    ]);

    const v1 = makeVersion(
      '1024034',
      [
        {
          courseCode: 'SE1',
          plannedSemester: 6,
          sortOrder: 1,
          isElective: false,
          groupCode: null,
          htDa: false,
          tqDa: false,
          note: null,
        },
        {
          courseCode: 'SE_E1',
          plannedSemester: 7,
          sortOrder: 1,
          isElective: true,
          groupCode: 'HK7-TC1',
          htDa: false,
          tqDa: false,
          note: null,
        },
        {
          courseCode: 'SE_E2',
          plannedSemester: 7,
          sortOrder: 2,
          isElective: true,
          groupCode: 'HK7-TC1',
          htDa: false,
          tqDa: false,
          note: null,
        },
      ],
      [
        {
          groupCode: 'HK7-TC1',
          groupName: 'Tự chọn HK7',
          minCourses: 1,
          minCredits: null,
        },
      ],
      [
        {
          targetCourseCode: 'SE1',
          sourceCourseCode: 'CORE2',
          relationType: CourseRelationType.PRIOR,
        },
      ],
    );

    const v2 = makeVersion(
      '1024035',
      [
        {
          courseCode: 'SEC1',
          plannedSemester: 6,
          sortOrder: 1,
          isElective: false,
          groupCode: null,
          htDa: false,
          tqDa: false,
          note: null,
        },
        {
          courseCode: 'SEC2',
          plannedSemester: 6,
          sortOrder: 2,
          isElective: false,
          groupCode: null,
          htDa: false,
          tqDa: false,
          note: null,
        },
        {
          courseCode: 'SEC_E1',
          plannedSemester: 7,
          sortOrder: 1,
          isElective: true,
          groupCode: 'HK7-TC1',
          htDa: false,
          tqDa: false,
          note: null,
        },
      ],
      [
        {
          groupCode: 'HK7-TC1',
          groupName: 'Tự chọn HK7',
          minCourses: null,
          minCredits: '3',
        },
      ],
      [
        {
          targetCourseCode: 'SEC2',
          sourceCourseCode: 'SEC1',
          relationType: CourseRelationType.PREREQUISITE,
        },
      ],
    );

    const showcase = buildTrackShowcase(
      [
        {
          trackCode: 'CNPM',
          trackName: 'Công nghệ phần mềm',
          englishName: 'Software Engineering',
          description: 'SE',
          sortOrder: 1,
          version: v1,
        },
        {
          trackCode: 'ATTT',
          trackName: 'An toàn thông tin',
          englishName: 'Information Security',
          description: 'Sec',
          sortOrder: 2,
          version: v2,
        },
      ],
      credits,
    );

    expect(showcase.programCode).toBe('CNTT-CN-DH');
    expect(showcase.commonItems.map((i) => i.courseCode)).toEqual([
      'CORE1',
      'CORE2',
      'CE1',
      'CE2',
    ]);
    expect(showcase.commonGroups.map((g) => g.groupCode)).toEqual(['HK1-TC1']);
    expect(showcase.commonRequisites).toHaveLength(1);

    const [cnpm, attt] = showcase.tracks;
    expect(cnpm.items.map((i) => i.courseCode)).toEqual([
      'SE1',
      'SE_E1',
      'SE_E2',
    ]);
    expect(cnpm.groups.map((g) => g.groupCode)).toEqual(['CNPM-HK7-TC1']);
    expect(cnpm.compulsoryCredits).toBe('4');
    expect(cnpm.electiveCredits).toBe('2');
    expect(cnpm.requisites).toEqual([
      {
        targetCourseCode: 'SE1',
        sourceCourseCode: 'CORE2',
        relationType: CourseRelationType.PRIOR,
      },
    ]);

    expect(attt.items.map((i) => i.courseCode)).toEqual([
      'SEC1',
      'SEC2',
      'SEC_E1',
    ]);
    expect(attt.groups.map((g) => g.groupCode)).toEqual(['ATTT-HK7-TC1']);
    expect(attt.compulsoryCredits).toBe('5');
    expect(attt.electiveCredits).toBe('3');
    expect(attt.requisites).toEqual([
      {
        targetCourseCode: 'SEC2',
        sourceCourseCode: 'SEC1',
        relationType: CourseRelationType.PREREQUISITE,
      },
    ]);
  });
});
