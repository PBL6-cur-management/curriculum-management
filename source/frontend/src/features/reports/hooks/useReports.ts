import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  fetchChangeRequestStatistics,
  fetchCreditDistribution,
  fetchProgramComparison,
  type StatisticsQuery,
} from '../api/reports';

export const REPORT_KEYS = {
  comparison: (left: string, right: string) =>
    ['reports', 'comparison', left, right] as const,
  distribution: (versionId: string) =>
    ['reports', 'distribution', versionId] as const,
  statistics: (query: StatisticsQuery) =>
    ['reports', 'statistics', query] as const,
};

export function useProgramComparison(left: string, right: string) {
  return useQuery({
    queryKey: REPORT_KEYS.comparison(left, right),
    queryFn: () => fetchProgramComparison(left, right),
    enabled: Boolean(left && right),
    retry: false,
  });
}

export function useCreditDistribution(versionId: string) {
  return useQuery({
    queryKey: REPORT_KEYS.distribution(versionId),
    queryFn: () => fetchCreditDistribution(versionId),
    enabled: Boolean(versionId),
    retry: false,
  });
}

export function useChangeRequestStatistics(query: StatisticsQuery) {
  return useQuery({
    queryKey: REPORT_KEYS.statistics(query),
    queryFn: () => fetchChangeRequestStatistics(query),
    placeholderData: keepPreviousData,
    retry: false,
  });
}
