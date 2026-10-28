import {
  Alert,
  App,
  Flex,
  Result,
  Skeleton,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
import { useCallback, useState } from 'react';
import { generatePath, Link, useParams, useSearchParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import {
  REQUEST_ID_PARAM,
  TAB_PARAM,
} from '../../../shared/change-requests/requestParams';
import { RequestDraftBanner } from '../../../shared/change-requests/RequestDraftBanner';
import { ProgramsUsingList } from '../../../shared/courses/ProgramsUsingList';
import { AttachmentPanel } from '../components/AttachmentPanel';
import { AssessmentCloTab } from '../components/AssessmentCloTab';
import { CloTab } from '../components/CloTab';
import { GradeFormulaTab } from '../components/GradeFormulaTab';
import { SyllabusContentForm } from '../components/SyllabusContentForm';
import { WeeklyContentTable } from '../components/WeeklyContentTable';
import {
  BACK_TO_SYLLABUS,
  CLO_TAB_DISABLED_TOOLTIP,
  CONTENT_TAB_DISABLED_TOOLTIP,
  EDITOR_TAB_LABELS,
  GRADING_TAB_DISABLED_TOOLTIP,
  LEAVE_TAB_BODY,
  LEAVE_TAB_CANCEL,
  LEAVE_TAB_OK,
  LEAVE_TAB_TITLE,
  NOT_DIRECTLY_EDITABLE,
  PROGRAMS_USING_NOTICE,
} from '../constants/syllabusLabels';
import { useCourseSyllabus } from '../hooks/useSyllabus';
import type { EditorTabProps } from '../types';

// The order users see. Each tab is enabled by the right that writes it: text, weekly rows and files by syllabus.edit,
// CLOs by clo.edit, formula and mappings by gradingFormula.edit.
const contentRight = (props: EditorTabProps) => props.canEditContent;
const EDITOR_TABS = [
  {
    key: 'content',
    label: EDITOR_TAB_LABELS.content,
    render: (props: EditorTabProps) => <SyllabusContentForm {...props} />,
    enabled: contentRight,
    disabledHint: CONTENT_TAB_DISABLED_TOOLTIP,
  },
  {
    key: 'weekly',
    label: EDITOR_TAB_LABELS.weekly,
    render: (props: EditorTabProps) => <WeeklyContentTable {...props} />,
    enabled: contentRight,
    disabledHint: CONTENT_TAB_DISABLED_TOOLTIP,
  },
  {
    key: 'attachments',
    label: EDITOR_TAB_LABELS.attachments,
    render: (props: EditorTabProps) => <AttachmentPanel {...props} />,
    enabled: contentRight,
    disabledHint: CONTENT_TAB_DISABLED_TOOLTIP,
  },
  {
    key: 'clos',
    label: EDITOR_TAB_LABELS.clos,
    render: (props: EditorTabProps) => <CloTab {...props} />,
    // CLOs are written with clo.edit, not syllabus.edit; the tab stays visible but off without it.
    enabled: (props: EditorTabProps) => props.canEditClos,
    disabledHint: CLO_TAB_DISABLED_TOOLTIP,
  },
  {
    key: 'formula',
    label: EDITOR_TAB_LABELS.formula,
    render: (props: EditorTabProps) => <GradeFormulaTab {...props} />,
    enabled: (props: EditorTabProps) => props.canEditGradingFormula,
    disabledHint: GRADING_TAB_DISABLED_TOOLTIP,
  },
  {
    key: 'mapping',
    label: EDITOR_TAB_LABELS.mapping,
    render: (props: EditorTabProps) => <AssessmentCloTab {...props} />,
    enabled: (props: EditorTabProps) => props.canEditGradingFormula,
    disabledHint: GRADING_TAB_DISABLED_TOOLTIP,
  },
] satisfies readonly EditorTab[];

interface EditorTab {
  key: string;
  label: string;
  render: (props: EditorTabProps) => React.ReactNode;
  enabled?: (props: EditorTabProps) => boolean;
  disabledHint?: string;
}

export function SyllabusEditorPage() {
  const { courseId = '' } = useParams();
  const { modal } = App.useApp();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get(REQUEST_ID_PARAM) ?? undefined;
  const requestedTab = searchParams.get(TAB_PARAM) ?? EDITOR_TABS[0].key;
  const [chosenTab, setChosenTab] = useState(requestedTab);
  const [dirty, setDirty] = useState(false);
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), []);
  const { data, isPending, error } = useCourseSyllabus(courseId, requestId);
  if (isPending) return <Skeleton active />;
  if (!data) {
    if (error instanceof ApiError && error.status === 403)
      return (
        <Result status="403" title="Bạn không có quyền sửa đề cương này" />
      );
    return <Result status="404" title="Không tìm thấy học phần" />;
  }
  const {
    course,
    draft,
    editPath,
    programsUsing,
    attachmentRules,
    canEditClos,
    canEditGradingFormula,
  } = data;
  const canEditContent = editPath === 'DIRECT';
  const backBase = generatePath(ROUTES.syllabus, { courseId });
  const backLink = requestId
    ? `${backBase}?${REQUEST_ID_PARAM}=${encodeURIComponent(requestId)}`
    : backBase;
  if (!draft || !(canEditContent || canEditClos || canEditGradingFormula))
    return (
      <Result
        status="info"
        title={NOT_DIRECTLY_EDITABLE}
        extra={<Link to={backLink}>{BACK_TO_SYLLABUS}</Link>}
      />
    );
  const tabProps: EditorTabProps = {
    courseId,
    syllabus: draft,
    attachmentRules,
    canEditClos,
    canEditContent,
    canEditGradingFormula,
    onDirtyChange,
    onNavigateTab: (tabKey) => goTo(tabKey),
  };
  // A request's copy carries no attachments; the request has its own documents.
  const shownTabs = EDITOR_TABS.filter(
    (tab) => !(draft.sourceRequest && tab.key === 'attachments'),
  );
  const isEnabled = (tab: EditorTab) =>
    tab.enabled ? tab.enabled(tabProps) : true;
  // A link that names a tab the caller cannot use lands on the first one they can.
  const activeTab = shownTabs.some(
    (tab) => tab.key === chosenTab && isEnabled(tab),
  )
    ? chosenTab
    : (shownTabs.find(isEnabled)?.key ?? chosenTab);

  function goTo(tabKey: string) {
    if (tabKey === activeTab) return;
    if (!dirty) {
      setChosenTab(tabKey);
      return;
    }
    modal.confirm({
      title: LEAVE_TAB_TITLE,
      content: LEAVE_TAB_BODY,
      okText: LEAVE_TAB_OK,
      cancelText: LEAVE_TAB_CANCEL,
      okButtonProps: { danger: true },
      onOk: () => {
        setDirty(false);
        setChosenTab(tabKey);
      },
    });
  }

  return (
    <Flex vertical gap="middle">
      <Flex justify="space-between" align="center" wrap gap="small">
        <Typography.Title level={2} style={{ margin: 0 }}>
          Sửa đề cương — {course.courseCode} {course.courseName}
        </Typography.Title>
        <Link to={backLink}>{BACK_TO_SYLLABUS}</Link>
      </Flex>
      <RequestDraftBanner request={draft.sourceRequest} />
      <Alert
        type="info"
        showIcon
        title={PROGRAMS_USING_NOTICE}
        description={<ProgramsUsingList programs={programsUsing} />}
      />
      <Tabs
        activeKey={activeTab}
        onChange={goTo}
        items={shownTabs.map((tab: EditorTab) => {
          const disabled = !isEnabled(tab);
          return {
            key: tab.key,
            label: disabled ? (
              <Tooltip title={tab.disabledHint}>{tab.label}</Tooltip>
            ) : (
              tab.label
            ),
            disabled,
            children: disabled ? null : tab.render(tabProps),
          };
        })}
      />
    </Flex>
  );
}
