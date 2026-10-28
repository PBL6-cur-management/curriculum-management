import type {
  AssessmentComponent,
  CourseSyllabus,
  GradeFormula,
  Syllabus,
  Clo,
  SyllabusAttachment,
  WeeklyContent,
} from './api/syllabi';

export const RULES = {
  maxBytes: 20 * 1024 * 1024,
  fileTypes: [
    'PDF',
    'DOCX',
    'XLSX',
    'IMAGE',
  ] as CourseSyllabus['attachmentRules']['fileTypes'],
};

export function week(
  id: string,
  sortOrder: number,
  patch: Partial<WeeklyContent> = {},
): WeeklyContent {
  return {
    id,
    weekLabel: `Tuần ${sortOrder}`,
    sortOrder,
    content: `<p>Nội dung ${id}</p>`,
    teachingActivities: null,
    cloIds: [],
    ...patch,
  };
}

export function clo(
  id: string,
  sortOrder: number,
  patch: Partial<Clo> = {},
): Clo {
  return {
    id,
    cloCode: `CLO${sortOrder}`,
    description: `Mô tả ${id}`,
    englishDescription: null,
    cognitiveLevel: null,
    sortOrder,
    linkedPrograms: [],
    assessmentLinkCount: 0,
    ...patch,
  };
}

export function assessmentComponent(
  id: string,
  patch: Partial<AssessmentComponent> = {},
): AssessmentComponent {
  return {
    id,
    componentCode: id.toUpperCase(),
    componentName: `Thành phần ${id}`,
    weight: '100',
    assessmentForm: null,
    isConditional: false,
    conditionThreshold: null,
    failingScore: null,
    mappings: [],
    ...patch,
  };
}

export function gradeFormula(
  components: AssessmentComponent[],
  patch: Partial<GradeFormula> = {},
): GradeFormula {
  return {
    failingScore: null,
    totalWeight: '100',
    components,
    warnings: [],
    ...patch,
  };
}

export function attachment(
  patch: Partial<SyllabusAttachment> = {},
): SyllabusAttachment {
  return {
    id: 'a1',
    fileName: 'Đề cương ký.pdf',
    fileType: 'PDF',
    sizeBytes: 2_500_000,
    uploadedBy: { id: 'u1', fullName: 'Giảng viên A' },
    recordedAt: '2026-10-19T03:00:00.000Z',
    canDelete: true,
    ...patch,
  };
}

export function syllabus(patch: Partial<Syllabus> = {}): Syllabus {
  return {
    id: 's1',
    revisionNumber: 1,
    status: 'DRAFT',
    sourceRequest: null,
    courseDescription: '<p>Mô tả tiếng Việt</p>',
    englishDescription: null,
    objectives: null,
    teachingMethods: null,
    assessmentMethods: null,
    references: null,
    publishedAt: null,
    updatedAt: '2026-10-19T03:00:00.000Z',
    weeklyContents: [],
    attachments: [],
    clos: [],
    gradingFormula: {
      failingScore: null,
      totalWeight: '0',
      components: [],
      warnings: [],
    },
    ...patch,
  };
}

export function courseSyllabus(
  patch: Partial<CourseSyllabus> = {},
): CourseSyllabus {
  return {
    course: {
      id: 'c1',
      courseCode: 'IT001',
      courseName: 'Nhập môn lập trình',
      englishName: null,
      credits: '3',
      status: 'ACTIVE',
    },
    programsUsing: [
      {
        programId: 'p1',
        programCode: 'CNTT',
        programName: 'Công nghệ thông tin',
        versionLabel: null,
        plannedSemester: 1,
      },
      {
        programId: 'p2',
        programCode: 'KTPM',
        programName: 'Kỹ thuật phần mềm',
        versionLabel: '1.0',
        plannedSemester: 2,
      },
    ],
    published: null,
    draft: syllabus(),
    canCreate: false,
    canEditClos: true,
    editPath: 'DIRECT',
    gradingEditPath: null,
    canEditGradingFormula: false,
    attachmentRules: RULES,
    canAttachToPublished: false,
    version: null,
    ...patch,
  };
}

export const ME = {
  id: 'u1',
  username: 'giangvien',
  userCode: 'GV',
  fullName: 'Giảng viên A',
  email: null,
  mustChangePassword: false,
  orgUnit: null,
  roles: [],
  permissions: [
    'course.view',
    'syllabus.view',
    'syllabus.edit',
    'changeRequest.create',
  ],
};
