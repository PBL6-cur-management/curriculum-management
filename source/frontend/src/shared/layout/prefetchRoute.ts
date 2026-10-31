// Tải trước chunk của trang khi hover mục menu, để chuyển trang không phải chờ tải mã.
import { ROUTES } from '../../routes';

const LOADERS: Record<string, () => Promise<unknown>> = {
  [ROUTES.notifications]: () =>
    import('../../features/notifications/pages/NotificationsPage'),
  [ROUTES.approvalQueue]: () =>
    import('../../features/change-requests/pages/ApprovalQueuePage'),
  [ROUTES.approvalDelegations]: () =>
    import('../../features/approval-delegations/pages/ApprovalDelegationsPage'),
  [ROUTES.changeRequests]: () =>
    import('../../features/change-requests/pages/ChangeRequestListPage'),
  [ROUTES.programs]: () =>
    import('../../features/programs/pages/ProgramListPage'),
  [ROUTES.courses]: () => import('../../features/courses/pages/CourseListPage'),
  [ROUTES.equivalenceGroups]: () =>
    import('../../features/equivalence-groups/pages/EquivalenceGroupsPage'),
  [ROUTES.semesters]: () =>
    import('../../features/releases/pages/SemestersPage'),
  [ROUTES.students]: () =>
    import('../../features/students/pages/StudentListPage'),
  [ROUTES.graduationBatches]: () =>
    import('../../features/graduation/pages/GraduationBatchesPage'),
  [ROUTES.graduation]: () =>
    import('../../features/graduation/pages/GraduationReviewPage'),
  [ROUTES.imports]: () => import('../../features/imports/pages/ImportPage'),
  [ROUTES.importHistory]: () =>
    import('../../features/imports/pages/ImportHistoryPage'),
  [ROUTES.reportComparison]: () =>
    import('../../features/reports/pages/ProgramComparisonPage'),
  [ROUTES.reportCredits]: () =>
    import('../../features/reports/pages/CreditDistributionPage'),
  [ROUTES.reportAccreditation]: () =>
    import('../../features/reports/pages/AccreditationExportPage'),
  [ROUTES.reportStatistics]: () =>
    import('../../features/reports/pages/ChangeRequestStatisticsPage'),
  [ROUTES.integrationClients]: () =>
    import('../../features/integration-clients/pages/IntegrationClientsPage'),
  [ROUTES.schoolSync]: () =>
    import('../../features/school-db-sync/pages/SchoolSyncSettingsPage'),
  [ROUTES.subjectGroups]: () =>
    import('../../features/subject-groups/pages/SubjectGroupListPage'),
  [ROUTES.orgUnits]: () =>
    import('../../features/org-units/pages/OrgUnitTreePage'),
  [ROUTES.users]: () => import('../../features/users/pages/UserListPage'),
  [ROUTES.permissionMatrix]: () =>
    import('../../features/permissions/pages/PermissionMatrixPage'),
  [ROUTES.health]: () => import('../../features/health/pages/HealthPage'),
};

const started = new Set<string>();

export function prefetchRoute(path: string): void {
  const load = LOADERS[path];
  if (!load || started.has(path)) return;
  started.add(path);
  void load().catch(() => started.delete(path));
}
