import { getJson, sendJson, withQuery } from '../../../shared/api/client';
import type { components, operations } from '../../../shared/api/schema';

export type MajorStatus = components['schemas']['MajorStatus'];
export type MajorItem = components['schemas']['MajorDto'];
export type MajorPage = components['schemas']['MajorPageDto'];
export type CreateMajorRequest = components['schemas']['CreateMajorDto'];
export type UpdateMajorRequest = components['schemas']['UpdateMajorDto'];
export type MajorQuery = NonNullable<
  operations['MajorsController_list']['parameters']['query']
>;

export type MajorItemExtended = MajorItem & {
  activeProgramCount?: number;
  studentCount?: number;
};

export type MajorPageExtended = Omit<MajorPage, 'items'> & {
  items: MajorItemExtended[];
};

export type MajorQueryExtended = MajorQuery & {
  hasPrograms?: boolean;
};

export interface MajorOverviewStats {
  totalPrograms: number;
  activePrograms: number;
  draftPrograms: number;
  inactivePrograms: number;
  releasedVersions: number;
  totalStudents: number;
  totalCourses: number;
  publishedSyllabi: number;
  totalPlos: number;
  subjectGroupCount: number;
}

export interface MajorOverviewDirector {
  id: string;
  userCode: string;
  fullName: string;
}

export interface MajorOverviewProgram {
  id: string;
  programCode: string;
  programName: string;
  degreeLevel: 'BACHELOR' | 'ENGINEER' | 'MASTER' | 'DOCTORATE';
  status: 'ACTIVE' | 'INACTIVE';
  faculty: { id: string; unitCode: string; unitName: string };
  hasReleasedVersion: boolean;
  directors: MajorOverviewDirector[];
  latestVersionId: string | null;
  latestVersionNumber: string | null;
  latestVersionStatus: 'DRAFT' | 'PENDING' | 'ACTIVE' | 'HISTORICAL' | null;
  totalCredits: number | null;
  releasedVersionCount: number;
  trackCount: number;
  ploCount: number;
  courseCount: number;
  studentCount: number;
  cohorts: string[];
}

export interface MajorOverviewCourse {
  id: string;
  courseCode: string;
  courseName: string;
  credits: number;
  courseType:
    | 'THEORY'
    | 'PRACTICE'
    | 'LAB'
    | 'PROJECT'
    | 'CAPSTONE'
    | 'INTERNSHIP'
    | 'CONDITIONAL';
  programCount: number;
  hasPublishedSyllabus: boolean;
  ownerGroup: { id: string; groupCode: string; groupName: string } | null;
}

export interface MajorOverviewSubjectGroup {
  id: string;
  groupCode: string;
  groupName: string;
  status: 'ACTIVE' | 'INACTIVE';
  memberCount: number;
  courseCount: number;
}

export interface MajorOverviewCohortBreakdown {
  programId: string;
  programCode: string;
  programName: string;
  cohortId: string;
  cohortCode: string;
  studentCount: number;
}

export interface MajorOverview {
  major: MajorItemExtended;
  stats: MajorOverviewStats;
  programs: MajorOverviewProgram[];
  courses: MajorOverviewCourse[];
  subjectGroups: MajorOverviewSubjectGroup[];
  cohortBreakdown: MajorOverviewCohortBreakdown[];
}

export const MAJORS_PATH = '/majors';

export const fetchMajors = (query: MajorQueryExtended) =>
  getJson<MajorPageExtended>(withQuery(MAJORS_PATH, { ...query }));

export const fetchMajorOverview = (majorId: string) =>
  getJson<MajorOverview>(
    `${MAJORS_PATH}/${encodeURIComponent(majorId)}/overview`,
  );

export const createMajor = (body: CreateMajorRequest) =>
  sendJson<MajorItem>('POST', MAJORS_PATH, body);

export const updateMajor = (majorId: string, body: UpdateMajorRequest) =>
  sendJson<MajorItem>(
    'PATCH',
    `${MAJORS_PATH}/${encodeURIComponent(majorId)}`,
    body,
  );

export const setMajorStatus = (majorId: string, status: MajorStatus) =>
  sendJson<MajorItem>(
    'PATCH',
    `${MAJORS_PATH}/${encodeURIComponent(majorId)}/status`,
    { status },
  );
