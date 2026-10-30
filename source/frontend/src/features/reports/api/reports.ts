import type { components } from '../../../shared/api/schema';
import { downloadFile, getJson, withQuery } from '../../../shared/api/client';

type Schemas = components['schemas'];
export type ProgramComparison = Schemas['ProgramComparisonDto'];
export type ComparisonCourse = Schemas['ComparisonCourseDto'];
export type CreditDistribution = Schemas['CreditDistributionDto'];
export type CreditBucket = Schemas['CreditBucketDto'];
export type ChangeRequestStatistics = Schemas['ChangeRequestStatisticsDto'];
export interface StatisticsQuery {
  from: string;
  to: string;
  programId?: string;
}

const REPORTS = '/reports';
const versionPath = (versionId: string) =>
  `${REPORTS}/versions/${encodeURIComponent(versionId)}`;

export const fetchProgramComparison = (left: string, right: string) =>
  getJson<ProgramComparison>(
    withQuery(`${REPORTS}/program-comparison`, {
      leftVersionId: left,
      rightVersionId: right,
    }),
  );
export const downloadProgramComparison = (left: string, right: string) =>
  downloadFile(
    withQuery(`${REPORTS}/program-comparison/export`, {
      leftVersionId: left,
      rightVersionId: right,
    }),
    'so-sanh-chuong-trinh.xlsx',
  );
export const fetchCreditDistribution = (versionId: string) =>
  getJson<CreditDistribution>(
    withQuery(`${REPORTS}/credit-distribution`, { versionId }),
  );
export const downloadCreditDistribution = (versionId: string) =>
  downloadFile(
    withQuery(`${REPORTS}/credit-distribution/export`, { versionId }),
    'phan-bo-tin-chi.xlsx',
  );
export const downloadMatrices = (versionId: string) =>
  downloadFile(`${versionPath(versionId)}/matrices/export`, 'ma-tran.xlsx');
export const downloadAccreditation = (versionId: string) =>
  downloadFile(
    `${versionPath(versionId)}/accreditation/export`,
    'ho-so-kiem-dinh.xlsx',
  );
export const fetchChangeRequestStatistics = (query: StatisticsQuery) =>
  getJson<ChangeRequestStatistics>(
    withQuery(`${REPORTS}/change-request-statistics`, { ...query }),
  );
