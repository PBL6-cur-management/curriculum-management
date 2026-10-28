import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { SYLLABUS_SECTION_FIELDS } from '../../syllabi/syllabus-sections.js';
import { SYLLABUS_SECTION_LABELS } from './diff-labels.js';
import { SNAPSHOT_ENTITY, type SnapshotEntry } from './snapshot-entry.js';
import { entry, scalar } from './snapshot-scalar.js';

const WEEKS_KEY = 'weeks';
const FORMULA_KEY = 'failingScore';

// Weeks are one item: reordering or retitling weeks has no stable key per row, so they compare as one text.
export async function readSyllabusSnapshot(
  db: PrismaService | Prisma.TransactionClient,
  syllabusId: string,
): Promise<SnapshotEntry[]> {
  const row = await db.syllabus.findUniqueOrThrow({
    where: { id: syllabusId },
    include: {
      weeklyContents: {
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: {
          cloLinks: { include: { clo: { select: { cloCode: true } } } },
        },
      },
      clos: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      assessmentComponents: {
        orderBy: [{ componentCode: 'asc' }, { id: 'asc' }],
        include: {
          mappings: { include: { clo: { select: { cloCode: true } } } },
        },
      },
    },
  });
  return [
    ...SYLLABUS_SECTION_FIELDS.map((field) =>
      entry(
        SNAPSHOT_ENTITY.SYLLABUS_FIELD,
        field,
        SYLLABUS_SECTION_LABELS[field],
        row.id,
        { text: row[field] },
      ),
    ),
    entry(
      SNAPSHOT_ENTITY.WEEKLY_CONTENTS,
      WEEKS_KEY,
      'Nội dung theo tuần',
      row.id,
      { text: formatWeeks(row.weeklyContents) },
    ),
    ...row.clos.map((clo) =>
      entry(SNAPSHOT_ENTITY.CLO, clo.cloCode, clo.cloCode, clo.id, {
        description: clo.description,
        englishDescription: clo.englishDescription,
        cognitiveLevel: clo.cognitiveLevel,
        sortOrder: scalar(clo.sortOrder),
      }),
    ),
    entry(
      SNAPSHOT_ENTITY.FORMULA,
      FORMULA_KEY,
      'Điểm liệt của học phần',
      row.id,
      { failingScore: scalar(row.failingScore) },
    ),
    ...row.assessmentComponents.map((component) =>
      entry(
        SNAPSHOT_ENTITY.COMPONENT,
        component.componentCode,
        component.componentCode,
        component.id,
        {
          componentName: component.componentName,
          weight: scalar(component.weight),
          assessmentForm: component.assessmentForm,
          isConditional: scalar(component.isConditional),
          conditionThreshold: scalar(component.conditionThreshold),
          failingScore: scalar(component.failingScore),
        },
      ),
    ),
    ...row.assessmentComponents.flatMap((component) =>
      component.mappings.map((mapping) =>
        entry(
          SNAPSHOT_ENTITY.CLO_MAPPING,
          `${component.componentCode}/${mapping.clo.cloCode}`,
          `${component.componentCode} – ${mapping.clo.cloCode}`,
          mapping.id,
          { cloWeight: scalar(mapping.cloWeight) },
        ),
      ),
    ),
  ];
}

interface WeekText {
  weekLabel: string;
  content: string;
  teachingActivities: string | null;
  cloLinks: { clo: { cloCode: string } }[];
}

// Null when there are no weeks, so "no weeks" and "no text" are one shape.
function formatWeeks(weeks: readonly WeekText[]): string | null {
  if (weeks.length === 0) return null;
  return weeks
    .map((week) => {
      const clos = week.cloLinks
        .map((link) => link.clo.cloCode)
        .sort()
        .join(', ');
      const parts = [
        `<p><strong>${escapeHtml(week.weekLabel)}</strong>${clos ? ` [${escapeHtml(clos)}]` : ''}</p>`,
        week.content,
        week.teachingActivities ?? '',
      ];
      return parts.join('');
    })
    .join('');
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
