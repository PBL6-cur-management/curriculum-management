import { App, Flex, Space, Tag, Typography } from 'antd';
import { RichTextView } from '../../../shared/components/rich-text/RichTextView';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type {
  AttachmentRules,
  Syllabus,
  SyllabusSectionField,
} from '../api/syllabi';
import {
  ATTACHMENTS_SECTION_LABEL,
  CLO_SECTION_LABEL,
  EMPTY_SECTION,
  NOT_TRANSLATED,
  REQUEST_COPY_TAB_LABEL,
  SECTION_LABELS,
  WEEKLY_SECTION_LABEL,
  type SyllabusLanguage,
} from '../constants/syllabusLabels';
import { useDeleteAttachment } from '../hooks/useSyllabus';
import { formatDate, formatDateTime } from '../utils/formatDateTime';
import { translated } from '../utils/syllabusLanguage';
import { AttachmentList } from './AttachmentList';
import { AttachmentUploader } from './AttachmentUploader';
import { CloView } from './CloView';
import { GradeFormulaView } from './GradeFormulaView';
import { WeeklyContentView } from './WeeklyContentView';

interface SyllabusSectionsProps {
  syllabus: Syllabus;
  language: SyllabusLanguage;
  // Set when the caller may add files (signed files on published revisions, or attachments on a CR working copy).
  attachTo?: {
    courseId: string;
    attachmentRules: AttachmentRules;
    allowDelete?: boolean;
  };
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  untranslated?: boolean;
}

function Section({ title, children, untranslated = false }: SectionProps) {
  return (
    <section>
      <Space>
        <Typography.Title level={5}>{title}</Typography.Title>
        {untranslated && <Tag>{NOT_TRANSLATED}</Tag>}
      </Space>
      {children}
    </section>
  );
}

// The course name, the description and each CLO have an English field (FR-48); the other sections show Vietnamese in both modes.
export function SyllabusSections({
  syllabus,
  language,
  attachTo,
}: SyllabusSectionsProps) {
  const { message } = App.useApp();
  const removeAttachment = useDeleteAttachment(attachTo?.courseId ?? '');
  const description = translated(
    language,
    syllabus.courseDescription,
    syllabus.englishDescription,
  );
  const plain = (field: SyllabusSectionField) => (
    <Section title={SECTION_LABELS[field]}>
      <RichTextView html={syllabus[field]} emptyText={EMPTY_SECTION} />
    </Section>
  );
  return (
    <Flex vertical gap="middle">
      <Typography.Text type="secondary">
        {syllabus.revisionNumber !== null
          ? `Bản số ${syllabus.revisionNumber}`
          : REQUEST_COPY_TAB_LABEL}
        {` · Cập nhật lúc ${formatDateTime(syllabus.updatedAt)}`}
        {syllabus.publishedAt &&
          ` · Ban hành ngày ${formatDate(syllabus.publishedAt)}`}
        {syllabus.effectiveSemester &&
          ` · Học kỳ hiệu lực: ${syllabus.effectiveSemester.semesterCode}`}
        {syllabus.documentNumber &&
          ` · Số văn bản: ${syllabus.documentNumber}`}
        {syllabus.signedDate &&
          ` · Ngày ký: ${formatDate(syllabus.signedDate)}`}
      </Typography.Text>
      <Section
        title={SECTION_LABELS.courseDescription}
        untranslated={description.missing}
      >
        <RichTextView html={description.text} emptyText={EMPTY_SECTION} />
      </Section>
      {plain('objectives')}
      <Section title={CLO_SECTION_LABEL}>
        <CloView clos={syllabus.clos} language={language} />
      </Section>
      <Section title={WEEKLY_SECTION_LABEL}>
        <WeeklyContentView
          weeks={syllabus.weeklyContents}
          clos={syllabus.clos}
        />
      </Section>
      {plain('teachingMethods')}
      {plain('assessmentMethods')}
      <GradeFormulaView syllabus={syllabus} />
      {plain('references')}
      <Section title={ATTACHMENTS_SECTION_LABEL}>
        <Flex vertical gap="small">
          {attachTo && (
            <AttachmentUploader
              courseId={attachTo.courseId}
              syllabusId={syllabus.id}
              attachmentRules={attachTo.attachmentRules}
            />
          )}
          <AttachmentList
            attachments={syllabus.attachments}
            onDelete={
              attachTo?.allowDelete
                ? (attachment) =>
                    removeAttachment.mutate(attachment.id, {
                      onError: (reason) =>
                        void message.error(
                          errorMessage(reason, 'Không gỡ được tệp.'),
                        ),
                    })
                : undefined
            }
          />
        </Flex>
      </Section>
    </Flex>
  );
}
