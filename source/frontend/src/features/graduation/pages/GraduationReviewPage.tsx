import { useRef, useState } from 'react';
import { Alert, Button, Card, Skeleton } from 'antd';
import { useSearchParams } from 'react-router';
import { useMe } from '../../../shared/auth/useMe';
import { DetailPageLayout, PageHeader } from '../../../shared/design-system';
import { SectionNav } from '../../../shared/layout/SectionNav';
import type { GraduationLookup } from '../schema/graduation';
import {
  graduationPollingBlocked,
  useGraduation,
  useSaveGraduation,
} from '../hooks/useGraduation';
import { GraduationContextForm } from '../components/GraduationContextForm';
import { GraduationError } from '../components/GraduationError';
import { GraduationResultView } from '../components/GraduationResultView';
import { GraduationHistoryTable } from '../components/GraduationHistoryTable';
import { GraduationReauditPanel } from '../components/GraduationReauditPanel';
import { GraduationAuditSummary } from '../components/GraduationAuditSummary';

export function GraduationReviewPage() {
  const [search, setSearch] = useSearchParams();
  const fromUrl = {
    studentId: search.get('studentId') ?? '',
    programId: search.get('programId') ?? '',
    semesterId: search.get('semesterId') ?? '',
  };
  const [submitted, setLookup] = useState<GraduationLookup | null>(null);
  const lookup =
    submitted?.studentId === fromUrl.studentId &&
    submitted?.programId === fromUrl.programId &&
    submitted?.semesterId === fromUrl.semesterId
      ? submitted
      : null;
  const requestKey = useRef<string | null>(null);
  const live = useGraduation(lookup);
  const save = useSaveGraduation();
  const { data: me } = useMe();
  const canSave = Boolean(me?.permissions.includes('graduation.audit'));
  const accessBlocked =
    graduationPollingBlocked(live.error) ||
    graduationPollingBlocked(save.error);
  const saved =
    !accessBlocked &&
    lookup &&
    save.data &&
    save.variables?.lookup.studentId === lookup.studentId &&
    save.variables.lookup.programId === lookup.programId &&
    save.variables.lookup.semesterId === lookup.semesterId
      ? save.data
      : undefined;
  const outcome = live.isError || accessBlocked ? undefined : live.data;
  const result =
    saved?.result ??
    (outcome?.status === 'REVIEWED' ? outcome.result : undefined);
  function clear() {
    setLookup(null);
    requestKey.current = null;
    save.reset();
  }
  function view(next: GraduationLookup) {
    requestKey.current = null;
    save.reset();
    if (
      lookup?.studentId === next.studentId &&
      lookup.programId === next.programId &&
      lookup.semesterId === next.semesterId
    )
      void live.refetch();
    setLookup(next);
    setSearch(next);
  }
  function persist() {
    if (!lookup || outcome?.status !== 'REVIEWED') return;
    if (!requestKey.current || save.isSuccess)
      requestKey.current = crypto.randomUUID();
    save.mutate({ lookup, requestKey: requestKey.current });
  }
  return (
    <DetailPageLayout>
      <PageHeader title="Xét tốt nghiệp" />
      <SectionNav section="graduation" />
      <Card title="Ngữ cảnh xét">
        <GraduationContextForm
          key={search.toString()}
          value={fromUrl}
          onChange={clear}
          onSubmit={view}
        />
      </Card>
      {!lookup ? (
        <Alert
          type="info"
          title="Chọn ngữ cảnh và bấm Xem kết quả để bắt đầu"
        />
      ) : (
        <>
          {live.isPending && <Skeleton active />}
          {live.isError && (
            <GraduationError
              error={live.error}
              onRetry={() => void live.refetch()}
            />
          )}
          {outcome?.status === 'CANNOT_AUDIT' && (
            <Alert
              type="warning"
              showIcon
              title="Chưa thể kết luận"
              description={`${outcome.error.code} — ${outcome.error.message}. Liên hệ Phòng Đào tạo để kiểm tra dữ liệu; không chọn phiên bản khác thay thế.`}
            />
          )}
          {saved && <GraduationAuditSummary audit={saved} />}
          {result && <GraduationResultView result={result} />}
          {canSave && (
            <Button
              type="primary"
              disabled={
                outcome?.status !== 'REVIEWED' ||
                live.isFetching ||
                save.isPending
              }
              loading={save.isPending}
              onClick={persist}
            >
              Lưu lần xét
            </Button>
          )}
          {save.isError && <GraduationError error={save.error} />}
          {!accessBlocked && (
            <GraduationHistoryTable
              key={JSON.stringify(lookup)}
              lookup={lookup}
            />
          )}
          {!accessBlocked && (
            <GraduationReauditPanel
              key={`tasks-${JSON.stringify(lookup)}`}
              lookup={lookup}
            />
          )}
        </>
      )}
    </DetailPageLayout>
  );
}
