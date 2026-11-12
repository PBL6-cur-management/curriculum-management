import {
  Button,
  Flex,
  Result,
  Select,
  Skeleton,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  generatePath,
  matchPath,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import { useCan } from '../../../shared/auth/useCan';
import { RequestStatusTag } from '../../../shared/change-requests/RequestStatusTag';
import { BackLink } from '../../../shared/design-system';
import { useSeesMatrices } from '../../../shared/outcomes/useSeesMatrices';
import type { ProgramDetail } from '../api/programs';
import {
  VERSION_STATUS_LABELS,
  versionLabel,
} from '../constants/programLabels';
import { useProgram, useVersionInfo } from '../hooks/usePrograms';
import { ProgramStatusTag } from './ProgramStatusTag';

// One workspace for everything inside a program (UI review 2026-10-31):
// - the program stays named at the top, with one way back to the list;
// - five groups of work on the first tab row; the open group lists its pages on a second row,
//   so every page is one visible click away (no hover menus, no wall of buttons);
// - the version being worked on is chosen once and kept while moving between views.

interface WorkspacePage {
  key: string;
  label: string;
  // Version-scoped views need a version id; program-scoped ones only the program.
  scope: 'program' | 'version';
  // Other routes that show this page as selected (drill-downs).
  also?: readonly string[];
  visible?: boolean;
}

interface WorkspaceGroup {
  key: string;
  label: string;
  pages: WorkspacePage[];
}

function useWorkspaceGroups(): WorkspaceGroup[] {
  const canViewOutcomes = useCan('outcome.view');
  const seesMatrices = useSeesMatrices();
  const canViewHistory = useCan('version.viewHistory');
  const canCompare = useCan('version.compare');
  const canAssignCohort = useCan('version.assignCohort');
  const groups: WorkspaceGroup[] = [
    {
      key: 'overview',
      label: 'Tổng quan',
      pages: [
        {
          key: ROUTES.programDetail,
          label: 'Tổng quan',
          scope: 'program',
          also: [ROUTES.programVersionInfo],
        },
      ],
    },
    {
      key: 'curriculum',
      label: 'Khung chương trình',
      pages: [
        {
          key: ROUTES.curriculum,
          label: 'Học phần trong khung',
          scope: 'version',
        },
        { key: ROUTES.electiveGroups, label: 'Nhóm tự chọn', scope: 'version' },
        {
          key: ROUTES.consistency,
          label: 'Kiểm tra nhất quán',
          scope: 'version',
        },
      ],
    },
    {
      key: 'outcomes',
      label: 'Chuẩn đầu ra',
      pages: [
        {
          key: ROUTES.plos,
          label: 'PLO',
          scope: 'version',
          visible: canViewOutcomes,
        },
        {
          key: ROUTES.coursePloMatrix,
          label: 'Ma trận học phần–PLO',
          scope: 'version',
          visible: seesMatrices,
        },
        {
          key: ROUTES.cloPloMatrix,
          label: 'Ma trận CLO–PLO',
          scope: 'version',
          also: [ROUTES.itemCloPlo],
          visible: seesMatrices,
        },
        {
          key: ROUTES.outcomeCoverage,
          label: 'Kiểm tra phủ',
          scope: 'version',
          visible: seesMatrices,
        },
      ],
    },
    {
      key: 'analysis',
      label: 'Phân tích',
      pages: [
        {
          key: ROUTES.courseGraph,
          label: 'Đồ thị học phần',
          scope: 'version',
          visible: seesMatrices,
        },
        {
          key: ROUTES.programHealth,
          label: 'Sức khỏe chương trình',
          scope: 'version',
          visible: seesMatrices,
        },
      ],
    },
    {
      key: 'versions',
      label: 'Phiên bản',
      pages: [
        {
          key: ROUTES.versionHistory,
          label: 'Lịch sử',
          scope: 'program',
          also: [ROUTES.versionDetail],
        },
        {
          key: ROUTES.versionCompare,
          label: 'So sánh',
          scope: 'program',
          also: [ROUTES.pinnedSyllabusCompare],
          visible: canCompare,
        },
        {
          key: ROUTES.versionTimeline,
          label: 'Dòng thời gian',
          scope: 'program',
          visible: canViewHistory && seesMatrices,
        },
        {
          key: ROUTES.cohortVersionAssignments,
          label: 'Gán cho khóa',
          scope: 'program',
          visible: canAssignCohort,
        },
      ],
    },
  ];
  return groups
    .map((group) => ({
      ...group,
      pages: group.pages.filter((page) => page.visible !== false),
    }))
    .filter((group) => group.pages.length > 0);
}

function findCurrent(groups: WorkspaceGroup[], pathname: string) {
  for (const group of groups)
    for (const page of group.pages)
      if (
        [page.key, ...(page.also ?? [])].some((pattern) =>
          matchPath({ path: pattern, end: true }, pathname),
        )
      )
        return { group, page };
  return undefined;
}

// The version a view opens: the one in the URL, else the Draft being worked on, else the current one.
function workingVersionId(program: ProgramDetail, versionId?: string) {
  if (versionId) return versionId;
  return program.draftVersion?.id ?? program.currentVersion.id;
}

function BackToList() {
  return <BackLink to={ROUTES.programs}>Danh sách chương trình</BackLink>;
}

export function ProgramWorkspaceLayout() {
  const { programId = '', versionId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data: program, isPending, error } = useProgram(programId);
  const versionInfoQuery = useVersionInfo(versionId ?? '');
  const sourceRequest = versionInfoQuery.data?.sourceRequest;
  const isProposalMode = Boolean(sourceRequest);
  const groups = useWorkspaceGroups();

  if (isPending || (Boolean(versionId) && versionInfoQuery.isPending))
    return (
      <Flex vertical gap={16} aria-busy="true">
        <Skeleton.Input active style={{ width: 360, height: 28 }} />
        <Skeleton.Input active block style={{ height: 40 }} />
        <Skeleton active paragraph={{ rows: 8 }} title={false} />
      </Flex>
    );
  if (!program)
    return error instanceof ApiError && error.status === 403 ? (
      <Result
        status="403"
        title="Bạn không có quyền xem chương trình này"
        extra={<BackToList />}
      />
    ) : (
      <Result
        status="404"
        title="Không tìm thấy chương trình"
        extra={<BackToList />}
      />
    );

  const activeVersionId = workingVersionId(program, versionId);
  const current = findCurrent(groups, pathname);
  const pathFor = (page: WorkspacePage, nextVersionId = activeVersionId) =>
    page.scope === 'version'
      ? generatePath(page.key, { programId, versionId: nextVersionId })
      : generatePath(page.key, { programId });

  function openGroup(key: string) {
    const group = groups.find((candidate) => candidate.key === key);
    if (group) void navigate(pathFor(group.pages[0]));
  }

  function openPage(key: string) {
    const page = current?.group.pages.find(
      (candidate) => candidate.key === key,
    );
    if (page) void navigate(pathFor(page));
  }

  // Switching version keeps the view when it is version-scoped; otherwise it opens the frame.
  function switchVersion(nextVersionId: string) {
    const curriculumPage = groups
      .flatMap((group) => group.pages)
      .find((page) => page.key === ROUTES.curriculum)!;
    const target =
      current?.page.scope === 'version' ? current.page : curriculumPage;
    void navigate(pathFor(target, nextVersionId));
  }

  const subPages =
    current && current.group.pages.length > 1 ? current.group.pages : null;

  return (
    <Flex vertical gap={16}>
      <Flex vertical gap={4}>
        {isProposalMode && sourceRequest ? (
          <BackLink
            to={generatePath(ROUTES.changeRequestEdit, {
              requestId: sourceRequest.id,
            })}
            preferHistory
          >
            Quay lại đề xuất {sourceRequest.requestCode}
          </BackLink>
        ) : (
          <BackToList />
        )}
        <Flex align="center" justify="space-between" wrap gap={12}>
          <Flex align="center" wrap gap={8} style={{ minWidth: 0 }}>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {program.programCode} — {program.programName}
            </Typography.Title>
            {isProposalMode && sourceRequest ? (
              <>
                <Tag color="processing">
                  Bản nháp đề xuất {sourceRequest.requestCode}
                </Tag>
                <RequestStatusTag status={sourceRequest.status} />
              </>
            ) : (
              <ProgramStatusTag status={program.status} />
            )}
          </Flex>
          {isProposalMode && sourceRequest ? (
            <Flex align="center" gap={8}>
              <Button
                type="primary"
                onClick={() =>
                  void navigate(
                    generatePath(ROUTES.changeRequestEdit, {
                      requestId: sourceRequest.id,
                    }),
                  )
                }
              >
                Về bàn soạn đề xuất
              </Button>
            </Flex>
          ) : (
            <Flex align="center" gap={8}>
              <Typography.Text type="secondary">Phiên bản</Typography.Text>
              <Select
                aria-label="Phiên bản đang xem"
                value={activeVersionId}
                onChange={switchVersion}
                style={{ minWidth: 180 }}
                options={program.versions.map((version) => ({
                  value: version.id,
                  label:
                    version.status === 'DRAFT'
                      ? 'Bản nháp'
                      : `${versionLabel(version)} · ${VERSION_STATUS_LABELS[version.status]}`,
                }))}
              />
            </Flex>
          )}
        </Flex>
      </Flex>
      {isProposalMode && current ? (
        current.group.key === 'overview' ? null : (
          <nav aria-label="Các mục của đề xuất">
            <Tabs
              activeKey={current.page.key}
              onChange={openPage}
              items={current.group.pages.map((page) => ({
                key: page.key,
                label: page.label,
              }))}
              tabBarStyle={{ marginBottom: 12 }}
            />
          </nav>
        )
      ) : (
        <nav aria-label="Các mục của chương trình">
          <Tabs
            activeKey={current?.group.key ?? ''}
            onChange={openGroup}
            items={groups.map((group) => ({
              key: group.key,
              label: group.label,
            }))}
            tabBarStyle={{ marginBottom: subPages ? 12 : 0 }}
          />
          {subPages && (
            <Tabs
              size="small"
              type="card"
              activeKey={current!.page.key}
              onChange={openPage}
              items={subPages.map((page) => ({
                key: page.key,
                label: page.label,
              }))}
              tabBarStyle={{ marginBottom: 0 }}
            />
          )}
        </nav>
      )}
      <Outlet />
    </Flex>
  );
}
