import { Button, Alert, Flex, Result, Segmented, Skeleton, Space } from 'antd';
import { useEffect, useRef, useState } from 'react';
import {
  generatePath,
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';
import {
  FOCUS_PARAM,
  IMPORT_TYPE_PARAM,
  IMPORT_VERSION_PARAM,
  ROUTES,
} from '../../../routes';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import { PageHeader } from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { ApiError } from '../../../shared/api/client';
import { RequestDraftBanner } from '../../../shared/change-requests/RequestDraftBanner';
import { versionLabel } from '../../../shared/constants/versionLabels';
import type { CurriculumItem } from '../api/curriculum';
import { CurriculumAddButton } from '../components/CurriculumAddButton';
import { CurriculumFiltersBar } from '../components/CurriculumFiltersBar';
import { CurriculumItemModal } from '../components/CurriculumItemModal';
import { CurriculumTable } from '../components/CurriculumTable';
import {
  CurriculumTotals,
  ProgramCreditsLine,
} from '../components/CurriculumTotals';
import { CurriculumWarningsPanel } from '../components/CurriculumWarningsPanel';
import { RequisitesModal } from '../components/RequisitesModal';
import { SemesterBoard } from '../components/SemesterBoard';
import {
  CURRICULUM_VIEW,
  CURRICULUM_VIEW_LABELS,
  type CurriculumView,
} from '../constants/curriculumLabels';
import { useCurriculum, useExportCurriculum } from '../hooks/useCurriculum';
import {
  EMPTY_CURRICULUM_FILTERS,
  useCurriculumFilters,
} from '../hooks/useCurriculumFilters';
import { itemElementId } from '../components/CurriculumWarningsPanel';
import { useMe } from '../../../shared/auth/useMe';
import { useSemesters } from '../../../shared/releases/useReleaseOptions';
import { semesterLabel } from '../../../shared/releases/semesters';
import { EligibilityReasons } from '../../../shared/registration-eligibility/EligibilityReasons';
import { EligibilityContextBar } from '../components/EligibilityContextBar';
import { useRegistrationEligibility } from '../hooks/useRegistrationEligibility';
import {
  ELIGIBILITY_CONTEXT_RELOAD_LIMIT,
  ELIGIBILITY_SEMESTER_PARAM,
  ELIGIBILITY_STUDENT_PARAM,
} from '../constants/curriculumLabels';

const VIEW_OPTIONS = (
  Object.keys(CURRICULUM_VIEW_LABELS) as CurriculumView[]
).map((value) => ({ value, label: CURRICULUM_VIEW_LABELS[value] }));

export function CurriculumPage() {
  const { programId = '', versionId = '' } = useParams();
  const curriculumQuery = useCurriculum(versionId);
  const { data: curriculum, isPending, error } = curriculumQuery;
  const canImportExport = useCan(PERMISSIONS.curriculumImportExportExcel);
  const exportExcel = useExportCurriculum(versionId);
  const [view, setView] = useState<CurriculumView>(CURRICULUM_VIEW.rows);
  const { filters, setFilters, visible, filtered } = useCurriculumFilters(
    curriculum?.items ?? [],
  );
  const [editing, setEditing] = useState<CurriculumItem | 'new' | null>(null);
  const [requisitesOf, setRequisitesOf] = useState<CurriculumItem | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const canViewEligibility = useCan(
    PERMISSIONS.studentViewRegistrationEligibility,
  );
  const staff =
    canViewEligibility &&
    Boolean(
      me?.roles?.some(
        (role) => role.roleCode === 'R1' || role.roleCode === 'R3',
      ),
    );
  const semesters = useSemesters();
  const studentId = searchParams.get(ELIGIBILITY_STUDENT_PARAM) ?? '';
  const semesterId = searchParams.get(ELIGIBILITY_SEMESTER_PARAM) ?? '';
  const knownSemester =
    Array.isArray(semesters.data) &&
    semesters.data.some(
      (semester) => semester.id === semesterId && semester.startDate !== null,
    );
  const evaluationSemester = Array.isArray(semesters.data)
    ? semesters.data.find((semester) => semester.id === semesterId)
    : undefined;
  const [selectionProgram, setSelectionProgram] = useState(programId);
  const sameProgram = selectionProgram === programId;
  const lookup =
    staff && studentId && knownSemester && sameProgram
      ? { studentId, programId, semesterId }
      : null;
  const eligibility = useRegistrationEligibility(lookup);
  const { refetch: refetchEligibility } = eligibility;
  const { refetch: refetchCurriculum } = curriculumQuery;
  const answer = eligibility.isError ? undefined : eligibility.data;
  const identityMatches = Boolean(
    answer &&
    lookup &&
    answer.context.studentId === lookup.studentId &&
    answer.context.programId === lookup.programId &&
    answer.context.semesterId === lookup.semesterId,
  );
  const studentMode = staff && Boolean(studentId);
  const contextKey = `${programId}:${studentId}:${semesterId}:${versionId}`;
  const [shownReason, setShownReason] = useState<{
    contextKey: string;
    itemId: string;
  } | null>(null);
  const reload = useRef({ key: '', count: 0 });
  const versionMatches = Boolean(
    identityMatches &&
    answer?.context.programVersionId === versionId &&
    curriculum?.version.id === versionId &&
    curriculum.version.programId === programId,
  );
  const itemIds = new Set(answer?.items.map((item) => item.itemId));
  const itemSetMatches = Boolean(
    versionMatches &&
    answer?.items.length === itemIds.size &&
    curriculum?.items.length === itemIds.size &&
    curriculum.items.every((item) => itemIds.has(item.id)),
  );
  useEffect(() => {
    if (sameProgram) return;
    setSelectionProgram(programId);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(ELIGIBILITY_STUDENT_PARAM);
        next.delete(ELIGIBILITY_SEMESTER_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [programId, sameProgram, setSearchParams]);
  useEffect(() => {
    if (
      !identityMatches ||
      !answer ||
      answer.context.programVersionId === versionId
    )
      return;
    const next = new URLSearchParams(searchParams);
    next.delete(FOCUS_PARAM);
    void navigate(
      `${generatePath(ROUTES.curriculum, { programId, versionId: answer.context.programVersionId })}?${next}`,
      { replace: true },
    );
  }, [identityMatches, answer, versionId, programId, searchParams, navigate]);
  useEffect(() => {
    if (!versionMatches || itemSetMatches || !answer || !curriculum) return;
    if (reload.current.key !== contextKey)
      reload.current = { key: contextKey, count: 0 };
    if (reload.current.count >= ELIGIBILITY_CONTEXT_RELOAD_LIMIT) return;
    reload.current.count++;
    void Promise.all([refetchEligibility(), refetchCurriculum()]);
  }, [
    versionMatches,
    itemSetMatches,
    answer,
    curriculum,
    contextKey,
    refetchEligibility,
    refetchCurriculum,
  ]);
  const changeContext = (
    nextStudent: string | undefined,
    nextSemester = semesterId,
  ) => {
    setShownReason(null);
    setEditing(null);
    setRequisitesOf(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete(FOCUS_PARAM);
      if (nextStudent) next.set(ELIGIBILITY_STUDENT_PARAM, nextStudent);
      else next.delete(ELIGIBILITY_STUDENT_PARAM);
      if (nextSemester) next.set(ELIGIBILITY_SEMESTER_PARAM, nextSemester);
      else next.delete(ELIGIBILITY_SEMESTER_PARAM);
      return next;
    });
  };
  const contextBar = staff ? (
    <EligibilityContextBar
      key={programId}
      programId={programId}
      semesterId={knownSemester ? semesterId : ''}
      studentId={studentId || undefined}
      onSemesterChange={(next) => changeContext(undefined, next)}
      onStudentChange={(next) => changeContext(next)}
      onRecompute={
        lookup
          ? () => {
              setShownReason(null);
              void eligibility.refetch();
            }
          : undefined
      }
      computing={eligibility.isFetching}
    />
  ) : null;
  const eligibilityByItemId = itemSetMatches
    ? new Map(answer!.items.map((item) => [item.itemId, item]))
    : undefined;
  const focusId = searchParams.get(FOCUS_PARAM);
  const focusVisible = visible.some((row) => row.id === focusId);
  const focusKnown = Boolean(
    focusId && curriculum?.items.some((row) => row.id === focusId),
  );
  // Arriving from the consistency result: clear a filter that hides the row, then bring it into view.
  useEffect(() => {
    if (!focusKnown) return;
    if (!focusVisible) {
      setFilters(EMPTY_CURRICULUM_FILTERS);
      return;
    }
    document
      .getElementById(itemElementId(focusId!))
      ?.scrollIntoView({ block: 'center' });
  }, [focusKnown, focusVisible, focusId, setFilters]);
  if (studentId && !me) return <Skeleton active />;
  if (studentId && me && !staff)
    return (
      <Result
        status="403"
        title="Bạn không có quyền xem khung theo sinh viên"
        extra={
          <Button onClick={() => changeContext(undefined)}>
            Bỏ chọn sinh viên
          </Button>
        }
      />
    );
  if (studentMode && !knownSemester)
    return (
      <Flex vertical gap="middle">
        {contextBar}
        <Alert
          type="info"
          showIcon
          title="Chọn học kỳ để tính điều kiện đăng ký"
        />
      </Flex>
    );
  if (studentMode && eligibility.isError)
    return (
      <Flex vertical gap="middle">
        {contextBar}
        <Alert
          type="error"
          showIcon
          title={errorMessage(
            eligibility.error,
            'Không tính được điều kiện đăng ký; hãy kiểm tra ngữ cảnh và thử lại.',
          )}
        />
      </Flex>
    );
  if (studentMode && curriculumQuery.isError)
    return (
      <Flex vertical gap="middle">
        {contextBar}
        <Alert
          type="error"
          showIcon
          title={errorMessage(
            error,
            'Không tải được khung áp dụng; hãy thử tải lại.',
          )}
          action={
            <Button
              onClick={() => {
                void refetchCurriculum();
              }}
            >
              Tải lại khung
            </Button>
          }
        />
      </Flex>
    );
  if (
    isPending ||
    (studentMode &&
      (eligibility.isPending ||
        eligibility.isFetching ||
        (identityMatches && answer?.context.programVersionId !== versionId)))
  )
    return (
      <Flex vertical gap="middle">
        {contextBar}
        {studentMode && (
          <span>Đang mở khung của phiên bản áp dụng cho sinh viên...</span>
        )}
        <Skeleton active />
      </Flex>
    );
  if (studentMode && !itemSetMatches)
    return (
      <Flex vertical gap="middle">
        {contextBar}
        <Alert
          type="error"
          showIcon
          title="Khung chương trình đã thay đổi; hãy tải lại để tính điều kiện đăng ký"
        />
      </Flex>
    );
  if (!curriculum) {
    if (error instanceof ApiError && error.status === 403)
      return (
        <Result
          status="403"
          title="Bạn không có quyền xem khung chương trình này"
        />
      );
    return <Result status="404" title="Không tìm thấy khung chương trình" />;
  }
  const { version } = curriculum;
  return (
    <Flex vertical gap="middle">
      <RequestDraftBanner request={version.sourceRequest} />
      <PageHeader
        title="Khung chương trình"
        actions={
          <Space wrap>
            {canImportExport && (
              <>
                <Button
                  loading={exportExcel.isPending}
                  onClick={() => exportExcel.mutate()}
                >
                  Xuất Excel
                </Button>
                {version.status === 'DRAFT' && !version.sourceRequest && (
                  <Link
                    to={`${ROUTES.imports}?${new URLSearchParams({ [IMPORT_TYPE_PARAM]: 'CURRICULUM', [IMPORT_VERSION_PARAM]: versionId })}`}
                  >
                    <Button>Nhập từ Excel</Button>
                  </Link>
                )}
              </>
            )}
            <Segmented<CurriculumView>
              options={VIEW_OPTIONS}
              value={view}
              onChange={setView}
            />
            {!studentMode && (
              <CurriculumAddButton
                curriculum={curriculum}
                onAdd={() => setEditing('new')}
              />
            )}
          </Space>
        }
      />
      {exportExcel.error && (
        <Alert
          type="error"
          showIcon
          title={errorMessage(
            exportExcel.error,
            'Không xuất được khung chương trình. Hãy thử lại.',
          )}
        />
      )}
      <ProgramCreditsLine credits={curriculum.programCredits} />
      <CurriculumWarningsPanel warnings={curriculum.warnings} />
      {contextBar}
      {studentMode && answer && (
        <>
          <Alert
            type="info"
            showIcon
            title={`Học kỳ xét: ${evaluationSemester ? semesterLabel(evaluationSemester) : semesterId} · ${answer.context.source === 'COHORT' ? 'Theo khóa' : 'Ngoại lệ'} · ${versionLabel(version)} · Tính lúc ${answer.evaluatedAt}`}
          />
          {answer.warnings.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title="Cần kiểm tra cấu hình điều kiện"
              description={
                <ul>
                  {answer.warnings.map((warning) => (
                    <li key={`${warning.code}:${warning.course.id}`}>
                      {warning.message}
                    </li>
                  ))}
                </ul>
              }
            />
          )}
        </>
      )}
      <CurriculumFiltersBar
        curriculum={curriculum}
        filters={filters}
        filtered={filtered}
        onChange={setFilters}
      />
      {view === CURRICULUM_VIEW.rows ? (
        <CurriculumTable
          curriculum={curriculum}
          items={visible}
          sortable={!studentMode && !filtered && curriculum.canEditStructure}
          studentMode={studentMode}
          eligibilityByItemId={eligibilityByItemId}
          onShowEligibility={(itemId) => setShownReason({ contextKey, itemId })}
          onEdit={setEditing}
          onRequisites={setRequisitesOf}
          focusId={focusId}
        />
      ) : (
        <SemesterBoard
          curriculum={curriculum}
          items={visible}
          studentMode={studentMode}
          eligibilityByItemId={eligibilityByItemId}
          onShowEligibility={(itemId) => setShownReason({ contextKey, itemId })}
          onEdit={setEditing}
          onRequisites={setRequisitesOf}
        />
      )}
      <CurriculumTotals
        curriculum={curriculum}
        highlightedBlock={filters.blockSymbol}
      />
      {studentMode && (
        <EligibilityReasons
          item={
            shownReason?.contextKey === contextKey
              ? (eligibilityByItemId?.get(shownReason.itemId) ?? null)
              : null
          }
          onClose={() => setShownReason(null)}
        />
      )}
      {!studentMode && editing && (
        <CurriculumItemModal
          curriculum={curriculum}
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {!studentMode && requisitesOf && (
        <RequisitesModal
          versionId={version.id}
          item={requisitesOf}
          onClose={() => setRequisitesOf(null)}
        />
      )}
    </Flex>
  );
}
