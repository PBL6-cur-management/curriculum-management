import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';
import { LoginPage } from './features/auth/pages/LoginPage';
import { ROUTES } from './routes';
import { RequireAuth } from './shared/auth/RequireAuth';
import { AppLayout } from './shared/layout/AppLayout';
import { RequirePermission } from './shared/auth/RequirePermission';
import { PERMISSIONS } from './shared/auth/permissions';

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

export const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: ROUTES.home,
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          {
            path: ROUTES.imports,
            element: (
              <RequirePermission code={PERMISSIONS.curriculumImportExportExcel}>
                <ImportPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.importHistory,
            element: (
              <RequirePermission code={PERMISSIONS.curriculumImportExportExcel}>
                <ImportHistoryPage />
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.importDetail,
            element: (
              <RequirePermission code={PERMISSIONS.curriculumImportExportExcel}>
                <ImportDetailPage />
              </RequirePermission>
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
              <RequirePermission code={PERMISSIONS.syllabusEdit}>
                <SyllabusEditorPage />
              </RequirePermission>
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
