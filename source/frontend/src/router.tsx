import { lazy } from 'react';
import { RequireStudentStaff } from './features/students/components/RequireStudentStaff';
import { RequireGraduationStaff } from './features/graduation/components/RequireGraduationStaff';
import { createBrowserRouter } from 'react-router';
import { LoginPage } from './features/auth/pages/LoginPage';
import { ROUTES } from './routes';
import { RequireAuth } from './shared/auth/RequireAuth';
import { AppLayout } from './shared/layout/AppLayout';
import { StudentLayout } from './features/student-portal/components/StudentLayout';
import {
  HomeGate,
  RequireStudent,
} from './features/student-portal/components/HomeGate';
import { RequireAnyPermission } from './shared/auth/RequireAnyPermission';
import { RequirePermission } from './shared/auth/RequirePermission';
import { PERMISSIONS } from './shared/auth/permissions';

const GraduationReviewPage = lazy(() =>
  import('./features/graduation/pages/GraduationReviewPage').then((module) => ({
    default: module.GraduationReviewPage,
  })),
);
const GraduationAuditPage = lazy(() =>
  import('./features/graduation/pages/GraduationAuditPage').then((module) => ({
    default: module.GraduationAuditPage,
  })),
);
const GraduationBatchesPage = lazy(() =>
  import('./features/graduation/pages/GraduationBatchesPage').then(
    (module) => ({ default: module.GraduationBatchesPage }),
  ),
);
const GraduationBatchPage = lazy(() =>
  import('./features/graduation/pages/GraduationBatchPage').then((module) => ({
    default: module.GraduationBatchPage,
  })),
);

const UserListPage = lazy(() =>
  import('./features/users/pages/UserListPage').then((module) => ({
    default: module.UserListPage,
  })),
);
const UserDetailPage = lazy(() =>
  import('./features/users/pages/UserDetailPage').then((module) => ({
    default: module.UserDetailPage,
  })),
);
const PermissionMatrixPage = lazy(() =>
  import('./features/permissions/pages/PermissionMatrixPage').then(
    (module) => ({ default: module.PermissionMatrixPage }),
  ),
);
const OrgUnitTreePage = lazy(() =>
  import('./features/org-units/pages/OrgUnitTreePage').then((module) => ({
    default: module.OrgUnitTreePage,
  })),
);
const SubjectGroupListPage = lazy(() =>
  import('./features/subject-groups/pages/SubjectGroupListPage').then(
    (module) => ({ default: module.SubjectGroupListPage }),
  ),
);
const SubjectGroupDetailPage = lazy(() =>
  import('./features/subject-groups/pages/SubjectGroupDetailPage').then(
    (module) => ({ default: module.SubjectGroupDetailPage }),
  ),
);
const CourseListPage = lazy(() =>
  import('./features/courses/pages/CourseListPage').then((module) => ({
    default: module.CourseListPage,
  })),
);
const CourseDetailPage = lazy(() =>
  import('./features/courses/pages/CourseDetailPage').then((module) => ({
    default: module.CourseDetailPage,
  })),
);
const CourseFormPage = lazy(() =>
  import('./features/courses/pages/CourseFormPage').then((module) => ({
    default: module.CourseFormPage,
  })),
);
const EquivalenceGroupsPage = lazy(() =>
  import('./features/equivalence-groups/pages/EquivalenceGroupsPage').then(
    (module) => ({ default: module.EquivalenceGroupsPage }),
  ),
);
const ProgramListPage = lazy(() =>
  import('./features/programs/pages/ProgramListPage').then((module) => ({
    default: module.ProgramListPage,
  })),
);
const ProgramOverviewPage = lazy(() =>
  import('./features/programs/pages/ProgramOverviewPage').then((module) => ({
    default: module.ProgramOverviewPage,
  })),
);
const CurriculumPage = lazy(() =>
  import('./features/curriculum/pages/CurriculumPage').then((module) => ({
    default: module.CurriculumPage,
  })),
);
const ElectiveGroupsPage = lazy(() =>
  import('./features/curriculum/pages/ElectiveGroupsPage').then((module) => ({
    default: module.ElectiveGroupsPage,
  })),
);
const ConsistencyPage = lazy(() =>
  import('./features/consistency/pages/ConsistencyPage').then((module) => ({
    default: module.ConsistencyPage,
  })),
);
const PloListPage = lazy(() =>
  import('./features/outcomes/pages/PloListPage').then((module) => ({
    default: module.PloListPage,
  })),
);
const CoursePloMatrixPage = lazy(() =>
  import('./features/outcomes/pages/CoursePloMatrixPage').then((module) => ({
    default: module.CoursePloMatrixPage,
  })),
);
const ProgramCloPloPage = lazy(() =>
  import('./features/outcomes/pages/ProgramCloPloPage').then((module) => ({
    default: module.ProgramCloPloPage,
  })),
);
const ItemCloPloPage = lazy(() =>
  import('./features/outcomes/pages/ItemCloPloPage').then((module) => ({
    default: module.ItemCloPloPage,
  })),
);
const OutcomeCoveragePage = lazy(() =>
  import('./features/outcomes/pages/OutcomeCoveragePage').then((module) => ({
    default: module.OutcomeCoveragePage,
  })),
);
const SyllabusPage = lazy(() =>
  import('./features/syllabi/pages/SyllabusPage').then((module) => ({
    default: module.SyllabusPage,
  })),
);
const SyllabusEditorPage = lazy(() =>
  import('./features/syllabi/pages/SyllabusEditorPage').then((module) => ({
    default: module.SyllabusEditorPage,
  })),
);
const ProgramFormPage = lazy(() =>
  import('./features/programs/pages/ProgramFormPage').then((module) => ({
    default: module.ProgramFormPage,
  })),
);

