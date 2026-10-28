import { Flex, Space, Tag, Typography } from 'antd';
import { RichTextView } from '../../../shared/components/rich-text/RichTextView';
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
  SECTION_LABELS,
  WEEKLY_SECTION_LABEL,
  type SyllabusLanguage,
} from '../constants/syllabusLabels';
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
  // Set when the caller may add a signed file to this published revision (no delete is ever offered).
  attachTo?: { courseId: string; attachmentRules: AttachmentRules };
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
        {`Bản số ${syllabus.revisionNumber} · Cập nhật lúc ${formatDateTime(syllabus.updatedAt)}`}
        {syllabus.publishedAt &&
          ` · Ban hành ngày ${formatDate(syllabus.publishedAt)}`}
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
          <AttachmentList attachments={syllabus.attachments} />
        </Flex>
      </Section>
    </Flex>
  );
}
