import { SyllabusStatus, type Prisma } from '../../generated/prisma/client.js';
import { sanitizeRichText } from '../rich-text/sanitize-rich-text.js';
import { SYLLABUS_SECTION_FIELDS } from './syllabus-sections.js';

// Copies a revision's text, weeks, CLOs, week–CLO links, grade formula and assessment–CLO links into a request's working copy. Attachments stay with
// their revision. The copy has no revision number: F-15 numbers it when it publishes (Syllabus_number_unless_copy).
// Every rich-text value goes through sanitizeRichText again; a copy is a write like any other.
export async function copySyllabusRevision(
  tx: Prisma.TransactionClient,
  fromId: string,
  copy: { sourceRequestId: string },
): Promise<string> {
  const from = await tx.syllabus.findUniqueOrThrow({
    where: { id: fromId },
    include: {
      weeklyContents: {
        include: { cloLinks: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      },
      clos: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      assessmentComponents: {
        include: { mappings: true },
        orderBy: [{ componentCode: 'asc' }, { id: 'asc' }],
      },
    },
  });
  const sections = Object.fromEntries(
    SYLLABUS_SECTION_FIELDS.map((field) => [
      field,
      sanitizeRichText(from[field]),
    ]),
  );
  const created = await tx.syllabus.create({
    data: {
      courseId: from.courseId,
      status: SyllabusStatus.DRAFT,
      revisionNumber: null,
      ...sections,
      sourceRequestId: copy.sourceRequestId,
      baseRevisionId: from.id,
      failingScore: from.failingScore,
    },
    select: { id: true },
  });
  const clos = await tx.cLO.createManyAndReturn({
    data: from.clos.map((clo) => ({
      syllabusId: created.id,
      cloCode: clo.cloCode,
      description: clo.description,
      englishDescription: clo.englishDescription,
      cognitiveLevel: clo.cognitiveLevel,
      sortOrder: clo.sortOrder,
    })),
    select: { id: true, cloCode: true },
  });
  const newCloByOld = new Map<string, string>();
  for (const old of from.clos) {
    const made = clos.find((clo) => clo.cloCode === old.cloCode);
    if (made) newCloByOld.set(old.id, made.id);
  }
  for (const week of from.weeklyContents) {
    const { id } = await tx.weeklyContent.create({
      data: {
        syllabusId: created.id,
        weekLabel: week.weekLabel,
        sortOrder: week.sortOrder,
        content: sanitizeRichText(week.content) ?? week.content,
        teachingActivities: sanitizeRichText(week.teachingActivities),
      },
      select: { id: true },
    });
    const links = week.cloLinks.flatMap((link) => {
      const cloId = newCloByOld.get(link.cloId);
      return cloId ? [{ weeklyContentId: id, cloId }] : [];
    });
    if (links.length > 0) await tx.weeklyContentCLO.createMany({ data: links });
  }
  for (const component of from.assessmentComponents) {
    const { id } = await tx.assessmentComponent.create({
      data: {
        syllabusId: created.id,
        componentCode: component.componentCode,
        componentName: component.componentName,
        weight: component.weight,
        assessmentForm: component.assessmentForm,
        isConditional: component.isConditional,
        conditionThreshold: component.conditionThreshold,
        failingScore: component.failingScore,
      },
      select: { id: true },
    });
    const links = component.mappings.flatMap((link) => {
      const cloId = newCloByOld.get(link.cloId);
      return cloId
        ? [{ assessmentComponentId: id, cloId, cloWeight: link.cloWeight }]
        : [];
    });
    if (links.length > 0) {
      await tx.assessmentCLOMapping.createMany({ data: links });
    }
  }
  return created.id;
}