const ChangeRequestListPage = lazy(() =>
  import('./features/change-requests/pages/ChangeRequestListPage').then(
    (module) => ({ default: module.ChangeRequestListPage }),
  ),
);
const ChangeRequestFormPage = lazy(() =>
  import('./features/change-requests/pages/ChangeRequestFormPage').then(
    (module) => ({ default: module.ChangeRequestFormPage }),
  ),
);
const OrganizationalRequestPage = lazy(() =>
  import('./features/change-requests/pages/OrganizationalRequestPage').then(
    (module) => ({ default: module.OrganizationalRequestPage }),
  ),
);
const ChangeRequestDetailPage = lazy(() =>
  import('./features/change-requests/pages/ChangeRequestDetailPage').then(
    (module) => ({ default: module.ChangeRequestDetailPage }),
  ),
);
const ApprovalQueuePage = lazy(() =>
  import('./features/change-requests/pages/ApprovalQueuePage').then(
    (module) => ({ default: module.ApprovalQueuePage }),
  ),
);
const ApprovalDelegationsPage = lazy(() =>
  import('./features/approval-delegations/pages/ApprovalDelegationsPage').then(
    (module) => ({ default: module.ApprovalDelegationsPage }),
  ),
);
const NotificationsPage = lazy(() =>
  import('./features/notifications/pages/NotificationsPage').then((module) => ({
    default: module.NotificationsPage,
  })),
);
const ChangeRequestEditPage = lazy(() =>
  import('./features/change-requests/pages/ChangeRequestEditPage').then(
    (module) => ({ default: module.ChangeRequestEditPage }),
  ),
);
const VersionInfoEditPage = lazy(() =>
  import('./features/programs/pages/VersionInfoEditPage').then((module) => ({
    default: module.VersionInfoEditPage,
  })),
);

