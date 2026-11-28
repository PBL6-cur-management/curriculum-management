import { useState } from 'react';
import { Alert, App, Button, Flex, Skeleton, Tabs, Tooltip } from 'antd';
import { Link, useParams, useSearchParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { useMe } from '../../../shared/auth/useMe';
import {
  BackLink,
  DetailPageLayout,
  FilterBar,
  PageHeader,
} from '../../../shared/design-system';
import type { EnrollmentCommand, StudentEnrollment } from '../api/students';
import { AcademicResultsTable } from '../components/AcademicResultsTable';
import { EnrollmentCommandModal } from '../components/EnrollmentCommandModal';
import { EnrollmentHistoryTable } from '../components/EnrollmentHistoryTable';
import { EnrollmentTrackModal } from '../components/EnrollmentTrackModal';
import { StudentFilters } from '../components/StudentFilters';
import { StudentInfoCard } from '../components/StudentInfoCard';
import {
  useReconcileStudent,
  useStudent,
  useStudentAppliedVersion,
  useStudentSemesters,
} from '../hooks/useStudents';
import { currentSemester } from '../constants/currentSemester';

function pickDefaultEnrollment(enrollments: StudentEnrollment[] | undefined) {
  if (!enrollments?.length) return undefined;
  return (
    enrollments.find(
      (e) => e.status === 'ACTIVE' && e.enrollmentType === 'PRIMARY',
    ) ??
    enrollments.find((e) => e.status === 'ACTIVE') ??
    enrollments[0]
  );
}

export function StudentDetailPage() {
  const { studentId = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const { data: me } = useMe();
  const { modal } = App.useApp();
  const semesters = useStudentSemesters();
  const urlSemesterId = search.get('semesterId') ?? '';
  const urlProgramId = search.get('programId') ?? '';
  const effectiveSemesterId =
    urlSemesterId || currentSemester(semesters.data ?? [])?.id || '';

  const detail = useStudent(studentId, {
    semesterId: effectiveSemesterId,
    programId: urlProgramId || undefined,
  });
  const student = detail.isError ? undefined : detail.data;
  const defaultEnrollment = pickDefaultEnrollment(student?.enrollments);
  const effectiveProgramId = urlProgramId || defaultEnrollment?.program.id || '';
  const context = {
    semesterId: effectiveSemesterId,
    programId: effectiveProgramId,
  };
  const enrolledPrograms = (() => {
    if (!student?.enrollments.length) return undefined;
    const unique = new Map<
      string,
      { id: string; programCode: string; programName: string }
    >();
    for (const enrollment of student.enrollments) {
      if (!unique.has(enrollment.program.id)) {
        unique.set(enrollment.program.id, enrollment.program);
      }
    }
    return [...unique.values()];
  })();
  const applied = useStudentAppliedVersion(studentId, context);
  const reconcile = useReconcileStudent(studentId);
  const [command, setCommand] = useState<{
    operation: EnrollmentCommand['operation'];
    source: StudentEnrollment | null;
  } | null>(null);
  const [trackTarget, setTrackTarget] = useState<StudentEnrollment | null>(
    null,
  );
  const isR1 = me?.roles.some((role) => role.roleCode === 'R1') ?? false;
  const canManage = Boolean(
    isR1 &&
    student?.canManageEnrollments &&
    student.status !== 'WITHDRAWN' &&
    student.status !== 'GRADUATED' &&
    me?.permissions.includes('version.assignCohort'),
  );
  function change(values: Record<string, string | undefined>) {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setCommand(null);
    setTrackTarget(null);
    setSearch(next);
  }
  return (
    <DetailPageLayout>
      <PageHeader
        title={
          student
            ? `${student.studentCode} — ${student.fullName}`
            : 'Hồ sơ sinh viên'
        }
        actions={
          <Flex gap="small" wrap>
            <BackLink to={`${ROUTES.students}?${search}`}>
              Danh sách sinh viên
            </BackLink>
            {me?.permissions.includes('graduation.view') &&
              me.roles.some(
                (role) => role.roleCode === 'R1' || role.roleCode === 'R3',
              ) &&
              (student &&
              context.programId &&
              context.semesterId &&
              applied.data &&
              !applied.isError &&
              !applied.isFetching ? (
                <Link
                  to={`${ROUTES.graduation}?${new URLSearchParams({ studentId, programId: context.programId, semesterId: context.semesterId })}`}
                >
                  Xét tốt nghiệp
                </Link>
              ) : (
                <Tooltip title="Chọn học kỳ và chương trình có phiên bản áp dụng xác định để mở xét tốt nghiệp.">
                  <span>
                    <Button disabled>Xét tốt nghiệp</Button>
                  </span>
                </Tooltip>
              ))}
          </Flex>
        }
      />
      <FilterBar>
        <StudentFilters
          params={context}
          onChange={change}
          contextOnly
          enrolledPrograms={enrolledPrograms}
        />
      </FilterBar>
      {!context.semesterId ? (
        <Alert type="info" title="Chọn học kỳ để xem hồ sơ sinh viên" />
      ) : detail.isPending ? (
        <Skeleton active />
      ) : detail.isError ? (
        <Alert
          type="error"
          showIcon
          title="Không tìm thấy sinh viên hoặc bạn không có quyền xem trong phạm vi này."
          action={
            <Button onClick={() => void detail.refetch()}>Thử lại</Button>
          }
        />
      ) : null}
      {student && context.semesterId && (
        <>
          <StudentInfoCard
            student={student}
            canViewAccount={
              isR1 && Boolean(me?.permissions.includes('user.manage'))
            }
          />
          {(student.enrollmentWarnings.length > 0 ||
            !student.enrollments.length) && (
            // One grouped warning instead of a stack: everything here needs the same reader (R1) to act.
            <Alert
              type="warning"
              showIcon
              title="Ghi danh cần xử lý"
              description={
                <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                  {student.enrollmentWarnings.map((warning, index) => (
                    <li key={`${warning.code}-${index}`}>{warning.message}</li>
                  ))}
                  {!student.enrollments.length && (
                    <li>
                      <strong>Chưa xác định được chương trình</strong>: hồ sơ đã
                      tồn tại nhưng chưa có ghi danh. Phòng Đào tạo cần gán
                      chương trình ngoại lệ hoặc kiểm tra dữ liệu nhập.
                    </li>
                  )}
                </ul>
              }
            />
          )}
          {!context.programId ? (
            <Alert
              type="info"
              title="Chọn chương trình để xem phiên bản áp dụng và kết quả học tập."
            />
          ) : applied.isPending ? (
            <Skeleton active />
          ) : applied.isError ? (
            <Alert
              type="warning"
              title="Chưa xác định được phiên bản cho học kỳ đã chọn. Cần đối soát lịch sử gán phiên bản."
              action={
                <Button onClick={() => void applied.refetch()}>Thử lại</Button>
              }
            />
          ) : (
            applied.data && (
              <Alert
                type="info"
                title="Phiên bản áp dụng cho học kỳ đã chọn"
                description={`${applied.data.programVersionId} · ${applied.data.source === 'COHORT' ? 'Theo khóa' : 'Ngoại lệ'}. Ghi danh đã lưu được hiển thị riêng bên dưới.`}
              />
            )
          )}
          {!student.canManageEnrollments && isR1 && (
            <Alert
              type="info"
              title="Không thể thay đổi ghi danh ở trạng thái hoặc phạm vi hiện tại."
            />
          )}
          {canManage && (
            <Flex gap="small" wrap>
              {!student.enrollments.length && (
                <Button
                  onClick={() =>
                    setCommand({ operation: 'ASSIGN_EXCEPTION', source: null })
                  }
                >
                  Gán chương trình ngoại lệ
                </Button>
              )}
              <Button
                onClick={() =>
                  setCommand({ operation: 'ADD_SECOND_MAJOR', source: null })
                }
              >
                Thêm song ngành
              </Button>
              <Button
                loading={reconcile.isPending}
                disabled={reconcile.isPending}
                onClick={() =>
                  modal.confirm({
                    title: 'Đồng bộ ghi danh theo khóa',
                    content:
                      'Chỉ áp dụng chuyển tiếp theo khóa đã đến hạn; không sửa lịch sử gán phiên bản.',
                    okText: 'Đồng bộ ghi danh',
                    cancelText: 'Hủy',
                    onOk: () => reconcile.mutateAsync(student.updatedAt),
                  })
                }
              >
                Đồng bộ ghi danh theo khóa
              </Button>
            </Flex>
          )}
          {reconcile.isError && (
            <Alert
              type="error"
              title="Không đồng bộ được ghi danh. Tải lại hồ sơ và kiểm tra quyền trước khi xác nhận lại."
              action={
                <Button onClick={() => void detail.refetch()}>
                  Tải lại hồ sơ
                </Button>
              }
            />
          )}
          {reconcile.data && (
            <Alert
              type="success"
              title={`Đã chuyển ${reconcile.data.transitioned}; giữ nguyên ${reconcile.data.unchanged}; cần đối soát ${reconcile.data.blocked} ghi danh.`}
            />
          )}
          <Tabs
            items={[
              {
                key: 'enrollments',
                label: 'Ghi danh',
                children: (
                  <EnrollmentHistoryTable
                    enrollments={student.enrollments}
                    canManage={canManage}
                    onTransfer={(source) =>
                      setCommand({ operation: 'TRANSFER', source })
                    }
                    onSelectTrack={(source) => setTrackTarget(source)}
                  />
                ),
              },
              {
                key: 'results',
                label: 'Kết quả học tập',
                children: context.programId ? (
                  <AcademicResultsTable
                    key={`${studentId}-${context.programId}-${context.semesterId}`}
                    studentId={studentId}
                    context={context}
                  />
                ) : (
                  <Alert
                    type="info"
                    title="Chọn chương trình để xem kết quả học tập."
                  />
                ),
              },
            ]}
          />
          {command && canManage && (
            <EnrollmentCommandModal
              key={`${studentId}-${command.operation}-${command.source?.id ?? ''}`}
              student={student}
              sourceEnrollment={command.source}
              operation={command.operation}
              open
              onClose={() => setCommand(null)}
              onReload={async () => {
                const result = await detail.refetch();
                return result.isError ? null : (result.data ?? null);
              }}
            />
          )}
          {trackTarget && canManage && (
            <EnrollmentTrackModal
              key={`${studentId}-${trackTarget.id}-${trackTarget.updatedAt}`}
              studentId={studentId}
              enrollment={trackTarget}
              open
              onClose={() => setTrackTarget(null)}
            />
          )}
        </>
      )}
    </DetailPageLayout>
  );
}
