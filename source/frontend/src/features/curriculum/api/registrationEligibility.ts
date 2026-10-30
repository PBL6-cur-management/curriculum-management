import { getJson, withQuery } from '../../../shared/api/client';
import type { components } from '../../../shared/api/schema';

export type RegistrationEligibility =
  components['schemas']['RegistrationEligibilityDto'];
export type EligibilityItem = components['schemas']['EligibilityItemDto'];
export type EligibilityReason = components['schemas']['EligibilityReasonDto'];
export type EligibilityStudentPage =
  components['schemas']['EligibilityStudentPageDto'];
export interface EligibilityLookup {
  studentId: string;
  programId: string;
  semesterId: string;
}
export interface EligibilityStudentQuery {
  programId: string;
  semesterId: string;
  q?: string;
  page: number;
  pageSize: number;
}
export const fetchRegistrationEligibility = (
  lookup: EligibilityLookup,
): Promise<RegistrationEligibility> =>
  getJson(
    withQuery(
      `/students/${encodeURIComponent(lookup.studentId)}/registration-eligibility`,
      { programId: lookup.programId, semesterId: lookup.semesterId },
    ),
  );
export const fetchEligibilityStudents = (
  query: EligibilityStudentQuery,
): Promise<EligibilityStudentPage> =>
  getJson(
    withQuery(
      `/programs/${encodeURIComponent(query.programId)}/registration-eligibility/students`,
      {
        semesterId: query.semesterId,
        q: query.q,
        page: query.page,
        pageSize: query.pageSize,
      },
    ),
  );