const SemestersPage = lazy(() =>
  import('./features/releases/pages/SemestersPage').then((module) => ({
    default: module.SemestersPage,
  })),
);
const VersionComparisonPage = lazy(() =>
  import('./features/releases/pages/VersionComparisonPage').then((module) => ({
    default: module.VersionComparisonPage,
  })),
);
const PinnedSyllabusComparisonPage = lazy(() =>
  import('./features/releases/pages/PinnedSyllabusComparisonPage').then(
    (module) => ({ default: module.PinnedSyllabusComparisonPage }),
  ),
);
const CohortVersionAssignmentsPage = lazy(() =>
  import('./features/releases/pages/CohortVersionAssignmentsPage').then(
    (module) => ({ default: module.CohortVersionAssignmentsPage }),
  ),
);
const InitialReleasePage = lazy(() =>
  import('./features/releases/pages/InitialReleasePage').then((module) => ({
    default: module.InitialReleasePage,
  })),
);
const VersionHistoryPage = lazy(() =>
  import('./features/releases/pages/VersionHistoryPage').then((module) => ({
    default: module.VersionHistoryPage,
  })),
);
const VersionDetailPage = lazy(() =>
  import('./features/releases/pages/VersionDetailPage').then((module) => ({
    default: module.VersionDetailPage,
  })),
);
const CorrectionPage = lazy(() =>
  import('./features/releases/pages/CorrectionPage').then((module) => ({
    default: module.CorrectionPage,
  })),
);
const FinalApprovalPage = lazy(() =>
  import('./features/change-requests/pages/FinalApprovalPage').then(
    (module) => ({ default: module.FinalApprovalPage }),
  ),
);

const HomePage = lazy(() =>
  import('./features/home/pages/HomePage').then((module) => ({
    default: module.HomePage,
  })),
);
const AccountPage = lazy(() =>
  import('./features/auth/pages/AccountPage').then((module) => ({
    default: module.AccountPage,
  })),
);
const HealthPage = lazy(() =>
  import('./features/health/pages/HealthPage').then((module) => ({
    default: module.HealthPage,
  })),
);

const ImportPage = lazy(() =>
  import('./features/imports/pages/ImportPage').then((module) => ({
    default: module.ImportPage,
  })),
);
const ImportHistoryPage = lazy(() =>
  import('./features/imports/pages/ImportHistoryPage').then((module) => ({
    default: module.ImportHistoryPage,
  })),
);
const ImportDetailPage = lazy(() =>
  import('./features/imports/pages/ImportDetailPage').then((module) => ({
    default: module.ImportDetailPage,
  })),
);

const PortalHomePage = lazy(() =>
  import('./features/student-portal/pages/PortalHomePage').then((module) => ({
    default: module.PortalHomePage,
  })),
);
const PortalCurriculumPage = lazy(() =>
  import('./features/student-portal/pages/PortalCurriculumPage').then(
    (module) => ({
      default: module.PortalCurriculumPage,
    }),
  ),
);
const PortalSyllabusPage = lazy(() =>
  import('./features/student-portal/pages/PortalSyllabusPage').then(
    (module) => ({
      default: module.PortalSyllabusPage,
    }),
  ),
);
const PortalProgressPage = lazy(() =>
  import('./features/student-portal/pages/PortalProgressPage').then(
    (module) => ({
      default: module.PortalProgressPage,
    }),
  ),
);
const PortalRegistrationPage = lazy(() =>
  import('./features/student-portal/pages/PortalRegistrationPage').then(
    (module) => ({
      default: module.PortalRegistrationPage,
    }),
  ),
);
const PortalGraduationPage = lazy(() =>
  import('./features/student-portal/pages/PortalGraduationPage').then(
    (module) => ({
      default: module.PortalGraduationPage,
    }),
  ),
);
const CourseGraphPage = lazy(
  () => import('./features/publication/pages/CourseGraphPage'),
);
const ProgramHealthPage = lazy(
  () => import('./features/publication/pages/ProgramHealthPage'),
);
const VersionTimelinePage = lazy(
  () => import('./features/publication/pages/VersionTimelinePage'),
);
const ProgramComparisonPage = lazy(
  () => import('./features/reports/pages/ProgramComparisonPage'),
);
const CreditDistributionPage = lazy(
  () => import('./features/reports/pages/CreditDistributionPage'),
);
const AccreditationExportPage = lazy(
  () => import('./features/reports/pages/AccreditationExportPage'),
);
const ChangeRequestStatisticsPage = lazy(
  () => import('./features/reports/pages/ChangeRequestStatisticsPage'),
);
const IntegrationClientsPage = lazy(() =>
  import('./features/integration-clients/pages/IntegrationClientsPage').then(
    (module) => ({ default: module.IntegrationClientsPage }),
  ),
);
const SchoolSyncSettingsPage = lazy(() =>
  import('./features/school-db-sync/pages/SchoolSyncSettingsPage').then(
    (module) => ({
      default: module.SchoolSyncSettingsPage,
    }),
  ),
);
const SchoolSyncRunsPage = lazy(() =>
  import('./features/school-db-sync/pages/SchoolSyncRunsPage').then(
    (module) => ({
      default: module.SchoolSyncRunsPage,
    }),
  ),
);
const SchoolSyncRunDetailPage = lazy(() =>
  import('./features/school-db-sync/pages/SchoolSyncRunDetailPage').then(
    (module) => ({
      default: module.SchoolSyncRunDetailPage,
    }),
  ),
);

