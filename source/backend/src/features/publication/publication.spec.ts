import { Prisma } from '../../generated/prisma/client.js';
import { escapeHtml, programPdfHtml } from './pdf/program-pdf.template.js';
import { snapshotOf } from './pdf/program-pdf-exports.service.js';
import {
  toCourseGraph,
  type PublicationVersion,
} from './publication-source.reader.js';
import type { TimelineEventDto } from './publication.dto.js';
import { compareEvents } from './version-timeline.reader.js';

const D = (value: number) => new Prisma.Decimal(value);

function item(
  id: string,
  semester: number,
  requisites: {
    sourceCourseId: string;
    relationType: string;
    code?: string;
  }[] = [],
) {
  return {
    id,
    courseId: `c-${id}`,
    plannedSemester: semester,
    sortOrder: 1,
    isElective: false,
    courseNameSnapshot: null,
    creditsSnapshot: null,
    electiveGroup: null,
    course: {
      id: `c-${id}`,
      courseCode: id.toUpperCase(),
      courseName: `Học phần ${id}`,
      credits: D(3),
      status: 'ACTIVE',
    },
    requisites: requisites.map((requisite, index) => ({
      id: `${id}-r${index}`,
      sourceCourseId: requisite.sourceCourseId,
      relationType: requisite.relationType,
      minScore: null,
      sourceCourse: {
        id: requisite.sourceCourseId,
        courseCode: requisite.code ?? requisite.sourceCourseId.toUpperCase(),
        courseName: 'Ngoài khung',
        credits: D(2),
      },
    })),
  };
}

function version(items: ReturnType<typeof item>[]): PublicationVersion {
  return {
    id: 'v1',
    program: { id: 'p1', programCode: 'CT1', facultyId: 'f' },
    programName: 'Chương trình <thử>',
    majorCode: 'M',
    majorName: 'Ngành',
    versionNumber: null,
    status: 'DRAFT',
    semesterCount: 8,
    totalCredits: D(9),
    compulsoryCredits: D(9),
    electiveCredits: D(0),
    decisionNumber: null,
    signedDate: null,
    effectiveSemester: null,
    electiveGroups: [],
    plos: [],
    curriculumItems: items,
  } as unknown as PublicationVersion;
}

describe('toCourseGraph (US-110)', () => {
  it('keeps version requisites, marks outside-frame sources external and drops replacements', () => {
    const graph = toCourseGraph(
      version([
        item('a', 1),
        item('b', 2, [
          { sourceCourseId: 'c-a', relationType: 'PREREQUISITE' },
          { sourceCourseId: 'x', relationType: 'PRIOR', code: 'NGOAI' },
          { sourceCourseId: 'c-a', relationType: 'REPLACEMENT' },
        ]),
      ]),
    );
    expect(
      graph.nodes.map((node) => [node.id, node.semester, node.external]),
    ).toEqual([
      ['item:a', 1, false],
      ['item:b', 2, false],
      ['course:x', null, true],
    ]);
    expect(
      graph.edges.map((edge) => [edge.source, edge.target, edge.relationType]),
    ).toEqual([
      ['item:a', 'item:b', 'PREREQUISITE'],
      ['course:x', 'item:b', 'PRIOR'],
    ]);
  });
});

describe('compareEvents (US-112)', () => {
  const event = (id: string, start: string | null, published: string | null) =>
    ({
      versionId: id,
      publishedAt: published,
      effectiveSemester: start ? { startDate: start } : null,
    }) as TimelineEventDto;

  it('orders by effective start, then publication, unknown start last', () => {
    const events = [
      event('c', null, '2020-01-01T00:00:00Z'),
      event('b', '2023-09-01', '2023-05-02T00:00:00Z'),
      event('a', '2023-09-01', '2023-05-01T00:00:00Z'),
      event('z', '2021-09-01', null),
    ].sort(compareEvents);
    expect(events.map((row) => row.versionId)).toEqual(['z', 'a', 'b', 'c']);
  });
});

describe('program PDF template (US-111)', () => {
  it('escapes every value and marks a Draft on the page', () => {
    expect(escapeHtml('<script>"x"&\'y\'')).toBe(
      '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;',
    );
    const snapshot = snapshotOf(
      version([item('a', 1)]),
      'ENGINEER',
      new Date(),
    );
    expect(snapshot).toMatchObject({ draft: true, degreeLevel: 'Kỹ sư' });
    expect(snapshot.semesters[0]).toMatchObject({ semester: 1, credits: '3' });
    const html = programPdfHtml(snapshot);
    expect(html).toContain('Chương trình &lt;thử&gt;');
    expect(html).not.toContain('<thử>');
    expect(html).toContain('class="draft">BẢN NHÁP');
    expect(html).not.toMatch(/<script|https?:\/\//);
  });
});