const StudentListPage = lazy(() =>
  import('./features/students/pages/StudentListPage').then((module) => ({
    default: module.StudentListPage,
  })),
);
const StudentDetailPage = lazy(() =>
  import('./features/students/pages/StudentDetailPage').then((module) => ({
    default: module.StudentDetailPage,
  })),
);

export const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: ROUTES.studentPortal,
        element: (
          <RequireStudent>
            <StudentLayout />
          </RequireStudent>
        ),
        children: [
          { index: true, element: <PortalHomePage /> },
          { path: ROUTES.studentCurriculum, element: <PortalCurriculumPage /> },
          { path: ROUTES.studentSyllabus, element: <PortalSyllabusPage /> },
          { path: ROUTES.studentProgress, element: <PortalProgressPage /> },
          {
            path: ROUTES.studentRegistration,
            element: <PortalRegistrationPage />,
          },
          { path: ROUTES.studentGraduation, element: <PortalGraduationPage /> },
        ],
      },
      {
        path: ROUTES.home,
        element: <AppLayout />,
        children: [
          { index: true, element: <HomeGate staffHome={<HomePage />} /> },
          {
            path: ROUTES.graduation,
            element: (
              <RequireGraduationStaff>
                <GraduationReviewPage />
              </RequireGraduationStaff>
            ),
          },
          {
            path: ROUTES.graduationAudit,
            element: (
              <RequireGraduationStaff>
                <GraduationAuditPage />
              </RequireGraduationStaff>
            ),
          },
          {
            path: ROUTES.graduationBatches,
            element: (
              <RequireGraduationStaff permission="graduation.audit">
                <GraduationBatchesPage />
              </RequireGraduationStaff>
            ),
          },
          {
            path: ROUTES.graduationBatch,
            element: (
              <RequireGraduationStaff permission="graduation.audit">
                <GraduationBatchPage />
              </RequireGraduationStaff>
            ),
          },
          {
            path: ROUTES.students,
            element: (
              <RequireStudentStaff>
                <StudentListPage />
              </RequireStudentStaff>
            ),
          },
          {
            path: ROUTES.studentDetail,
            element: (
              <RequireStudentStaff>
                <StudentDetailPage />
              </RequireStudentStaff>
            ),
          },
          {
            path: ROUTES.imports,
            element: (
              <RequireAnyPermission
                codes={[
                  PERMISSIONS.curriculumImportExportExcel,
                  PERMISSIONS.dataImportExcel,
                ]}
              >
                <ImportPage />
              </RequireAnyPermission>
            ),
          },
          {
            path: ROUTES.reportComparison,
            element: (
              <RequirePermission code={PERMISSIONS.reportBenchmark}>
                <ProgramComparisonPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.reportCredits,
            element: (
              <RequirePermission code={PERMISSIONS.reportBenchmark}>
                <CreditDistributionPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.reportAccreditation,
            element: (
              <RequirePermission code={PERMISSIONS.reportExportAccreditation}>
                <AccreditationExportPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.reportStatistics,
            element: (
              <RequirePermission code={PERMISSIONS.changeRequestStatistics}>
                <ChangeRequestStatisticsPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.integrationClients,
            element: (
              <RequirePermission code={PERMISSIONS.integrationClientManage}>
                <IntegrationClientsPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.schoolSync,
            element: (
              <RequirePermission code={PERMISSIONS.syncConfigure}>
                <SchoolSyncSettingsPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.schoolSyncRuns,
            element: (
              <RequirePermission code={PERMISSIONS.syncConfigure}>
                <SchoolSyncRunsPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.schoolSyncRunDetail,
            element: (
              <RequirePermission code={PERMISSIONS.syncConfigure}>
                <SchoolSyncRunDetailPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.importHistory,
            element: (
              <RequireAnyPermission
                codes={[
                  PERMISSIONS.curriculumImportExportExcel,
                  PERMISSIONS.dataImportExcel,
                ]}
              >
                <ImportHistoryPage />
              </RequireAnyPermission>
            ),
          },
          {
            path: ROUTES.importDetail,
            element: (
              <RequireAnyPermission
                codes={[
                  PERMISSIONS.curriculumImportExportExcel,
                  PERMISSIONS.dataImportExcel,
                ]}
              >
                <ImportDetailPage />
              </RequireAnyPermission>
            ),
          },
          { path: ROUTES.account, element: <AccountPage /> },
          { path: ROUTES.health, element: <HealthPage /> },
          {
            path: ROUTES.users,
            element: (
              <RequirePermission code={PERMISSIONS.userManage}>
                <UserListPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.userDetail,
            element: (
              <RequirePermission code={PERMISSIONS.userManage}>
                <UserDetailPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.permissionMatrix,
            element: (
              <RequirePermission code={PERMISSIONS.permissionView}>
                <PermissionMatrixPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.orgUnits,
            element: (
              <RequirePermission code={PERMISSIONS.orgUnitManage}>
                <OrgUnitTreePage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.subjectGroups,
            element: (
              <RequirePermission code={PERMISSIONS.subjectGroupView}>
                <SubjectGroupListPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.subjectGroupDetail,
            element: (
              <RequirePermission code={PERMISSIONS.subjectGroupView}>
                <SubjectGroupDetailPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.courses,
            element: (
              <RequirePermission code={PERMISSIONS.courseView}>
                <CourseListPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.courseNew,
            element: (
              <RequirePermission code={PERMISSIONS.courseEdit}>
                <CourseFormPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.courseDetail,
            element: (
              <RequirePermission code={PERMISSIONS.courseView}>
                <CourseDetailPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.courseEdit,
            element: (
              <RequirePermission code={PERMISSIONS.courseEdit}>
                <CourseFormPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.syllabus,
            element: (
              <RequirePermission code={PERMISSIONS.syllabusView}>
                <SyllabusPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.syllabusEdit,
            element: (
              <RequireAnyPermission
                codes={[
                  PERMISSIONS.syllabusEdit,
                  PERMISSIONS.cloEdit,
                  PERMISSIONS.gradingFormulaEdit,
                ]}
              >
                <SyllabusEditorPage />
              </RequireAnyPermission>
            ),
          },
          {
            path: ROUTES.semesters,
            element: (
              <RequirePermission code={PERMISSIONS.semesterManage}>
                <SemestersPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.versionCompare,
            element: (
              <RequirePermission code={PERMISSIONS.versionCompare}>
                <VersionComparisonPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.pinnedSyllabusCompare,
            element: (
              <RequirePermission code={PERMISSIONS.versionCompare}>
                <PinnedSyllabusComparisonPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.cohortVersionAssignmentStart,
            element: (
              <RequirePermission code={PERMISSIONS.versionAssignCohort}>
                <CohortVersionAssignmentsPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.cohortVersionAssignments,
            element: (
              <RequirePermission code={PERMISSIONS.versionAssignCohort}>
                <CohortVersionAssignmentsPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.versionHistory,
            element: (
              <RequirePermission code={PERMISSIONS.programView}>
                <VersionHistoryPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.versionDetail,
            element: (
              <RequirePermission code={PERMISSIONS.programView}>
                <VersionDetailPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.versionRelease,
            element: (
              <RequirePermission code={PERMISSIONS.versionPublish}>
                <InitialReleasePage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.versionCorrection,
            element: (
              <RequirePermission code={PERMISSIONS.versionCorrect}>
                <CorrectionPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.finalApproval,
            element: (
              <RequirePermission code={PERMISSIONS.changeRequestView}>
                <FinalApprovalPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.programVersionInfo,
            element: (
              <RequirePermission code={PERMISSIONS.programView}>
                <VersionInfoEditPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.changeRequests,
            element: (
              <RequirePermission code={PERMISSIONS.changeRequestView}>
                <ChangeRequestListPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.changeRequestNew,
            element: (
              <RequirePermission code={PERMISSIONS.changeRequestCreate}>
                <ChangeRequestFormPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.changeRequestOrganizationalNew,
            element: (
              <RequirePermission
                code={PERMISSIONS.changeRequestCreateOrganizational}
              >
                <OrganizationalRequestPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.changeRequestDetail,
            element: (
              <RequirePermission code={PERMISSIONS.changeRequestView}>
                <ChangeRequestDetailPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.changeRequestEdit,
            element: (
              <RequirePermission code={PERMISSIONS.changeRequestView}>
                <ChangeRequestEditPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.approvalQueue,
            element: (
              <RequirePermission code={PERMISSIONS.changeRequestView}>
                <ApprovalQueuePage />
              </RequirePermission>
            ),
          },
          { path: ROUTES.notifications, element: <NotificationsPage /> },
          // Anyone signed in may read the grants they gave or received; creating needs delegation.manage (server-checked).
          {
            path: ROUTES.approvalDelegations,
            element: <ApprovalDelegationsPage />,
          },
          {
            path: ROUTES.equivalenceGroups,
            element: (
              <RequirePermission code={PERMISSIONS.courseView}>
                <EquivalenceGroupsPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.programs,
            element: (
              <RequirePermission code={PERMISSIONS.programView}>
                <ProgramListPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.programNew,
            element: (
              <RequirePermission code={PERMISSIONS.programEditInfo}>
                <ProgramFormPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.programDetail,
            element: (
              <RequirePermission code={PERMISSIONS.programView}>
                <ProgramOverviewPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.programEdit,
            element: (
              <RequirePermission code={PERMISSIONS.programEditInfo}>
                <ProgramFormPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.curriculum,
            element: (
              <RequirePermission code={PERMISSIONS.programView}>
                <CurriculumPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.electiveGroups,
            element: (
              <RequirePermission code={PERMISSIONS.programView}>
                <ElectiveGroupsPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.courseGraph,
            element: (
              <RequirePermission code={PERMISSIONS.programView}>
                <CourseGraphPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.programHealth,
            element: (
              <RequirePermission code={PERMISSIONS.programView}>
                <ProgramHealthPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.versionTimeline,
            element: (
              <RequirePermission code={PERMISSIONS.versionViewHistory}>
                <VersionTimelinePage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.consistency,
            element: (
              <RequirePermission code={PERMISSIONS.programView}>
                <ConsistencyPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.plos,
            element: (
              <RequirePermission code={PERMISSIONS.outcomeView}>
                <PloListPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.coursePloMatrix,
            element: (
              <RequirePermission code={PERMISSIONS.outcomeView}>
                <CoursePloMatrixPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.cloPloMatrix,
            element: (
              <RequirePermission code={PERMISSIONS.outcomeView}>
                <ProgramCloPloPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.itemCloPlo,
            element: (
              <RequirePermission code={PERMISSIONS.outcomeView}>
                <ItemCloPloPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.outcomeCoverage,
            element: (
              <RequirePermission code={PERMISSIONS.outcomeView}>
                <OutcomeCoveragePage />
              </RequirePermission>
            ),
          },
        ],
      },
    ],
  },
]);
